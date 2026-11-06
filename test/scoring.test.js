import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/db.js";
import { eligibleCircles } from "../src/repo.js";
import { WEIGHTS, byRank, collapseByTopic, scoreCircle } from "../src/scoring.js";

const REF = "2026-09-21T00:00:00.000Z";
const DAY = 86_400_000;
const circle = (over = {}) => ({
  id: 1, topic_slug: "negotiation", last_activity_at: REF, feed_posts_30d: 10, chat_messages_30d: 100,
  join_policy: "open", member_count: 10, max_members: null, ...over,
});
const ctx = (over = {}) => ({
  circle: circle(), tags: [], interests: new Set(), member: { id: 99, industry: "Technology" },
  members: [], coMembers: new Set(), referenceTime: REF, postsP90: 15, chatP90: 186, ...over,
});

test("dormancy boundary: exactly 180 days is dormant, 179 is not; full with null capacity is never full", () => {
  const db = openDatabase();
  const ids = (cutoff) => new Set(eligibleCircles(db, 42, cutoff).map((c) => c.id));
  // #32 The Resilience Room: last activity 2026-01-29 = 235 days before the reference.
  const at = (days) => new Date(Date.parse(REF) - days * DAY).toISOString();
  assert.equal(ids(at(236)).has(32), true, "cutoff 236d back: #32 is inside the window");
  assert.equal(ids(at(235)).has(32), false, "cutoff 235d back: #32 is exactly on the boundary and excluded");
  // #10 Negotiation Circle has max_members = null and is eligible; #20 is full (15/15) and is not.
  assert.equal(ids(at(180)).has(10), true);
  assert.equal(ids(at(180)).has(20), false);
});

test("a topic is counted once even when it appears as both Primary Topic and Tag", () => {
  const interests = new Set(["negotiation"]);
  const once = scoreCircle(ctx({ interests, tags: [] }));
  const repeated = scoreCircle(ctx({ interests, tags: ["negotiation", "negotiation"] }));
  assert.equal(once.topic, 1);
  assert.equal(repeated.topic, 1);
  assert.deepEqual(repeated.matched, ["negotiation"]);
});

test("a tag-only match earns score but no tier", () => {
  const r = scoreCircle(ctx({ interests: new Set(["confidence"]), tags: ["confidence"] }));
  assert.equal(r.primary, 0);
  assert.equal(r.tier, 0);
  assert.equal(r.topic, WEIGHTS.tag);
});

test("peers: each person counts once, the member is excluded, missing industry never matches", () => {
  const members = [
    { user_id: 99, industry: "Technology" }, // the member herself
    { user_id: 1, industry: "Technology" },  // industry only
    { user_id: 2, industry: null },          // co-member only
    { user_id: 3, industry: "Technology" },  // both
    { user_id: 4, industry: null },          // neither
  ];
  const r = scoreCircle(ctx({ members, coMembers: new Set([2, 3]) }));
  assert.equal(r.peerCount, 3);
  assert.equal(r.industryPeers, 2);
  assert.equal(r.coMemberPeers, 2);
  assert.equal(r.peers, 3 / 5);
  const noIndustry = scoreCircle(ctx({ members, member: { id: 99, industry: null } }));
  assert.equal(noIndustry.industryPeers, 0);
});

test("cold-start adjustments apply only when the member has no interests", () => {
  const cold = scoreCircle(ctx({ circle: circle({ topic_slug: null, join_policy: "request" }) }));
  assert.equal(cold.adjustment, -WEIGHTS.coldNoTopicPenalty);
  const coldOpen = scoreCircle(ctx({ circle: circle({ join_policy: "open" }) }));
  assert.equal(coldOpen.adjustment, WEIGHTS.coldOpenBonus);
  const warm = scoreCircle(ctx({ interests: new Set(["confidence"]), circle: circle({ topic_slug: null }) }));
  assert.equal(warm.adjustment, 0);
});

test("ranking is deterministic: tier, then score, then ascending id", () => {
  const rows = [
    { tier: 0, score: 0.9, circle: { id: 3 } },
    { tier: 1, score: 0.5, circle: { id: 2 } },
    { tier: 1, score: 0.5, circle: { id: 1 } },
  ];
  assert.deepEqual([...rows].sort(byRank).map((r) => r.circle.id), [1, 2, 3]);
});

test("collapse: one per topic, overflow becomes alternatives (max 2), topic-less never collapses, limit respected", () => {
  const mk = (id, topic) => ({ circle: { id, topic_slug: topic } });
  const sorted = [mk(1, "a"), mk(2, "a"), mk(3, "a"), mk(4, "a"), mk(5, null), mk(6, null), mk(7, "b"), mk(8, "b")];
  const main = collapseByTopic(sorted, { limit: 3 });
  assert.deepEqual(main.map((r) => r.circle.id), [1, 5, 6]);
  assert.deepEqual(main[0].alternatives.map((a) => a.circle.id), [2, 3], "capped at 2 alternatives");
  assert.deepEqual(main[1].alternatives, []);
  // topic "b" never made the main list, so it has no alternatives anywhere.
  assert.ok(main.every((r) => r.alternatives.every((a) => a.circle.topic_slug !== "b")));
});
