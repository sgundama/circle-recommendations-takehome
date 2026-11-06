# Circle Recommendations API

This API gives a ranked list of Circles to a Lean In Connect member.
For each Circle, the API also gives a short reason that the member can read.
This repository is the submission for the Lean In Software Engineer take-home assignment.

## 1. Deliverables

The assignment asks for three deliverables. This table shows where to find each one.

| Deliverable (from the assignment) | Location |
| --- | --- |
| API that gives a ranked list of Circles and a reason for each result. It runs locally. | [`src/`](src/). Setup is in [section 2](#2-setup). |
| Database schema: tables, relations, indexes, and the rationale | [`schema.sql`](schema.sql). A summary is in [section 6](#6-database-schema). |
| Technical design document (1 page): what I built, tradeoffs, production scale | [`DESIGN.md`](DESIGN.md) |

Other documents:

- [`data/README.md`](data/README.md): the dataset and the data dictionary.
- [`CONTEXT.md`](CONTEXT.md): the domain glossary.
- [`docs/adr/`](docs/adr/): two architecture decision records.
- [`docs/prototype-calibration.md`](docs/prototype-calibration.md): how I set the score weights.
- [`docs/review-2026-11-05.md`](docs/review-2026-11-05.md): the review report.

## 2. Setup

You must have Node.js 22 or a later version.
You do not need a database server. SQLite runs in memory.

1. Open a terminal in the root folder of this repository.
2. Install the dependencies:

   ```sh
   npm install
   ```

3. Start the server:

   ```sh
   npm start
   ```

4. Make sure that the server runs. Open `http://localhost:3000/health`.
5. Run the tests (optional):

   ```sh
   npm test
   ```

   Result: 34 tests pass in approximately 0.4 seconds.

### Configuration

| Variable | Default | Function |
| --- | --- | --- |
| `PORT` | `3000` | Sets the server port. |
| `REFERENCE_TIME` | `2026-09-21T00:00:00Z` | Sets the default "now". This is the snapshot date of the dataset. Refer to [ADR-0001](docs/adr/0001-anchored-reference-time.md). |

The `reference_time` query parameter replaces `REFERENCE_TIME` for one request.

## 3. API

```
GET /
GET /health
GET /users/:id/recommendations?limit=10&explain=false
```

`GET /` lists the endpoints and gives one example path to try.

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | integer, 1 or more | — | If the member does not exist, the API gives `404`. |
| `limit` | integer, 1 to 20 | 10 | The number of main recommendations. |
| `explain` | boolean | false | If `true`, the API adds the score parts to each result. |
| `reference_time` | ISO timestamp | snapshot date | Sets "now" for one request. Use `Z` or a numeric offset. |

If the input is not valid, the API gives `400`.
If no Circle is eligible for the member, the API gives `200` and an empty list.

### Example

```sh
curl 'localhost:3000/users/15/recommendations?limit=1'
```

```json
{
  "member_id": 15,
  "reference_time": "2026-09-21T00:00:00.000Z",
  "recommendations": [
    {
      "circle": { "id": 13, "name": "Confident Voices", "topic": "confidence", "format": "in_person",
                  "join_policy": "open", "member_count": 12, "max_members": 18 },
      "reason": "Matches your interest in confidence and negotiation · very active (14 posts in the 30 days before 2026-09-21) · members you may know: 1 from your Circles · 1 similar Circle on confidence",
      "reasons": [
        { "kind": "topic_match", "topics": ["confidence", "negotiation"] },
        { "kind": "activity", "level": "very active", "posts_30d": 14, "chat_messages_30d": 71, "last_active_days": 1 },
        { "kind": "peers", "same_industry": 0, "from_your_circles": 1 },
        { "kind": "alternatives", "count": 1, "topic": "confidence" },
        { "kind": "open_to_join", "format": "in_person" }
      ],
      "alternatives": [
        { "id": 37, "name": "The Confidence Lab", "format": "virtual", "join_policy": "request" }
      ]
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `reason` | The sentence that the member reads. |
| `reasons[]` | The same evidence in a structured form. A client can show it as chips or translate it. |
| `alternatives` | Other eligible Circles on the same topic. The API shows one main Circle for each topic and puts the others here. |

## 4. The four test scenarios

The assignment names four scenarios. The dataset has a planted member for each scenario.
Use these requests to examine the results.
Add `&explain=true` to see the tier and the score parts.

| Scenario | Request | Expected result |
| --- | --- | --- |
| Cold start: no memberships and no stated interests | `/users/42/recommendations` | Active Circles, most of them open to join. The reasons do not claim a topic match. |
| Obvious matches: interests agree with a few Circles | `/users/7/recommendations` | #6 Speak Up Circle is first. #1 and #5 are both leadership matches. #5 is an alternative below #1. |
| Duplicate Circles: near-identical Circles on one topic | `/users/15/recommendations` | Only one negotiation Circle (#11) is in the list. #10 and #12 are its alternatives. |
| Full and inactive Circles | `/users/23/recommendations` | #22 Level Up Collective is first. #20 (full) and #21 (inactive, unlisted) do not show. |

## 5. Signals and rationale

The assignment says that the selection of signals is part of the evaluation.
This section gives a summary. [`DESIGN.md`](DESIGN.md) gives more data.

### Signals that the API uses

| Signal | How the API uses it | Why |
| --- | --- | --- |
| Membership, access, capacity, last activity | Hard filter. The API removes Circles that the member is in, and Circles that are unlisted, full, or inactive for 180 days or more. | A member cannot join a Circle that is full or inactive. A low rank is not sufficient. |
| Circle primary topic and member interests | Sets the tier. Gives 60% of the score. | This makes obvious matches rank first. |
| Circle tags and member interests | Adds 0.3 for each tag that matches. Does not change the tier. | Tags are free-form, so they are a weaker signal than the primary topic. |
| Posts, chat messages, and recency (30 days) | Gives 30% of the score. The values are normalised to the 90th percentile of the snapshot. | Members need Circles that are active. |
| Same industry and shared Circles ("peers") | Gives 10% of the score. | A member can trust a Circle more if she knows some of its members. |
| Join policy | The reason shows it. Open Circles get a small bonus for cold-start members. | An open Circle is the easiest first step for a new member. |

### Signals that the API does not use

| Signal | Why not |
| --- | --- |
| `location`, `format` | Circles have no location field, so the API cannot compare the two. |
| `profile_completeness`, `has_photo`, `joined_at` | These fields describe the member. They do not tell if a Circle is a good fit. |
| `description` | The text is from a template, so it adds no new data. |
| Engagement for each post in `activity.json` | It follows `feed_posts_30d` closely. |
| Leader profiles | This is the next signal to add. There was not sufficient time. |

## 6. Database schema

The full schema and the comments are in [`schema.sql`](schema.sql).

### Tables and relations

| Table | Contents | Relations |
| --- | --- | --- |
| `topics` | The fixed topic taxonomy | — |
| `users` | Member profile fields | — |
| `circles` | Circle profile, capacity, and activity totals | `topic_slug` → `topics` |
| `memberships` | The link between a member and a Circle, with the role | → `users`, → `circles` |
| `user_interests` | One row for each stated interest of a member | → `users`, → `topics` |
| `circle_tags` | One row for each tag on a Circle | → `circles`. No link to `topics`, because tags are free-form. |
| `activity` | Feed posts and engagement counts | → `circles`, → `users` |

The dataset keeps interests and tags as JSON arrays.
The schema puts them in join tables, so topic matches use a SQL join and not a JSON scan.
The loader removes duplicate tags. For example, Circle #17 has one tag two times.

### Indexes

| Index | Why |
| --- | --- |
| `memberships(circle_id)` | The primary key `(user_id, circle_id)` finds the Circles of a member. This index finds the members of a Circle, for peers and leaders. |
| `circles(topic_slug)` | Finds candidate Circles for a member interest. |
| `circles(access, last_activity_at)` | Supports the eligibility filter: public and recently active. |

There is no index on `activity(circle_id, created_at)`. This version of the scoring does not read `activity`.

## 7. Evaluation criteria

This table shows how the submission agrees with each criterion in the assignment.

| Criterion | How the submission agrees |
| --- | --- |
| Product sense | Each result has a sentence in plain language. The API shows a reason only if there is a signal for it. Counts show the time window. Tag-only matches start with the subject of the Circle. |
| Engineering craft | The steps are separate: SQL eligibility, pure scoring functions, topic collapse, and reason text. 34 tests cover the four scenarios, all 100 members, reasons, HTTP, and limit values. |
| Judgment | The API removes full and inactive Circles before it ranks. It shows one Circle for each topic. "Now" is the snapshot date. [`DESIGN.md`](DESIGN.md) records each tradeoff. |
| Mission awareness | Lean In wants women to find relevant and active Circles. The ranking puts active, open, and joinable Circles first. The reasons tell a member why a Circle can help her career. |
| AI fluency | I used AI as a design partner. An interview-style review made [`CONTEXT.md`](CONTEXT.md) and the [ADRs](docs/adr/). A prototype set the weights. Then I wrote the tests first and the code after. |

## 8. Scope and future work

The assignment gives a limit of 3 to 4 hours. I kept the scope small to stay in that limit.
With more time, I will do these tasks (refer to [`DESIGN.md`](DESIGN.md)):

1. Record which Circles the API shows and which Circles members join. Use this data to set the weights.
2. Calculate the recommendations each night. Do the eligibility check again at read time.
3. Move to Postgres with the same schema. Add authentication, so a member can read only her own list.
4. Add a better similarity model when the metadata is sufficiently good. Add leader profiles as a signal.

## 9. Project layout

```
schema.sql          tables, constraints, indexes (with rationale in comments)
src/db.js           opens SQLite, applies the schema, loads data/*.json
src/repo.js         all SQL queries, including the eligibility filter
src/scoring.js      pure scoring and the one-per-topic collapse
src/reasons.js      member-facing reason text and structured reasons
src/rank.js         sequence: member → eligible → score → collapse → present
src/server.js       Fastify routes and input validation
src/index.js        entry point
test/               scenario, reason, HTTP, and unit tests (node:test)
docs/adr/           two architecture decision records
docs/prototype-calibration.md   how I set the weights
CONTEXT.md          domain glossary
```
