import { useEffect, useState } from 'react';
import { Section } from './Section';
import { api } from '../api';
import type { WeekSnapshot, Reflection } from '../types';

type Props = {
  isoWeek: string;
  week: WeekSnapshot | null;
  onUpdated: (w: WeekSnapshot) => void;
};

const EMPTY: Reflection = { energy: 3, wins: '', blockers: '', surprises: '', notes: '' };

export function ReflectionSection({ isoWeek, week, onUpdated }: Props) {
  const [form, setForm] = useState<Reflection>(week?.reflection ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(week?.reflection ?? EMPTY);
  }, [week?.reflection, week?.isoWeek]);

  const save = async () => {
    setBusy(true);
    setSaved(false);
    try {
      const w = await api.saveReflection(isoWeek, form);
      onUpdated(w);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      number="IV"
      eyebrow="Letters Home"
      title="A note from the desk."
      subtitle="How the week felt, before forgetting."
      action={
        <div className="flex flex-col gap-2 items-start">
          <button onClick={save} disabled={busy} className="btn-ink">
            {busy ? 'Filing…' : 'Save reflection'}
          </button>
          {saved && (
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-accent-cool-2 pulse-mark">
              ✓ Filed
            </span>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-8">
        {/* Energy meter */}
        <div className="border-y border-ink py-6">
          <div className="flex items-baseline justify-between mb-4">
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-2">
              Energy across the week
            </span>
            <span className="font-display text-2xl tabular">
              {form.energy}<span className="text-muted-2 text-lg">/5</span>
            </span>
          </div>
          <EnergyBar
            value={form.energy}
            onChange={(energy) => setForm((f) => ({ ...f, energy }))}
          />
          <div className="grid grid-cols-5 mt-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-2">
            <span>flat</span>
            <span className="text-center">low</span>
            <span className="text-center">steady</span>
            <span className="text-center">good</span>
            <span className="text-right">soaring</span>
          </div>
        </div>

        {/* Three textareas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Field
            label="Wins"
            tone="cool"
            value={form.wins}
            onChange={(v) => setForm((f) => ({ ...f, wins: v }))}
            placeholder="What landed, what felt good."
          />
          <Field
            label="Blockers"
            tone="warm"
            value={form.blockers}
            onChange={(v) => setForm((f) => ({ ...f, blockers: v }))}
            placeholder="What slowed it down."
          />
          <Field
            label="Surprises"
            value={form.surprises}
            onChange={(v) => setForm((f) => ({ ...f, surprises: v }))}
            placeholder="What you didn't see coming."
          />
        </div>

        <Field
          label="Loose notes"
          value={form.notes ?? ''}
          onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
          placeholder="Anything else worth recording. Optional."
        />
      </div>
    </Section>
  );
}

function Field({
  label,
  tone,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  tone?: 'warm' | 'cool';
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const accent =
    tone === 'warm'
      ? 'text-accent-warm-2'
      : tone === 'cool'
        ? 'text-accent-cool-2'
        : 'text-ink';
  return (
    <div>
      <div className={`font-mono text-[0.7rem] uppercase tracking-[0.22em] ${accent} mb-2 border-b border-rule pb-1.5`}>
        {label}
      </div>
      <textarea
        className="textarea-paper"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function EnergyBar({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= value;
        return (
          <button
            key={n}
            onClick={() => onChange(n)}
            className="group h-12 flex flex-col items-center justify-end relative"
            aria-label={`Energy ${n} of 5`}
          >
            <div
              className={`w-full transition-all duration-300 origin-bottom ${
                active
                  ? 'bg-ink h-full group-hover:bg-accent-warm'
                  : 'bg-rule-soft h-2 group-hover:bg-muted'
              }`}
            />
            <span
              className={`absolute top-1 font-mono text-[0.62rem] tabular ${
                active ? 'text-paper' : 'text-muted-2'
              }`}
            >
              {n}
            </span>
          </button>
        );
      })}
    </div>
  );
}
