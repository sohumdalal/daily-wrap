---
description: "Personal weekly engineering check-in. Pulls GitHub PRs and code activity, tracks goals, and asks an LLM for a candid weekly review."
tags:
  - "personal"
  - "weekly-review"
  - "github"
  - "goals"
authors: []
capabilities:
  - "weekly-snapshot"
  - "goal-tracking"
  - "llm-review"
integrations:
  - "anthropic"
  - "openai"
  - "github"
---

# Mentor

A personal Astropods agent for tracking engineering growth week-over-week. Each ISO week, it pulls GitHub activity, captures self-reflection, lets you define goals, and asks Claude or GPT for a candid weekly review against those goals.

## What it does

- **The Ledger** — PRs opened, merged, and reviewed in the current week
- **In Circulation** — repos touched, languages used, lines added/removed
- **The Masthead** — goals you define (title, description, metric, status)
- **Letters Home** — weekly reflection (energy 1–5, wins, blockers, surprises)
- **The Reading Room** — articles, docs, and talks you logged
- **The Editorial** — Claude or OpenAI grades each goal, calls out strengths and adjustments, and sets a focus for next week

A background scheduler refreshes GitHub data every 6 hours so the dashboard is always fresh when you open it.

## Architecture

Single container, three services:

- **Agent** — Hono web server on Bun (`agent/`). Serves the API and the built React frontend.
- **Frontend** — React 19 + Vite + Tailwind 4 SPA (`frontend/`).
- **Database** — Postgres for goals, week snapshots, and ingestion run history.

All weekly data is keyed by ISO week (`2026-W25`) and tagged with a `user_id` (currently `default`) so multi-tenancy can be added later without a migration.

## Deploy on Astropods

```bash
ast push
```

After deploy, open the agent URL and fill in the inputs declared in `astropods.yml`:

| Input | Description |
|---|---|
| `GITHUB_TOKEN` | PAT with `repo` + `read:user` scopes |
| `GITHUB_USERNAME` | Your handle |
| `LLM_PROVIDER` | `anthropic` or `openai` (default for new reviews) |
| `ANTHROPIC_MODEL` | Claude model (Opus 4.8 default) |
| `OPENAI_MODEL` | OpenAI model (gpt-4o default) |
| `DATA_ROOT` | Filesystem path for the volume (default `/data`) |

`ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are pulled from the `models:` block — Astropods injects them automatically.

## Local development

Requires Bun and Postgres on `localhost:5432`.

```bash
# One-time
createdb mentor
bun install
cd frontend && bun install && cd ..

# Run
bun run dev                  # agent on :3002 (auto-migrates on boot)
cd frontend && bun run dev   # vite on :5173 with HMR
```

Open <http://localhost:5173>.

The dev script (`scripts/dev.ts`) auto-loads secrets from `~/.ast/project-configs.json` if present, so once you've run `ast project ...` for this agent locally you don't need a `.env`. As a fallback, copy `.env.example` to `.env` and source it.

## Project layout

```
mentor/
├── agent/
│   ├── index.ts            # Hono entry point
│   ├── config.ts           # Env → config
│   ├── data/               # Domain ops (goals, weeks, dates)
│   ├── db/                 # Postgres client + migrations + ingestion log
│   ├── github/             # Octokit client (PR + repo + language queries)
│   ├── jobs/               # Scheduler + ingestion runner
│   ├── llm/                # Claude + OpenAI adapter, weekly-review prompt
│   └── routes/             # /api/* Hono routes
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── api.ts          # Typed fetch client
│       ├── styles.css      # Tailwind 4 + @theme tokens
│       └── components/     # Masthead, Ledger, Circulation, Goals, Reflection, ReadingRoom, Editorial
├── scripts/dev.ts          # Local dev launcher
├── astropods.yml           # Astropods deployment spec
├── Dockerfile              # Multi-stage production build
└── package.json
```

## Status

- ✅ GitHub ingestion (PRs opened / merged / reviewed + repos + languages)
- ✅ Goals CRUD with active/paused/achieved/archived statuses
- ✅ Weekly reflection (energy + wins + blockers + surprises + notes)
- ✅ Reading log
- ✅ Weekly LLM review with per-goal scoring, strengths, adjustments, focus
- ✅ Background scheduler (every 6h) with ingestion run history
- ⬜ Slack mentions → task extraction
- ⬜ Codex / Claude Code usage analysis from local transcripts
- ⬜ Prompting-quality analysis (comparing your prompts week-over-week)
