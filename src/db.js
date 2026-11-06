import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA = join(ROOT, "schema.sql");
export const DEFAULT_DATA_DIR = join(ROOT, "data");

const readJson = (dir, name) => JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8"));

// A new database receives the schema and snapshot in one transaction.
// A stored version-1 database is reopened without changing its data.
export function openDatabase({ path = ":memory:", dataDir = DEFAULT_DATA_DIR } = {}) {
  const db = new Database(path);
  try {
    db.pragma("foreign_keys = ON");
    const version = db.pragma("user_version", { simple: true });
    if (version === 0) {
      db.transaction(() => {
        db.exec(readFileSync(SCHEMA, "utf8"));
        loadSnapshot(db, dataDir);
        db.pragma("user_version = 1");
      })();
    } else if (version !== 1) {
      throw new Error(`Unsupported database version: ${version}`);
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function loadSnapshot(db, dataDir) {
  const topics = readJson(dataDir, "topics");
  const users = readJson(dataDir, "users");
  const circles = readJson(dataDir, "circles");
  const memberships = readJson(dataDir, "memberships");
  const activity = readJson(dataDir, "activity");

  const ins = {
    topic: db.prepare("INSERT INTO topics (slug, id, label, domain) VALUES (@slug, @id, @label, @domain)"),
    user: db.prepare(`INSERT INTO users (id, first_name, last_name, has_photo, bio, job_title, company, industry, location, joined_at, profile_completeness)
      VALUES (@id, @first_name, @last_name, @has_photo, @bio, @job_title, @company, @industry, @location, @joined_at, @profile_completeness)`),
    interest: db.prepare("INSERT INTO user_interests (user_id, topic_slug) VALUES (?, ?)"),
    circle: db.prepare(`INSERT INTO circles (id, name, slug, description, topic_slug, cover_image_url, format, access, join_policy, max_members, member_count, created_at, last_activity_at, feed_posts_30d, chat_messages_30d)
      VALUES (@id, @name, @slug, @description, @topic, @cover_image_url, @format, @access, @join_policy, @max_members, @member_count, @created_at, @last_activity_at, @feed_posts_30d, @chat_messages_30d)`),
    tag: db.prepare("INSERT INTO circle_tags (circle_id, tag) VALUES (?, ?)"),
    membership: db.prepare("INSERT INTO memberships (user_id, circle_id, role, joined_at) VALUES (@user_id, @circle_id, @role, @joined_at)"),
    post: db.prepare(`INSERT INTO activity (id, circle_id, author_user_id, body, reaction_count, comment_count, save_count, created_at)
      VALUES (@id, @circle_id, @author_user_id, @body, @reaction_count, @comment_count, @save_count, @created_at)`),
  };

  db.transaction(() => {
    for (const t of topics) ins.topic.run(t);
    for (const u of users) {
      ins.user.run({ ...u, has_photo: u.has_photo ? 1 : 0 });
      for (const slug of new Set(u.topic_interests)) ins.interest.run(u.id, slug);
    }
    for (const c of circles) {
      ins.circle.run(c);
      for (const tag of new Set(c.tags)) ins.tag.run(c.id, tag);
    }
    for (const m of memberships) ins.membership.run(m);
    for (const p of activity) ins.post.run(p);
  })();
}
