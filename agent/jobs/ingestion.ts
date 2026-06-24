import { fetchWeekActivity } from '../github/client.ts';
import { setGithub } from '../data/weeks.ts';
import { rangeForWeekId, currentWeek, previousWeeks } from '../data/dates.ts';
import { startRun, finishRun, lastSuccess } from '../db/ingestion.ts';
import { config } from '../config.ts';

/**
 * Pull GitHub activity for a given ISO week and save the snapshot.
 * Records the attempt in ingestion_runs regardless of outcome.
 */
export async function ingestGithubWeek(
  isoWeek: string,
  userId: string = 'default',
): Promise<{ ok: boolean; error?: string }> {
  const runId = await startRun(isoWeek, 'github', userId);
  try {
    const range = rangeForWeekId(isoWeek);
    const activity = await fetchWeekActivity(range.startIso, range.endIso);
    await setGithub(isoWeek, activity, userId);
    await finishRun(runId, 'success');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    await finishRun(runId, 'failed', msg);
    console.warn(`[ingestion] github ${isoWeek} failed: ${msg}`);
    return { ok: false, error: msg };
  }
}

/**
 * Decide which weeks need ingestion right now and run them.
 *
 * Strategy:
 *  - Always refresh the current week (so the dashboard stays fresh through Sunday).
 *  - Refresh last week IF we haven't successfully ingested it yet (catches the
 *    case where the agent was offline at week boundary).
 */
export async function runScheduledIngestion(
  userId: string = 'default',
): Promise<void> {
  if (!config.github.token || !config.github.username) {
    console.log('[ingestion] skipping — github not configured');
    return;
  }

  const current = currentWeek();
  await ingestGithubWeek(current.isoWeek, userId);

  const [last] = previousWeeks(1);
  if (last) {
    const success = await lastSuccess('github', userId);
    const hasLast = success && success.isoWeek === last.isoWeek;
    if (!hasLast) {
      await ingestGithubWeek(last.isoWeek, userId);
    }
  }
}
