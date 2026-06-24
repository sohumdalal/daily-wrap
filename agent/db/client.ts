import postgres from 'postgres';

let _sql: postgres.Sql | null = null;

function sql(): postgres.Sql {
  if (_sql) return _sql;
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = Number(process.env.POSTGRES_PORT ?? 5432);
  const database = process.env.POSTGRES_DB ?? 'mentor';
  const username = process.env.POSTGRES_USER ?? 'postgres';
  const password = process.env.POSTGRES_PASSWORD ?? 'postgres';

  _sql = postgres({
    host,
    port,
    database,
    username,
    password,
    max: 8,
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => {},
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
