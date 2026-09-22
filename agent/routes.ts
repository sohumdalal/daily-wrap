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
import { mergeSources, sourcesForDay } from './sources/links.ts';
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
import { hasActivity, NoDaysToRollUp, writeDayWrap, writeRollup } from './wrap.ts';
import type { Goal } from './types.ts';
import {
  GOAL_CATEGORIES,
  GOAL_HORIZONS,
  GOAL_STATUSES,
  type ClaudeDay,
  type GitHubDay,
} from './types.ts';

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
    feedback: await store.getFeedback(period, key),
  };

  if (period === 'day') {
    const record = await store.getDay(key);
    return {
      ...base,
      claude: record?.claude ?? null,
      github: record?.github ?? null,
      collectedAt: record?.collectedAt ?? null,
      sources: sourcesForDay(record?.claude ?? null, record?.github ?? null),
      // A rollup needs days beneath it; a day needs nothing.
      coveredDays: null,
    };
  }

  const [dayWraps, days] = await Promise.all([
    store.getWrapsBetween('day', span.from, span.to),
    store.getDays(span.from, span.to),
  ]);
  return {
    ...base,
    claude: null,
    github: null,
    collectedAt: null,
    // A period's sources are every day's, deduped — the same PR reviewed twice
    // in a week is one link.
    sources: mergeSources(days.map((d) => sourcesForDay(d.claude, d.github))),
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
    try {
      const wrap = await writeRollup(t.period, t.key);
      return c.json({ ...(await view(t.period, t.key)), wrap, errors: [] });
    } catch (err) {
      // Nothing wrapped underneath yet is a state of the record, not a fault.
      if (err instanceof NoDaysToRollUp) {
        return c.json({ ...(await view(t.period, t.key)), empty: true, errors: [] }, 200);
      }
      throw err;
    }
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

/**
 * Disagree with a wrap. The note is kept and shown to every later generation,
 * then this key is rewritten immediately so the correction is visible at once
 * rather than only affecting tomorrow.
 */
routes.post('/api/view/:period/:key/disagree', async (c) => {
  const t = target(c.req.param('period'), c.req.param('key'));
  if (!t) return c.json({ error: 'bad period or key' }, 400);

  const body = (await c.req.json().catch(() => ({}))) as { note?: unknown };
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (!note) return c.json({ error: 'say what was wrong about it' }, 400);
  if (note.length > 2000) return c.json({ error: 'note is too long' }, 400);

  await store.addFeedback(t.period, t.key, note);

  if (!readiness().llm) {
    // The note is safely stored; it will apply whenever a key is next written.
    return c.json({ ...(await view(t.period, t.key)), errors: [] });
  }

  try {
    if (t.period === 'day') {
      const record = await store.getDay(t.key);
      if (!hasActivity(record?.claude ?? null, record?.github ?? null)) {
        return c.json({ ...(await view(t.period, t.key)), empty: true, errors: [] });
      }
      await writeDayWrap({
        day: t.key,
        claude: record?.claude ?? null,
        github: record?.github ?? null,
        reflection: await store.getReflection('day', t.key),
      });
    } else {
      await writeRollup(t.period, t.key);
    }
  } catch (err) {
    if (!(err instanceof NoDaysToRollUp)) throw err;
    return c.json({ ...(await view(t.period, t.key)), empty: true, errors: [] });
  }

  return c.json({ ...(await view(t.period, t.key)), errors: [] });
});

// ── Goals ──────────────────────────────────────────────────────────────────

type GoalPatch = Partial<
  Pick<Goal, 'title' | 'category' | 'horizon' | 'why' | 'measure' | 'status' | 'sort'>
>;

routes.get('/api/goals', async (c) => c.json({ goals: await store.listGoals() }));

/**
 * Read a goal payload. An absent field falls back to a default; a field that is
 * present but invalid is an error. Coercing a misspelled category to 'career'
 * would silently discard what the caller actually said.
 */
function readGoalBody(
  body: Record<string, unknown>,
): { bad: string } | { ok: GoalPatch } {
  const patch: GoalPatch = {};
  const bad: string[] = [];

  const str = (name: 'title' | 'why' | 'measure', max: number): void => {
    const value = body[name];
    if (value === undefined) return;
    if (typeof value !== 'string') bad.push(name);
    else patch[name] = value.trim().slice(0, max);
  };

  const oneOf = <K extends 'category' | 'horizon' | 'status'>(
    name: K,
    allowed: readonly string[],
  ): void => {
    const value = body[name];
    if (value === undefined) return;
    if (typeof value !== 'string' || !allowed.includes(value)) {
      bad.push(`${name} must be one of ${allowed.join(', ')}`);
      return;
    }
    patch[name] = value as GoalPatch[K];
  };

  str('title', 200);
  str('why', 1000);
  str('measure', 300);
  oneOf('category', GOAL_CATEGORIES);
  oneOf('horizon', GOAL_HORIZONS);
  oneOf('status', GOAL_STATUSES);

  if (body.sort !== undefined) {
    if (typeof body.sort === 'number' && Number.isInteger(body.sort)) {
      patch.sort = body.sort;
    } else {
      bad.push('sort must be an integer');
    }
  }

  return bad.length ? { bad: bad.join('; ') } : { ok: patch };
}

routes.post('/api/goals', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const read = readGoalBody(body);
  if ('bad' in read) return c.json({ error: read.bad }, 400);
  if (!read.ok.title) return c.json({ error: 'a goal needs a title' }, 400);

  const goal = await store.createGoal({
    title: read.ok.title,
    category: read.ok.category ?? 'career',
    horizon: read.ok.horizon ?? 'year',
    why: read.ok.why ?? '',
    measure: read.ok.measure ?? '',
  });
  return c.json({ goal });
});

routes.patch('/api/goals/:id', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const read = readGoalBody(body);
  if ('bad' in read) return c.json({ error: read.bad }, 400);
  if (read.ok.title !== undefined && !read.ok.title) {
    return c.json({ error: 'a goal needs a title' }, 400);
  }
  const goal = await store.updateGoal(c.req.param('id'), read.ok);
  if (!goal) return c.json({ error: 'no such goal' }, 404);
  return c.json({ goal });
});

routes.delete('/api/goals/:id', async (c) => {
  const gone = await store.deleteGoal(c.req.param('id'));
  if (!gone) return c.json({ error: 'no such goal' }, 404);
  return c.json({ ok: true });
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
