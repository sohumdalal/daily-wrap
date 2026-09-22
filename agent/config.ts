import { homedir } from 'node:os';
import { join } from 'node:path';
import { describeTarget, targetIsLocal } from './db/client.ts';

/**
 * Env → config. Every value here is either injected by Astropods (see the
 * `models`/`integrations`/`knowledge` blocks in astropods.yml) or declared as
 * an `agent.inputs` entry there.
 */

const DEFAULT_MODEL = 'claude-sonnet-5';

/**
 * Display names people actually type or pick from a dropdown, mapped to real
 * model ids. Configuring this agent by hand or through a deploy form makes
 * `Sonnet` or `Opus 5` far likelier than `claude-sonnet-5`, and the API answers
 * a display name with a flat 401/404 that looks like a bad key.
 */
const MODEL_ALIASES: Record<string, string> = {
  opus: 'claude-opus-5',
  'opus-5': 'claude-opus-5',
  sonnet: 'claude-sonnet-5',
  'sonnet-5': 'claude-sonnet-5',
  haiku: 'claude-haiku-4-5',
  'haiku-4-5': 'claude-haiku-4-5',
  fable: 'claude-fable-5-1',
  'fable-5-1': 'claude-fable-5-1',
};

function resolveModel(raw: string): string {
  const value = raw.trim();
  if (!value) return DEFAULT_MODEL;
  // A real id passes through untouched, so a model released later still works.
  if (value.startsWith('claude-')) return value;

  const key = value.toLowerCase().replace(/[\s_.]+/g, '-');
  const alias = MODEL_ALIASES[key];
  if (alias) return alias;

  console.warn(
    `[config] ANTHROPIC_MODEL="${raw}" is not a known model id or alias — ` +
      `falling back to ${DEFAULT_MODEL}`,
  );
  return DEFAULT_MODEL;
}

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
    model: resolveModel(process.env.ANTHROPIC_MODEL ?? ''),
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
    database: describeTarget(),
    databaseIsLocal: targetIsLocal(),
  };
}
