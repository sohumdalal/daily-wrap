/**
 * Every read and write against Postgres. Nothing else in the agent issues SQL.
 */

import { db } from './db/client.ts';
import type { Period } from './time.ts';
import type { ClaudeDay, DayRecord, GitHubDay, Reflection, Wrap } from './types.ts';

/** Single-user today, but every row is tagged so that needn't stay true. */
const USER = 'default';

type DayRow = {
  day: Date;
  claude: ClaudeDay | null;
  github: GitHubDay | null;
  collected_at: Date | null;
};

function toDay(row: DayRow): DayRecord {
  return {
    day: row.day.toISOString().slice(0, 10),
    claude: row.claude,
    github: row.github,
    collectedAt: row.collected_at?.toISOString() ?? null,
  };
}

export async function getDay(day: string): Promise<DayRecord | null> {
  const rows = await db()<DayRow[]>`
    SELECT day, claude, github, collected_at
      FROM days
     WHERE user_id = ${USER} AND day = ${day}
  `;
  return rows[0] ? toDay(rows[0]) : null;
}

export async function getDays(from: string, to: string): Promise<DayRecord[]> {
  const rows = await db()<DayRow[]>`
    SELECT day, claude, github, collected_at
      FROM days
     WHERE user_id = ${USER} AND day BETWEEN ${from} AND ${to}
     ORDER BY day
  `;
  return rows.map(toDay);
}

export async function saveDay(
  day: string,
  claude: ClaudeDay | null,
  github: GitHubDay | null,
): Promise<DayRecord> {
  const rows = await db()<DayRow[]>`
    INSERT INTO days (day, user_id, claude, github, collected_at)
    VALUES (${day}, ${USER}, ${db().json(claude)}, ${db().json(github)}, now())
    ON CONFLICT (day, user_id) DO UPDATE
       SET claude = EXCLUDED.claude,
           github = EXCLUDED.github,
           collected_at = EXCLUDED.collected_at
    RETURNING day, claude, github, collected_at
  `;
  return toDay(rows[0]!);
}

type WrapRow = {
  period: Period;
  key: string;
  headline: string;
  did: string[];
  learned: string[];
  grew: string[];
  model: string | null;
  generated_at: Date;
};

function toWrap(row: WrapRow): Wrap {
  return {
    period: row.period,
    key: row.key,
    headline: row.headline,
    did: row.did ?? [],
    learned: row.learned ?? [],
    grew: row.grew ?? [],
    model: row.model,
    generatedAt: row.generated_at.toISOString(),
  };
}

export async function getWrap(period: Period, key: string): Promise<Wrap | null> {
  const rows = await db()<WrapRow[]>`
    SELECT period, key, headline, did, learned, grew, model, generated_at
      FROM wraps
     WHERE user_id = ${USER} AND period = ${period} AND key = ${key}
  `;
  return rows[0] ? toWrap(rows[0]) : null;
}

/** Wraps of one period whose keys fall in `[from, to]`, oldest first. */
export async function getWrapsBetween(
  period: Period,
  from: string,
  to: string,
): Promise<Wrap[]> {
  const rows = await db()<WrapRow[]>`
    SELECT period, key, headline, did, learned, grew, model, generated_at
      FROM wraps
     WHERE user_id = ${USER} AND period = ${period} AND key BETWEEN ${from} AND ${to}
     ORDER BY key
  `;
  return rows.map(toWrap);
}

export async function saveWrap(
  wrap: Omit<Wrap, 'generatedAt'>,
): Promise<Wrap> {
  const sql = db();
  const rows = await sql<WrapRow[]>`
    INSERT INTO wraps (period, key, user_id, headline, did, learned, grew, model, generated_at)
    VALUES (
      ${wrap.period}, ${wrap.key}, ${USER}, ${wrap.headline},
      ${sql.json(wrap.did)}, ${sql.json(wrap.learned)}, ${sql.json(wrap.grew)},
      ${wrap.model}, now()
    )
    ON CONFLICT (period, key, user_id) DO UPDATE
       SET headline = EXCLUDED.headline,
           did = EXCLUDED.did,
           learned = EXCLUDED.learned,
           grew = EXCLUDED.grew,
           model = EXCLUDED.model,
           generated_at = EXCLUDED.generated_at
    RETURNING period, key, headline, did, learned, grew, model, generated_at
  `;
  return toWrap(rows[0]!);
}

type ReflectionRow = {
  period: Period;
  key: string;
  body: string;
  energy: number | null;
  updated_at: Date;
};

function toReflection(row: ReflectionRow): Reflection {
  return {
    period: row.period,
    key: row.key,
    body: row.body,
    energy: row.energy,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getReflection(
  period: Period,
  key: string,
): Promise<Reflection | null> {
  const rows = await db()<ReflectionRow[]>`
    SELECT period, key, body, energy, updated_at
      FROM reflections
     WHERE user_id = ${USER} AND period = ${period} AND key = ${key}
  `;
  return rows[0] ? toReflection(rows[0]) : null;
}

export async function getReflectionsBetween(
  period: Period,
  from: string,
  to: string,
): Promise<Reflection[]> {
  const rows = await db()<ReflectionRow[]>`
    SELECT period, key, body, energy, updated_at
      FROM reflections
     WHERE user_id = ${USER} AND period = ${period} AND key BETWEEN ${from} AND ${to}
       AND body <> ''
     ORDER BY key
  `;
  return rows.map(toReflection);
}

export async function saveReflection(
  period: Period,
  key: string,
  body: string,
  energy: number | null,
): Promise<Reflection> {
  const rows = await db()<ReflectionRow[]>`
    INSERT INTO reflections (period, key, user_id, body, energy, updated_at)
    VALUES (${period}, ${key}, ${USER}, ${body}, ${energy}, now())
    ON CONFLICT (period, key, user_id) DO UPDATE
       SET body = EXCLUDED.body,
           energy = EXCLUDED.energy,
           updated_at = EXCLUDED.updated_at
    RETURNING period, key, body, energy, updated_at
  `;
  return toReflection(rows[0]!);
}

/**
 * Period keys that already hold a wrap or a reflection — what the UI's index
 * lists, so you can navigate to days that have something on them.
 */
export async function listKeys(period: Period, limit = 400): Promise<string[]> {
  const rows = await db()<{ key: string }[]>`
    SELECT key FROM wraps       WHERE user_id = ${USER} AND period = ${period}
    UNION
    SELECT key FROM reflections WHERE user_id = ${USER} AND period = ${period} AND body <> ''
    ORDER BY key DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => r.key);
}
