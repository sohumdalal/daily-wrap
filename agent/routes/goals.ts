import { Hono } from 'hono';
import { z } from 'zod';
import { listGoals, upsertGoal, deleteGoal } from '../data/goals.ts';
import type { Goal } from '../types.ts';

export const goalRoutes = new Hono();

const upsertSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  metric: z.string().optional(),
  status: z.enum(['active', 'paused', 'achieved', 'archived']).default('active'),
});

goalRoutes.get('/', async (c) => {
  const goals = await listGoals();
  return c.json({ goals });
});

goalRoutes.post('/', async (c) => {
  const body = upsertSchema.parse(await c.req.json());
  const now = new Date().toISOString();
  const goal: Goal = {
    id: body.id ?? crypto.randomUUID(),
    title: body.title,
    description: body.description,
    metric: body.metric,
    status: body.status,
    createdAt: now,
    updatedAt: now,
  };
  const saved = await upsertGoal(goal);
  return c.json(saved);
});

goalRoutes.delete('/:id', async (c) => {
  await deleteGoal(c.req.param('id'));
  return c.json({ ok: true });
});
