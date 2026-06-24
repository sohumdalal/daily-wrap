import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';

type ConfigState = {
  db: boolean;
  github: { configured: boolean; username: string | null; lastIngestion: string | null };
  llm: { anthropic: boolean; openai: boolean; defaultProvider: string };
};

export function ConfigStatus() {
  const [state, setState] = useState<ConfigState | null>(null);

  useEffect(() => {
    fetch('/api/health/config')
      .then((r) => r.json())
      .then(setState)
      .catch(() => {});
  }, []);

  if (!state) return null;

  const integrations = [
    {
      label: 'Postgres',
      ok: state.db,
      detail: state.db ? 'connected' : 'unreachable',
    },
    {
      label: 'GitHub',
      ok: state.github.configured,
      detail: state.github.configured
        ? `@${state.github.username}`
        : 'token missing',
    },
    {
      label: 'Claude',
      ok: state.llm.anthropic,
      detail: state.llm.anthropic ? 'ready' : 'key missing',
    },
    {
      label: 'OpenAI',
      ok: state.llm.openai,
      detail: state.llm.openai ? 'ready' : 'key missing',
    },
  ];

  return (
    <div className="border-b border-rule">
      <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-2.5 flex items-center gap-6 flex-wrap font-mono text-[0.62rem] uppercase tracking-[0.18em]">
        <span className="text-muted-2">Wire room</span>
        {integrations.map((i) => (
          <span key={i.label} className="flex items-center gap-1.5">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                i.ok ? 'bg-accent-cool' : 'bg-accent-warm pulse-mark'
              }`}
              aria-hidden
            />
            <span className={i.ok ? 'text-ink' : 'text-accent-warm-2'}>
              {i.label}
            </span>
            <span className="text-muted-2 normal-case lowercase tracking-normal">
              · {i.detail}
            </span>
          </span>
        ))}
        {state.github.lastIngestion && (
          <span className="text-muted-2 ml-auto normal-case lowercase tracking-normal">
            last pull · {format(parseISO(state.github.lastIngestion), 'EEE HH:mm')}
          </span>
        )}
      </div>
    </div>
  );
}
