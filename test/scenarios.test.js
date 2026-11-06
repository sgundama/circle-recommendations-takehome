import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/db.js";
import { recommendFor } from "../src/rank.js";

let db;
before(() => { db = openDatabase(); });
after(() => db.close());
const REFERENCE_TIME = "2026-09-21T00:00:00.000Z";
const recommend = (id, options = {}) => recommendFor(db, id, { referenceTime: REFERENCE_TIME, ...options });

const ids = (result) => result.recommendations.map((r) => r.circle.id);
const everywhere = (result) =>
  new Set([...ids(result), ...result.recommendations.flatMap((r) => r.alternatives.map((a) => a.id))]);

test("full / inactive (user 23): #20 and #21 never appear, #22 ranks first", () => {
  const result = recommend(23);
  const seen = everywhere(result);
  assert.equal(seen.has(20), false, "#20 The Promotion Path is full");
  assert.equal(seen.has(21), false, "#21 Career Climbers is dormant and unlisted");
  assert.equal(ids(result)[0], 22, "#22 Level Up Collective is the healthy alternative");
});

test("duplicates (user 15): one negotiation Circle in the list, the other two as alternatives", () => {
  const result = recommend(15);
  const negotiation = [10, 11, 12];
  const inMain = ids(result).filter((id) => negotiation.includes(id));
  assert.equal(inMain.length, 1, `main list has ${inMain.join(",")}`);
  assert.ok(ids(result).indexOf(inMain[0]) < 3, "the negotiation Circle is in the top 3");

  const head = result.recommendations.find((r) => r.circle.id === inMain[0]);
  const altIds = head.alternatives.map((a) => a.id).sort();
  assert.deepEqual(altIds, negotiation.filter((id) => id !== inMain[0]), "the other two are attached as alternatives");
});

test("obvious matches (user 7): #6 in the top 3 and #5 visible", () => {
  const result = recommend(7);
  assert.ok(ids(result).slice(0, 3).includes(6), "#6 Speak Up Circle in top 3");
  assert.ok(everywhere(result).has(5), "#5 Women Who Lead is a recommendation or an alternative");
  // Both of her interests are covered in the top 2.
  const topTopics = result.recommendations.slice(0, 2).map((r) => r.circle.topic).sort();
  assert.deepEqual(topTopics, ["leadership-skills", "public-speaking"]);
});

test("cold start (user 42): a full list of active Circles, mostly open, no topic-less Circle on top", () => {
  const result = recommend(42);
  const top5 = result.recommendations.slice(0, 5);
  assert.equal(result.recommendations.length, 10, "returns the default limit");
  assert.ok(top5.filter((r) => r.circle.join_policy === "request").length <= 2, "at most 2 request-to-join in top 5");
  assert.ok(top5.every((r) => r.circle.topic !== null), "no topic-less Circle in top 5");
  assert.ok(top5.every((r) => r.circle.member_count >= 5), "top 5 are established Circles");
});

test("every member gets at least one recommendation and never a Circle they already belong to", () => {
  const memberIds = db.prepare("SELECT id FROM users").all().map((r) => r.id);
  const joinedOf = db.prepare("SELECT circle_id FROM memberships WHERE user_id = ?");
  for (const id of memberIds) {
    const result = recommend(id);
    assert.ok(result.recommendations.length >= 1, `user ${id} has recommendations`);
    const joined = new Set(joinedOf.all(id).map((r) => r.circle_id));
    for (const cid of everywhere(result)) assert.ok(!joined.has(cid), `user ${id} already belongs to #${cid}`);
  }
});

test("unknown member returns null", () => {
  assert.equal(recommend(9999), null);
});
