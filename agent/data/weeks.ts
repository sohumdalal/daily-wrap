import { db } from '../db/client.ts';
import { rangeForWeekId } from './dates.ts';
import type {
  WeekSnapshot,
  Reflection,
  ReadingEntry,
  GitHubActivity,
  WeeklyReview,
} from '../types.ts';

const DEFAULT_USER = 'default';

type Row = {
  iso_week: string;
  user_id: string;
  start_at: Date;
  end_at: Date;
  github: GitHubActivity | null;
  reflection: Reflection | null;
  reading: ReadingEntry[];
  review: WeeklyReview | null;
  saved_at: Date | null;
};

function toSnapshot(r: Row): WeekSnapshot {
  return {
    isoWeek: r.iso_week,
    start: r.start_at.toISOString(),
    end: r.end_at.toISOString(),
    github: r.github,
    reflection: r.reflection,
    reading: r.reading ?? [],
    review: r.review,
    savedAt: r.saved_at ? r.saved_at.toISOString() : null,
  };
}

function emptySnapshot(isoWeek: string): WeekSnapshot {
  const range = rangeForWeekId(isoWeek);
  return {
    isoWeek,
    start: range.startIso,
    end: range.endIso,
    github: null,
    reflection: null,
    reading: [],
    review: null,
    savedAt: null,
  };
}

export async function getWeek(
  isoWeek: string,
  userId: string = DEFAULT_USER,
): Promise<WeekSnapshot> {
  const sql = db();
  const rows = await sql<Row[]>`
    SELECT * FROM week_snapshots
    WHERE iso_week = ${isoWeek} AND user_id = ${userId}
  `;
  if (!rows[0]) return emptySnapshot(isoWeek);
  return toSnapshot(rows[0]);
}

async function ensureRow(
  isoWeek: string,
  userId: string,
): Promise<void> {
  const sql = db();
  const range = rangeForWeekId(isoWeek);
  await sql`
    INSERT INTO week_snapshots (iso_week, user_id, start_at, end_at)
    VALUES (${isoWeek}, ${userId}, ${range.startIso}, ${range.endIso})
    ON CONFLICT (iso_week, user_id) DO NOTHING
  `;
}

export async function setGithub(
  isoWeek: string,
  github: GitHubActivity,
  userId: string = DEFAULT_USER,
): Promise<WeekSnapshot> {
  const sql = db();
  await ensureRow(isoWeek, userId);
  await sql`
    UPDATE week_snapshots
    SET github = ${sql.json(github)}, saved_at = now()
    WHERE iso_week = ${isoWeek} AND user_id = ${userId}
  `;
  return getWeek(isoWeek, userId);
}

export async function setReflection(
  isoWeek: string,
  reflection: Reflection,
  userId: string = DEFAULT_USER,
): Promise<WeekSnapshot> {
  const sql = db();
  await ensureRow(isoWeek, userId);
  await sql`
    UPDATE week_snapshots
    SET reflection = ${sql.json(reflection)}, saved_at = now()
    WHERE iso_week = ${isoWeek} AND user_id = ${userId}
  `;
  return getWeek(isoWeek, userId);
}

export async function addReading(
  isoWeek: string,
  entry: ReadingEntry,
  userId: string = DEFAULT_USER,
): Promise<WeekSnapshot> {
  const sql = db();
  await ensureRow(isoWeek, userId);
  await sql`
    UPDATE week_snapshots
    SET reading = COALESCE(reading, '[]'::jsonb) || ${sql.json([entry])}::jsonb,
        saved_at = now()
    WHERE iso_week = ${isoWeek} AND user_id = ${userId}
  `;
  return getWeek(isoWeek, userId);
}

export async function removeReading(
  isoWeek: string,
  id: string,
  userId: string = DEFAULT_USER,
): Promise<WeekSnapshot> {
  const week = await getWeek(isoWeek, userId);
  const sql = db();
  const next = week.reading.filter((r) => r.id !== id);
  await sql`
    UPDATE week_snapshots
    SET reading = ${sql.json(next)}, saved_at = now()
    WHERE iso_week = ${isoWeek} AND user_id = ${userId}
  `;
  return getWeek(isoWeek, userId);
}

export async function setReview(
  isoWeek: string,
  review: WeeklyReview,
  userId: string = DEFAULT_USER,
): Promise<WeekSnapshot> {
  const sql = db();
  await ensureRow(isoWeek, userId);
  await sql`
    UPDATE week_snapshots
    SET review = ${sql.json(review)}, saved_at = now()
    WHERE iso_week = ${isoWeek} AND user_id = ${userId}
  `;
  return getWeek(isoWeek, userId);
}

export async function listSavedWeeks(
  userId: string = DEFAULT_USER,
): Promise<string[]> {
  const sql = db();
  const rows = await sql<{ iso_week: string }[]>`
    SELECT iso_week FROM week_snapshots
    WHERE user_id = ${userId}
    ORDER BY iso_week DESC
  `;
  return rows.map((r) => r.iso_week);
}

export async function recentWeeks(
  count: number,
  userId: string = DEFAULT_USER,
): Promise<WeekSnapshot[]> {
  const sql = db();
  const rows = await sql<Row[]>`
    SELECT * FROM week_snapshots
    WHERE user_id = ${userId}
    ORDER BY iso_week DESC
    LIMIT ${count}
  `;
  return rows.map(toSnapshot);
}
