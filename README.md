---
description: "Reads your day out of Claude Code and GitHub, writes it back as five bullets, and keeps your reflection beside it."
tags:
  - personal
  - daily-review
  - claude-code
  - github
authors:
  - name: Sohum Dalal
    account: sohumdalal
repository: "github:sohumdalal/daily-wrap"
---

# Daily Wrap

An Astropods agent that keeps a record of your days so the year adds up to
something you can read.

Each day it reads what you actually did, writes it back as at most five
bullets, and then asks you about it until you have three takeaways you believe.
Days roll up into weeks, months and years.

The day is the smallest unit that has to work. If a day's wrap is not worth
reading, no rollup built from it can be.

- [`docs/architecture.md`](docs/architecture.md) — sources, assembly, schema, and why each piece is shaped that way
- [`docs/roadmap.md`](docs/roadmap.md) — what is next, and the open questions

## What it reads

**Claude Code**, from `~/.claude`, read-only: every prompt you typed, plus
session titles, repos, branches, tool calls, models and active minutes.

**GitHub**: commits authored, PRs opened, merged, and reviewed for others, each
query bounded to your local day.

Your prompts are the primary evidence; GitHub corroborates. Two people can ship
the same diff and have had completely different days.

## What it writes

```
headline   ≤6 words, used in a rollup's day list
did        3–5 bullets, grouped by thread of work
learned    2–3 sentences — the read on what the period taught you
grew       0–2 bullets — where to improve next, against your goals
```

`learned` and `grew` may be empty, and often should be. Manufactured insight
would make the rollups noise, since they are written by reading those fields
back.

## The screen

Three tabs on a period. **Summary** is the record. **Reflection** is a chat that
ends in your three. **Sources** is every artifact behind the wrap as a real
link, searchable and filterable.

Keys: `←` `→` move · `D` `W` `M` `Y` period · `⏎` wrap · `T` today.

## Local development

Needs Bun, and Postgres on `localhost:5432` unless you point it elsewhere.

```bash
createdb daily_wrap
bun install
bun run dev            # http://localhost:3002, migrations run on boot
bun run check          # typecheck, then the UI checks
```

Secrets, in precedence order: your shell, then `.env.local` (gitignored), then
`~/.ast/project-configs.json`. `GITHUB_TOKEN` comes from `gh auth token` unless
your shell sets one.

Required: `ANTHROPIC_API_KEY`. Optional: `ANTHROPIC_MODEL` (display names like
`Sonnet` resolve), `TIMEZONE`, `CLAUDE_HOME`, `POSTGRES_URL`.

### Pointing at the shared database

Put a `POSTGRES_URL` in `.env.local` and this process writes into the same
database the deployed agent serves. Use Supabase's **pooler** string: the direct
host resolves AAAA only, so any moment without IPv6 drops the connection, and
the pooler's user must carry the project ref (`postgres.<ref>`). The boot line
names whichever database is in use.

### The nightly wrap

Nothing watches `~/.claude`, so a day you never open the app on is a day that
never gets wrapped.

```bash
bun run nightly                # today, plus any unwrapped day in the last 7
bun run nightly 2026-09-19     # one day, rewrapped
bun run nightly --force        # replace a stored capture that is wrong, not thin
bun run nightly --dry-run
```

From cron, with an explicit `PATH` because cron has almost none:

```
30 23 * * * cd /path/to/daily-wrap && PATH=$HOME/.bun/bin:/opt/homebrew/bin:/usr/bin:/bin bun scripts/nightly.ts >> $HOME/Library/Logs/daily-wrap-nightly.log 2>&1
```

If the project lives under `~/Desktop`, `~/Documents` or `~/Downloads`, macOS
may block cron from reading it until `/usr/sbin/cron` has Full Disk Access.
Check the log after the first night.

## Deploy

```bash
ast login
ast push                 # build and register
```

Then deploy **from the dashboard**, not the CLI: binding the database to a
shared store is a deploy-form control with no flag.

1. **Knowledge → Add store** — your Postgres, host/port/database/credentials
2. **Blueprints → daily-wrap → Deploy**
3. `daily-wrap-db` → **Shared** → that store
4. `ANTHROPIC_API_KEY` from the vault, `GITHUB_TOKEN` as a PAT with `repo` +
   `read:user`

`agent.interfaces.frontend: true` routes a hostname straight to the container on
port 80 and skips the built-in chat UI; OIDC sign-in stays at the front door.

> A deployed agent has no `~/.claude`, so the Claude half of each day is empty
> up there. Bind a shared database and let the laptop collect while the deployed
> agent serves.
