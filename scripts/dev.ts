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
  const allConfigs = JSON.parse(readFileSync(configPath, 'utf-8'));
  const projectConfig = allConfigs[PROJECT_NAME];
  if (projectConfig?.variables) {
    for (const [key, value] of Object.entries(projectConfig.variables)) {
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
