import { Hono } from 'hono';
import { currentWeek, rangeForWeekId } from '../data/dates.ts';
import { getWeek, setGithub, listSavedWeeks } from '../data/weeks.ts';
import { fetchWeekActivity } from '../github/client.ts';

export const weekRoutes = new Hono();

weekRoutes.get('/current', (c) => {
  const range = currentWeek();
  return c.json({ isoWeek: range.isoWeek, start: range.startIso, end: range.endIso });
});

weekRoutes.get('/list', async (c) => {
  const ids = await listSavedWeeks();
  return c.json({ weeks: ids });
});

weekRoutes.get('/:isoWeek', async (c) => {
  const isoWeek = c.req.param('isoWeek');
  const week = await getWeek(isoWeek);
  return c.json(week);
});

weekRoutes.post('/:isoWeek/refresh-github', async (c) => {
  const isoWeek = c.req.param('isoWeek');
  const range = rangeForWeekId(isoWeek);
  try {
    const activity = await fetchWeekActivity(range.startIso, range.endIso);
    const week = await setGithub(isoWeek, activity);
    return c.json(week);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return c.json({ error: msg }, 500);
  }
});
