import { generate, type Provider } from './client.ts';
import { activeGoals } from '../data/goals.ts';
import { getWeek, recentWeeks } from '../data/weeks.ts';
import type { Goal, WeekSnapshot, WeeklyReview, GoalScore } from '../types.ts';

const SYSTEM = `You are a senior engineering coach giving a candid, weekly performance review to an individual contributor.

The user runs this review every week. Be direct, specific, and grounded in the data they hand you. Avoid hedging, generic praise, and platitudes. Reference concrete activity (PR titles, languages, reflection content) rather than abstract qualities. If the data is sparse, say so plainly.

Output JSON only — no surrounding prose, no code fences.`;

type LLMReviewJson = {
  goalScores: Array<{ goalId: string; goalTitle: string; score: number; reason: string }>;
  strengths: string[];
  adjustments: string[];
  focusNextWeek: string;
  bodyMarkdown: string;
};

function summarizeWeek(w: WeekSnapshot): string {
  const lines: string[] = [];
  lines.push(`## Week ${w.isoWeek} (${w.start.slice(0, 10)} → ${w.end.slice(0, 10)})`);
  if (w.github) {
    lines.push(
      `- GitHub: ${w.github.totals.opened} opened, ${w.github.totals.merged} merged, ${w.github.totals.reviewed} reviewed; +${w.github.totals.additions}/−${w.github.totals.deletions} across ${w.github.reposTouched.length} repos`,
    );
    if (w.github.prsMerged.length) {
      lines.push('- Merged:');
      for (const pr of w.github.prsMerged.slice(0, 10)) {
        lines.push(`  - ${pr.repo}#${pr.number}: ${pr.title}`);
      }
    }
    if (w.github.prsReviewed.length) {
      lines.push(`- Reviewed: ${w.github.prsReviewed.length} PRs`);
    }
  } else {
    lines.push('- GitHub: no data');
  }
  if (w.reflection) {
    lines.push(`- Energy: ${w.reflection.energy}/5`);
    lines.push(`- Wins: ${w.reflection.wins}`);
    lines.push(`- Blockers: ${w.reflection.blockers}`);
    lines.push(`- Surprises: ${w.reflection.surprises}`);
  }
  if (w.reading.length) {
    lines.push(`- Reading: ${w.reading.map((r) => r.title).join('; ')}`);
  }
  return lines.join('\n');
}

function buildPrompt(args: {
  goals: Goal[];
  current: WeekSnapshot;
  history: WeekSnapshot[];
}): string {
  const { goals, current, history } = args;

  const goalLines = goals.length
    ? goals
        .map(
          (g) =>
            `- ${g.id} :: ${g.title}${g.metric ? ` (metric: ${g.metric})` : ''}${g.description ? ` — ${g.description}` : ''}`,
        )
        .join('\n')
    : '(no active goals defined)';

  const historyBlock = history.length
    ? history.map(summarizeWeek).join('\n\n')
    : '(no prior week snapshots)';

  return [
    '## Active goals',
    goalLines,
    '',
    '## Current week',
    summarizeWeek(current),
    '',
    '## Previous weeks (most recent first)',
    historyBlock,
    '',
    '## Task',
    `Produce a weekly review.

Return ONLY a JSON object matching this TypeScript type — no surrounding text, no code fences:

{
  "goalScores": [
    { "goalId": string, "goalTitle": string, "score": 1|2|3|4|5, "reason": string }
  ],
  "strengths": string[],     // 2-3 items
  "adjustments": string[],   // 2-3 items, each phrased as a concrete next action
  "focusNextWeek": string,   // one sentence
  "bodyMarkdown": string     // 200-400 word markdown summary, candid voice
}

Scoring guide for goalScores: 1 = no signal / regression, 3 = on-pace, 5 = clearly exceeded. Score every active goal even if the data is thin (use 1-2 and explain why). If there are no active goals, return an empty goalScores array.`,
  ].join('\n');
}

function tryParseJson(raw: string): LLMReviewJson | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(trimmed) as LLMReviewJson;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as LLMReviewJson;
    } catch {
      return null;
    }
  }
}

export async function generateWeeklyReview(
  isoWeek: string,
  opts: { provider?: Provider; model?: string } = {},
): Promise<WeeklyReview> {
  const [goals, current, history] = await Promise.all([
    activeGoals(),
    getWeek(isoWeek),
    recentWeeks(4),
  ]);

  const prior = history.filter((w) => w.isoWeek !== isoWeek).slice(0, 4);

  const result = await generate({
    system: SYSTEM,
    user: buildPrompt({ goals, current, history: prior }),
    provider: opts.provider,
    model: opts.model,
    temperature: 0.6,
  });

  const parsed = tryParseJson(result.body);
  const goalScores: GoalScore[] = parsed?.goalScores ?? [];
  return {
    provider: result.provider,
    model: result.model,
    generatedAt: new Date().toISOString(),
    body: parsed?.bodyMarkdown ?? result.body,
    goalScores,
    strengths: parsed?.strengths ?? [],
    adjustments: parsed?.adjustments ?? [],
    focusNextWeek: parsed?.focusNextWeek ?? '',
  };
}
