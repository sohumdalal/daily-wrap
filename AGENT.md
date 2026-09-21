---
description: "Reads your day out of Claude Code and GitHub, writes it back as five bullets, and keeps your reflection beside it."
tags:
  - personal
  - daily-review
  - claude-code
  - github
  - self-quantified
authors:
  - name: Sohum Dalal
    account: sohumdalal
repository: "github:sohumdalal/daily-wrap"
capabilities:
  - Reads a day out of your local Claude Code transcripts
  - Pulls the day's commits, pull requests and reviews from GitHub
  - Writes the day as five bullets plus what you learned and where you grew
  - Rolls days up into weekly, monthly and yearly wraps of growth
  - Keeps your own written reflection alongside every wrap
integrations:
  - GitHub
  - Anthropic
---

<h1 align="center">Daily Wrap</h1>

<p align="center"><em>What you did today, what you learned, where you grew.</em></p>

Daily Wrap keeps a record of your days so the year adds up to something you can
read. Each day it reads what you actually did — your Claude Code sessions and
your GitHub activity — and writes it back as at most five bullets, plus what you
learned and where you grew. You write the reflection. Those two halves are then
rolled up into weekly, monthly and yearly wraps.

The point is the rollups. A single day's bullets are mildly interesting; a year
of them, read back, is the only honest record of how you changed.

## The screen

One screen, mostly empty. The day's headline is the only thing above the fold.

- **Day** — the day in numbers, then what you did / learned / grew, then your reflection
- **Week / Month / Year** — the same shape, written from the days beneath it, which it lists

Keys: `←` `→` move, `D` `W` `M` `Y` switch period, `⏎` wrap, `R` jump to the reflection.

Nothing runs in the background. A wrap is written when you ask for one, which
also re-reads both sources first — so wrapping mid-afternoon and again at
midnight both give you the day as it stands.

## Where the day comes from

**Claude Code** — read from your Claude home (`~/.claude`, or `CLAUDE_HOME`):

- `history.jsonl` — every prompt you typed, which is the clearest record of intent
- `projects/**/*.jsonl` — per-session transcripts: Claude's own session titles, the
  repo and branch, tool calls, models, active time, and PRs opened from the session

Read-only, and only within the requested day. Files untouched since before the
day began are skipped, which is what keeps a 60MB+ transcript tree fast.

**GitHub** — commits authored, PRs opened, PRs merged, and PRs you reviewed for
someone else. Every query is bounded with the day's real UTC offset, so a local
day is a local day.

Day boundaries come from `TIMEZONE`, never from UTC.

## What it writes

```
headline   at most eight words
did        3–5 bullets, most consequential first
learned    0–3 bullets — a mechanism, a constraint, a root cause
grew       0–2 bullets — a change in how you work, judge or decide
```

`learned` and `grew` are allowed to come back empty, and often should. A day of
mechanical work ought to read as one — inventing growth would make the rollups
worthless, because they are built by reading these fields back.

Your reflection outranks the machine record. When you've written one, it is
treated as authoritative for what you learned and how you grew; the commits and
transcripts are only evidence.

## Setup

Deployed, Astropods prompts for everything declared in `astropods.yml`:

| Input | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Writes the wraps (from the `models.anthropic` entry) |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | Which Claude writes them |
| `GITHUB_TOKEN` | — | `repo` + `read:user`, so private repos count (from `integrations.github`) |
| `GITHUB_USERNAME` | `sohumdalal` | Whose commits and PRs to read |
| `TIMEZONE` | `America/New_York` | Where one day ends and the next begins |
| `CLAUDE_HOME` | `~/.claude` | Claude Code home to read |

Postgres comes from the `knowledge.daily-wrap-db` entry — no configuration.

<blockquote>
Claude Code transcripts live on the machine you code on. Deployed, the agent has
no <code>~/.claude</code> to read, so the Claude half of each day will be empty
and wraps will be written from GitHub alone. Run it locally to get the full day.
</blockquote>

## Local development

Requires Bun and Postgres on `localhost:5432`.

```bash
createdb daily_wrap
bun install
bun run dev          # http://localhost:3002, migrations run on boot
```

`scripts/dev.ts` loads secrets from `~/.ast/project-configs.json` if you've run
`ast project configure`, and takes a live GitHub token from `gh auth token`.
Otherwise copy `.env.example`.

## Design

The screen follows the Ferrari design system in `DESIGN.md`: near-black canvas,
Rosso Corsa used scarcely, Inter at 500, sharp corners, hairlines instead of
shadows. Ferrari's signature is a full-bleed cinematic photograph; there is no
photography here, so the day's headline takes that role — display-mega on the
bare canvas with nothing competing. The accent appears twice: the wordmark rule
and the marker on **where you grew**, which is the reason the record is kept.
