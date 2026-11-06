-- Circle Recommendations schema (SQLite). Loaded by src/db.js.
--
-- The seed JSON is already relational except for two arrays: users.topic_interests and
-- circles.tags. Both are normalised into join tables so topic matching is a join, not a
-- JSON scan. Tags are free-form (README: "free-form topic-ish tags"), so circle_tags has no
-- foreign key to topics; interests and a Circle's primary topic do.

CREATE TABLE topics (
  slug   TEXT PRIMARY KEY,
  id     INTEGER NOT NULL UNIQUE,
  label  TEXT NOT NULL,
  domain TEXT NOT NULL
);

CREATE TABLE users (
  id                   INTEGER PRIMARY KEY,
  first_name           TEXT NOT NULL,
  last_name            TEXT NOT NULL,
  has_photo            INTEGER NOT NULL,
  bio                  TEXT,
  job_title            TEXT,
  company              TEXT,
  industry             TEXT,
  location             TEXT,
  joined_at            TEXT NOT NULL,
  profile_completeness REAL NOT NULL
);

CREATE TABLE circles (
  id                INTEGER PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  description       TEXT,
  topic_slug        TEXT REFERENCES topics(slug),
  cover_image_url   TEXT,
  format            TEXT NOT NULL CHECK (format IN ('in_person', 'virtual', 'hybrid')),
  access            TEXT NOT NULL CHECK (access IN ('public', 'unlisted')),
  join_policy       TEXT NOT NULL CHECK (join_policy IN ('open', 'request')),
  max_members       INTEGER,                 -- NULL = uncapped
  member_count      INTEGER NOT NULL,
  created_at        TEXT NOT NULL,
  last_activity_at  TEXT NOT NULL,           -- ISO-8601 UTC; sorts lexicographically
  feed_posts_30d    INTEGER NOT NULL,
  chat_messages_30d INTEGER NOT NULL
);

CREATE TABLE memberships (
  user_id   INTEGER NOT NULL REFERENCES users(id),
  circle_id INTEGER NOT NULL REFERENCES circles(id),
  role      TEXT NOT NULL CHECK (role IN ('member', 'leader')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (user_id, circle_id)
);

CREATE TABLE user_interests (
  user_id    INTEGER NOT NULL REFERENCES users(id),
  topic_slug TEXT NOT NULL REFERENCES topics(slug),
  PRIMARY KEY (user_id, topic_slug)
);

CREATE TABLE circle_tags (
  circle_id INTEGER NOT NULL REFERENCES circles(id),
  tag       TEXT NOT NULL,
  PRIMARY KEY (circle_id, tag)
);

CREATE TABLE activity (
  id             INTEGER PRIMARY KEY,
  circle_id      INTEGER NOT NULL REFERENCES circles(id),
  author_user_id INTEGER NOT NULL REFERENCES users(id),
  body           TEXT NOT NULL,
  reaction_count INTEGER NOT NULL,
  comment_count  INTEGER NOT NULL,
  save_count     INTEGER NOT NULL,
  created_at     TEXT NOT NULL
);

-- Indexes beyond primary keys.
-- memberships PK is (user_id, circle_id), which serves "which Circles does this member belong
-- to". The reverse lookup, "who is in this Circle", is needed for Peers and leaders.
CREATE INDEX memberships_circle_id ON memberships(circle_id);
-- Candidate generation by interest.
CREATE INDEX circles_topic_slug ON circles(topic_slug);
-- Eligibility filter: public AND recently active.
CREATE INDEX circles_access_last_activity ON circles(access, last_activity_at);
-- Not indexed on purpose: activity(circle_id, created_at). v1 scoring does not read activity.
