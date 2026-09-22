/**
 * Local dev launcher: `bun run dev`.
 */

import { loadLocalEnv } from './env.ts';

loadLocalEnv();
process.env.PORT ??= '3002';

await import('../agent/index.ts');
