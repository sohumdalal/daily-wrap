import { db } from './client.ts';

/**
 * Bring the schema to current. Idempotent — safe to call on every boot.
 * Migrations are append-only; never edit an existing migration, add a new one.
 */
const MIGRATIONS: Array<{ id: string; sql: string }> = [
  {
    id: '0001_init',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id          TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS goals (
        id          UUID PRIMARY KEY,
        user_id     TEXT NOT NULL DEFAULT 'default',
        title       TEXT NOT NULL,
        description TEXT,
        metric      TEXT,
        status      TEXT NOT NULL DEFAULT 'active',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS goals_user_status ON goals(user_id, status);

      CREATE TABLE IF NOT EXISTS week_snapshots (
        iso_week    TEXT NOT NULL,
        user_id     TEXT NOT NULL DEFAULT 'default',
        start_at    TIMESTAMPTZ NOT NULL,
        end_at      TIMESTAMPTZ NOT NULL,
        github      JSONB,
        reflection  JSONB,
        reading     JSONB NOT NULL DEFAULT '[]'::jsonb,
        review      JSONB,
        saved_at    TIMESTAMPTZ,
        PRIMARY KEY (iso_week, user_id)
      );

      CREATE TABLE IF NOT EXISTS ingestion_runs (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     TEXT NOT NULL DEFAULT 'default',
        iso_week    TEXT NOT NULL,
        source      TEXT NOT NULL,
        status      TEXT NOT NULL,
        started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        finished_at TIMESTAMPTZ,
        error       TEXT
      );
      CREATE INDEX IF NOT EXISTS ingestion_runs_user_week
        ON ingestion_runs(user_id, iso_week, started_at DESC);
    `,
  },
];

export async function runMigrations(): Promise<void> {
  const sql = db();

  // Bootstrap migrations table — needs to exist before we can query it
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const applied = await sql<{ id: string }[]>`SELECT id FROM schema_migrations`;
  const appliedSet = new Set(applied.map((r) => r.id));

  for (const m of MIGRATIONS) {
    if (appliedSet.has(m.id)) continue;
    console.log(`[migrations] applying ${m.id}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(m.sql);
      await tx`INSERT INTO schema_migrations (id) VALUES (${m.id})`;
    });
  }
}
