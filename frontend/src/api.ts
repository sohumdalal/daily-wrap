import type { Goal, WeekSnapshot, ReadingEntry, Reflection } from './types';

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  currentWeekId: () =>
    req<{ isoWeek: string; start: string; end: string }>('/api/weeks/current'),
  listWeeks: () => req<{ weeks: string[] }>('/api/weeks/list'),
  getWeek: (isoWeek: string) => req<WeekSnapshot>(`/api/weeks/${isoWeek}`),
  refreshGithub: (isoWeek: string) =>
    req<WeekSnapshot>(`/api/weeks/${isoWeek}/refresh-github`, { method: 'POST' }),
  saveReflection: (isoWeek: string, body: Reflection) =>
    req<WeekSnapshot>(`/api/weeks/${isoWeek}/reflection`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  addReading: (
    isoWeek: string,
    body: { title: string; url?: string; takeaway?: string; notes?: string },
  ) =>
    req<WeekSnapshot>(`/api/weeks/${isoWeek}/reading`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  removeReading: (isoWeek: string, id: string) =>
    req<WeekSnapshot>(`/api/weeks/${isoWeek}/reading/${id}`, { method: 'DELETE' }),
  listGoals: () => req<{ goals: Goal[] }>('/api/goals'),
  saveGoal: (g: Partial<Goal>) =>
    req<Goal>('/api/goals', { method: 'POST', body: JSON.stringify(g) }),
  deleteGoal: (id: string) =>
    req<{ ok: true }>(`/api/goals/${id}`, { method: 'DELETE' }),
  generateReview: (
    isoWeek: string,
    body: { provider?: 'anthropic' | 'openai'; model?: string } = {},
  ) =>
    req<WeekSnapshot>(`/api/reviews/${isoWeek}/generate`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  ingestionRuns: () =>
    req<{
      runs: Array<{
        id: string;
        isoWeek: string;
        source: string;
        status: 'success' | 'failed' | 'running';
        startedAt: string;
        finishedAt: string | null;
        error: string | null;
      }>;
    }>('/api/ingestion/runs'),
  triggerIngestion: () =>
    req<{ ok: true }>('/api/ingestion/run', { method: 'POST' }),
};

export type { ReadingEntry, Goal, WeekSnapshot, Reflection };
