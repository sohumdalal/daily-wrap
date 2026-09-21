import postgres from 'postgres';

/**
 * Postgres connection. On Astropods the `daily-wrap-db` knowledge entry
 * injects POSTGRES_URL (plus _HOST and _PORT); locally the discrete vars are
 * easier to point at a Homebrew install.
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
