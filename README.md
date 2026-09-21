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
headline   at most eight words
did        3–5 bullets, most consequential first
learned    0–3 bullets — a mechanism, a constraint, a root cause
grew       0–2 bullets — a change in how you work, judge or decide
```

`learned` and `grew` may be empty, and often should be. A mechanical day should
read as one; manufactured insight would make the rollups worthless, since they
are written by reading these fields back across days.

Your own reflection outranks the machine record — when you've written one it is
authoritative for what you learned, and the commits are only evidence.

## Architecture

One container. No build step.

```
daily-wrap/
├── astropods.yml       blueprint/v1 — frontend agent, github + anthropic + postgres
├── AGENT.md            agent card (registry-facing)
├── DESIGN.md           Ferrari design system the screen follows
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

`scripts/dev.ts` loads secrets from `~/.ast/project-configs.json` if present and
takes a live GitHub token from `gh auth token` — a stale token in the ast bag
would otherwise shadow it. Otherwise copy `.env.example`.

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

## Status

- ✅ Claude Code day: sessions, titles, prompts, tools, models, active time, PR links
- ✅ GitHub day: commits, PRs opened / merged / reviewed, timezone-correct windows
- ✅ Daily wrap — headline, did, learned, grew
- ✅ Reflection with energy, on any period
- ✅ Weekly / monthly / yearly rollups written from the days beneath them
- ⬜ Growth trendlines across periods
- ⬜ A year view worth printing
