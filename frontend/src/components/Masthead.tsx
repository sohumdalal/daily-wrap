import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';

type Props = {
  isoWeek: string;
  weekRange: { start: string; end: string } | null;
  weeks: string[];
  onSelectWeek: (id: string) => void;
};

const TODAY = format(new Date(), "EEEE, MMMM d, yyyy");

export function Masthead({ isoWeek, weekRange, weeks, onSelectWeek }: Props) {
  const [year, week] = isoWeek.split('-W');
  const currentIndex = weeks.indexOf(isoWeek);
  const hasPrev = currentIndex >= 0 && currentIndex < weeks.length - 1;
  const hasNext = currentIndex > 0;

  const range = useMemo(() => {
    if (!weekRange) return '—';
    const s = parseISO(weekRange.start);
    const e = parseISO(weekRange.end);
    const sameMonth = s.getMonth() === e.getMonth();
    return sameMonth
      ? `${format(s, 'MMM d')} – ${format(e, 'd, yyyy')}`
      : `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`;
  }, [weekRange]);

  return (
    <header className="relative border-b border-ink">
      {/* Top dateline strip */}
      <div className="border-b border-rule">
        <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-3 flex items-baseline justify-between text-[0.65rem] font-mono uppercase tracking-[0.22em] text-muted-2">
          <span>Mentor · A Weekly Engineering Log</span>
          <span className="hidden md:inline">{TODAY}</span>
          <span className="md:hidden">{format(new Date(), 'EEE, MMM d')}</span>
        </div>
      </div>

      {/* Main masthead */}
      <div className="mx-auto max-w-[1100px] px-6 lg:px-10 pt-12 lg:pt-16 pb-8">
        <div className="flex items-end justify-between gap-6 mb-2">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-2">
            Vol. {year}
          </span>
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-2">
            № {week}
          </span>
        </div>

        <h1 className="font-display text-[3.5rem] sm:text-[4.8rem] lg:text-[6rem] leading-[0.92] tracking-[-0.02em] text-ink text-center">
          MENTOR
        </h1>

        <p className="font-display italic text-center text-[1.15rem] lg:text-[1.4rem] leading-snug text-muted-2 mt-3 max-w-2xl mx-auto">
          Field notes from the engineering desk — pull requests, dispatches,
          and matters of growth, gathered weekly.
        </p>

        {/* Date band */}
        <div className="mt-10 rule-double" />
        <div className="grid grid-cols-3 gap-4 py-4 items-center">
          <div className="flex items-center gap-2">
            <button
              onClick={() => hasPrev && onSelectWeek(weeks[currentIndex + 1]!)}
              disabled={!hasPrev}
              className="btn-ghost"
              aria-label="Previous week"
            >
              <span aria-hidden>←</span>
              <span>PREV</span>
            </button>
          </div>
          <div className="text-center">
            <div className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-2">
              Edition
            </div>
            <div className="font-display text-2xl lg:text-3xl tracking-tight mt-0.5">
              {range}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <select
              className="select-paper"
              value={isoWeek}
              onChange={(e) => onSelectWeek(e.target.value)}
            >
              {weeks.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <button
              onClick={() => hasNext && onSelectWeek(weeks[currentIndex - 1]!)}
              disabled={!hasNext}
              className="btn-ghost"
              aria-label="Next week"
            >
              <span>NEXT</span>
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>
        <div className="rule-double" />
      </div>
    </header>
  );
}
