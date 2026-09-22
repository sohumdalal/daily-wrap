/**
 * Turning a day (or a week, month, year) into five bullets.
 *
 * The output shape is fixed: what you did, what you learned, where you grew.
 * `learned` and `grew` are allowed to come back empty, and that matters — a day
 * of mechanical work should read as one. Inventing growth on a quiet day would
 * make the weekly and yearly rollups worthless, because they are built by
 * reading these fields back.
 */

import { z } from 'zod';
import { generate } from './llm.ts';
import * as store from './store.ts';
import { labelFor, spanOf, type Period } from './time.ts';
import type { ClaudeDay, GitHubDay, Reflection, Wrap } from './types.ts';

const WrapSchema = z.object({
  // A compact label, not a title: it appears as one row in a rollup's list of
  // days, never as a heading on the page.
  headline: z.string().min(1).max(60),
  did: z.array(z.string().min(1)).max(5),
  learned: z.array(z.string().min(1)).max(3),
  grew: z.array(z.string().min(1)).max(2),
});

const VOICE = `You write in second person, plainly, with no cheerleading and no
corporate register. Never open a bullet with "Worked on", "Continued", "Helped",
"Successfully", or a gerund; lead with the verb that did the work ("Shipped",
"Traced", "Rewrote", "Cut"). Name the concrete thing — the repo, the PR number,
the bug, the file. No adjectives that add nothing ("significant", "various",
"several key"). No em-dashes.`;

const DAY_SYSTEM = `You are writing one person's daily engineering wrap from the
raw record of their day: their Claude Code sessions (what they asked for, what
was built, which repos and branches) and their GitHub activity (commits, pull
requests opened, merged and reviewed).

${VOICE}

Return a JSON object with exactly these keys:

  headline  At most six words, 60 characters. A terse label for this day in a
            list of days, not a heading. Name the thing, not the actions:
            "Everyone group lockdown" over "Locked the Everyone group and
            moved access settings". No trailing punctuation.
  did       Three to five bullets. What actually happened, most consequential
            first. At most fourteen words each. Cite the PR number or repo when
            the record gives you one. Merge related work into one bullet rather
            than listing near-duplicates.
  learned   Zero to three bullets. Something specific that is now understood
            that was not understood this morning — a mechanism, a constraint, a
            root cause. Not a task restated as a lesson. If the record shows no
            such moment, return an empty array.
  grew      Zero to two bullets. A change in how this person works, judges, or
            decides — evidenced by the record, not a task. Examples of the
            shape: "Stopped guessing at the fix and read the failing query
            first." If the day shows no such change, return an empty array.

Returning empty arrays for learned and grew is correct and expected on a
mechanical day. Do not manufacture insight. Reply with the JSON object only.`;

const ROLLUP_SYSTEM = `You are writing one person's engineering wrap for a whole
period, from the daily wraps they already have and the reflections they wrote
alongside them.

${VOICE}

You are looking for the arc, not a longer list. Repetition across days is the
signal: what they returned to, what stopped being hard, what kept biting.

Return a JSON object with exactly these keys:

  headline  At most six words, 60 characters. A terse label for this period in
            a list, not a heading. Name the theme, not the actions. No trailing
            punctuation.
  did       Three to five bullets. The work that mattered at this altitude. At
            most sixteen words each. A single day's task belongs here only if it
            still matters at the end of the period. Group; do not enumerate.
  learned   Zero to three bullets. What they understand now that they did not at
            the start, drawn from the recurrence across days.
  grew      Zero to three bullets. How they changed as an engineer over this
            period. This is the most important field — it is the reason the
            record is kept. Ground each one in what the days actually show, and
            name the direction of travel. Return an empty array rather than a
            platitude.

Reply with the JSON object only.`;

function bullets(label: string, items: string[]): string {
  if (!items.length) return '';
  return `${label}\n${items.map((i) => `  - ${i}`).join('\n')}\n`;
}

/** The day's raw record, rendered for the model. */
function describeDay(day: string, claude: ClaudeDay | null, github: GitHubDay | null): string {
  const out: string[] = [`DAY: ${day} (${labelFor('day', day)})`];

  if (claude?.sessions.length) {
    const t = claude.totals;
    out.push(
      `\nCLAUDE CODE — ${t.sessions} session(s), ${t.activeMinutes} min active, ` +
        `${t.prompts} prompts, ${t.toolCalls} tool calls` +
        (claude.models.length ? `, models: ${claude.models.join(', ')}` : ''),
    );
    for (const s of claude.sessions) {
      // Resuming a session writes a fresh record that replays the opening
      // prompt. Those stubs carry no title, no tool calls and no active time,
      // and including them makes one piece of work look like three.
      if (!s.title && !s.tools.length && !s.activeMinutes) continue;
      if (!s.prompts.length && !s.title) continue;
      const where = [s.project, ...s.branches].filter(Boolean).join(' @ ');
      out.push(
        `\n  session${s.title ? ` "${s.title}"` : ''}${where ? ` [${where}]` : ''}` +
          ` — ${s.activeMinutes} min` +
          (s.tools.length
            ? `, tools: ${s.tools.slice(0, 5).map((x) => `${x.name}×${x.count}`).join(' ')}`
            : ''),
      );
      // The prompts are the intent behind the day. Give the model the openings.
      for (const p of s.prompts.slice(0, 12)) {
        out.push(`    asked: ${p.replace(/\s+/g, ' ').slice(0, 300)}`);
      }
    }
    if (claude.prs.length) {
      out.push(
        `\n  PRs opened from these sessions: ${claude.prs
          .map((p) => `${p.repo}#${p.number}`)
          .join(', ')}`,
      );
    }
  } else {
    out.push('\nCLAUDE CODE — no sessions recorded.');
  }

  if (github && (github.repos.length || github.totals.commits)) {
    const t = github.totals;
    out.push(
      `\nGITHUB — ${t.commits} commit(s), ${t.opened} PR(s) opened, ` +
        `${t.merged} merged (+${t.additions}/-${t.deletions}), ${t.reviewed} reviewed`,
    );
    out.push(
      bullets(
        '  commits:',
        github.commits.map((c) => `${c.repo} ${c.sha} ${c.message}`),
      ),
    );
    out.push(
      bullets(
        '  opened:',
        github.opened.map(
          (p) =>
            `${p.repo}#${p.number} ${p.title}` +
            (p.additions !== null ? ` (+${p.additions}/-${p.deletions})` : ''),
        ),
      ),
    );
    out.push(
      bullets(
        '  merged:',
        github.merged.map((p) => `${p.repo}#${p.number} ${p.title}`),
      ),
    );
    out.push(
      bullets(
        '  reviewed for others:',
        github.reviewed.map((p) => `${p.repo}#${p.number} ${p.title} (by ${p.author})`),
      ),
    );
  } else {
    out.push('\nGITHUB — nothing recorded.');
  }

  return out.filter(Boolean).join('\n');
}

/** A period with no wrapped days beneath it. Expected, not a failure. */
export class NoDaysToRollUp extends Error {}

/** Whether a day holds enough to be worth asking the model about. */
export function hasActivity(claude: ClaudeDay | null, github: GitHubDay | null): boolean {
  const c = claude?.totals;
  const g = github?.totals;
  return Boolean(
    (c && (c.prompts > 0 || c.sessions > 0)) ||
      (g && (g.commits > 0 || g.opened > 0 || g.merged > 0 || g.reviewed > 0)),
  );
}

export async function writeDayWrap(opts: {
  day: string;
  claude: ClaudeDay | null;
  github: GitHubDay | null;
  reflection: Reflection | null;
}): Promise<Wrap> {
  let user = describeDay(opts.day, opts.claude, opts.github);
  if (opts.reflection?.body) {
    // Their own account of the day outranks the machine record for `learned`
    // and `grew` — it is the only source for what the day felt like.
    user += `\n\nTHEIR OWN REFLECTION ON THE DAY (treat as authoritative for what
they learned and how they grew; the record above is only evidence):\n${opts.reflection.body}`;
    if (opts.reflection.energy) {
      user += `\n\nEnergy they rated the day: ${opts.reflection.energy}/5.`;
    }
  }

  const { value, model } = await generate({
    system: DAY_SYSTEM,
    user,
    schema: WrapSchema,
  });

  return store.saveWrap({ period: 'day', key: opts.day, model, ...value });
}

export async function writeRollup(period: Period, key: string): Promise<Wrap> {
  if (period === 'day') throw new Error('use writeDayWrap for a single day');
  const { from, to } = spanOf(period, key);

  const [dayWraps, dayReflections, ownReflection] = await Promise.all([
    store.getWrapsBetween('day', from, to),
    store.getReflectionsBetween('day', from, to),
    store.getReflection(period, key),
  ]);

  if (!dayWraps.length) {
    throw new NoDaysToRollUp(`no daily wraps between ${from} and ${to} to roll up`);
  }

  const reflectionByDay = new Map(dayReflections.map((r) => [r.key, r]));
  const sections = dayWraps.map((w) => {
    const parts = [`--- ${w.key} — ${w.headline}`];
    parts.push(bullets('  did:', w.did));
    parts.push(bullets('  learned:', w.learned));
    parts.push(bullets('  grew:', w.grew));
    const r = reflectionByDay.get(w.key);
    if (r?.body) {
      parts.push(
        `  they wrote: ${r.body.replace(/\s+/g, ' ').slice(0, 800)}` +
          (r.energy ? ` (energy ${r.energy}/5)` : ''),
      );
    }
    return parts.filter(Boolean).join('\n');
  });

  const covered = dayWraps.length;
  let user =
    `PERIOD: ${period} ${key} (${labelFor(period, key)})\n` +
    `${covered} day(s) wrapped in this period.\n\n` +
    sections.join('\n');

  if (ownReflection?.body) {
    user += `\n\nTHEIR OWN REFLECTION ON THE WHOLE ${period.toUpperCase()} (authoritative):\n${ownReflection.body}`;
  }

  const { value, model } = await generate({
    system: ROLLUP_SYSTEM,
    user,
    schema: WrapSchema.extend({ grew: z.array(z.string().min(1)).max(3) }),
    maxTokens: 3072,
  });

  return store.saveWrap({ period, key, model, ...value });
}
