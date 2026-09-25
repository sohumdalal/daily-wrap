/**
 * Slack ingestion, by reaction.
 *
 * React :brain: to a message and it becomes feedback on the day you reacted.
 * The platform does the hard part: `actionable_reactions` in astropods.yml
 * decides which emoji are forwarded, and the Slack adapter fetches the reacted
 * message's text before handing it over, so nothing here needs a Slack token
 * or a Slack app of its own.
 *
 * The sidecar only exists when the agent is deployed with messaging enabled,
 * or locally under `ast project start`. Plain `bun run dev` has none, so every
 * failure here is logged and dropped: the screen and the wraps must work
 * whether or not Slack is connected.
 */

import { connect } from 'node:net';
import { MessagingClient, type AgentResponse, type Message } from '@astropods/messaging';
import { config } from './config.ts';
import * as store from './store.ts';
import { dayOf } from './time.ts';

const SIDECAR = process.env.MESSAGING_ADDRESS ?? 'localhost:9090';

/**
 * Is anything actually listening?
 *
 * A gRPC channel connects lazily, so `connectWithRetry` succeeds against a
 * closed port and the stream then reconnects forever. `bun run dev` has no
 * sidecar, which is the common case, and an endless retry loop would bury the
 * nightly log. One TCP probe settles it.
 */
async function sidecarPresent(address: string): Promise<boolean> {
  const [host, port] = address.split(':');
  return new Promise((resolve) => {
    const socket = connect({ host: host || 'localhost', port: Number(port ?? 9090) });
    const settle = (present: boolean) => {
      socket.destroy();
      resolve(present);
    };
    socket.setTimeout(700);
    socket.once('connect', () => settle(true));
    socket.once('timeout', () => settle(false));
    socket.once('error', () => settle(false));
  });
}

/**
 * The adapter prefixes the reacted text with a line naming the emoji and the
 * person who reacted. Parsing it back gives the original message on its own,
 * which is what belongs in the record.
 */
const REACTION_HEADER = /^\[reaction :([^:]+): added by <@([^>]+)> on message\]\n?/;

function parseReaction(content: string): { emoji: string; reactor: string; text: string } | null {
  const match = content.match(REACTION_HEADER);
  if (!match) return null;
  return {
    emoji: match[1]!,
    reactor: match[2]!,
    text: content.slice(match[0].length).trim(),
  };
}

/** A link to the message, which Slack builds from the channel and the ts. */
function permalink(workspace: string, channelId: string, messageTs: string): string {
  if (!workspace || !channelId || !messageTs) return '';
  return `https://${workspace}.slack.com/archives/${channelId}/p${messageTs.replace('.', '')}`;
}

/**
 * Connect to the sidecar and capture reactions. Returns without throwing when
 * there is no sidecar to talk to.
 */
export async function startSlackIngestion(): Promise<void> {
  if (!(await sidecarPresent(SIDECAR))) {
    console.log(`[slack] no messaging sidecar at ${SIDECAR} — reaction capture off`);
    return;
  }

  let client: MessagingClient;
  try {
    client = new MessagingClient(SIDECAR);
    await client.connectWithRetry({ maxRetries: 5 });
  } catch (err) {
    console.log(
      `[slack] could not reach the sidecar at ${SIDECAR} — reaction capture off ` +
        `(${err instanceof Error ? err.message : String(err)})`,
    );
    return;
  }

  const conversation = client.createConversationStream();
  console.log(`[slack] listening for :brain: reactions via ${SIDECAR}`);

  // A dropped stream is worth one line, not one per attempt.
  conversation.on('error', (err: Error) =>
    console.error('[slack] stream gave up:', err.message),
  );

  // The sidecar pushes inbound events as AgentResponse.incomingMessage on the
  // same bidirectional stream the agent writes replies to.
  conversation.on('response', (resp: AgentResponse) => {
    const message = resp.incomingMessage;
    if (message) void handleReaction(message);
  });

  async function handleReaction(message: Message): Promise<void> {
    const ctx = message.platformContext ?? ({} as NonNullable<Message['platformContext']>);
    // Everything else the sidecar forwards is somebody talking to a chat bot,
    // which this agent is not.
    if (ctx.eventKind !== 'EVENT_KIND_REACTION') return;

    const parsed = parseReaction(message.content ?? '');
    if (!parsed || !parsed.text) {
      console.warn('[slack] reaction arrived with no readable message text');
      return;
    }

    try {
      const saved = await store.addSlackFeedback({
        // The day it was noticed, not the day the message was written: this is
        // an input to today's wrap.
        day: dayOf(new Date(), config.timezone),
        channelId: ctx.channelId ?? '',
        channelName: ctx.channelName ?? '',
        messageTs: ctx.messageId ?? '',
        threadRoot: ctx.threadRootId ?? '',
        reactorId: message.user?.id ?? parsed.reactor,
        emoji: parsed.emoji,
        text: parsed.text,
        permalink: permalink(ctx.workspaceId ?? '', ctx.channelId ?? '', ctx.messageId ?? ''),
      });

      console.log(
        `[slack] captured :${saved.emoji}: from ${saved.channelName || saved.channelId}`,
      );

      // Acknowledge in the thread, so reacting has a visible result.
      if (message.conversationId) {
        conversation.sendContentChunk(message.conversationId, {
          type: 'END',
          content: `Saved to your Daily Wrap feedback for ${saved.day}.`,
        });
      }
    } catch (err) {
      console.error('[slack] could not store the reaction:', err);
    }
  }
}
