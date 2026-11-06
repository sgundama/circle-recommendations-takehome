# Circle Recommendations — Technical Design

## What I built

A Node/Fastify API over SQLite. `GET /users/:id/recommendations` returns ranked Circles, each
with a member-facing reason plus structured `reasons[]`. Per request: **eligibility** (SQL) →
**scoring** (pure functions) → **collapse** to one Circle per topic → **explain**. 34 tests
cover the planted scenarios, all 100 members, reasons, HTTP, and boundaries.

## Signals used, and why

- **Hard excludes** — joined, unlisted, full, dormant (≥180 days). An unjoinable Circle is a
  dead end, not a low rank.
- **Primary topic vs. interests** — tier plus 60% of score. Makes "obvious matches" obvious.
- **Tags vs. interests** — +0.3 per distinct tag, no tier; the reason says "also covers X".
- **Posts, chat, recency** — 30% of score, normalised to the snapshot p90.
- **Industry and co-membership** — 10% as "peers"; Circles carry no industry, members carry it.
- **Join policy** — disclosed; small cold-start bonus for open.

**Not used:** `location`, `format` (nothing on the Circle side); `profile_completeness`,
`has_photo`, `joined_at` (describe the member, not the fit); `description` (templated);
post-level engagement (tracks `feed_posts_30d`); leader profiles (next signal, not in 4 h).

## Decisions and tradeoffs

- **One Circle per topic, rest as alternatives** ([ADR-0002](docs/adr/0002-limit-circles-per-primary-topic.md)).
  The negotiation Circles score within 0.008; two-per-topic showed near-identical rows back to
  back. Cost: user 7 gets #5 as an alternative under #1.
- **Tier on primary topic only.** Tiering on tags stacked quiet tag-matches above very active
  Circles with known peers. Weights calibrated with a throwaway scorer
  ([notes](docs/prototype-calibration.md)).
- **"Now" is the snapshot date** ([ADR-0001](docs/adr/0001-anchored-reference-time.md)); otherwise
  every Circle looks six weeks stale. `REFERENCE_TIME` overrides it.
- **Honest reasons.** Fragments are gated on their signal; tag-only matches lead with the
  Circle's own subject; counts name the snapshot window.
- **Cold start uses the same model** plus two nudges. Peer evidence stays: most interest-less
  members still have memberships.

## Schema

`user_interests` and `circle_tags` normalise the two JSON arrays. Tags are free-form, so
`circle_tags` has no FK to `topics`; the loader de-duplicates (Circle #17 repeats one). Indexes
and rationale are in `schema.sql` comments; `activity` is loaded, not read.

## For production

1. **Measure** shown/joined; fit the weights to real outcomes.
2. **Precompute** recommendations nightly; re-apply eligibility at read time.
3. **Postgres**, same schema; auth so a member reads only her own list.
4. **Richer similarity** once metadata beats the topic rule.

**How I worked with AI:** as a design partner — an interview-style review produced `CONTEXT.md`
and two ADRs; later passes changed decisions; a prototype calibrated weights; then test-first
implementation.
