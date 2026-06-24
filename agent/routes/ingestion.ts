import { Hono } from 'hono';
import { recentRuns } from '../db/ingestion.ts';
import { runScheduledIngestion, ingestGithubWeek } from '../jobs/ingestion.ts';

export const ingestionRoutes = new Hono();

ingestionRoutes.get('/runs', async (c) => {
  const runs = await recentRuns(30);
  return c.json({ runs });
});

ingestionRoutes.post('/run', async (c) => {
  // Fire and forget — runs in background, surface progress via /runs
  runScheduledIngestion().catch((e) =>
    console.warn('[ingestion] manual run failed:', e),
  );
  return c.json({ ok: true, message: 'ingestion started' });
});

ingestionRoutes.post('/run/:isoWeek', async (c) => {
  const isoWeek = c.req.param('isoWeek');
  const res = await ingestGithubWeek(isoWeek);
  return c.json(res);
});
