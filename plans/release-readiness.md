# Release readiness

Daily Wrap is one person's agent with one person's credentials. This plan turns
it into a blueprint anyone deploys from the public catalog: they supply their
own GitHub token, optionally their own Slack app, and get a working wrap the
same day.

Scope is the deploy path only. Feature work stays in [roadmap.md](../docs/roadmap.md);
how the parts fit stays in [architecture.md](../docs/architecture.md).

## Definition of done

A person who has never seen this repo runs `ast blueprint deploy daily-wrap`,
fills in the form, and by the end of that day has a wrap covering their own
commits and their own Claude sessions. Nothing in the deployed agent refers to
`sohumdalal`.

## What the platform already handles

Each claim below is checkable against the named section of the
[package spec](https://astropods.com/docs/astropods-package-spec).

| Need | Mechanism | Spec | Deployer effort |
| --- | --- | --- | --- |
| Per-deployer credentials | `inputs` with `secret: true`, prompted at deploy, injected as env vars | 4.5, 8.4 | types them once |
| A database | `knowledge: {provider: postgres}`. The platform generates a random password and a managed user, then injects `POSTGRES_HOST/PORT/USER/PASSWORD/DB` | 4.2 | none |
| Backfill at deploy | `ingestion` entry with `trigger: {type: startup}`, which runs once at deploy time | 6 | none |
| Nightly run | `ingestion` entry with `trigger: {type: schedule}`, cron supplied at deploy | 6 | picks a cron |
| A model without a key | `models` with `provider: gateway`, which injects `ASTRO_GATEWAY_URL` and `ASTRO_GATEWAY_API_KEY` | 4.1 | picks a model |
| Public distribution | `ast blueprint push daily-wrap --visibility public` | n/a | none |

Two of these change decisions already made in `astropods.yml`.

The **gateway** removes the Anthropic key from the form entirely. Today
`models.anthropic.provider: anthropic` prompts for `ANTHROPIC_API_KEY`. A key we
never collect is a key we cannot leak, so the gateway is the better default. Keep
the direct provider only if per-deployer billing separation turns out to matter.

The **`ingestion` section** replaces the local cron in `scripts/nightly.ts`.
`trigger: startup` is the backfill primitive, so "run a backfill on their data"
is a spec field rather than a pipeline to build.

## Gaps

1. **Personal defaults are baked in.** `astropods.yml` defaults
   `GITHUB_USERNAME` to `sohumdalal` and `TIMEZONE` to `America/New_York`, and
   the spec name is `@sohumdalal/daily-wrap`. A default that is one person's
   handle is worse than no default: it silently produces an empty wrap instead
   of an obvious error.
2. **Slack is set up by hand.** The app was created from
   `slack-app-manifest.json` and its tokens live outside the spec. A deployer
   has no prompt for `SLACK_BOT_TOKEN` or `SLACK_APP_TOKEN`, and no way to set
   actionable reactions except the deploy form, because `SlackConfig()` exists
   on `Dev` alone.
3. **No `ingestion` section.** The nightly is a cron entry on one laptop, and
   there is no backfill at all. A new deployer sees an empty app until their
   first night.
4. **Supabase is load-bearing for the wrong reason.** `POSTGRES_URL` takes
   precedence over the discrete vars in `agent/db/client.ts`, so the deployed
   agent ignores the Postgres the platform provisioned for it. Supabase exists
   only because the laptop collector and the deployed agent must share one
   database. Remove that requirement and Supabase goes away, along with its
   IPv6-only direct host and its prepared-statement restriction.
5. **Claude transcripts cannot be read from the cluster.** This is the only
   blocker without an off-the-shelf answer. It gets its own section.

## The Claude ingestion problem

`agent/sources/claude.ts` reads `CLAUDE_HOME`, which defaults to `~/.claude`. An
`ingestion` container runs in the cluster and has no access to the deployer's
machine, so `trigger: startup` backfills GitHub perfectly, because GitHub is an
API, and returns zero Claude sessions.

This is already why the current setup is a laptop cron writing to Supabase while
the deployed agent only serves the UI. The blueprint does not create the
constraint, it makes it every deployer's problem.

Three options:

**A. Ship a local collector.** The deployer installs a small command that reads
their transcripts and pushes them up. Honest about the constraint, works today,
and costs the deployer one install step.

**B. Use Claude Code's OTLP telemetry.** Claude Code can export usage to
Astropods (`Settings > Data Sources`, then managed settings in the Anthropic
admin console), per team member, with tokens, cost, models, tools, and
optionally prompt text. No local install. The open question is whether an agent
can read it back: it lands in the platform's own trace and metrics stores, and
no read API is documented under `docs-public/fern/docs/pages`. Confirm with
whoever owns `astro-otel` before counting on this.

**C. Ship without Claude data.** GitHub and Slack only, with Claude as an
opt-in extra. Fastest to release and gives up the input that makes a wrap
specific about how the work happened.

Recommend **A now, B when the read path exists.** B is strictly better when it
works, because it needs no install and covers a whole team from one setting, but
it cannot be planned against an undocumented API.

### Design: two halves

- **Deployed:** the UI, GitHub ingestion, Slack capture, wrap generation, and
  the platform's Postgres. All self-provisioning.
- **Local:** a collector the deployer runs for Claude transcripts.

The collector **posts to an authenticated endpoint on the agent** rather than
connecting to the database. Handing every deployer Postgres credentials for
their laptop would throw away the provisioning the platform just did for free,
and would put a writable database on the public internet for each of them.

This is also what retires Supabase: once nothing outside the cluster needs the
database, the injected `POSTGRES_*` vars are enough.

## Work items

- [ ] Drop `GITHUB_USERNAME` and `TIMEZONE` defaults. Make both required, and
      fail loudly with an empty value rather than producing an empty wrap.
- [ ] Rename the spec away from `@sohumdalal/daily-wrap`.
- [ ] Declare `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN` as optional
      `secret: true` inputs. Slack stays optional: the app must work without it.
- [ ] Document in the README that actionable reactions are a deploy-form field,
      and that the value is `brain` with no colons.
- [ ] Add `ingestion.backfill` with `trigger: {type: startup}` covering GitHub.
- [ ] Add `ingestion.nightly` with `trigger: {type: schedule}`, replacing the
      cron entry.
- [ ] Add `POST /api/ingest/claude`, authenticated, accepting one civil day of
      sessions. Idempotent per day, since a collector will retry.
- [ ] Ship the collector as a single command. It reads `CLAUDE_HOME`, resolves
      civil days through `agent/time.ts`, and posts each day.
- [ ] Switch `models` to `provider: gateway` and drop `ANTHROPIC_API_KEY`.
- [ ] Stop preferring `POSTGRES_URL` over the injected discrete vars, or keep it
      only as a local-dev override.
- [ ] First-run state: an empty app must say what it is waiting for, not render
      a blank screen.
- [ ] Deploy from a clean account with no `.env.local` and no vault entries, as
      a real deployer would. That is the only test that proves this.

## Open questions

- **Is the OTLP telemetry readable by an agent?** Decides whether option B ever
  replaces the local collector. Ask the `astro-otel` owner.
- **How does the collector authenticate?** A frontend agent sits behind OIDC,
  which suits a browser and not a background command. Needs either a
  deploy-time token as an input or a device-style flow.
- **Does multi-tenancy ever apply?** Two of three inputs describe exactly one
  person: Claude transcripts come from one machine, GitHub from one token. Only
  Slack feedback is naturally shared, since a message can be feedback for
  several people. One deployment per person is the assumption until that
  changes. The reactor is already part of the `slack_feedback` key, so no
  capture is lost in the meantime.

## Out of scope

Feature work, which stays in the roadmap. Team or org accounts inside one
deployment. Reading another person's Claude or GitHub data.
