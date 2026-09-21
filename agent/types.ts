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

// ── Stored records ─────────────────────────────────────────────────────────

export type DayRecord = {
  day: string;
  claude: ClaudeDay | null;
  github: GitHubDay | null;
  collectedAt: string | null;
};

/**
 * What the agent writes back. `did` is what happened; `learned` and `grew` are
 * the point of the whole exercise. All three may be empty — a quiet day should
 * read as a quiet day rather than have growth invented for it.
 */
export type Wrap = {
  period: Period;
  key: string;
  headline: string;
  did: string[];
  learned: string[];
  grew: string[];
  model: string | null;
  generatedAt: string;
};

export type Reflection = {
  period: Period;
  key: string;
  body: string;
  energy: number | null;
  updatedAt: string;
};
