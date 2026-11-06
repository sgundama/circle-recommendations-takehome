import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/db.js";
import { recommendFor } from "../src/rank.js";

let db;
before(() => { db = openDatabase(); });
after(() => db.close());
const REFERENCE_TIME = "2026-09-21T00:00:00.000Z";
const recommend = (id, options = {}) => recommendFor(db, id, { referenceTime: REFERENCE_TIME, ...options });

const find = (result, id) => result.recommendations.find((r) => r.circle.id === id);
const kinds = (rec) => rec.reasons.map((r) => r.kind);

test("a Primary Topic match leads with the member's interest, using the topic label", () => {
  const rec = find(recommend(23), 22); // Level Up Collective, getting-promoted
  assert.match(rec.reason, /^Matches your interest in getting promoted/);
  assert.equal(rec.reasons[0].kind, "topic_match");
  assert.deepEqual(rec.reasons[0].topics, ["getting-promoted"]);
});

test("a tag-only match leads with the Circle's own subject, not the member's interest", () => {
  const rec = find(recommend(23), 19); // Working Mothers United, tagged getting-promoted
  assert.match(rec.reason, /^Focused on working motherhood, also covers getting promoted/);
  assert.equal(rec.reasons[0].kind, "related_topic");
  assert.doesNotMatch(rec.reason, /^Matches your interest/);
});

test("activity is described relative to the snapshot, and request-to-join is always disclosed", () => {
  const rec = find(recommend(23), 22); // 8 posts, hybrid, request
  assert.match(rec.reason, /8 posts in the 30 days before 2026-09-21/);
  assert.match(rec.reason, /request to join/);
  assert.ok(kinds(rec).includes("request_to_join"));
});

test("peers are reported as two separate counts", () => {
  const rec = find(recommend(7), 1); // The Elevation Circle: 2 industry, 2 co-members
  const peers = rec.reasons.find((r) => r.kind === "peers");
  assert.deepEqual(peers, { kind: "peers", same_industry: 2, from_your_circles: 2 });
  assert.match(rec.reason, /2 in your industry/);
  assert.match(rec.reason, /2 from your Circles/);
});

test("when alternatives exist the reason says so", () => {
  const result = recommend(15);
  const rec = result.recommendations.find((r) => r.alternatives.length === 2 && r.circle.topic === "negotiation");
  assert.match(rec.reason, /2 similar Circles on negotiation/);
  assert.ok(kinds(rec).includes("alternatives"));
});

test("a cold-start member gets a reason with no interest claim", () => {
  const rec = recommend(42).recommendations[0];
  assert.doesNotMatch(rec.reason, /your interest/);
  assert.match(rec.reason, /posts in the 30 days before 2026-09-21/);
  assert.match(rec.reason, /open to join/);
});
