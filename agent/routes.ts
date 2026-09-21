/**
 * The whole API. Eight routes.
 *
 *   GET  /healthz
 *   GET  /api/state                     what's configured, and today's date here
 *   GET  /api/view/:period/:key         everything the screen needs for one key
 *   POST /api/view/:period/:key/collect re-read Claude + GitHub for the day
 *   POST /api/view/:period/:key/wrap    write the wrap
 *   PUT  /api/reflection/:period/:key   save the reflection
 *   GET  /api/index/:period             keys that have something on them
 */

import { Hono } from 'hono';
import { config, readiness } from './config.ts';
import { fetchClaudeDay } from './sources/claude.ts';
import { fetchGitHubDay } from './sources/github.ts';
import * as store from './store.ts';
import {
  isKeyFor,
  isPeriod,
  keyFor,
  labelFor,
  spanOf,
  today,
  type Period,
} from './time.ts';
import { hasActivity, writeDayWrap, writeRollup } from './wrap.ts';
import type { ClaudeDay, GitHubDay } from './types.ts';

export const routes = new Hono();

/** Parse and validate the `:period/:key` pair every view route shares. */
function target(period: string, key: string): { period: Period; key: string } | null {
  if (!isPeriod(period) || !isKeyFor(period, key)) return null;
  return { period, key };
}

routes.get('/healthz', (c) => c.json({ ok: true }));

routes.get('/api/state', (c) =>
  c.json({ ...readiness(), today: today(config.timezone) }),
);

/**
 * Read both sources for one day and store the result. Either source failing is
 * reported rather than thrown — a missing GitHub token should not stop the
 * Claude half of the day from being recorded.
 */
async function collectDay(day: string): Promise<{
  claude: ClaudeDay | null;
  github: GitHubDay | null;
  errors: string[];
}> {
  const errors: string[] = [];

  const [claude, github] = await Promise.all([
    fetchClaudeDay(day, { home: config.claude.home, timezone: config.timezone }).catch(
      (err: unknown) => {
        errors.push(`claude: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      },
    ),
    config.github.token && config.github.username
      ? fetchGitHubDay(day, {
          token: config.github.token,
          username: config.github.username,
          timezone: config.timezone,
        }).catch((err: unknown) => {
          errors.push(`github: ${err instanceof Error ? err.message : String(err)}`);
          return null;
        })
      : Promise.resolve(null),
  ]);

  // Keep whatever came back, even partially — a stored half-day beats nothing.
  const stored = await store.saveDay(day, claude, github);
  return { claude: stored.claude, github: stored.github, errors };
}

/** Everything the screen renders for one period key. */
async function view(period: Period, key: string) {
  const span = spanOf(period, key);
  const [wrap, reflection] = await Promise.all([
    store.getWrap(period, key),
    store.getReflection(period, key),
  ]);

  const base = {
    period,
    key,
    label: labelFor(period, key),
    span,
    wrap,
    reflection,
  };

  if (period === 'day') {
    const record = await store.getDay(key);
    return {
      ...base,
      claude: record?.claude ?? null,
      github: record?.github ?? null,
      collectedAt: record?.collectedAt ?? null,
      // A rollup needs days beneath it; a day needs nothing.
      coveredDays: null,
    };
  }

  const dayWraps = await store.getWrapsBetween('day', span.from, span.to);
  return {
    ...base,
    claude: null,
    github: null,
    collectedAt: null,
    coveredDays: dayWraps.map((w) => ({ key: w.key, headline: w.headline })),
  };
}

routes.get('/api/view/:period/:key', async (c) => {
  const t = target(c.req.param('period'), c.req.param('key'));
  if (!t) return c.json({ error: 'bad period or key' }, 400);
  return c.json(await view(t.period, t.key));
});

routes.post('/api/view/:period/:key/collect', async (c) => {
  const t = target(c.req.param('period'), c.req.param('key'));
  if (!t) return c.json({ error: 'bad period or key' }, 400);
  if (t.period !== 'day') {
    return c.json({ error: 'only a day can be collected' }, 400);
  }
  const { errors } = await collectDay(t.key);
  return c.json({ ...(await view(t.period, t.key)), errors });
});

routes.post('/api/view/:period/:key/wrap', async (c) => {
  const t = target(c.req.param('period'), c.req.param('key'));
  if (!t) return c.json({ error: 'bad period or key' }, 400);
  if (!readiness().llm) {
    return c.json({ error: 'ANTHROPIC_API_KEY is not configured' }, 400);
  }

  if (t.period !== 'day') {
    const wrap = await writeRollup(t.period, t.key);
    return c.json({ ...(await view(t.period, t.key)), wrap, errors: [] });
  }

  // Always re-read the sources first: the day is usually still in progress.
  const { claude, github, errors } = await collectDay(t.key);
  if (!hasActivity(claude, github)) {
    return c.json({ ...(await view(t.period, t.key)), errors, empty: true });
  }

  const reflection = await store.getReflection('day', t.key);
  const wrap = await writeDayWrap({ day: t.key, claude, github, reflection });
  return c.json({ ...(await view(t.period, t.key)), wrap, errors });
});

routes.put('/api/reflection/:period/:key', async (c) => {
  const t = target(c.req.param('period'), c.req.param('key'));
  if (!t) return c.json({ error: 'bad period or key' }, 400);

  const body = (await c.req.json().catch(() => ({}))) as {
    body?: unknown;
    energy?: unknown;
  };
  const text = typeof body.body === 'string' ? body.body : '';
  const energyNum = Number(body.energy);
  const energy =
    Number.isInteger(energyNum) && energyNum >= 1 && energyNum <= 5 ? energyNum : null;

  const reflection = await store.saveReflection(t.period, t.key, text, energy);
  return c.json({ reflection });
});

routes.get('/api/index/:period', async (c) => {
  const period = c.req.param('period');
  if (!isPeriod(period)) return c.json({ error: 'bad period' }, 400);
  const keys = await store.listKeys(period);
  return c.json({
    period,
    // Today's key always appears, so the screen has somewhere to start.
    keys: [...new Set([keyFor(period, today(config.timezone)), ...keys])].sort().reverse(),
  });
});
