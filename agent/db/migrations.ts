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
    `,
  },
  {
    // Daily Wrap replaces Mentor's weekly model. The old tables held nothing
    // worth carrying across — goals, ISO-week snapshots and a reading log, all
    // superseded by per-day records and period wraps.
    id: '0002_daily_wrap',
    sql: `
      DROP TABLE IF EXISTS goals;
      DROP TABLE IF EXISTS week_snapshots;
      DROP TABLE IF EXISTS ingestion_runs;

      -- One row per civil day, holding the raw material a wrap is written from.
      CREATE TABLE IF NOT EXISTS days (
        day          DATE NOT NULL,
        user_id      TEXT NOT NULL DEFAULT 'default',
        claude       JSONB,
        github       JSONB,
        collected_at TIMESTAMPTZ,
        PRIMARY KEY (day, user_id)
      );

      -- What the agent wrote, for any period. "did" is what happened;
      -- "learned" and "grew" are the point of keeping the record at all.
      CREATE TABLE IF NOT EXISTS wraps (
        period       TEXT NOT NULL CHECK (period IN ('day','week','month','year')),
        key          TEXT NOT NULL,
        user_id      TEXT NOT NULL DEFAULT 'default',
        headline     TEXT NOT NULL DEFAULT '',
        did          JSONB NOT NULL DEFAULT '[]'::jsonb,
        learned      JSONB NOT NULL DEFAULT '[]'::jsonb,
        grew         JSONB NOT NULL DEFAULT '[]'::jsonb,
        model        TEXT,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (period, key, user_id)
      );
      CREATE INDEX IF NOT EXISTS wraps_period_key ON wraps(user_id, period, key DESC);

      -- What you wrote. Keyed the same way as wraps, so a week or a year can
      -- carry a reflection of its own.
      CREATE TABLE IF NOT EXISTS reflections (
        period     TEXT NOT NULL CHECK (period IN ('day','week','month','year')),
        key        TEXT NOT NULL,
        user_id    TEXT NOT NULL DEFAULT 'default',
        body       TEXT NOT NULL DEFAULT '',
        energy     SMALLINT CHECK (energy IS NULL OR energy BETWEEN 1 AND 5),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (period, key, user_id)
      );
      CREATE INDEX IF NOT EXISTS reflections_period_key
        ON reflections(user_id, period, key DESC);
    `,
  },
  {
    // "learned" became a paragraph rather than a list: it is the agent's read
    // on the period, and it sits beside the person's own reflection. Existing
    // rows hold arrays, so join them instead of discarding them.
    //
    // "feedback" is the correction channel. Disagreeing with a wrap records a
    // note here, and every later generation is shown these notes — so the
    // agent's read gets less wrong over time instead of being wrong the same
    // way forever.
    id: '0003_learned_paragraph_and_feedback',
    sql: `
      UPDATE wraps
         SET learned = to_jsonb(
               (SELECT string_agg(item, ' ')
                  FROM jsonb_array_elements_text(learned) AS item)
             )
       WHERE jsonb_typeof(learned) = 'array';

      UPDATE wraps SET learned = '""'::jsonb WHERE learned IS NULL;

      CREATE TABLE IF NOT EXISTS feedback (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    TEXT NOT NULL DEFAULT 'default',
        period     TEXT NOT NULL CHECK (period IN ('day','week','month','year')),
        key        TEXT NOT NULL,
        note       TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS feedback_recent
        ON feedback(user_id, created_at DESC);
    `,
  },
  {
    // Goals are an input to every generated wrap, not a separate tracker. The
    // point of "where to improve" is that it is measured against what this
    // person is actually trying to become, which the day's diffs cannot say.
    //
    // "why" holds the intrinsic anchor — the reason the goal matters to them.
    // Career goals without it drift into someone else's ladder.
    id: '0004_goals',
    sql: `
      CREATE TABLE IF NOT EXISTS goals (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    TEXT NOT NULL DEFAULT 'default',
        title      TEXT NOT NULL,
        category   TEXT NOT NULL DEFAULT 'career'
                   CHECK (category IN ('career','craft','impact','personal','intrinsic')),
        horizon    TEXT NOT NULL DEFAULT 'year'
                   CHECK (horizon IN ('quarter','year','long')),
        why        TEXT NOT NULL DEFAULT '',
        measure    TEXT NOT NULL DEFAULT '',
        status     TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','paused','achieved','dropped')),
        sort       INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS goals_active
        ON goals(user_id, status, category, sort);
    `,
  },
];

export async function runMigrations(): Promise<void> {
  const sql = db();

  // Bootstrap the ledger before we can query which migrations have run.
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const applied = await sql<{ id: string }[]>`SELECT id FROM schema_migrations`;
  const appliedIds = new Set(applied.map((r) => r.id));

  for (const m of MIGRATIONS) {
    if (appliedIds.has(m.id)) continue;
    console.log(`[migrations] applying ${m.id}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(m.sql);
      await tx`INSERT INTO schema_migrations (id) VALUES (${m.id})`;
    });
  }
}
