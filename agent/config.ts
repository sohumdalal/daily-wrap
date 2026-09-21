import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Env → config. Every value here is either injected by Astropods (see the
 * `models`/`integrations`/`knowledge` blocks in astropods.yml) or declared as
 * an `agent.inputs` entry there.
 */

const systemTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const config = {
  port: Number(process.env.PORT ?? 80),
  /** Defines where one day ends and the next begins. Never UTC by accident. */
  timezone: process.env.TIMEZONE || systemTimezone(),
  github: {
    token: process.env.GITHUB_TOKEN ?? '',
    username: process.env.GITHUB_USERNAME ?? '',
  },
  claude: {
    /** Claude Code home to read days out of. Read-only, never written to. */
    home: process.env.CLAUDE_HOME || join(homedir(), '.claude'),
  },
  llm: {
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
  },
};

export const isDev = config.port !== 80;

/** What the agent can and cannot do right now, for the UI to report honestly. */
export function readiness() {
  return {
    timezone: config.timezone,
    github: Boolean(config.github.token && config.github.username),
    claudeHome: config.claude.home,
    llm: Boolean(config.llm.anthropicKey),
    model: config.llm.model,
  };
}
