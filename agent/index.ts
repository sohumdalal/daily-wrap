import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { config, isDev } from './config.ts';
import { describeTarget, ping } from './db/client.ts';
import { runMigrations } from './db/migrations.ts';
import { routes } from './routes.ts';

const app = new Hono();

app.onError((err, c) => {
  console.error('[error]', err);
  return c.json({ error: err instanceof Error ? err.message : 'internal error' }, 500);
});

app.route('/', routes);

// The screen is three static files. No build step, no bundler, no framework.
app.use('/*', serveStatic({ root: './agent/ui' }));
app.get('/', serveStatic({ root: './agent/ui', path: 'index.html' }));

// Bind the HTTP server FIRST so the platform's port-80 ingress comes up
// immediately. Database problems must never block binding or crash the
// process — otherwise the pod crash-loops and the URL never resolves.
Bun.serve({
  port: config.port,
  fetch: app.fetch,
  // Writing a wrap is one or two model calls and can run past 30s on a dense
  // day — and a retry after a schema miss doubles it. At 30s the connection was
  // dropped mid-generation with no error on either side, which made the busiest
  // days the ones that could never be wrapped.
  idleTimeout: 180,
});

console.log(
  `Daily Wrap on :${config.port} — ${config.timezone}` +
    ` — db ${describeTarget()}${isDev ? ' (dev)' : ''}`,
);

// Initialize the database in the background with retry/backoff. The Postgres
// knowledge container often isn't accepting connections at the instant the
// agent boots, so a single ping isn't enough — retry until reachable, THEN run
// migrations. (A one-shot ping leaves the schema uncreated once Postgres comes
// up, surfacing later as `relation ... does not exist`.) Failures are logged,
// never fatal — the screen stays up throughout and reports what's missing.
void (async () => {
  const maxDelayMs = 30_000;
  let delayMs = 1_000;
  for (let attempt = 1; ; attempt++) {
    if (await ping()) {
      try {
        await runMigrations();
        console.log('[db] connected — migrations applied');
      } catch (err) {
        console.error('[boot] database initialization failed after connect:', err);
      }
      return;
    }
    console.warn(`[db] postgres unreachable (attempt ${attempt}) — retrying in ${delayMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(delayMs * 2, maxDelayMs);
  }
})();
