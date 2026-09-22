# Daily Wrap

An Astropods agent that keeps a record of your days so the year adds up to
something you can read.

Each day it reads what you actually did — your Claude Code sessions and your
GitHub activity — and writes it back as at most five bullets, plus what you
learned and where you grew. You write the reflection. Both halves roll up into
weekly, monthly and yearly wraps.

The rollups are the point. A single day's bullets are mildly interesting; a year
of them is the only honest record of how you changed.

## What it reads

**Claude Code**, from `~/.claude` (read-only, one day at a time):

| Source | What it gives |
|---|---|
| `history.jsonl` | Every prompt you typed — the clearest record of intent |
| `projects/**/*.jsonl` | Session titles Claude wrote, repo + branch, tool calls, models, active minutes, PRs opened |

**GitHub**: commits authored, PRs opened, PRs merged, PRs reviewed for others —
each query bounded with the day's real UTC offset so a local day is a local day.

## What it writes

```
headline   a terse label, ≤6 words — used in a rollup's list of days
did        3–5 bullets, grouped by thread of work, not one per artifact
learned    2–3 sentences — the agent's read on what the period taught you
grew       0–2 bullets — where to improve next, measured against your goals
```

The prompts you typed are the **primary** evidence; GitHub is corroboration.
Two people can ship the same diff and have had completely different days, and
only the prompts show how you framed the problem, when you changed your mind,
and what you refused to accept.

`learned` is the point. It is a paragraph rather than a list because it is an
argument, and it sits directly beside the reflection you write yourself — the
agent's read and yours, saved together. It may be empty: a mechanical day should
read as one, and manufactured insight would make the rollups worthless, since
they are written by reading these fields back across days.

Each day also sees the **ten days before it**, so a wrap can recognise ongoing
work rather than describing every day as though it began from nothing.

**Sources** are derived from collected data only, never from model output — every
row is a real URL from the GitHub API or a Claude transcript, so a wrap can be
wrong about a sentence but never about a link.

### Goals

The **Goals** tab holds what you're trying to become — by category (career,
craft, impact, personal, and the intrinsic *why*) and horizon (quarter, year,
long term), each with an optional measure and the reason it matters to you.

Active goals are an input to every wrap. That is what lets *where to improve*
be measured against your own direction rather than a generic idea of a good
engineer — including saying plainly when a day of real work moved none of them.

### History

`wraps` holds the current wrap; `wrap_versions` is append-only and holds every
version ever written, including the current one. Re-wrapping a day overwrites
what you see and appends to the history, and each version records **why** it
exists — a plain `wrap`, or a `disagree` you forced. Once a key has more than
one version, the take shows a `N versions` disclosure listing the earlier
paragraphs.

That is what makes the record show how the agent's read of you changed, rather
than only where it landed.

### Disagreeing

If the agent's read of you is wrong, press **Disagree** and say why. The note is
stored and shown to *every* wrap written afterwards as a binding instruction, and
the current one is rewritten immediately. This is the only mechanism by which the
agent's model of you improves instead of being wrong the same way forever.

## Architecture

One container. No build step.

```
daily-wrap/
├── astropods.yml       blueprint/v1 — frontend agent, github + anthropic + postgres
├── AGENT.md            agent card (registry-facing)
├── DESIGN.md           → ../DESIGN.md (shared Ferrari design system, one per agents/ tree)
├── Dockerfile          single stage; bun, port 80
└── agent/
    ├── index.ts        Bun.serve + Hono; binds before touching the database
    ├── config.ts       env → config, and an honest readiness report
    ├── time.ts         civil-date math in a fixed IANA timezone (DST-aware)
    ├── types.ts
    ├── store.ts        every SQL statement in the agent
    ├── llm.ts          one structured Claude call, retried once on a parse failure
    ├── wrap.ts         the prompts, and the shape of a wrap
    ├── routes.ts       the whole API — eight routes
    ├── db/             postgres client + append-only migrations
    ├── sources/
    │   ├── claude.ts   a day out of the Claude Code transcripts
    │   └── github.ts   a day out of the GitHub API
    └── ui/             index.html + app.css + app.js — no framework, no bundler
```

Days, wraps and reflections are all keyed by `(period, key)` — `day`/`week`/
`month`/`year` against `2026-09-21`/`2026-W39`/`2026-09`/`2026` — so a week or
a year can carry a reflection of its own, and a rollup is just a wrap written
from the wraps beneath it.

## API

| Route | Does |
|---|---|
| `GET /healthz` | Liveness, for the platform healthcheck |
| `GET /api/state` | What's configured, and today's date in `TIMEZONE` |
| `GET /api/view/:period/:key` | Everything the screen needs for one key |
| `POST /api/view/day/:day/collect` | Re-read Claude and GitHub for that day |
| `POST /api/view/:period/:key/wrap` | Write the wrap (a day re-collects first) |
| `PUT /api/reflection/:period/:key` | Save the reflection and energy |
| `GET /api/index/:period` | Keys that have a wrap or a reflection on them |

## Local development

Requires Bun and Postgres on `localhost:5432`.

```bash
createdb daily_wrap
bun install
bun run dev          # http://localhost:3002, migrations run on boot
bun run typecheck
```

`scripts/dev.ts` reads `.env.local` first (gitignored — the right place for a
database URL), then `~/.ast/project-configs.json`, and takes a live GitHub token
from `gh auth token` since a stale token in the ast bag would otherwise shadow
it.

### Pointing this laptop at the shared database

Set `POSTGRES_URL` in `.env.local` to the Postgres the deployed agent uses and
this process writes the days it collects straight into it:

```
POSTGRES_URL=postgresql://postgres:PW@db.<ref>.supabase.co:5432/postgres
```

That is the only way a deployed copy ever sees Claude Code activity — the
transcripts are on this machine, so the laptop does the collecting and the
deployed agent serves the result. The boot line names whichever database is in
use, and the header carries a marker whenever it is not local.

## Deploy

```bash
ast spec validate
ast blueprint push daily-wrap
ast blueprint deploy daily-wrap --var ANTHROPIC_API_KEY=@ANTHROPIC_API_KEY
```

`agent.interfaces.frontend: true` means the platform routes a dedicated hostname
straight to the container on port 80 and skips the built-in chat UI; OIDC
sign-in still sits at the front door.

> Claude Code transcripts live on the machine you code on. A deployed agent has
> no `~/.claude` to read, so the Claude half of each day comes back empty and
> wraps are written from GitHub alone. Run it locally for the full day.

### Sharing one database with the deployed agent

Point both copies at the same Postgres and the laptop can collect while the
deployed agent serves. Connect the database under **Knowledge > Add store**,
then set `daily-wrap-db` to **Shared** at deploy.

## Status

- ✅ Claude Code day: sessions, titles, prompts, tools, models, active time, PR links
- ✅ GitHub day: commits, PRs opened / merged / reviewed, timezone-correct windows
- ✅ Daily wrap — headline, did, learned, grew
- ✅ Reflection with energy, on any period
- ✅ Weekly / monthly / yearly rollups written from the days beneath them
- ⬜ Growth trendlines across periods
- ⬜ A year view worth printing

## The nightly wrap

Nothing watches `~/.claude`, so a day you never open the app on is a day that
never gets wrapped, even though the transcripts are sitting there.
`scripts/nightly.ts` closes that gap without the web server:

```bash
bun run nightly                # today, plus any unwrapped day in the last 7
bun run nightly 2026-09-19     # one specific day, rewrapped
bun run nightly --window 30    # widen the catch-up window
bun run nightly --dry-run      # report what it would do
```

It looks back over a window rather than at today alone, so a laptop that was
asleep or a day spent away from the machine does not leave a permanent hole.
A day already wrapped is left alone, except today, which is still in progress.

Run it nightly from cron:

```
30 23 * * * cd /path/to/daily-wrap && PATH=$HOME/.bun/bin:/opt/homebrew/bin:/usr/bin:/bin bun scripts/nightly.ts >> $HOME/Library/Logs/daily-wrap-nightly.log 2>&1
```

The explicit `PATH` matters: cron starts with almost none, and the job needs
`bun` and `gh`. If the project lives under `~/Desktop`, `~/Documents` or
`~/Downloads`, macOS will block cron from reading it until you grant
**Full Disk Access** to `/usr/sbin/cron` in System Settings > Privacy &
Security. The failure is silent, so check the log after the first night.

## Keeping Postgres running (macOS)

`brew services` is broken on Homebrew 6.0.12 — a formula uses `stop_timeout`,
which that version dropped, and the command dies while iterating every formula.
It has nothing to do with Postgres. Install the LaunchAgent the formula already
ships, which is what `brew services start` would have done:

```bash
cp /opt/homebrew/opt/postgresql@16/homebrew.mxcl.postgresql@16.plist \
   ~/Library/LaunchAgents/
launchctl load -w ~/Library/LaunchAgents/homebrew.mxcl.postgresql@16.plist
pg_isready -h localhost -p 5432
```

`RunAtLoad` + `KeepAlive` mean it starts at login and restarts if it dies. To
undo: `launchctl unload -w ~/Library/LaunchAgents/homebrew.mxcl.postgresql@16.plist`.
