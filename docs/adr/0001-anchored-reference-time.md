# Use the snapshot date as the reference time

The seed dataset uses the fixed anchor `2026-09-21T00:00:00Z` in
[`generate.mjs`](../../generate.mjs). An explicit reference-time override takes precedence;
otherwise, this submission uses that anchor. A fixed date keeps recency and dormancy stable
when the same snapshot is evaluated later.

## Consequences

- Reject an invalid override. Do not infer the snapshot date from activity timestamps.
  The latest Circle activity is six hours before the known snapshot date.
- Tests inject a fixed reference time and do not depend on the host clock.
- For live production data, obtain the current time from a clock at the start of each request.
  Use that time throughout the request. Do not retain a timestamp captured at process startup.
- Twenty-nine Circles have a feed post dated after their `last_activity_at`.
  Use the Circle aggregates as authoritative for scoring and dormancy.
  Preserve the source data and document this inconsistency.
