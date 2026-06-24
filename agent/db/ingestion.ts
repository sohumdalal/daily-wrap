import { db } from './client.ts';

export type IngestionStatus = 'success' | 'failed' | 'running';
export type IngestionSource = 'github' | 'slack';

export type IngestionRun = {
  id: string;
  userId: string;
  isoWeek: string;
  source: IngestionSource;
  status: IngestionStatus;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
};

type Row = {
  id: string;
  user_id: string;
  iso_week: string;
  source: string;
  status: string;
  started_at: Date;
  finished_at: Date | null;
  error: string | null;
};

function toRun(r: Row): IngestionRun {
  return {
    id: r.id,
    userId: r.user_id,
    isoWeek: r.iso_week,
    source: r.source as IngestionSource,
    status: r.status as IngestionStatus,
    startedAt: r.started_at.toISOString(),
    finishedAt: r.finished_at ? r.finished_at.toISOString() : null,
    error: r.error,
  };
}

export async function startRun(
  isoWeek: string,
  source: IngestionSource,
  userId: string = 'default',
): Promise<string> {
  const sql = db();
  const rows = await sql<{ id: string }[]>`
    INSERT INTO ingestion_runs (user_id, iso_week, source, status)
    VALUES (${userId}, ${isoWeek}, ${source}, 'running')
    RETURNING id
  `;
  return rows[0]!.id;
}

export async function finishRun(
  id: string,
  status: IngestionStatus,
  error?: string,
): Promise<void> {
  const sql = db();
  await sql`
    UPDATE ingestion_runs
    SET status = ${status}, finished_at = now(), error = ${error ?? null}
    WHERE id = ${id}
  `;
}

export async function recentRuns(
  limit = 20,
  userId: string = 'default',
): Promise<IngestionRun[]> {
  const sql = db();
  const rows = await sql<Row[]>`
    SELECT * FROM ingestion_runs
    WHERE user_id = ${userId}
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;
  return rows.map(toRun);
}

export async function lastSuccess(
  source: IngestionSource,
  userId: string = 'default',
): Promise<IngestionRun | null> {
  const sql = db();
  const rows = await sql<Row[]>`
    SELECT * FROM ingestion_runs
    WHERE user_id = ${userId} AND source = ${source} AND status = 'success'
    ORDER BY started_at DESC
    LIMIT 1
  `;
  return rows[0] ? toRun(rows[0]) : null;
}
