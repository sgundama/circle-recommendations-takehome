import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../src/db.js";
import { recommendFor } from "../src/rank.js";

test("loads the snapshot with foreign keys on and repeated tags removed", (t) => {
  const db = openDatabase();
  t.after(() => db.close());

  assert.equal(db.pragma("foreign_keys", { simple: true }), 1);
  assert.equal(db.prepare("SELECT count(*) AS n FROM users").get().n, 100);
  assert.equal(db.prepare("SELECT count(*) AS n FROM circles").get().n, 40);
  assert.equal(db.prepare("SELECT count(*) AS n FROM memberships").get().n, 441);

  // Circle #17 lists "difficult-conversations" twice in the source JSON.
  const tags = db.prepare("SELECT tag FROM circle_tags WHERE circle_id = 17 ORDER BY tag").all().map((r) => r.tag);
  assert.deepEqual(tags, ["difficult-conversations", "managing-a-team"]);

  // Interests are normalised; user 7 has two.
  const interests = db.prepare("SELECT topic_slug FROM user_interests WHERE user_id = 7 ORDER BY topic_slug").all().map((r) => r.topic_slug);
  assert.deepEqual(interests, ["leadership-skills", "public-speaking"]);
});

test("a stored snapshot can be reopened without reloading or losing its data", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "circle-db-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "snapshot.sqlite");
  const options = { referenceTime: "2026-09-21T00:00:00.000Z", limit: 1 };
  const first = openDatabase({ path });
  first.prepare("UPDATE circles SET name = ? WHERE id = 22").run("Stored Circle");
  const expected = recommendFor(first, 23, options);
  first.close();
  const second = openDatabase({ path });
  t.after(() => second.close());
  assert.deepEqual(recommendFor(second, 23, options), expected);
  assert.equal(expected.recommendations[0].circle.name, "Stored Circle");
});
