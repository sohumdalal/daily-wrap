import postgres from 'postgres';

/**
 * Postgres connection.
 *
 * Astropods injects discrete fields for a Postgres knowledge store —
 * POSTGRES_HOST / PORT / USER / PASSWORD / DB — and deliberately not a URL
 * (Redis, Qdrant and Neo4j get a _URL; Postgres does not). POSTGRES_URL is
 * still honoured first because a hosted provider like Neon or Supabase hands
 * you one, and that is the shape you want when pointing this laptop at the
 * same shared store the deployed agent uses.
 */

let _sql: postgres.Sql | null = null;

function sql(): postgres.Sql {
  if (_sql) return _sql;

  const options = {
    max: 8,
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => {},
  } as const;

  const url = process.env.POSTGRES_URL;
  _sql = url
    ? postgres(url, options)
    : postgres({
        host: process.env.POSTGRES_HOST ?? 'localhost',
        port: Number(process.env.POSTGRES_PORT ?? 5432),
        database: process.env.POSTGRES_DB ?? 'daily_wrap',
        username: process.env.POSTGRES_USER ?? 'postgres',
        password: process.env.POSTGRES_PASSWORD ?? 'postgres',
        ...options,
      });
  return _sql;
}

export function db(): postgres.Sql {
  return sql();
}

export async function ping(): Promise<boolean> {
  try {
    await sql()`select 1`;
    return true;
  } catch {
    return false;
  }
}

export async function shutdown(): Promise<void> {
  if (_sql) {
    await _sql.end({ timeout: 5 });
    _sql = null;
  }
}
