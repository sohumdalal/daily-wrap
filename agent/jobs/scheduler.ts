import { runScheduledIngestion } from './ingestion.ts';

const HOURS = 60 * 60 * 1000;
const INGESTION_INTERVAL_MS = 6 * HOURS;

let interval: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  // Initial pass — fires shortly after boot so we don't block startup
  setTimeout(() => {
    runScheduledIngestion().catch((e) =>
      console.warn('[scheduler] initial ingestion failed:', e),
    );
  }, 10_000);

  interval = setInterval(() => {
    runScheduledIngestion().catch((e) =>
      console.warn('[scheduler] periodic ingestion failed:', e),
    );
  }, INGESTION_INTERVAL_MS);
  if (interval.unref) interval.unref();

  console.log(
    `[scheduler] github ingestion every ${INGESTION_INTERVAL_MS / HOURS}h`,
  );
}

export function stopScheduler(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
