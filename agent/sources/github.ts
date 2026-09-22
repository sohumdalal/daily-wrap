/**
 * Reads a day out of GitHub: commits authored, PRs opened, PRs merged, PRs
 * reviewed for someone else.
 *
 * Every query is bounded with an explicit UTC offset for the day in question
 * (`2026-09-21T00:00:00-04:00..2026-09-21T23:59:59-04:00`) so the window
 * matches the local day rather than a UTC one.
 */

import { Octokit } from '@octokit/rest';
import { offsetSuffix } from '../time.ts';
import type { Commit, GitHubDay, PullRequest, ReviewedPullRequest } from '../types.ts';

/** Per-query page cap. A single day never approaches this. */
const PER_PAGE = 50;
const MAX_PAGES = 3;
/** Fetching additions/deletions costs one request per PR. */
const MAX_ENRICHED = 20;

let client: Octokit | null = null;

function gh(token: string): Octokit {
  if (!client) {
    client = new Octokit({
      auth: token,
      log: {
        debug: () => {},
        // Request traces, one line per call, which bury a nightly log.
        info: () => {},
        // The issues-and-PRs search endpoint warns on every call that it is
        // deprecated. It is still the only way to query PRs by date across
        // repos, and `advanced_search` keeps it working — so drop that one
        // warning and let every other through.
        warn: (message: string) => {
          if (!message.includes('issuesAndPullRequests')) console.warn(message);
        },
        error: console.error,
      },
    });
  }
  return client;
}

/** The `..`-delimited range qualifier covering one local day. */
function dayRange(day: string, timezone: string): string {
  const off = offsetSuffix(day, timezone);
  return `${day}T00:00:00${off}..${day}T23:59:59${off}`;
}

function repoFromPullUrl(htmlUrl: string): string {
  return htmlUrl.match(/github\.com\/([^/]+\/[^/]+)\/pull\//)?.[1] ?? 'unknown';
}

type SearchedPr = {
  number: number;
  title: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  state: string;
  mergedAt: string | null;
  author: string;
  repo: string;
};

async function searchPrs(token: string, q: string): Promise<SearchedPr[]> {
  const out: SearchedPr[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await gh(token).search.issuesAndPullRequests({
      q,
      per_page: PER_PAGE,
      page,
      advanced_search: 'true',
    });
    for (const item of res.data.items) {
      out.push({
        number: item.number,
        title: item.title,
        htmlUrl: item.html_url,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        state: item.state,
        mergedAt:
          (item.pull_request as { merged_at?: string | null } | undefined)?.merged_at ?? null,
        author: item.user?.login ?? 'unknown',
        repo: repoFromPullUrl(item.html_url),
      });
    }
    if (res.data.items.length < PER_PAGE) break;
  }
  return out;
}

/** Diff size for a PR. Null when the repo or PR isn't reachable. */
async function prDiff(
  token: string,
  repo: string,
  number: number,
): Promise<{ additions: number; deletions: number } | null> {
  const [owner, name] = repo.split('/');
  if (!owner || !name) return null;
  try {
    const res = await gh(token).pulls.get({ owner, repo: name, pull_number: number });
    return { additions: res.data.additions, deletions: res.data.deletions };
  } catch {
    return null;
  }
}

async function toPullRequests(token: string, rows: SearchedPr[]): Promise<PullRequest[]> {
  return Promise.all(
    rows.map(async (r, i): Promise<PullRequest> => {
      const diff = i < MAX_ENRICHED ? await prDiff(token, r.repo, r.number) : null;
      return {
        repo: r.repo,
        number: r.number,
        title: r.title,
        url: r.htmlUrl,
        state: r.mergedAt ? 'merged' : r.state === 'closed' ? 'closed' : 'open',
        createdAt: r.createdAt,
        mergedAt: r.mergedAt,
        additions: diff?.additions ?? null,
        deletions: diff?.deletions ?? null,
      };
    }),
  );
}

/**
 * Commits authored on the day, across every repo the token can see.
 *
 * `search/commits` is the only cross-repo commit query GitHub offers. It is
 * subject to indexing lag, so a commit pushed minutes ago may not appear yet —
 * re-collecting the day later picks it up.
 */
async function fetchCommits(
  token: string,
  username: string,
  day: string,
  timezone: string,
): Promise<Commit[]> {
  const q = `author:${username} author-date:${dayRange(day, timezone)}`;
  const out: Commit[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await gh(token).search.commits({ q, per_page: PER_PAGE, page, sort: 'author-date' });
    for (const item of res.data.items) {
      out.push({
        repo: item.repository.full_name,
        sha: item.sha.slice(0, 8),
        // Only the subject line — commit bodies are mostly trailers.
        message: item.commit.message.split('\n')[0] ?? '',
        url: item.html_url,
        at: item.commit.author?.date ?? '',
      });
    }
    if (res.data.items.length < PER_PAGE) break;
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export async function fetchGitHubDay(
  day: string,
  opts: { token: string; username: string; timezone: string },
): Promise<GitHubDay> {
  const { token, username, timezone } = opts;
  if (!token) throw new Error('GITHUB_TOKEN is not configured');
  if (!username) throw new Error('GITHUB_USERNAME is not configured');
  const range = dayRange(day, timezone);

  const [commits, openedRaw, mergedRaw, reviewedRaw] = await Promise.all([
    fetchCommits(token, username, day, timezone),
    searchPrs(token, `is:pr author:${username} created:${range}`),
    searchPrs(token, `is:pr author:${username} merged:${range}`),
    searchPrs(token, `is:pr reviewed-by:${username} -author:${username} updated:${range}`),
  ]);

  const [opened, merged] = await Promise.all([
    toPullRequests(token, openedRaw),
    toPullRequests(token, mergedRaw),
  ]);

  const reviewed: ReviewedPullRequest[] = reviewedRaw.map((r) => ({
    repo: r.repo,
    number: r.number,
    title: r.title,
    url: r.htmlUrl,
    author: r.author,
    at: r.updatedAt,
  }));

  const repos = [
    ...new Set([
      ...commits.map((c) => c.repo),
      ...opened.map((p) => p.repo),
      ...merged.map((p) => p.repo),
      ...reviewed.map((p) => p.repo),
    ]),
  ];

  return {
    commits,
    opened,
    merged,
    reviewed,
    repos,
    totals: {
      commits: commits.length,
      opened: opened.length,
      merged: merged.length,
      reviewed: reviewed.length,
      additions: merged.reduce((n, p) => n + (p.additions ?? 0), 0),
      deletions: merged.reduce((n, p) => n + (p.deletions ?? 0), 0),
    },
  };
}
