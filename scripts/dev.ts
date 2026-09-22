/**
 * Local dev launcher — `bun run dev`.
 *
 * Loads project secrets from ~/.ast/project-configs.json (the Astropods CLI's
 * per-project env bag) if present, so there's no separate .env to maintain.
 * Anything already in the shell environment wins.
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT_NAMES = ['daily-wrap', '@sohumdalal/daily-wrap'];

// Precedence: real shell environment, then the live `gh` credential, then the
// ast project bag. Noting what the shell actually set has to happen before the
// bag is merged in, since merging makes the two indistinguishable.
const fromShell = new Set(Object.keys(process.env));

try {
  const raw = JSON.parse(
    readFileSync(join(homedir(), '.ast', 'project-configs.json'), 'utf-8'),
  );
  // `ast project configure` stores configs under `projects`, keyed by absolute
  // project path, each entry shaped { name, vars }. Match this directory
  // first, then fall back to the name. (Also tolerate a flat name→{variables}
  // map, for older or hand-written configs.)
  const projects = raw.projects ?? raw;
  const entry =
    projects[process.cwd()] ??
    Object.values(projects).find(
      (p): p is { name?: string; vars?: Record<string, unknown> } =>
        !!p && typeof p === 'object' && PROJECT_NAMES.includes((p as { name?: string }).name ?? ''),
    ) ??
    PROJECT_NAMES.map((n) => projects[n]).find(Boolean);

  const vars = entry?.vars ?? entry?.variables;
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      if (typeof value === 'string' && !process.env[key]) process.env[key] = value;
    }
  }
} catch {
  // No ast config — fall back to the shell environment.
}

// `gh` holds a live token; the ast bag holds whatever was pasted into it once,
// which goes stale and then fails as `Bad credentials`. So `gh` overrides the
// bag — but never a GITHUB_TOKEN the shell set deliberately.
if (!fromShell.has('GITHUB_TOKEN')) {
  const gh = Bun.spawnSync(['gh', 'auth', 'token']);
  const token = gh.exitCode === 0 ? gh.stdout.toString().trim() : '';
  if (token) process.env.GITHUB_TOKEN = token;
}

process.env.PORT ??= '3002';
process.env.GITHUB_USERNAME ??= 'sohumdalal';

// Local Postgres (Homebrew on macOS). In production the `daily-wrap-db`
// knowledge entry declared in astropods.yml injects these.
process.env.POSTGRES_HOST ??= 'localhost';
process.env.POSTGRES_PORT ??= '5432';
process.env.POSTGRES_DB ??= 'daily_wrap';
process.env.POSTGRES_USER ??= process.env.USER ?? 'postgres';
process.env.POSTGRES_PASSWORD ??= '';

await import('../agent/index.ts');
