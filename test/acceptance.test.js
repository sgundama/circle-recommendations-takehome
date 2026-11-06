import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../src/db.js";
import { recommendFor } from "../src/rank.js";

const REFERENCE_TIME = "2026-09-21T00:00:00.000Z";
const DAY = 86_400_000;
const DATA = new URL("../data/", import.meta.url);

// Copies the seed snapshot and applies edits to circles.json. Lets a test place a
// Circle exactly where the seed data has none (e.g. inside the dormancy window).
function snapshotDir(t, editCircles = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), "circle-acceptance-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const name of ["topics", "users", "circles", "memberships", "activity"]) {
    cpSync(new URL(`${name}.json`, DATA), join(dir, `${name}.json`));
  }
  const file = join(dir, "circles.json");
  const circles = JSON.parse(readFileSync(file, "utf8"));
  editCircles(circles);
  writeFileSync(file, JSON.stringify(circles));
  return dir;
}

const atAge = (days) => new Date(Date.parse(REFERENCE_TIME) - days * DAY).toISOString();
const patch = (circles, id, fields) => Object.assign(circles.find((c) => c.id === id), fields);

const idsFor = (db, memberId, options = {}) =>
  new Set(recommendFor(db, memberId, { referenceTime: REFERENCE_TIME, limit: 20, ...options })
    .recommendations.map((r) => r.circle.id));

test("dormancy is applied at exactly 180 days through the recommendation path", (t) => {
  // The seed data has no Circle between 21 and 235 days old, so the constant must be
  // exercised with placed Circles: #1 at 100d and #5 at 181d, both made attractive.
  const dir = snapshotDir(t, (circles) => {
    patch(circles, 1, { last_activity_at: atAge(100), feed_posts_30d: 30, chat_messages_30d: 300 });
    patch(circles, 5, { last_activity_at: atAge(181), feed_posts_30d: 30, chat_messages_30d: 300 });
  });
  const db = openDatabase({ dataDir: dir });
  t.after(() => db.close());
  const ids = idsFor(db, 42);
  assert.ok(ids.has(1), "100 days old is inside the window and ranks on activity");
  assert.ok(!ids.has(5), "181 days old is dormant even when attractive on paper");
});

test("a Circle at exactly the boundary is dormant; one day inside is eligible", (t) => {
  const dir = snapshotDir(t, (circles) => {
    patch(circles, 1, { last_activity_at: atAge(180), feed_posts_30d: 30, chat_messages_30d: 300 });
    patch(circles, 5, { last_activity_at: atAge(179), feed_posts_30d: 30, chat_messages_30d: 300 });
  });
  const db = openDatabase({ dataDir: dir });
  t.after(() => db.close());
  const ids = idsFor(db, 42);
  assert.ok(!ids.has(1), "exactly 180 days is dormant");
  assert.ok(ids.has(5), "179 days is still eligible");
});

test("the reason window stays honest when the reference time is overridden", (t) => {
  const db = openDatabase();
  t.after(() => db.close());
  const result = recommendFor(db, 42, { referenceTime: "2026-11-05T00:00:00.000Z", limit: 3 });
  for (const r of result.recommendations) {
    assert.doesNotMatch(r.reason, /in the last 30 days/, r.reason);
    assert.match(r.reason, /in the 30 days before 2026-09-21/, r.reason);
  }
});
