import { useState } from 'react';
import { Section } from './Section';
import { api } from '../api';
import type { Goal } from '../types';

type Props = {
  goals: Goal[];
  onChange: () => void | Promise<void>;
};

const STATUSES: Goal['status'][] = ['active', 'paused', 'achieved', 'archived'];

export function GoalsSection({ goals, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const active = goals.filter((g) => g.status === 'active');
  const other = goals.filter((g) => g.status !== 'active');

  return (
    <Section
      number="III"
      eyebrow="The Masthead"
      title="Stated intentions."
      subtitle="Goals named by the editor."
      action={
        <button onClick={() => setAdding(true)} className="btn-ink">
          + New goal
        </button>
      }
    >
      {adding && (
        <div className="mb-8">
          <GoalForm
            onCancel={() => setAdding(false)}
            onSaved={async () => {
              setAdding(false);
              await onChange();
            }}
          />
        </div>
      )}

      {active.length === 0 && other.length === 0 && !adding && (
        <div className="panel">
          <p className="font-display italic text-xl text-muted-2">
            No goals on the masthead yet. Name one to begin keeping score.
          </p>
        </div>
      )}

      {active.length > 0 && (
        <ol className="border-t border-ink">
          {active.map((g, i) => (
            <li key={g.id}>
              {editing === g.id ? (
                <div className="py-5 border-b border-rule-soft">
                  <GoalForm
                    goal={g}
                    onCancel={() => setEditing(null)}
                    onSaved={async () => {
                      setEditing(null);
                      await onChange();
                    }}
                  />
                </div>
              ) : (
                <GoalRow
                  goal={g}
                  index={i + 1}
                  onEdit={() => setEditing(g.id)}
                  onDelete={async () => {
                    if (confirm(`Delete goal "${g.title}"?`)) {
                      await api.deleteGoal(g.id);
                      await onChange();
                    }
                  }}
                  onStatusChange={async (status) => {
                    await api.saveGoal({ ...g, status });
                    await onChange();
                  }}
                />
              )}
            </li>
          ))}
        </ol>
      )}

      {other.length > 0 && (
        <div className="mt-12">
          <div className="eyebrow mb-4">Inactive</div>
          <ul className="border-t border-rule">
            {other.map((g) => (
              <li
                key={g.id}
                className="py-4 border-b border-rule-soft flex items-baseline justify-between gap-4"
              >
                <span className="text-muted-2 line-through decoration-rule">
                  {g.title}
                </span>
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-2">
                  {g.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

function GoalRow({
  goal,
  index,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  goal: Goal;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: Goal['status']) => void;
}) {
  return (
    <article className="py-6 border-b border-rule-soft group">
      <div className="flex items-baseline gap-5">
        <span className="font-display text-3xl text-accent-warm tabular w-10 shrink-0">
          {String(index).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-display text-2xl leading-tight text-ink">
              {goal.title}
            </h3>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={onEdit} className="btn-link">edit</button>
              <button onClick={onDelete} className="btn-link !text-muted-2">
                delete
              </button>
            </div>
          </div>
          {goal.description && (
            <p className="text-[0.95rem] text-ink-soft leading-relaxed mt-1.5 max-w-prose">
              {goal.description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-4 flex-wrap">
            {goal.metric && (
              <span className="font-mono text-[0.72rem] uppercase tracking-[0.12em] text-accent-cool-2 bg-paper-2 px-2 py-1 border border-rule">
                metric · {goal.metric}
              </span>
            )}
            <select
              className="select-paper"
              value={goal.status}
              onChange={(e) => onStatusChange(e.target.value as Goal['status'])}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </article>
  );
}

function GoalForm({
  goal,
  onCancel,
  onSaved,
}: {
  goal?: Goal;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState(goal?.title ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [metric, setMetric] = useState(goal?.metric ?? '');
  const [status, setStatus] = useState<Goal['status']>(goal?.status ?? 'active');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api.saveGoal({
        id: goal?.id,
        title: title.trim(),
        description: description.trim() || undefined,
        metric: metric.trim() || undefined,
        status,
      });
      await onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <div className="eyebrow mb-3">{goal ? 'Edit goal' : 'New goal'}</div>
      <div className="space-y-4">
        <input
          autoFocus
          className="input-paper font-display text-2xl"
          placeholder="What does growth look like?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="textarea-paper"
          placeholder="A line or two on why this goal matters. Optional."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <input
            className="input-paper"
            placeholder="Metric — e.g. ship 2 PRs/wk, finish testing book"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          />
          <select
            className="select-paper !text-[0.78rem]"
            value={status}
            onChange={(e) => setStatus(e.target.value as Goal['status'])}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button onClick={submit} disabled={busy || !title.trim()} className="btn-ink">
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
      </div>
    </div>
  );
}
