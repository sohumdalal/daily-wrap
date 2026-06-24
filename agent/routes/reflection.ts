import { Hono } from 'hono';
import { z } from 'zod';
import { setReflection, addReading, removeReading } from '../data/weeks.ts';

export const reflectionRoutes = new Hono();

const reflectionSchema = z.object({
  energy: z.number().int().min(1).max(5),
  wins: z.string().default(''),
  blockers: z.string().default(''),
  surprises: z.string().default(''),
  notes: z.string().optional(),
});

reflectionRoutes.put('/:isoWeek/reflection', async (c) => {
  const isoWeek = c.req.param('isoWeek');
  const body = reflectionSchema.parse(await c.req.json());
  const week = await setReflection(isoWeek, body);
  return c.json(week);
});

const readingSchema = z.object({
  title: z.string().min(1),
  url: z.string().url().optional(),
  notes: z.string().optional(),
  takeaway: z.string().optional(),
});

reflectionRoutes.post('/:isoWeek/reading', async (c) => {
  const isoWeek = c.req.param('isoWeek');
  const body = readingSchema.parse(await c.req.json());
  const week = await addReading(isoWeek, {
    id: crypto.randomUUID(),
    title: body.title,
    url: body.url,
    notes: body.notes,
    takeaway: body.takeaway,
    addedAt: new Date().toISOString(),
  });
  return c.json(week);
});

reflectionRoutes.delete('/:isoWeek/reading/:id', async (c) => {
  const week = await removeReading(c.req.param('isoWeek'), c.req.param('id'));
  return c.json(week);
});
