/**
 * Dev server — runs the agent backend on the host with hot reload.
 *
 * Usage:
 *   Terminal 1: bun run dev                          (backend on :3002)
 *   Terminal 2: cd frontend && bun run dev           (Vite on :5173 with HMR)
 *
 * Open http://localhost:5173 in the browser.
 *
 * Loads project secrets from ~/.ast/project-configs.json (the Astropods CLI's
 * per-project env bag) if present, so you don't have to manage a separate .env.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PROJECT_NAME = 'mentor';

try {
  const configPath = join(homedir(), '.ast', 'project-configs.json');
  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));

  // `ast project configure` stores configs under `projects`, keyed by the
  // absolute project path, each entry shaped { name, vars }. Match this project
  // by its directory first, then fall back to the `name` field. (Also support a
  // flat name→{variables} map, in case of older/hand-written configs.)
  const projects = raw.projects ?? raw;
  const entry =
    projects[process.cwd()] ??
    Object.values(projects).find(
      (p): p is { name?: string; vars?: Record<string, unknown> } =>
        !!p &&
        typeof p === 'object' &&
        ((p as { name?: string }).name === PROJECT_NAME ||
          (p as { name?: string }).name === `@sohumdalal/${PROJECT_NAME}`),
    ) ??
    projects[PROJECT_NAME];

  const vars = entry?.vars ?? entry?.variables;
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      if (typeof value === 'string' && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
} catch {
  // no ast config — fall back to .env or shell env
}

process.env.PORT ??= '3002';
process.env.DATA_ROOT ??= join(process.cwd(), 'data');
process.env.APP_URL ??= 'http://localhost:5173';

// Local Postgres (Homebrew on macOS). In prod, Astropods injects these via the
// postgres knowledge provider declared in astropods.yml.
process.env.POSTGRES_HOST ??= 'localhost';
process.env.POSTGRES_PORT ??= '5432';
process.env.POSTGRES_DB ??= 'mentor';
process.env.POSTGRES_USER ??= process.env.USER ?? 'postgres';
process.env.POSTGRES_PASSWORD ??= '';

await import('../agent/index.ts');
