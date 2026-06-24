import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Section } from './Section';
import { api } from '../api';
import type { WeekSnapshot, GoalScore } from '../types';

type Props = {
  isoWeek: string;
  week: WeekSnapshot | null;
  onUpdated: (w: WeekSnapshot) => void;
};

type Provider = 'anthropic' | 'openai';

export function Editorial({ isoWeek, week, onUpdated }: Props) {
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const review = week?.review ?? null;

  const generate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const w = await api.generateReview(isoWeek, { provider });
      onUpdated(w);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      number="VI"
      eyebrow="The Editorial"
      title="A reading of the week."
      subtitle="The desk's candid take, against the stated goals."
      action={
        <div className="flex flex-col gap-3 items-start">
          <ProviderToggle value={provider} onChange={setProvider} />
          <button onClick={generate} disabled={busy} className="btn-ink">
            {busy
              ? 'Composing…'
              : review
                ? 'Compose a new editorial'
                : 'Compose this week’s editorial'}
          </button>
        </div>
      }
    >
      {err && (
        <div className="panel border-accent-warm mb-6">
          <span className="eyebrow !text-accent-warm-2">Trouble</span>
          <p className="mt-2 text-sm">{err}</p>
        </div>
      )}

      {!review && !err && (
        <div className="panel">
          <p className="font-display italic text-xl text-muted-2 leading-snug">
            No editorial yet for this edition. Once the week's data is in,
            ask the editor for a reading.
          </p>
        </div>
      )}

      {review && (
        <div>
          {/* Byline */}
          <div className="flex items-baseline justify-between border-b border-ink pb-2 mb-8">
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-2">
              Filed {format(parseISO(review.generatedAt), 'EEE, MMM d · HH:mm')}
            </span>
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-ink">
              By {review.provider} · {review.model}
            </span>
          </div>

          {/* Pull quote: focus next week */}
          {review.focusNextWeek && (
            <figure className="my-12 lg:my-16 grid grid-cols-12 gap-4">
              <div className="col-span-12 lg:col-span-1 flex items-start justify-end">
                <span className="font-display text-[5rem] leading-none text-accent-warm -mt-3">
                  &ldquo;
                </span>
              </div>
              <div className="col-span-12 lg:col-span-11">
                <blockquote className="pull-quote">
                  {review.focusNextWeek}
                </blockquote>
                <figcaption className="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-2">
                  — Focus, for the week to come
                </figcaption>
              </div>
            </figure>
          )}

          {/* Goal scores */}
          {review.goalScores.length > 0 && (
            <div className="mb-12">
              <div className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-ink border-b border-ink pb-1.5">
                Marks against the masthead
              </div>
              <ul className="mt-2">
                {review.goalScores.map((s) => (
                  <li
                    key={s.goalId}
                    className="py-5 border-b border-rule-soft"
                  >
                    <ScoreRow score={s} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Strengths + Adjustments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-10 mb-12">
            <SidePanel
              label="Holding"
              tone="cool"
              items={review.strengths}
            />
            <SidePanel
              label="Adjust"
              tone="warm"
              items={review.adjustments}
            />
          </div>

          {/* Long-form body */}
          {review.body && (
            <article className="prose-news drop-cap">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {review.body}
              </ReactMarkdown>
            </article>
          )}
        </div>
      )}
    </Section>
  );
}

function ProviderToggle({
  value,
  onChange,
}: {
  value: Provider;
  onChange: (p: Provider) => void;
}) {
  return (
    <div className="inline-flex border border-ink">
      {(['anthropic', 'openai'] as const).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] transition-colors ${
            value === p
              ? 'bg-ink text-paper'
              : 'bg-transparent text-ink hover:bg-paper-2'
          }`}
        >
          {p === 'anthropic' ? 'Claude' : 'OpenAI'}
        </button>
      ))}
    </div>
  );
}

function ScoreRow({ score }: { score: GoalScore }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-1.5">
        <span className="font-display text-lg text-ink leading-snug">
          {score.goalTitle}
        </span>
        <ScoreDots score={score.score} />
      </div>
      <p className="text-[0.92rem] text-ink-soft leading-relaxed">
        {score.reason}
      </p>
    </div>
  );
}

function ScoreDots({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`block w-2.5 h-2.5 border ${
            n <= score
              ? 'bg-accent-warm border-accent-warm'
              : 'bg-transparent border-rule'
          }`}
          style={{ borderRadius: '0' }}
        />
      ))}
      <span className="font-mono text-[0.72rem] tabular text-muted-2 ml-2">
        {score}/5
      </span>
    </div>
  );
}

function SidePanel({
  label,
  tone,
  items,
}: {
  label: string;
  tone: 'warm' | 'cool';
  items: string[];
}) {
  const accent = tone === 'warm' ? 'text-accent-warm-2' : 'text-accent-cool-2';
  return (
    <div>
      <div className={`font-mono text-[0.7rem] uppercase tracking-[0.22em] ${accent} border-b border-ink pb-1.5`}>
        {label}
      </div>
      {items.length === 0 ? (
        <p className="font-display italic text-muted-2 mt-3">—</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {items.map((it, i) => (
            <li
              key={i}
              className="flex gap-3 text-[0.95rem] leading-relaxed text-ink"
            >
              <span className={`font-mono text-[0.78rem] tabular shrink-0 ${accent}`}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="flex-1">{it}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
