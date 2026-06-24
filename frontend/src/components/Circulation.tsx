import { Section } from './Section';
import type { WeekSnapshot } from '../types';

type Props = {
  week: WeekSnapshot | null;
};

export function Circulation({ week }: Props) {
  const gh = week?.github;
  const hasData = !!gh && (gh.reposTouched.length > 0 || gh.totals.additions > 0);

  return (
    <Section
      number="II"
      eyebrow="In Circulation"
      title="Where the work travelled."
      subtitle="Repositories handled and tongues spoken."
    >
      {!hasData && (
        <div className="panel">
          <p className="font-display italic text-xl text-muted-2">
            Circulation report pending. Refresh GitHub to populate.
          </p>
        </div>
      )}

      {hasData && gh && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Lines added/removed */}
          <div className="lg:col-span-5">
            <div className="border-y border-ink py-5">
              <div className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-2 mb-2">
                Net lines, merged
              </div>
              <div className="flex items-baseline gap-6">
                <div>
                  <div className="font-display text-[3.25rem] leading-none tabular text-accent-cool-2">
                    +{gh.totals.additions.toLocaleString()}
                  </div>
                  <div className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-2 mt-1">
                    added
                  </div>
                </div>
                <div className="font-display text-3xl text-rule">/</div>
                <div>
                  <div className="font-display text-[3.25rem] leading-none tabular text-accent-warm-2">
                    −{gh.totals.deletions.toLocaleString()}
                  </div>
                  <div className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-2 mt-1">
                    removed
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-ink mb-3 border-b border-ink pb-1.5">
                Repositories touched · {gh.reposTouched.length}
              </div>
              {gh.reposTouched.length === 0 ? (
                <p className="font-display italic text-muted-2">None.</p>
              ) : (
                <ul className="space-y-1 mt-3">
                  {gh.reposTouched.map((r) => (
                    <li
                      key={r}
                      className="font-mono text-[0.85rem] text-ink-soft"
                    >
                      <span className="text-muted">↪</span> {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Languages */}
          <div className="lg:col-span-7">
            <div className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-ink mb-3 border-b border-ink pb-1.5">
              Languages, by repositories
            </div>
            <LanguageBars languages={gh.languages} />
          </div>
        </div>
      )}
    </Section>
  );
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  Ruby: '#701516',
  Go: '#00add8',
  Rust: '#dea584',
  Java: '#b07219',
  Kotlin: '#a97bff',
  Swift: '#f05138',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  PHP: '#4f5d95',
  Vue: '#41b883',
  Astro: '#ff5d01',
};

function LanguageBars({ languages }: { languages: Record<string, number> }) {
  const entries = Object.entries(languages).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((acc, [, n]) => acc + n, 0);
  if (!entries.length)
    return (
      <p className="font-display italic text-muted-2 mt-3">
        No languages catalogued.
      </p>
    );
  return (
    <div className="mt-3">
      {/* Stacked bar */}
      <div className="flex h-4 w-full border border-rule overflow-hidden">
        {entries.map(([lang, n]) => (
          <div
            key={lang}
            title={`${lang} · ${n}`}
            style={{
              width: `${(n / total) * 100}%`,
              background: LANG_COLORS[lang] ?? '#999',
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <ul className="mt-5 grid grid-cols-2 gap-y-2 gap-x-6">
        {entries.map(([lang, n]) => (
          <li key={lang} className="flex items-baseline gap-3">
            <span
              className="inline-block w-2.5 h-2.5 shrink-0 translate-y-[1px]"
              style={{ background: LANG_COLORS[lang] ?? '#999' }}
            />
            <span className="font-sans text-[0.9rem] text-ink flex-1">{lang}</span>
            <span className="font-mono text-[0.78rem] tabular text-muted-2">
              {n} {n === 1 ? 'repo' : 'repos'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
