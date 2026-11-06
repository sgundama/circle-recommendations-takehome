# Prototype calibration notes

## Question

Do the draft eligibility, scoring, tiering and one-per-topic rules in `DESIGN.md` produce
sensible lists for users 7, 15, 23 and 42? Which values should the real code use for the
items marked "open for calibration": tag weight, peer weight, tier mode, per-topic limit,
cold-start bonus and penalty?

## Run

    (prototype removed after calibration; the scorer now lives in src/scoring.js)

## Observed with defaults (before the user drove it)

- All four scenario checks pass with `DEFAULTS` as written in `scoring.mjs`.
- Tier mode `any` puts tag-only matches (topic 0.3) in a band above every non-match.
  For user 7 that band is #31 Team Leads, #14 Imposter Syndrome, #34 Visibility Lab, #40
  Network & Grow, all with the Reason "matches your interest in public speaking". For user 23
  it puts #19 Working Mothers United second. Tier mode `primary` keeps #6/#1 and #22 on top
  and lets strong non-matches interleave with the tag-only band. `off` is identical to
  `primary` on these four users.
- #1 The Elevation Circle beats #5 Women Who Lead for user 7 at every peer weight tried
  (0.1–0.3); #1 wins on activity. The ADR already accepts this.
- User 15: #10, #11, #12 score within 0.008 of each other. The winner is arbitrary;
  the Alternatives carry the other two. The Reason should say so.
- Cold start: the +0.05 open bonus barely moves anything; the −0.05 null-topic penalty moves
  #27 from #2 to #8. Top 5 for user 42 are all open except #15.

## Answer

- tier mode: **primary**. A Primary Topic match always outranks a non-match. Tag-only
  matches compete on score with everything else. Chosen because `any` stacked quiet
  tag-only Circles (4–5 posts) above the most active Circles with 4+ known peers, with the
  thin Reason "matches your interest in X" on an unrelated Circle. `off` gives the same
  lists today but drops the strong-match guarantee.
- tag weight: 0.3 (unchanged). Lowering it to 0.2 does not move #19 for user 23; ~0.1 would,
  at the cost of every other tag match. Not worth it.
- peer weight: 0.1 (unchanged). #1 beats #5 for user 7 at every value tried; #1 wins on activity.
- per-topic limit: 1, Alternatives ≤ 2 (unchanged; see ADR-0002).
- cold open bonus / null penalty: 0.05 / 0.05 (unchanged). Top 5 for user 42 are open Circles
  except #15; #27 drops from #2 to #8.
- Reason changes needed:
  1. Tag-only matches must lead with the Circle's Primary Topic:
     "A working motherhood Circle that also covers getting promoted", not
     "matches your interest in getting promoted".
  2. When a Recommendation has Alternatives, say so: "2 similar Circles on negotiation".
  3. "Members you may know" is good; keep industry and co-member counts separate.

Verdict: all four planted scenarios pass with these values. `scoring.mjs` was lifted into `src/scoring.js`
and the TUI was deleted.
