/**
 * Daily Wrap — the whole client. No framework, no build step.
 *
 * State is two values: which period you're looking at, and which key. Both
 * live in the URL hash so a day is linkable and the back button works.
 */

const $ = (id) => document.getElementById(id);

const CATEGORY_LABEL = {
  career: 'Career',
  craft: 'Craft',
  impact: 'Impact',
  personal: 'Personal',
  intrinsic: 'Why',
};

const HORIZON_LABEL = {
  quarter: 'this quarter',
  year: 'this year',
  long: 'long term',
};

const el = {
  shell: $('shell'),
  goalsView: $('goals-view'),
  goalsTab: $('goals-tab'),
  goalForm: $('goal-form'),
  goalTitle: $('goal-title'),
  goalCategory: $('goal-category'),
  goalHorizon: $('goal-horizon'),
  goalMeasure: $('goal-measure'),
  goalWhy: $('goal-why'),
  goalList: $('goal-list'),
  goalsEmpty: $('goals-empty'),
  periods: $('periods'),
  todayJump: $('today-jump'),
  datepick: $('datepick'),
  datefield: $('datefield'),
  datefieldLabel: $('datefield-label'),
  prev: $('prev'),
  next: $('next'),
  dateLabel: $('date-label'),
  todayBadge: $('today-badge'),
  empty: $('empty'),
  specs: $('specs'),
  specsRule: $('specs-rule'),
  did: $('did'),
  didSection: $('did-section'),
  learned: $('learned'),
  learnedSection: $('learned-section'),
  disagree: $('disagree'),
  dispute: $('dispute'),
  disputeNote: $('dispute-note'),
  disputeSend: $('dispute-send'),
  disputeCancel: $('dispute-cancel'),
  corrections: $('corrections'),
  correctionsList: $('corrections-list'),
  grew: $('grew'),
  grewSection: $('grew-section'),
  grewLabel: $('grew-label'),
  covered: $('covered'),
  coveredSection: $('covered-section'),
  sources: $('sources'),
  sourcesSection: $('sources-section'),
  sourcesCount: $('sources-count'),
  provenance: $('provenance'),
  reflection: $('reflection'),
  reflectionLabel: $('reflection-label'),
  energy: $('energy'),
  saved: $('saved'),
  wrap: $('wrap'),
  collect: $('collect'),
  note: $('note'),
};

let state = {
  /** 'wrap' shows a period; 'goals' shows the goals page. */
  mode: 'wrap',
  period: 'day',
  key: null,
  today: null,
  view: null,
  busy: false,
};

// ── Period key arithmetic (mirrors agent/time.ts, for navigation only) ─────

const pad = (n) => String(n).padStart(2, '0');

function shiftDay(key, delta) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function mondayOfWeekKey(key) {
  const [year, week] = key.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  monday.setUTCDate(monday.getUTCDate() + (week - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

function weekKeyOf(day) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3,
  );
  const week = 1 + Math.round((d - firstThursday) / (7 * 86400000));
  return `${isoYear}-W${pad(week)}`;
}

function shiftKey(period, key, delta) {
  if (period === 'day') return shiftDay(key, delta);
  if (period === 'week') return weekKeyOf(shiftDay(mondayOfWeekKey(key), delta * 7));
  if (period === 'month') {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  }
  return String(Number(key) + delta);
}

/** The key for the period that contains today — where each period starts. */
function keyForToday(period, today) {
  if (period === 'day') return today;
  if (period === 'week') return weekKeyOf(today);
  if (period === 'month') return today.slice(0, 7);
  return today.slice(0, 4);
}

/** The key for the period containing `day`, for switching period in place. */
function keyContaining(period, key, today) {
  // Derive a representative day from whatever key we're on, then re-bucket it.
  let day = today;
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) day = key;
  else if (key.includes('-W')) day = mondayOfWeekKey(key);
  else if (/^\d{4}-\d{2}$/.test(key)) day = `${key}-01`;
  else if (/^\d{4}$/.test(key)) day = `${key}-01-01`;
  return keyForToday(period, day);
}

// ── Rendering ──────────────────────────────────────────────────────────────

function list(node, items) {
  node.replaceChildren(
    ...items.map((text) => {
      const li = document.createElement('li');
      li.textContent = text;
      return li;
    }),
  );
}

function specCell(value, label) {
  const cell = document.createElement('div');
  const v = document.createElement('div');
  v.className = value ? 'spec-value' : 'spec-value dim';
  v.textContent = String(value);
  const l = document.createElement('div');
  l.className = 'label spec-label';
  l.textContent = label;
  cell.append(v, l);
  return cell;
}

function renderSpecs(view) {
  const claude = view.claude;
  const github = view.github;
  if (!claude && !github) {
    el.specs.hidden = true;
    el.specsRule.hidden = true;
    return;
  }
  const c = claude?.totals;
  const g = github?.totals;
  el.specs.replaceChildren(
    specCell(c?.prompts ?? 0, 'Prompts'),
    specCell(g?.commits ?? 0, 'Commits'),
    specCell((g?.opened ?? 0) + (g?.merged ?? 0), 'Pull requests'),
    specCell(c?.activeMinutes ?? 0, 'Minutes active'),
  );
  el.specs.hidden = false;
  el.specsRule.hidden = false;
}

function renderWrap(view) {
  const wrap = view.wrap;
  const hasWrap = Boolean(wrap && wrap.did.length);

  // The headline is still generated — it labels this key in a rollup's list of
  // days — but it is not rendered here, where it only restated the bullets.
  el.empty.hidden = hasWrap;
  el.empty.textContent =
    view.period === 'day'
      ? 'Nothing wrapped yet.'
      : `Nothing wrapped for this ${view.period} yet.`;

  for (const [section, node, items] of [
    [el.didSection, el.did, wrap?.did ?? []],
    [el.grewSection, el.grew, wrap?.grew ?? []],
  ]) {
    section.hidden = items.length === 0;
    if (items.length) list(node, items);
  }

  // The agent's take is a paragraph. The section stays open whenever there are
  // corrections to show, even on a period it has nothing to say about.
  const take = wrap?.learned ?? '';
  const notes = view.feedback ?? [];
  el.learned.textContent = take;
  el.learned.hidden = !take;
  el.learnedSection.hidden = !take && notes.length === 0;
  el.disagree.hidden = !take;

  el.corrections.hidden = notes.length === 0;
  if (notes.length) list(el.correctionsList, notes.map((n) => n.note));
}

function renderCovered(view) {
  const days = view.coveredDays;
  if (!days) {
    el.coveredSection.hidden = true;
    return;
  }
  el.coveredSection.hidden = false;
  if (!days.length) {
    const p = document.createElement('p');
    p.className = 'caption';
    p.textContent = 'No days wrapped in this period yet.';
    el.covered.replaceChildren(p);
    return;
  }
  el.covered.replaceChildren(
    ...days.map((d) => {
      const a = document.createElement('a');
      a.href = `#day/${d.key}`;
      const when = document.createElement('span');
      when.className = 'when';
      when.textContent = d.key;
      const what = document.createElement('span');
      what.className = 'what';
      what.textContent = d.headline;
      a.append(when, what);
      return a;
    }),
  );
}

/**
 * Every row is a real URL that came from the collected data, so these are safe
 * to link. textContent throughout — a PR title is somebody else's text.
 */
function renderSources(view) {
  const sources = view.sources ?? [];
  el.sourcesSection.hidden = sources.length === 0;
  if (!sources.length) return;

  el.sourcesCount.textContent = `${sources.length}`;
  el.sources.replaceChildren(
    ...sources.map((s) => {
      const a = document.createElement('a');
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.dataset.kind = s.kind;

      const kind = document.createElement('span');
      kind.className = 'kind';
      kind.textContent = s.kind;

      const ref = document.createElement('span');
      ref.className = 'ref';
      ref.textContent = s.ref;

      const what = document.createElement('span');
      what.className = 'what';
      what.textContent = s.author ? `${s.label} · ${s.author}` : s.label;
      what.title = what.textContent;

      a.append(kind, ref, what);
      return a;
    }),
  );
}

function renderReflection(view) {
  const r = view.reflection;
  // Don't clobber what's being typed if a refresh lands mid-sentence.
  if (document.activeElement !== el.reflection) {
    el.reflection.value = r?.body ?? '';
  }
  el.reflection.placeholder =
    view.period === 'day'
      ? 'What actually happened today?'
      : `Looking back on this ${view.period} — what changed?`;
  el.reflectionLabel.textContent = 'Reflection';
  for (const button of el.energy.querySelectorAll('button')) {
    button.setAttribute(
      'aria-pressed',
      String(Number(button.dataset.energy) === r?.energy),
    );
  }
  el.saved.textContent = r?.updatedAt
    ? `Saved ${new Date(r.updatedAt).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : '';
}

const clock = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/**
 * Where this screen's contents came from and when. GitHub's commit search is
 * indexed with a lag, so a count can be short simply because the day was read
 * too early — saying when it was read makes that visible instead of puzzling.
 */
function renderProvenance(view) {
  const parts = [];
  if (view.collectedAt) parts.push(`Sources read ${clock(view.collectedAt)}`);
  if (view.wrap) {
    parts.push(
      `wrapped ${clock(view.wrap.generatedAt)}` +
        (view.wrap.model ? ` by ${view.wrap.model}` : ''),
    );
  }
  el.provenance.hidden = parts.length === 0;
  el.provenance.textContent = parts.join(' · ');
}

function render() {
  const view = state.view;
  if (!view) return;

  // The picker always holds a real date for the current key, and cannot reach
  // into the future, where there is nothing to wrap.
  el.datepick.value = view.span.from;
  el.datepick.max = state.today;
  el.datefieldLabel.textContent = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${view.span.from}T12:00:00Z`));

  el.dateLabel.textContent = view.label;
  el.todayBadge.hidden = view.key !== keyForToday(state.period, state.today);
  // No future — a day that hasn't happened has nothing to wrap.
  el.next.disabled = view.key >= keyForToday(state.period, state.today);

  el.wrap.textContent = state.period === 'day' ? 'Wrap the day' : `Wrap the ${state.period}`;
  // Forward-looking, so it names the period that comes next, not this one.
  el.grewLabel.textContent =
    state.period === 'day'
      ? 'Where to improve tomorrow'
      : `Where to improve next ${state.period}`;
  el.collect.hidden = state.period !== 'day';

  renderSpecs(view);
  renderWrap(view);
  renderCovered(view);
  renderSources(view);
  renderReflection(view);
  renderProvenance(view);
}

function goalRow(goal) {
  const row = document.createElement('div');
  row.className = 'goal';
  row.dataset.category = goal.category;
  row.dataset.status = goal.status;

  const meta = document.createElement('div');
  meta.className = 'goal-meta';
  meta.textContent = CATEGORY_LABEL[goal.category] ?? goal.category;

  const body = document.createElement('div');
  const title = document.createElement('span');
  title.className = 'goal-title';
  title.textContent = goal.title;
  body.append(title);

  const sub = document.createElement('span');
  sub.className = 'goal-sub';
  sub.textContent = [HORIZON_LABEL[goal.horizon] ?? goal.horizon, goal.measure]
    .filter(Boolean)
    .join(' · ');
  body.append(sub);

  if (goal.why) {
    const why = document.createElement('span');
    why.className = 'goal-why';
    why.textContent = goal.why;
    body.append(why);
  }

  const actions = document.createElement('div');
  actions.className = 'goal-actions';

  const status = document.createElement('select');
  status.setAttribute('aria-label', 'Status');
  for (const value of ['active', 'paused', 'achieved', 'dropped']) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    option.selected = value === goal.status;
    status.append(option);
  }
  status.addEventListener('change', () => patchGoal(goal.id, { status: status.value }));

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Delete';
  remove.addEventListener('click', async () => {
    // Deleting changes what every future wrap is judged against, so confirm.
    if (!confirm(`Delete "${goal.title}"? Future wraps stop measuring against it.`)) return;
    await api(`/api/goals/${goal.id}`, { method: 'DELETE' }).catch((err) =>
      note(err.message, true),
    );
    loadGoals();
  });

  actions.append(status, remove);
  row.append(meta, body, actions);
  return row;
}

async function loadGoals() {
  try {
    const { goals } = await api('/api/goals');
    el.goalList.replaceChildren(...goals.map(goalRow));
    el.goalsEmpty.hidden = goals.length > 0;
  } catch (err) {
    note(err.message, true);
  }
}

async function patchGoal(id, patch) {
  try {
    await api(`/api/goals/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    loadGoals();
  } catch (err) {
    note(err.message, true);
  }
}

function note(message, warn = false) {
  el.note.hidden = !message;
  el.note.textContent = message ?? '';
  el.note.className = warn ? 'note warn' : 'note';
}

function busy(on) {
  state.busy = on;
  el.shell.classList.toggle('busy', on);
  el.wrap.disabled = on;
  el.collect.disabled = on;
}

// ── Server ─────────────────────────────────────────────────────────────────

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  return body;
}

async function load() {
  state.view = await api(`/api/view/${state.period}/${state.key}`);
  render();
}

async function run(path, pending, body) {
  if (state.busy) return;
  busy(true);
  note(pending);
  try {
    const view = await api(path, {
      method: 'POST',
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    state.view = view;
    render();
    if (view.empty)
      note(
        state.period === 'day'
          ? 'Nothing recorded for this day — nothing to wrap.'
          : `No days wrapped in this ${state.period} yet — wrap some days first.`,
      );
    else if (view.errors?.length) note(view.errors.join(' · '), true);
    else note(null);
  } catch (err) {
    note(err.message, true);
  } finally {
    busy(false);
  }
}

const wrapNow = () =>
  run(
    `/api/view/${state.period}/${state.key}/wrap`,
    state.period === 'day' ? 'Reading the day, then writing it…' : 'Reading the days…',
  );

const collectNow = () =>
  run(`/api/view/${state.period}/${state.key}/collect`, 'Re-reading Claude and GitHub…');

let saveTimer;
async function saveReflection() {
  const energyButton = el.energy.querySelector('button[aria-pressed="true"]');
  try {
    const { reflection } = await api(`/api/reflection/${state.period}/${state.key}`, {
      method: 'PUT',
      body: JSON.stringify({
        body: el.reflection.value,
        energy: energyButton ? Number(energyButton.dataset.energy) : null,
      }),
    });
    if (state.view) state.view.reflection = reflection;
    renderReflection(state.view);
  } catch (err) {
    note(err.message, true);
  }
}

function queueSave() {
  clearTimeout(saveTimer);
  el.saved.textContent = 'Saving…';
  saveTimer = setTimeout(saveReflection, 700);
}

// ── Routing ────────────────────────────────────────────────────────────────

function go(period, key, replace = false) {
  state.mode = 'wrap';
  const hash = `#${period}/${key}`;
  if (replace) history.replaceState(null, '', hash);
  else location.hash = hash;
  if (replace) applyHash();
}

/** Swap which of the two shells is on screen, and mark the nav. */
function applyMode() {
  const goals = state.mode === 'goals';
  el.goalsView.hidden = !goals;
  el.shell.hidden = goals;
  el.goalsTab.setAttribute('aria-current', String(goals));
  el.datefield.hidden = goals;
  for (const button of el.periods.querySelectorAll('button[data-period]')) {
    button.setAttribute(
      'aria-current',
      String(!goals && button.dataset.period === state.period),
    );
  }
}

function applyHash() {
  const raw = location.hash.replace(/^#/, '');

  if (raw === 'goals') {
    state.mode = 'goals';
    applyMode();
    note(null);
    loadGoals();
    return;
  }

  const [period, key] = raw.split('/');
  const valid = ['day', 'week', 'month', 'year'].includes(period) && key;
  state.mode = 'wrap';
  state.period = valid ? period : 'day';
  state.key = valid ? key : keyForToday(state.period, state.today);
  applyMode();
  load().catch((err) => note(err.message, true));
}

// ── Events ─────────────────────────────────────────────────────────────────

el.periods.addEventListener('click', (e) => {
  if (e.target.dataset?.view === 'goals') {
    location.hash = '#goals';
    return;
  }
  const period = e.target.dataset?.period;
  if (period) go(period, keyContaining(period, state.key, state.today));
});

el.goalForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = el.goalTitle.value.trim();
  if (!title) return;
  try {
    await api('/api/goals', {
      method: 'POST',
      body: JSON.stringify({
        title,
        category: el.goalCategory.value,
        horizon: el.goalHorizon.value,
        measure: el.goalMeasure.value.trim(),
        why: el.goalWhy.value.trim(),
      }),
    });
    el.goalForm.reset();
    el.goalHorizon.value = 'year';
    el.goalTitle.focus();
    loadGoals();
  } catch (err) {
    note(err.message, true);
  }
});

/**
 * Jump to today and put the cursor in the reflection. Focusing has to wait for
 * the view to load, since rendering replaces the textarea's value — and it is
 * skipped when already on today's day so pressing Today twice doesn't fight
 * the caret.
 */
async function goToTodaysReflection() {
  const alreadyThere = state.period === 'day' && state.key === state.today;
  if (!alreadyThere) {
    go('day', state.today);
    // `go` routes through the hash, so wait for the load it triggers.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  el.reflection.focus();
  el.reflection.setSelectionRange(
    el.reflection.value.length,
    el.reflection.value.length,
  );
  el.reflection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

el.todayJump.addEventListener('click', goToTodaysReflection);

// Clicking our trigger opens the native calendar. showPicker() is the only way
// to do that without the browser's own control being visible; where it is
// unsupported, focusing the input still lets the keyboard through.
el.datefield.addEventListener('click', () => {
  try {
    el.datepick.showPicker();
  } catch {
    el.datepick.focus();
  }
});

// Picking a date jumps to the period that contains it, so the calendar works
// the same whether you are looking at a day, a week, a month or a year.
el.datepick.addEventListener('change', () => {
  const picked = el.datepick.value;
  if (!picked) return;
  if (picked > state.today) {
    el.datepick.value = state.view?.span.from ?? state.today;
    return;
  }
  go(state.period, keyForToday(state.period, picked));
});

// ── Disagreeing with the agent's take ──────────────────────────────────────

function showDispute(show) {
  el.dispute.hidden = !show;
  if (show) {
    el.disputeNote.focus();
  } else {
    el.disputeNote.value = '';
  }
}

el.disagree.addEventListener('click', () => showDispute(el.dispute.hidden));
el.disputeCancel.addEventListener('click', () => showDispute(false));

el.disputeSend.addEventListener('click', async () => {
  const note = el.disputeNote.value.trim();
  if (!note) {
    el.disputeNote.focus();
    return;
  }
  showDispute(false);
  await run(
    `/api/view/${state.period}/${state.key}/disagree`,
    'Noted. Rewriting with that in mind, and keeping it for next time…',
    { note },
  );
});

el.prev.addEventListener('click', () => go(state.period, shiftKey(state.period, state.key, -1)));
el.next.addEventListener('click', () => {
  if (!el.next.disabled) go(state.period, shiftKey(state.period, state.key, 1));
});

el.wrap.addEventListener('click', wrapNow);
el.collect.addEventListener('click', collectNow);

el.reflection.addEventListener('input', queueSave);
el.reflection.addEventListener('blur', () => {
  clearTimeout(saveTimer);
  saveReflection();
});

el.energy.addEventListener('click', (e) => {
  const value = e.target.dataset?.energy;
  if (!value) return;
  const already = e.target.getAttribute('aria-pressed') === 'true';
  for (const button of el.energy.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(!already && button === e.target));
  }
  saveReflection();
});

document.addEventListener('keydown', (e) => {
  // The goals page is a form; leave its keys alone entirely.
  if (state.mode === 'goals') {
    if (e.key === 'Escape') history.back();
    return;
  }
  // Never steal keys from either text box.
  if (e.target === el.reflection) {
    if (e.key === 'Escape') el.reflection.blur();
    return;
  }
  if (e.target === el.disputeNote) {
    if (e.key === 'Escape') showDispute(false);
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) el.disputeSend.click();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  const periods = { d: 'day', w: 'week', m: 'month', y: 'year' };
  const period = periods[e.key.toLowerCase()];

  if (e.key === 'ArrowLeft') el.prev.click();
  else if (e.key === 'ArrowRight') el.next.click();
  else if (e.key === 'Enter') wrapNow();
  else if (e.key.toLowerCase() === 't') {
    e.preventDefault();
    goToTodaysReflection();
  } else if (e.key.toLowerCase() === 'r') {
    e.preventDefault();
    el.reflection.focus();
  } else if (period) go(period, keyContaining(period, state.key, state.today));
});

window.addEventListener('hashchange', applyHash);

// ── Boot ───────────────────────────────────────────────────────────────────

(async () => {
  try {
    const server = await api('/api/state');
    state.today = server.today;
    if (!server.llm) note('ANTHROPIC_API_KEY is not set — wraps cannot be written.', true);
    else if (!server.github) note('GitHub is not configured — the day will be Claude only.', true);
  } catch (err) {
    note(`Cannot reach the agent: ${err.message}`, true);
    state.today = new Date().toISOString().slice(0, 10);
  }
  if (!location.hash) go('day', state.today, true);
  else applyHash();
})();
