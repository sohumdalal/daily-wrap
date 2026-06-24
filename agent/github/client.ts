import { Octokit } from '@octokit/rest';
import { config } from '../config.ts';
import type { GitHubActivity, PR, ReviewedPR } from '../types.ts';

let _client: Octokit | null = null;
function client(): Octokit {
  if (!_client) {
    if (!config.github.token) throw new Error('GITHUB_TOKEN is not configured');
    _client = new Octokit({ auth: config.github.token });
  }
  return _client;
}

function dateRange(startIso: string, endIso: string): string {
  return `${startIso.slice(0, 10)}..${endIso.slice(0, 10)}`;
}

function parseRepoFromUrl(htmlUrl: string): string {
  // https://github.com/owner/repo/pull/123 -> owner/repo
  const m = htmlUrl.match(/github\.com\/([^/]+\/[^/]+)\/pull\//);
  return m ? m[1]! : 'unknown';
}

async function searchPRs(q: string): Promise<Array<{
  number: number;
  title: string;
  url: string;
  htmlUrl: string;
  createdAt: string;
  closedAt: string | null;
  state: string;
  user: { login: string } | null;
  pullRequest: { merged_at: string | null } | undefined;
  repo: string;
}>> {
  const gh = client();
  const out: Array<{
    number: number;
    title: string;
    url: string;
    htmlUrl: string;
    createdAt: string;
    closedAt: string | null;
    state: string;
    user: { login: string } | null;
    pullRequest: { merged_at: string | null } | undefined;
    repo: string;
  }> = [];
  let page = 1;
  while (true) {
    const res = await gh.search.issuesAndPullRequests({
      q,
      per_page: 50,
      page,
      advanced_search: 'true',
    });
    for (const item of res.data.items) {
      out.push({
        number: item.number,
        title: item.title,
        url: item.url,
        htmlUrl: item.html_url,
        createdAt: item.created_at,
        closedAt: item.closed_at,
        state: item.state,
        user: item.user ? { login: item.user.login } : null,
        pullRequest: item.pull_request
          ? { merged_at: (item.pull_request as { merged_at: string | null }).merged_at }
          : undefined,
        repo: parseRepoFromUrl(item.html_url),
      });
    }
    if (res.data.items.length < 50) break;
    page += 1;
    if (page > 4) break; // safety cap — 200 items per query is plenty for a week
  }
  return out;
}

async function prDetails(
  repo: string,
  number: number,
): Promise<{ additions: number; deletions: number; mergedAt: string | null } | null> {
  const gh = client();
  const [owner, name] = repo.split('/');
  if (!owner || !name) return null;
  try {
    const res = await gh.pulls.get({ owner, repo: name, pull_number: number });
    return {
      additions: res.data.additions,
      deletions: res.data.deletions,
      mergedAt: res.data.merged_at,
    };
  } catch {
    return null;
  }
}

async function repoLanguage(repo: string): Promise<string | null> {
  const gh = client();
  const [owner, name] = repo.split('/');
  if (!owner || !name) return null;
  try {
    const res = await gh.repos.get({ owner, repo: name });
    return res.data.language ?? null;
  } catch {
    return null;
  }
}

export async function fetchWeekActivity(
  startIso: string,
  endIso: string,
): Promise<GitHubActivity> {
  const username = config.github.username;
  if (!username) throw new Error('GITHUB_USERNAME is not configured');
  const range = dateRange(startIso, endIso);

  const [openedRaw, mergedRaw, reviewedRaw] = await Promise.all([
    searchPRs(`is:pr author:${username} created:${range}`),
    searchPRs(`is:pr author:${username} merged:${range}`),
    searchPRs(`is:pr reviewed-by:${username} -author:${username} updated:${range}`),
  ]);

  // Hydrate PR details for opened + merged so we have additions/deletions
  const enrich = async (rows: typeof openedRaw): Promise<PR[]> =>
    Promise.all(
      rows.map(async (r): Promise<PR> => {
        const det = await prDetails(r.repo, r.number);
        const state: PR['state'] = r.pullRequest?.merged_at
          ? 'merged'
          : r.state === 'closed'
            ? 'closed'
            : 'open';
        return {
          number: r.number,
          title: r.title,
          repo: r.repo,
          url: r.htmlUrl,
          state,
          createdAt: r.createdAt,
          mergedAt: r.pullRequest?.merged_at ?? undefined,
          additions: det?.additions,
          deletions: det?.deletions,
        };
      }),
    );

  const [prsOpened, prsMerged] = await Promise.all([
    enrich(openedRaw),
    enrich(mergedRaw),
  ]);

  const prsReviewed: ReviewedPR[] = reviewedRaw.map((r) => ({
    number: r.number,
    title: r.title,
    repo: r.repo,
    url: r.htmlUrl,
    reviewedAt: r.createdAt,
    author: r.user?.login ?? 'unknown',
  }));

  const reposTouched = Array.from(
    new Set<string>([
      ...prsOpened.map((p) => p.repo),
      ...prsMerged.map((p) => p.repo),
      ...prsReviewed.map((p) => p.repo),
    ]),
  );

  const langPairs = await Promise.all(
    reposTouched.map(async (r) => [r, await repoLanguage(r)] as const),
  );
  const languages: Record<string, number> = {};
  for (const [, lang] of langPairs) {
    if (!lang) continue;
    languages[lang] = (languages[lang] ?? 0) + 1;
  }

  const additions = prsMerged.reduce((acc, p) => acc + (p.additions ?? 0), 0);
  const deletions = prsMerged.reduce((acc, p) => acc + (p.deletions ?? 0), 0);

  return {
    prsOpened,
    prsMerged,
    prsReviewed,
    reposTouched,
    languages,
    totals: {
      opened: prsOpened.length,
      merged: prsMerged.length,
      reviewed: prsReviewed.length,
      additions,
      deletions,
    },
  };
}
