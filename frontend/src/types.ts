export type Goal = {
  id: string;
  title: string;
  description?: string;
  metric?: string;
  status: 'active' | 'paused' | 'achieved' | 'archived';
  createdAt: string;
  updatedAt: string;
};

export type Reflection = {
  energy: number;
  wins: string;
  blockers: string;
  surprises: string;
  notes?: string;
};

export type ReadingEntry = {
  id: string;
  title: string;
  url?: string;
  notes?: string;
  takeaway?: string;
  addedAt: string;
};

export type PR = {
  number: number;
  title: string;
  repo: string;
  url: string;
  state: 'open' | 'closed' | 'merged';
  createdAt: string;
  mergedAt?: string;
  additions?: number;
  deletions?: number;
};

export type ReviewedPR = {
  number: number;
  title: string;
  repo: string;
  url: string;
  reviewedAt: string;
  author: string;
};

export type GitHubActivity = {
  prsOpened: PR[];
  prsMerged: PR[];
  prsReviewed: ReviewedPR[];
  reposTouched: string[];
  languages: Record<string, number>;
  totals: {
    opened: number;
    merged: number;
    reviewed: number;
    additions: number;
    deletions: number;
  };
};

export type GoalScore = {
  goalId: string;
  goalTitle: string;
  score: number;
  reason: string;
};

export type WeeklyReview = {
  provider: 'anthropic' | 'openai';
  model: string;
  generatedAt: string;
  body: string;
  goalScores: GoalScore[];
  strengths: string[];
  adjustments: string[];
  focusNextWeek: string;
};

export type WeekSnapshot = {
  isoWeek: string;
  start: string;
  end: string;
  github: GitHubActivity | null;
  reflection: Reflection | null;
  reading: ReadingEntry[];
  review: WeeklyReview | null;
  savedAt: string | null;
};
