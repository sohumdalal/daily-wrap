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
  brand: $('brand'),
  brandmenu: $('brandmenu'),
  goalForm: $('goal-form'),
  goalTitle: $('goal-title'),
  goalCategory: $('goal-category'),
  goalHorizon: $('goal-horizon'),
  goalMeasure: $('goal-measure'),
  goalWhy: $('goal-why'),
  goalList: $('goal-list'),
  goalsEmpty: $('goals-empty'),
  goalsLoading: $('goals-loading'),
  periods: $('periods'),
  todayJump: $('today-jump'),
  datefield: $('datefield'),
  datefieldLabel: $('datefield-label'),
  calendar: $('calendar'),
  calMonth: $('cal-month'),
  calDow: $('cal-dow'),
  calGrid: $('cal-grid'),
  calPrev: $('cal-prev'),
  calNext: $('cal-next'),
  calToday: $('cal-today'),
  prev: $('prev'),
  next: $('next'),
  dateLabel: $('date-label'),
  todayBadge: $('today-badge'),
  tabs: $('tabs'),
  tabSummary: $('tab-summary'),
  tabReflect: $('tab-reflect'),
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
  sourcesCount: $('sources-count'),
  sourcesSearch: $('sources-search'),
  sourcesKinds: $('sources-kinds'),
  sourcesEmpty: $('sources-empty'),
  tabSources: $('tab-sources'),
  provenance: $('provenance'),
  reflection: $('reflection'),
  thread: $('thread'),
  reflectIntro: $('reflect-intro'),
  reflectSend: $('reflect-send'),
  reflectHint: $('reflect-hint'),
  takeaways: $('takeaways'),
  takeGood: $('take-good'),
  takeBad: $('take-bad'),
  takeImprove: $('take-improve'),
  reflectionLabel: $('reflection-label'),
  energy: $('energy'),
  saved: $('saved'),
  wrap: $('wrap'),
  collect: $('collect'),
  note: $('note'),
};

const TABS = ['summary', 'reflect', 'sources'];

let state = {
  /** 'wrap' shows a period; 'goals' shows the goals page. */
  mode: 'wrap',
  period: 'day',
  /** Which half of a period is on screen. */
  tab: 'summary',
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
/** Search text and kind, applied to the day's sources without refetching. */
const sourceFilter = { text: '', kind: 'all' };

function matchesFilter(source) {
  if (sourceFilter.kind !== 'all' && source.kind !== sourceFilter.kind) return false;
  const text = sourceFilter.text.trim().toLowerCase();
  if (!text) return true;
  return `${source.ref} ${source.label} ${source.author ?? ''}`
    .toLowerCase()
    .includes(text);
}

function renderSources(view) {
  const all = view.sources ?? [];
  const sources = all.filter(matchesFilter);

  el.sourcesCount.textContent =
    sources.length === all.length
      ? `${all.length}`
      : `${sources.length} of ${all.length}`;
  el.sourcesEmpty.hidden = sources.length > 0 || all.length === 0;

  // Only offer a kind that the period actually contains.
  const present = new Set(all.map((s) => s.kind));
  for (const button of el.sourcesKinds.querySelectorAll('button')) {
    const kind = button.dataset.kind;
    button.hidden = kind !== 'all' && !present.has(kind);
    button.setAttribute('aria-pressed', String(kind === sourceFilter.kind));
  }

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

function renderThread(view) {
  const turns = view.turns ?? [];
  el.thread.replaceChildren(
    ...turns.map((t) => {
      const row = document.createElement('div');
      row.className = 'turn';
      row.dataset.role = t.role;

      const role = document.createElement('span');
      role.className = 'turn-role';
      role.textContent = t.role === 'agent' ? 'Daily Wrap' : 'You';

      const text = document.createElement('p');
      text.className = 'turn-text';
      text.textContent = t.text;

      row.append(role, text);
      return row;
    }),
  );
  el.reflectIntro.hidden = turns.length > 0;
  el.reflectSend.textContent = 'Send';
  el.reflectHint.hidden = turns.length === 0;
  el.reflection.placeholder = turns.length ? 'Your answer' : '';
  // Nothing to answer until it has asked.
  el.reflection.disabled = turns.length === 0;
  el.reflectSend.disabled = turns.length === 0 || state.busy;
}

function renderTakeaways(view) {
  const t = view.reflection?.takeaways ?? { good: '', bad: '', improve: '' };
  const any = Boolean(t.good || t.bad || t.improve);
  // Shown once there is something to show, and kept open after that so the
  // fields stay editable.
  el.takeaways.hidden = !any;
  for (const [field, node] of [
    ['good', el.takeGood],
    ['bad', el.takeBad],
    ['improve', el.takeImprove],
  ]) {
    if (document.activeElement !== node) node.value = t[field] ?? '';
  }
}

function renderReflection(view) {
  renderThread(view);
  renderTakeaways(view);

  el.reflectionLabel.textContent = 'Reflection';
  for (const button of el.energy.querySelectorAll('button')) {
    button.setAttribute(
      'aria-pressed',
      String(Number(button.dataset.energy) === view.reflection?.energy),
    );
  }
  el.saved.textContent = view.reflection?.updatedAt
    ? `Saved ${new Date(view.reflection.updatedAt).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : '';
}

function render() {
  const view = state.view;
  if (!view) return;

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

  applyTab();
  maybeOpenReflection(view);
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
  // Bars only while there is nothing to show; a refresh keeps the current list.
  const blank = el.goalList.childElementCount === 0;
  el.goalsLoading.hidden = !blank;
  el.goalsEmpty.hidden = true;
  try {
    const { goals } = await api('/api/goals');
    el.goalList.replaceChildren(...goals.map(goalRow));
    el.goalsEmpty.hidden = goals.length > 0;
  } catch (err) {
    note(err.message, true);
  } finally {
    el.goalsLoading.hidden = true;
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

/** True until the first view has rendered, which is the only time bars beat dimming. */
let firstPaint = true;

async function load() {
  if (firstPaint) el.shell.classList.add('is-loading');
  else busy(true);
  try {
    state.view = await api(`/api/view/${state.period}/${state.key}`);
    render();
    restorePlace();
    if (focusReflectionOnLoad) {
      focusReflectionOnLoad = false;
      setTab('reflect');
      applyTab();
      focusReflection();
    }
  } finally {
    el.shell.classList.remove('is-loading');
    if (!firstPaint) busy(false);
    firstPaint = false;
  }
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

/** Patch fields on the reflection without touching the rest. */
async function patchReflection(patch) {
  try {
    const { reflection } = await api(`/api/reflection/${state.period}/${state.key}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    if (state.view) state.view.reflection = reflection;
    renderReflection(state.view);
  } catch (err) {
    note(err.message, true);
  }
}

let takeawayTimer;
function queueTakeaways() {
  clearTimeout(takeawayTimer);
  el.saved.textContent = 'Saving…';
  takeawayTimer = setTimeout(
    () =>
      patchReflection({
        good: el.takeGood.value,
        bad: el.takeBad.value,
        improve: el.takeImprove.value,
      }),
    700,
  );
}

/**
 * Keys this session has already tried to open, so a failed open is not retried
 * on every render and a revisit does not spend another call.
 */
const opened = new Set();

/**
 * Open the conversation when you arrive with nothing in it. Gated on the
 * period having a wrap: with nothing to read, the agent has nothing to ask
 * about, and paging through empty days should not each cost a call.
 */
function maybeOpenReflection(view) {
  if (state.tab !== 'reflect') return;
  if ((view.turns ?? []).length > 0) return;
  if (!view.wrap) return;
  const id = `${view.period}/${view.key}`;
  if (opened.has(id)) return;
  opened.add(id);
  sendReflection();
}

/** Send a turn, or open the conversation when the box is empty. */
async function sendReflection() {
  if (state.busy) return;
  const message = el.reflection.value.trim();
  busy(true);
  note(message ? null : 'Reading your day…');
  if (!message) {
    el.reflectIntro.hidden = false;
    el.reflectIntro.textContent = 'Reading your day and your recent ones…';
  }
  try {
    const res = await api(`/api/reflect/${state.period}/${state.key}`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    el.reflection.value = '';
    if (state.view) {
      state.view.turns = res.turns;
      state.view.reflection = res.reflection;
    }
    renderReflection(state.view);
    note(null);
    el.thread.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    note(err.message, true);
  } finally {
    busy(false);
  }
}

// ── Resuming after a reload ────────────────────────────────────────────────

/**
 * A reload restores the period from the hash, but not the scroll position or
 * an unsent answer, so it lands you at the top of a page you were part way
 * down. Both are per-key and per-tab, which is what sessionStorage is for.
 * Every access is guarded: a private window or blocked site data throws here
 * rather than returning empty.
 */
const resumeKey = () => `dw:resume:${state.mode}:${state.period}:${state.key}`;

function rememberPlace() {
  if (!state.key) return;
  try {
    sessionStorage.setItem(
      resumeKey(),
      JSON.stringify({ scroll: window.scrollY, draft: el.reflection.value }),
    );
  } catch {
    // No session storage. Losing the position is not worth failing over.
  }
}

function restorePlace() {
  let saved = null;
  try {
    const raw = sessionStorage.getItem(resumeKey());
    if (raw) saved = JSON.parse(raw);
  } catch {
    saved = null;
  }
  if (!saved) return;

  if (typeof saved.draft === 'string' && saved.draft && !el.reflection.value) {
    el.reflection.value = saved.draft;
  }
  if (typeof saved.scroll === 'number' && saved.scroll > 0) {
    // After render, so the page is tall enough to scroll to.
    requestAnimationFrame(() => window.scrollTo(0, saved.scroll));
  }
}

// Fires on reload, tab close, and navigation away.
window.addEventListener('pagehide', rememberPlace);
window.addEventListener('beforeunload', rememberPlace);

// ── Routing// ── Routing ────────────────────────────────────────────────────────────────

function go(period, key, replace = false) {
  rememberPlace();
  sourceFilter.text = '';
  sourceFilter.kind = 'all';
  el.sourcesSearch.value = '';
  state.mode = 'wrap';
  // Moving to another period keeps whichever half you were reading.
  const suffix = state.tab === 'summary' ? '' : `/${state.tab}`;
  const hash = `#${period}/${key}${suffix}`;
  if (replace) history.replaceState(null, '', hash);
  else location.hash = hash;
  if (replace) applyHash();
}

/**
 * Show one half of a period. Switching is not navigation, so it replaces the
 * history entry rather than adding one, while still living in the URL.
 */
function setTab(tab) {
  if (!TABS.includes(tab) || tab === state.tab) return;
  state.tab = tab;
  const suffix = tab === 'summary' ? '' : `/${tab}`;
  history.replaceState(null, '', `#${state.period}/${state.key}${suffix}`);
  applyTab();
  if (state.view) maybeOpenReflection(state.view);
}

function applyTab() {
  el.tabSummary.hidden = state.tab !== 'summary';
  el.tabReflect.hidden = state.tab !== 'reflect';
  el.tabSources.hidden = state.tab !== 'sources';
  for (const button of el.tabs.querySelectorAll('button')) {
    button.setAttribute('aria-current', String(button.dataset.tab === state.tab));
  }
}

/** Swap which of the two shells is on screen, and mark the nav. */
function applyMode() {
  const goals = state.mode === 'goals';
  el.goalsView.hidden = !goals;
  el.shell.hidden = goals;
  el.goalsTab.setAttribute('aria-current', String(goals));
  el.datefield.closest('.datefield-wrap').hidden = goals;
  closeCalendar();
  openBrandMenu(false);
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

  const [period, key, tab] = raw.split('/');
  const valid = ['day', 'week', 'month', 'year'].includes(period) && key;
  state.mode = 'wrap';
  state.period = valid ? period : 'day';
  state.key = valid ? key : keyForToday(state.period, state.today);
  state.tab = TABS.includes(tab) ? tab : 'summary';
  applyMode();
  load().catch((err) => note(err.message, true));
}

// ── Events ─────────────────────────────────────────────────────────────────

el.periods.addEventListener('click', (e) => {
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

/** Set while a Today jump is in flight, so load() knows to focus when it lands. */
let focusReflectionOnLoad = false;

function focusReflection() {
  el.reflection.focus();
  el.reflection.setSelectionRange(
    el.reflection.value.length,
    el.reflection.value.length,
  );
  el.reflection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Jump to today and put the cursor in the reflection.
 *
 * The mode is part of "already there": on the goals page the period and key
 * are still today's, so testing those alone skips the navigation and then
 * focuses a textarea inside the hidden shell.
 *
 * Focusing waits for the load rather than a timer, because renderReflection
 * will not overwrite a focused textarea. Winning that race would leave an
 * empty box on a day that has a reflection.
 */
function goToTodaysReflection() {
  const alreadyThere =
    state.mode === 'wrap' && state.period === 'day' && state.key === state.today;
  if (alreadyThere) {
    setTab('reflect');
    focusReflection();
    return;
  }
  focusReflectionOnLoad = true;
  state.tab = 'reflect';
  go('day', state.today);
}

el.todayJump.addEventListener('click', goToTodaysReflection);

// ── Brand menu ─────────────────────────────────────────────────────────────

function openBrandMenu(open) {
  el.brandmenu.hidden = !open;
  el.brand.setAttribute('aria-expanded', String(open));
}

el.brand.addEventListener('click', (e) => {
  e.stopPropagation();
  closeCalendar();
  openBrandMenu(el.brandmenu.hidden);
});

el.brandmenu.addEventListener('click', (e) => {
  e.stopPropagation();
  if (e.target.dataset?.view === 'goals') {
    openBrandMenu(false);
    location.hash = '#goals';
  }
});

// ── Calendar ───────────────────────────────────────────────────────────────

/** Which month the open calendar is showing, as `YYYY-MM`. */
let calMonth = null;

const monthOf = (key) => key.slice(0, 7);

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

function renderCalendar() {
  const [year, month] = calMonth.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));

  el.calMonth.textContent = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(first);

  // Weeks start Monday, to agree with the ISO week keys used everywhere else.
  if (!el.calDow.childElementCount) {
    el.calDow.replaceChildren(
      ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => {
        const span = document.createElement('span');
        span.textContent = d;
        return span;
      }),
    );
  }

  const leading = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - leading);

  const selected = state.view?.span.from;
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const at = new Date(gridStart);
    at.setUTCDate(gridStart.getUTCDate() + i);
    const iso = at.toISOString().slice(0, 10);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cal-day';
    button.textContent = String(at.getUTCDate());
    button.dataset.outside = String(iso.slice(0, 7) !== calMonth);
    button.dataset.today = String(iso === state.today);
    // A day in a period the current view covers reads as selected, so the
    // calendar makes sense on a week or month view too.
    button.setAttribute(
      'aria-selected',
      String(
        selected !== undefined &&
          iso >= selected &&
          iso <= (state.view?.span.to ?? selected),
      ),
    );
    // Nothing to wrap in the future.
    button.disabled = iso > state.today;
    if (!button.disabled) {
      button.addEventListener('click', () => {
        closeCalendar();
        go(state.period, keyForToday(state.period, iso));
      });
    }
    cells.push(button);
  }
  el.calGrid.replaceChildren(...cells);

  // Never navigate into a month that has not happened.
  el.calNext.disabled = shiftMonth(calMonth, 1) > monthOf(state.today);
}

function openCalendar() {
  calMonth = monthOf(state.view?.span.from ?? state.today);
  el.calendar.hidden = false;
  el.datefield.setAttribute('aria-expanded', 'true');
  renderCalendar();
}

function closeCalendar() {
  el.calendar.hidden = true;
  el.datefield.setAttribute('aria-expanded', 'false');
}

el.datefield.addEventListener('click', (e) => {
  e.stopPropagation();
  if (el.calendar.hidden) openCalendar();
  else closeCalendar();
});

el.calendar.addEventListener('click', (e) => e.stopPropagation());

el.calPrev.addEventListener('click', () => {
  calMonth = shiftMonth(calMonth, -1);
  renderCalendar();
});

el.calNext.addEventListener('click', () => {
  if (el.calNext.disabled) return;
  calMonth = shiftMonth(calMonth, 1);
  renderCalendar();
});

el.calToday.addEventListener('click', () => {
  closeCalendar();
  go(state.period, keyForToday(state.period, state.today));
});

// Clicking anywhere else dismisses either popup.
document.addEventListener('click', () => {
  if (!el.calendar.hidden) closeCalendar();
  if (!el.brandmenu.hidden) openBrandMenu(false);
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

el.sourcesSearch.addEventListener('input', () => {
  sourceFilter.text = el.sourcesSearch.value;
  if (state.view) renderSources(state.view);
});

el.sourcesKinds.addEventListener('click', (e) => {
  const kind = e.target.dataset?.kind;
  if (!kind) return;
  sourceFilter.kind = kind;
  if (state.view) renderSources(state.view);
});

el.tabs.addEventListener('click', (e) => {
  const tab = e.target.dataset?.tab;
  if (tab) setTab(tab);
});

el.prev.addEventListener('click', () => go(state.period, shiftKey(state.period, state.key, -1)));
el.next.addEventListener('click', () => {
  if (!el.next.disabled) go(state.period, shiftKey(state.period, state.key, 1));
});

el.wrap.addEventListener('click', wrapNow);
el.collect.addEventListener('click', collectNow);

el.reflectSend.addEventListener('click', sendReflection);

for (const node of [el.takeGood, el.takeBad, el.takeImprove]) {
  node.addEventListener('input', queueTakeaways);
  node.addEventListener('blur', () => {
    clearTimeout(takeawayTimer);
    patchReflection({
      good: el.takeGood.value,
      bad: el.takeBad.value,
      improve: el.takeImprove.value,
    });
  });
}

el.energy.addEventListener('click', (e) => {
  const value = e.target.dataset?.energy;
  if (!value) return;
  const already = e.target.getAttribute('aria-pressed') === 'true';
  patchReflection({ energy: already ? null : Number(value) });
});

/** A key pressed inside a field belongs to the field. */
const isTyping = (target) =>
  target instanceof HTMLElement &&
  (target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable);

document.addEventListener('keydown', (e) => {
  // The goals page is a form, so its fields keep their own keys. Outside them
  // the jump to today still works, which is where it is most wanted.
  if (state.mode === 'goals') {
    if (isTyping(e.target)) return;
    if (e.key === 'Escape') history.back();
    if (e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      goToTodaysReflection();
    }
    return;
  }
  // Never steal keys from either text box.
  if (e.target === el.reflection) {
    if (e.key === 'Escape') el.reflection.blur();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendReflection();
    }
    return;
  }
  if (e.target === el.disputeNote) {
    if (e.key === 'Escape') showDispute(false);
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) el.disputeSend.click();
    return;
  }
  if (e.key === 'Escape' && (!el.calendar.hidden || !el.brandmenu.hidden)) {
    closeCalendar();
    openBrandMenu(false);
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
