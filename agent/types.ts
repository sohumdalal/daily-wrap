import type { Period } from './time.ts';

// ── Claude Code activity ───────────────────────────────────────────────────

export type ClaudeSession = {
  id: string;
  /** Claude's own generated title for the session — the best one-line summary. */
  title: string | null;
  /** Repo or directory the session ran in, shortened to a basename. */
  project: string | null;
  branches: string[];
  startedAt: string;
  endedAt: string;
  /** Summed turn durations, not wall-clock between first and last message. */
  activeMinutes: number;
  prompts: string[];
  models: string[];
  tools: Array<{ name: string; count: number }>;
};

export type ClaudePrompt = {
  at: string;
  project: string | null;
  text: string;
};

export type ClaudePrLink = {
  repo: string;
  number: number;
  url: string;
  at: string;
};

export type ClaudeDay = {
  sessions: ClaudeSession[];
  prompts: ClaudePrompt[];
  prs: ClaudePrLink[];
  totals: {
    sessions: number;
    prompts: number;
    assistantMessages: number;
    toolCalls: number;
    activeMinutes: number;
    costUsd: number | null;
    tokens: { input: number; output: number; cacheRead: number; cacheCreate: number };
  };
  models: string[];
  projects: string[];
};

// ── GitHub activity ────────────────────────────────────────────────────────

export type Commit = {
  repo: string;
  sha: string;
  message: string;
  url: string;
  at: string;
};

export type PullRequest = {
  repo: string;
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed' | 'merged';
  createdAt: string;
  mergedAt: string | null;
  additions: number | null;
  deletions: number | null;
};

export type ReviewedPullRequest = {
  repo: string;
  number: number;
  title: string;
  url: string;
  author: string;
  at: string;
};

export type GitHubDay = {
  commits: Commit[];
  opened: PullRequest[];
  merged: PullRequest[];
  reviewed: ReviewedPullRequest[];
  repos: string[];
  totals: {
    commits: number;
    opened: number;
    merged: number;
    reviewed: number;
    additions: number;
    deletions: number;
  };
};

/**
 * One clickable artifact behind a wrap. Derived from collected data only, so a
 * source is always something that really exists. `slack` is declared ahead of
 * the integration so the UI and ordering don't need changing when it lands.
 */
export type Source = {
  kind: 'merged' | 'opened' | 'reviewed' | 'commit' | 'slack';
  /** Short identity, e.g. `astropods/astro#2669`. */
  ref: string;
  label: string;
  url: string;
  at: string | null;
  /** Whose work it was, for something reviewed rather than authored. */
  author?: string;
};

// ── Stored records ─────────────────────────────────────────────────────────

export type DayRecord = {
  day: string;
  claude: ClaudeDay | null;
  github: GitHubDay | null;
  collectedAt: string | null;
};

/**
 * What the agent writes back.
 *
 * `did` is what happened. `learned` is the agent's own read on what this person
 * took from the period — a short paragraph, not bullets, because it is an
 * argument rather than a list, and it is the half of the record that sits
 * beside the reflection. `grew` stays terse: the distilled trajectory.
 *
 * `learned` and `grew` may be empty. A quiet day should read as a quiet day
 * rather than have growth invented for it.
 */
export type Wrap = {
  period: Period;
  key: string;
  headline: string;
  did: string[];
  /** 2–3 sentences. The agent's take, paired with the person's reflection. */
  learned: string;
  grew: string[];
  model: string | null;
  generatedAt: string;
};

/**
 * A correction the person made to something the agent wrote. Every wrap
 * written afterwards sees these, which is how the agent's read of them gets
 * less wrong over time.
 */
export type Feedback = {
  id: string;
  period: Period;
  key: string;
  note: string;
  createdAt: string;
};

export type Reflection = {
  period: Period;
  key: string;
  body: string;
  energy: number | null;
  updatedAt: string;
};
