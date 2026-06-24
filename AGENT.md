---
description: "Personal weekly engineering check-in. Pulls GitHub PR + code activity, tracks goals you define, captures reflection and reading, then asks Claude or OpenAI for a candid weekly review against those goals."
tags:
  - "personal"
  - "weekly-review"
  - "github"
  - "goals"
  - "self-quantified"
authors: []
capabilities:
  - "github-ingestion"
  - "weekly-snapshot"
  - "goal-tracking"
  - "llm-review"
integrations:
  - "anthropic"
  - "openai"
  - "github"
---

<h1 align="center">Mentor</h1>

<p align="center"><em>A weekly engineering log — field notes from the desk.</em></p>

Mentor ingests your GitHub activity each ISO week (PRs opened, merged, reviewed; repos touched; languages; net lines), holds the goals you've named, captures a short reflection (energy, wins, blockers, surprises) and the things you've read, then asks an LLM to grade the week against your goals and tell you what to adjust.

## Setup

After deploying, visit your agent's URL.

### 1. Provide a GitHub token

In the agent's configuration, set:

- **GITHUB_TOKEN** — a personal access token with `repo` and `read:user` scopes (private repos count toward your weekly PR totals)
- **GITHUB_USERNAME** — your GitHub handle

A background job will pull your activity for the current and most recently completed ISO week within a few seconds of the token landing, then refresh every six hours.

### 2. Pick an LLM provider

Set at least one of:

- **ANTHROPIC_API_KEY** — to use Claude for the weekly review
- **OPENAI_API_KEY** — to use GPT for the weekly review

You can switch between providers per-review from the UI; **LLM_PROVIDER** controls the default.

### 3. Name your goals

Open the dashboard and add a few goals on the masthead — title, optional description, and an optional metric (e.g. *"ship 2 PRs/wk"*, *"finish 1 systems-design chapter/wk"*). Goals carry a status — `active`, `paused`, `achieved`, or `archived` — and only `active` goals are scored.

## Usage

### The weekly dashboard

The page is one long broadsheet edition with six sections:

- **The Ledger** — totals and lists for PRs opened, merged, and reviewed this week
- **In Circulation** — repositories touched, language mix, net lines added/removed
- **The Masthead** — goals you've named, with add/edit/delete and status switching
- **Letters Home** — the week's reflection (energy 1–5, wins, blockers, surprises, notes)
- **The Reading Room** — articles, docs, talks you logged this week with one-line takeaways
- **The Editorial** — the LLM's reading of the week against your goals

### Generating a weekly review

Open **The Editorial**, toggle between **Claude** and **OpenAI**, and press **Compose this week's editorial**. The model receives your active goals, the current week's snapshot, and the previous four weeks for trend context. It returns:

- A 1–5 score and one-paragraph rationale for every active goal
- 2–3 things you're holding (strengths)
- 2–3 concrete adjustments
- A single-sentence focus for the week to come
- A 200–400 word markdown body

You can recompose at any time. Each generation overwrites the previous review for that week.

### Browsing prior weeks

Use the **Prev / Next** controls and the week selector at the top of the page. Past weeks are read-only snapshots — the reflection, reading log, and editorial as you filed them.

### Background ingestion

A scheduler runs every six hours and pulls your GitHub activity for the current ISO week. It also fills in last week's snapshot if no successful ingestion was recorded after the week boundary. The **Wire Room** strip at the top of the page shows when the last successful pull happened.

## Configuration

| Setting | Default | Description |
|---|---|---|
| `GITHUB_TOKEN` | — | PAT with `repo` + `read:user` scopes |
| `GITHUB_USERNAME` | `sohumdalal` | The handle whose PR activity to track |
| `LLM_PROVIDER` | `anthropic` | Default provider for new reviews; switchable per-review in the UI |
| `ANTHROPIC_MODEL` | `claude-opus-4-8` | Claude model used when provider is `anthropic` |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model used when provider is `openai` |
| `DATA_ROOT` | `/data` | Filesystem path for any future file-based exports (data lives in Postgres) |

## Local development

```bash
# One-time
createdb mentor
bun install
cd frontend && bun install && cd ..

# Run
bun run dev                  # agent on :3002 (auto-migrates on boot)
cd frontend && bun run dev   # vite on :5173 with HMR
```

Open <http://localhost:5173>. The dev script auto-loads secrets from `~/.ast/project-configs.json` if you've configured them for this agent via the Astropods CLI; otherwise set them in your shell.
