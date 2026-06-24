import { Hono } from 'hono';
import { z } from 'zod';
import { generateWeeklyReview } from '../llm/review.ts';
import { setReview } from '../data/weeks.ts';

export const reviewRoutes = new Hono();

const generateSchema = z.object({
  provider: z.enum(['anthropic', 'openai']).optional(),
  model: z.string().optional(),
});

reviewRoutes.post('/:isoWeek/generate', async (c) => {
  const isoWeek = c.req.param('isoWeek');
  const body = generateSchema.parse(await c.req.json().catch(() => ({})));
  try {
    const review = await generateWeeklyReview(isoWeek, body);
    const week = await setReview(isoWeek, review);
    return c.json(week);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return c.json({ error: msg }, 500);
  }
});
