import { useEffect, useState, useCallback } from 'react';
import { api } from './api';
import type { Goal, WeekSnapshot } from './types';
import { Masthead } from './components/Masthead';
import { Ledger } from './components/Ledger';
import { Circulation } from './components/Circulation';
import { GoalsSection } from './components/GoalsSection';
import { ReflectionSection } from './components/ReflectionSection';
import { ReadingRoom } from './components/ReadingRoom';
import { Editorial } from './components/Editorial';
import { Loading } from './components/Loading';
import { ConfigStatus } from './components/ConfigStatus';

export function App() {
  const [isoWeek, setIsoWeek] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [week, setWeek] = useState<WeekSnapshot | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    (async () => {
      const [current, list, goalsRes] = await Promise.all([
        api.currentWeekId(),
        api.listWeeks(),
        api.listGoals(),
      ]);
      const all = Array.from(
        new Set([current.isoWeek, ...list.weeks]),
      ).sort().reverse();
      setWeeks(all);
      setIsoWeek(current.isoWeek);
      setGoals(goalsRes.goals);
      setBooted(true);
    })().catch((e) => {
      console.error(e);
      setBooted(true);
    });
  }, []);

  useEffect(() => {
    if (!isoWeek) return;
    setWeek(null);
    (async () => {
      const w = await api.getWeek(isoWeek);
      setWeek(w);
    })().catch(console.error);
  }, [isoWeek]);

  const reloadGoals = useCallback(async () => {
    const r = await api.listGoals();
    setGoals(r.goals);
  }, []);

  if (!booted || !isoWeek) return <Loading />;

  return (
    <div className="min-h-screen">
      <ConfigStatus />
      <Masthead
        isoWeek={isoWeek}
        weekRange={week ? { start: week.start, end: week.end } : null}
        weeks={weeks}
        onSelectWeek={setIsoWeek}
      />
      <main className="mx-auto max-w-[1100px] px-6 lg:px-10 pb-32 fade-up">
        <Ledger
          isoWeek={isoWeek}
          week={week}
          onUpdated={(w) => setWeek(w)}
        />
        <Circulation week={week} />
        <GoalsSection goals={goals} onChange={reloadGoals} />
        <ReflectionSection
          isoWeek={isoWeek}
          week={week}
          onUpdated={(w) => setWeek(w)}
        />
        <ReadingRoom
          isoWeek={isoWeek}
          week={week}
          onUpdated={(w) => setWeek(w)}
        />
        <Editorial
          isoWeek={isoWeek}
          week={week}
          onUpdated={(w) => setWeek(w)}
        />

        <footer className="mt-32 pt-8 border-t border-ink">
          <div className="flex items-baseline justify-between font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-2">
            <span>— End of edition —</span>
            <span>Set in Instrument Serif, Inter & JetBrains Mono</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
