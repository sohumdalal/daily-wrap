import { Hono } from 'hono';
import { config } from '../config.ts';
import { ping } from '../db/client.ts';
import { lastSuccess } from '../db/ingestion.ts';

export const healthRoutes = new Hono();

healthRoutes.get('/health', (c) =>
  c.json({ ok: true, time: new Date().toISOString() }),
);

healthRoutes.get('/api/health/config', async (c) => {
  const db = await ping();
  const lastGh = db ? await lastSuccess('github').catch(() => null) : null;
  return c.json({
    db,
    github: {
      configured: Boolean(config.github.token && config.github.username),
      username: config.github.username || null,
      lastIngestion: lastGh ? lastGh.startedAt : null,
    },
    llm: {
      anthropic: Boolean(config.llm.anthropicKey),
      openai: Boolean(config.llm.openaiKey),
      defaultProvider: config.llm.provider,
    },
  });
});
