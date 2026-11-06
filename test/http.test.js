import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../src/db.js";
import { buildServer } from "../src/server.js";

let app, db;
const REFERENCE_TIME = "2026-09-21T00:00:00.000Z";
before(async () => {
  db = openDatabase();
  app = buildServer({ db, referenceTime: REFERENCE_TIME });
  await app.ready();
});
after(async () => { await app.close(); db.close(); });

const get = (url) => app.inject({ method: "GET", url });

test("GET /health", async () => {
  const res = await get("/health");
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: "ok" });
});

test("GET / lists the endpoints", async () => {
  const res = await get("/");
  assert.equal(res.statusCode, 200);
  assert.equal((await get(res.json().try)).statusCode, 200);
});

test("GET /users/:id/recommendations returns the ranked list with reasons and reference_time", async () => {
  const res = await get("/users/7/recommendations");
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.member_id, 7);
  assert.equal(body.reference_time, "2026-09-21T00:00:00.000Z");
  assert.equal(body.recommendations.length, 10);
  const first = body.recommendations[0];
  assert.deepEqual(Object.keys(first).sort(), ["alternatives", "circle", "reason", "reasons"]);
  assert.equal(typeof first.reason, "string");
  assert.ok(Array.isArray(first.reasons) && first.reasons.length > 0);
  assert.equal("explain" in first, false);
});

test("limit is honoured within 1..20", async () => {
  assert.equal((await get("/users/7/recommendations?limit=3")).json().recommendations.length, 3);
  assert.equal((await get("/users/7/recommendations?limit=20")).json().recommendations.length, 20);
});

test("explain=true adds score components", async () => {
  const first = (await get("/users/7/recommendations?explain=true")).json().recommendations[0];
  assert.deepEqual(Object.keys(first.explain).sort(), ["activity", "adjustment", "matched_topics", "peers", "score", "tier", "topic"]);
});

test("404 for an unknown member", async () => {
  const res = await get("/users/9999/recommendations");
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().error, "member not found");
});

test("400 for invalid input", async () => {
  for (const url of [
    "/users/abc/recommendations",
    "/users/7/recommendations?limit=0",
    "/users/7/recommendations?limit=21",
    "/users/7/recommendations?limit=2.5",
    "/users/7/recommendations?explain=maybe",
  ]) {
    const res = await get(url);
    assert.equal(res.statusCode, 400, url);
  }
});

test("reference_time overrides the clock per request; invalid values return 400", async () => {
  const ok = await get("/users/7/recommendations?reference_time=2026-09-22T00:00:00Z");
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().reference_time, "2026-09-22T00:00:00.000Z");

  // Far in the future every Circle is dormant, so the eligible set is empty.
  const far = await get("/users/7/recommendations?reference_time=2027-09-21T00:00:00Z");
  assert.equal(far.statusCode, 200);
  assert.deepEqual(far.json().recommendations, []);

  for (const url of [
    "/users/7/recommendations?reference_time=not-a-date",
    "/users/7/recommendations?reference_time=2026-02-30T00:00:00Z",
    "/users/7/recommendations?reference_time=2026-09-21T00:00:00",
    "/users/7/recommendations?reference_time=",
  ]) {
    assert.equal((await get(url)).statusCode, 400, url);
  }
});

test("unknown query parameters return 400 instead of silently using defaults", async () => {
  for (const url of [
    "/users/7/recommendations?limti=1",
    "/users/7/recommendations?explain=true&extra=1",
  ]) {
    assert.equal((await get(url)).statusCode, 400, url);
  }
});

test("server configuration rejects invalid dates and timestamps without a time zone", (t) => {
  const db = openDatabase();
  t.after(() => db.close());
  for (const referenceTime of [
    "not-a-date",
    "2026-02-30T00:00:00Z",
    "2026-09-21T00:00:00",
    "2026-09-21",
    "",
  ]) {
    assert.throws(
      () => buildServer({ db, referenceTime }),
      /Invalid REFERENCE_TIME/,
      referenceTime,
    );
  }
});

test("fixture scenarios are independent of the ambient reference time", () => {
  const env = { ...process.env, REFERENCE_TIME: "2027-09-21T00:00:00Z" };
  delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", "test/scenarios.test.js", "test/reasons.test.js"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env,
    encoding: "utf8",
    timeout: 10000,
  });
  const failures = run.stdout.split("\n").filter((line) => /^(not ok |# fail)/.test(line)).join("\n");
  assert.equal(run.status, 0, failures + run.stderr);
  assert.match(run.stdout, /# tests [1-9]\d*/, "the child runner must execute tests");
});
