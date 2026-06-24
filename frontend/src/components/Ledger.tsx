import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Section } from './Section';
import { api } from '../api';
import type { WeekSnapshot, PR, ReviewedPR } from '../types';

type Props = {
  isoWeek: string;
  week: WeekSnapshot | null;
  onUpdated: (w: WeekSnapshot) => void;
};

export function Ledger({ isoWeek, week, onUpdated }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const gh = week?.github;

  const refresh = async () => {
    setBusy(true);
    setErr(null);
    try {
      const w = await api.refreshGithub(isoWeek);
      onUpdated(w);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      number="I"
      eyebrow="The Ledger"
      title="What shipped, what closed, what got read."
      subtitle="Pull requests of the week."
      action={
        <button onClick={refresh} disabled={busy} className="btn-ink">
          {busy ? 'Refreshing…' : gh ? 'Refresh dispatch' : 'Pull from GitHub'}
        </button>
      }
    >
      {err && (
        <div className="mb-6 panel border-accent-warm text-sm">
          <span className="eyebrow !text-accent-warm-2">Trouble</span>
          <p className="mt-2">{err}</p>
        </div>
      )}

      {!gh && !err && (
        <div className="panel">
          <p className="font-display italic text-xl text-muted-2">
            The wires are quiet. Pull from GitHub to fill this column.
          </p>
        </div>
      )}

      {gh && (
        <>
          <div className="grid grid-cols-3 gap-0 border-y border-ink">
            <Tally label="Opened" value={gh.totals.opened} />
            <Tally label="Merged" value={gh.totals.merged} hot />
            <Tally label="Reviewed" value={gh.totals.reviewed} last />
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-12">
            <PrColumn label="Opened" prs={gh.prsOpened} variant="opened" />
            <PrColumn label="Merged" prs={gh.prsMerged} variant="merged" />
          </div>

          {gh.prsReviewed.length > 0 && (
            <div className="mt-12">
              <ReviewedColumn label="Reviewed" prs={gh.prsReviewed} />
            </div>
          )}
        </>
      )}
    </Section>
  );
}

function Tally({
  label,
  value,
  hot,
  last,
}: {
  label: string;
  value: number;
  hot?: boolean;
  last?: boolean;
}) {
  return (
    <div className={`py-6 px-5 ${last ? '' : 'border-r border-ink'}`}>
      <div className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-2">
        {label}
      </div>
      <div
        className={`font-display text-[3.5rem] lg:text-[4.5rem] leading-none tabular mt-2 ${
          hot ? 'text-accent-warm' : 'text-ink'
        }`}
      >
        {String(value).padStart(2, '0')}
      </div>
    </div>
  );
}

function PrColumn({
  label,
  prs,
  variant,
}: {
  label: string;
  prs: PR[];
  variant: 'opened' | 'merged';
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-ink pb-1.5">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-ink">
          {label}
        </span>
        <span className="font-mono text-[0.7rem] tabular text-muted-2">
          {prs.length}
        </span>
      </div>
      {prs.length === 0 ? (
        <p className="font-display italic text-muted-2 text-base mt-4">
          Nothing this week.
        </p>
      ) : (
        <ol className="mt-3">
          {prs.map((pr) => (
            <li
              key={`${pr.repo}#${pr.number}`}
              className="py-3 border-b border-rule-soft last:border-b-0"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[0.7rem] tabular text-muted-2 shrink-0 mt-[3px]">
                  #{String(pr.number).padStart(4, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noreferrer"
                    className="link-news text-[0.98rem] leading-snug"
                  >
                    {pr.title}
                  </a>
                  <div className="mt-1 flex items-center gap-3 text-[0.72rem] text-muted-2">
                    <span className="font-mono">{pr.repo}</span>
                    <span aria-hidden>·</span>
                    <span>
                      {variant === 'merged' && pr.mergedAt
                        ? `merged ${format(parseISO(pr.mergedAt), 'EEE, MMM d')}`
                        : `opened ${format(parseISO(pr.createdAt), 'EEE, MMM d')}`}
                    </span>
                    {(pr.additions !== undefined || pr.deletions !== undefined) && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="font-mono tabular">
                          <span className="text-accent-cool-2">
                            +{pr.additions ?? 0}
                          </span>{' '}
                          <span className="text-accent-warm-2">
                            −{pr.deletions ?? 0}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ReviewedColumn({ label, prs }: { label: string; prs: ReviewedPR[] }) {
  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-ink pb-1.5">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-ink">
          {label}
        </span>
        <span className="font-mono text-[0.7rem] tabular text-muted-2">
          {prs.length}
        </span>
      </div>
      <ol className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-x-12">
        {prs.map((pr) => (
          <li
            key={`${pr.repo}#${pr.number}-${pr.reviewedAt}`}
            className="py-3 border-b border-rule-soft"
          >
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[0.7rem] tabular text-muted-2 shrink-0 mt-[3px]">
                #{String(pr.number).padStart(4, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noreferrer"
                  className="link-news text-[0.96rem] leading-snug"
                >
                  {pr.title}
                </a>
                <div className="mt-1 flex items-center gap-3 text-[0.72rem] text-muted-2">
                  <span className="font-mono">{pr.repo}</span>
                  <span aria-hidden>·</span>
                  <span>by @{pr.author}</span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
