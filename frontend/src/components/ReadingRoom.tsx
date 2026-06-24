import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Section } from './Section';
import { api } from '../api';
import type { WeekSnapshot } from '../types';

type Props = {
  isoWeek: string;
  week: WeekSnapshot | null;
  onUpdated: (w: WeekSnapshot) => void;
};

export function ReadingRoom({ isoWeek, week, onUpdated }: Props) {
  const [adding, setAdding] = useState(false);
  const entries = week?.reading ?? [];

  return (
    <Section
      number="V"
      eyebrow="The Reading Room"
      title="What was read, what was learned."
      subtitle="Articles, docs, papers, talks."
      action={
        <button onClick={() => setAdding(true)} className="btn-ink">
          + Add entry
        </button>
      }
    >
      {adding && (
        <AddForm
          onCancel={() => setAdding(false)}
          onSubmit={async (entry) => {
            const w = await api.addReading(isoWeek, entry);
            onUpdated(w);
            setAdding(false);
          }}
        />
      )}

      {entries.length === 0 && !adding && (
        <div className="panel">
          <p className="font-display italic text-xl text-muted-2">
            The shelf is empty this week. Add what you read.
          </p>
        </div>
      )}

      {entries.length > 0 && (
        <ul className="border-t border-ink mt-2">
          {entries.map((e, i) => (
            <li
              key={e.id}
              className="py-5 border-b border-rule-soft group"
            >
              <div className="flex items-baseline gap-4">
                <span className="font-display text-2xl text-accent-cool-2 tabular w-9 shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-4">
                    {e.url ? (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        className="link-news text-lg font-display leading-snug"
                      >
                        {e.title}
                      </a>
                    ) : (
                      <span className="font-display text-lg leading-snug">
                        {e.title}
                      </span>
                    )}
                    <button
                      onClick={async () => {
                        const w = await api.removeReading(isoWeek, e.id);
                        onUpdated(w);
                      }}
                      className="btn-link !text-muted-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      remove
                    </button>
                  </div>
                  {e.takeaway && (
                    <p className="text-[0.95rem] text-ink-soft leading-relaxed italic mt-1.5">
                      “{e.takeaway}”
                    </p>
                  )}
                  <div className="mt-1.5 font-mono text-[0.7rem] tabular text-muted-2">
                    {format(parseISO(e.addedAt), 'EEE, MMM d · HH:mm')}
                    {e.url && (
                      <>
                        <span aria-hidden> · </span>
                        <span className="lowercase">{hostnameOf(e.url)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function AddForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (e: { title: string; url?: string; takeaway?: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [takeaway, setTakeaway] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        url: url.trim() || undefined,
        takeaway: takeaway.trim() || undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel mb-6">
      <div className="eyebrow mb-3">New entry</div>
      <div className="space-y-4">
        <input
          autoFocus
          className="input-paper font-display text-xl"
          placeholder="Title — what you read"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="input-paper"
          placeholder="URL (optional)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <textarea
          className="textarea-paper"
          placeholder="Takeaway — one line that captures the idea"
          value={takeaway}
          onChange={(e) => setTakeaway(e.target.value)}
        />
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button onClick={submit} disabled={busy || !title.trim()} className="btn-ink">
          {busy ? 'Filing…' : 'Add to shelf'}
        </button>
        <button onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
      </div>
    </div>
  );
}
