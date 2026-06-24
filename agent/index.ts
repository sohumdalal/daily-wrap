import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { cors } from 'hono/cors';
import { config, isDev } from './config.ts';
import { ping } from './db/client.ts';
import { runMigrations } from './db/migrations.ts';
import { startScheduler } from './jobs/scheduler.ts';
import { healthRoutes } from './routes/health.ts';
import { weekRoutes } from './routes/week.ts';
import { goalRoutes } from './routes/goals.ts';
import { reflectionRoutes } from './routes/reflection.ts';
import { reviewRoutes } from './routes/review.ts';
import { ingestionRoutes } from './routes/ingestion.ts';

const app = new Hono();

app.onError((err, c) => {
  console.error('[error]', err);
  const msg = err instanceof Error ? err.message : 'internal error';
  return c.json({ error: msg }, 500);
});

if (isDev) {
  app.use(
    '/api/*',
    cors({
      origin: ['http://localhost:5173', 'http://localhost:5174'],
      credentials: true,
    }),
  );
}

app.route('/', healthRoutes);
app.route('/api/weeks', weekRoutes);
app.route('/api/goals', goalRoutes);
app.route('/api/weeks', reflectionRoutes);
app.route('/api/reviews', reviewRoutes);
app.route('/api/ingestion', ingestionRoutes);

if (isDev) {
  app.get('/', (c) => c.redirect('http://localhost:5173/'));
} else {
  app.use('/*', serveStatic({ root: './frontend/dist' }));
  app.get('/*', serveStatic({ root: './frontend/dist', path: 'index.html' }));
}

// Bind the HTTP server FIRST so the platform's port-80 ingress comes up
// immediately. DB problems must never block binding or crash the process —
// otherwise the pod crash-loops and the served frontend link never resolves.
Bun.serve({
  port: config.port,
  fetch: app.fetch,
  idleTimeout: 30,
});

console.log(`Mentor listening on :${config.port}`);

// Initialize the database in the background. Failures are logged, not fatal —
// a slow or unreachable Postgres can't take down the served frontend.
void (async () => {
  try {
    const reachable = await ping();
    if (!reachable) {
      console.warn(
        '[db] could not reach postgres on first ping — will keep retrying lazily',
      );
      return;
    }
    await runMigrations();
    startScheduler();
  } catch (err) {
    console.error('[boot] database initialization failed:', err);
  }
})();
