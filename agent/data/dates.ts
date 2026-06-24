import {
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
  endOfISOWeek,
  subWeeks,
  parseISO,
  formatISO,
} from 'date-fns';

export type WeekRange = {
  isoWeek: string; // "2026-W25"
  year: number;
  week: number;
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
};

export function weekId(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function rangeForDate(date: Date): WeekRange {
  const start = startOfISOWeek(date);
  const end = endOfISOWeek(date);
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return {
    isoWeek: weekId(year, week),
    year,
    week,
    start,
    end,
    startIso: formatISO(start),
    endIso: formatISO(end),
  };
}

export function currentWeek(): WeekRange {
  return rangeForDate(new Date());
}

export function previousWeeks(count: number): WeekRange[] {
  const out: WeekRange[] = [];
  const now = new Date();
  for (let i = 1; i <= count; i++) {
    out.push(rangeForDate(subWeeks(now, i)));
  }
  return out;
}

export function rangeForWeekId(id: string): WeekRange {
  // Accept "YYYY-Www" — convert by finding any date in that ISO week
  const match = id.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) throw new Error(`Invalid week id: ${id}`);
  const year = Number(match[1]);
  const week = Number(match[2]);
  // ISO week 1 contains Jan 4. Walk forward from Jan 4 by (week - 1) weeks.
  const jan4 = parseISO(`${year}-01-04`);
  const offsetMs = (week - 1) * 7 * 24 * 60 * 60 * 1000;
  return rangeForDate(new Date(jan4.getTime() + offsetMs));
}
