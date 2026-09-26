# Feature impact

Daily Wrap measures effort. Commits, PRs, reviews, Claude sessions, and time
spent are all inputs about what you did. None of them says whether it mattered.

This plan adds the first outcome input: when a feature ships, record a release
event in the observability stack, then pull its traffic back in every day so a
wrap can say how the thing is doing, not just that it was built.

The interesting number is the gap between the two. "You spent three days on
saved filters. Eleven people have used it." That is a growth signal no amount of
commit counting produces.

## The real problem is attribution, not vendor choice

Picking Grafana or New Relic is the easy half. Both have a release-marker
primitive and a query language:

| | Release marker | Query |
| --- | --- | --- |
| New Relic | Change Tracking deployments, via NerdGraph | NRQL |
| Grafana | Annotations API, tagged, at a timestamp | PromQL or the datasource's own |

The hard half is that a merged PR does not map to a metric. Nothing in
`GitHubDay.merged` tells you which chart moves when that code ships. Something
has to declare "this feature is that number," and no vendor does it for you.

So the unit of work here is a **feature registry**, not an integration:

```
feature:  saved-filters
shipped:  2026-09-18
source:   newrelic
query:    SELECT uniqueCount(userId) FROM PageView WHERE path LIKE '/filters%'
```

Daily Wrap polls each registered feature once a day, stores the value against
that civil day, and computes deltas from its own history. Day over day, week
over week, and month over month then fall out of the same table the wraps
already roll up from, using the period shapes in `agent/time.ts`.

Keeping the query in the registry rather than deriving it is the whole design
decision. It is manual, it is the only thing that actually works, and it means a
feature with no measurable surface simply is not registered.

## Where the release event comes from

Daily Wrap already ingests `merged: PullRequest[]` for every day (see
`GitHubDay` in `agent/types.ts`), so it can emit the marker itself rather than
asking anyone to remember. A merged PR whose branch or title matches a
registered feature writes a Change Tracking deployment or a Grafana annotation
with that feature's tag.

That closes the loop in one direction: ship, mark, measure, report. It also
makes the marker useful to people who never open Daily Wrap, because deployment
markers show up on the team's existing dashboards.

## Vendor

Lean New Relic, on evidence rather than preference: this environment has a New
Relic MCP connector configured, which means someone at the org already wired it
up and the account exists. An Amplitude connector is configured too, and for
"how is my feature doing" product analytics is arguably the better fit than an
APM. Grafana is the weakest of the three here unless the metrics only exist in
Prometheus.

Decide by answering one question: **where does traffic for a Postman feature
actually live today?** Build against that and treat the registry's `source`
field as the seam that keeps a second one possible.

## This item fails the roadmap's own bar, and needs a reframe

The roadmap judges every item the same way: *"does it make one day's wrap
sharper? The day is the smallest successful unit, so a change that only pays off
at the yearly view is not ready."*

Feature traffic is slow. A feature shipped today has no meaningful day-over-day
signal for weeks, so on the day it lands this input says nothing. Taken
literally, that disqualifies it.

The reframe that makes it fit: the daily fact is not *this* feature's growth, it
is **any** registered feature crossing something today. "Saved filters passed
fifty users." "Everyone-groups traffic dropped for the third straight day."
Those are day-level facts, produced by a slow-moving series, and they belong in
a day's wrap because they are things you would want to know today.

Build the daily poll and the crossing detection together. A stored series with
no day-level readout is the yearly-view-only change the roadmap warns about.

## Work items

- [ ] Decide the source by finding where Postman feature traffic actually lives.
- [ ] `features` table: slug, shipped date, source, query, and whether it is
      still being tracked.
- [ ] Registry UI. A Goals-style tab is the closest existing pattern.
- [ ] A source adapter behind one interface, so a second vendor is additive.
      One method: given a query and a civil day, return a number.
- [ ] `feature_metrics` table: one row per feature per day. Idempotent per day,
      because a poll will retry.
- [ ] Daily poll in the nightly run, with the same catch-up window the wrap
      collection uses.
- [ ] Crossing detection: thresholds, streaks, and reversals, so a day has
      something to say.
- [ ] Emit the release marker from a merged PR that matches a registered
      feature.
- [ ] Feed the day's crossings into the wrap prompt as an input, the way goals
      and Slack feedback already are.
- [ ] Rollups: show the series across week, month and year using the existing
      period shapes.

## Open questions

- **Is a query per feature acceptable to maintain?** If registering a feature
  takes twenty minutes of NRQL, nobody registers the third one. A template per
  common shape, such as a route prefix or a custom event name, may be the
  difference between this being used and abandoned.
- **Where does the credential live?** A New Relic API key is another
  `secret: true` input, which touches
  [release-readiness.md](release-readiness.md). It also means every deployer of
  the blueprint needs their own observability account for this feature to do
  anything, so it has to degrade to off cleanly.
- **Does the marker belong to Daily Wrap?** Writing deployment markers into a
  shared team dashboard from a personal agent is a side effect on someone
  else's surface. Worth asking before turning it on, rather than after.
- **What counts as shipped?** A merged PR is not a release at Postman, where
  deploys go through
  [cloud9-parcels-production-deployments](https://github.com/postman-eng/cloud9-parcels-production-deployments).
  The marker may need to come from that repo rather than from the feature PR.

## Out of scope

Dashboards inside Daily Wrap. The app reports a number and its delta; the
vendor already renders charts better than this ever will. Also out: alerting,
and anything that writes to a team surface without being asked.
