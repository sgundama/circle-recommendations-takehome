// All SQL lives here. Functions return plain rows / maps; no scoring.

export function getMember(db, id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) ?? null;
}

export function memberInterests(db, id) {
  return db.prepare("SELECT topic_slug FROM user_interests WHERE user_id = ?").all(id).map((r) => r.topic_slug);
}

export function memberCircleIds(db, id) {
  return db.prepare("SELECT circle_id FROM memberships WHERE user_id = ?").all(id).map((r) => r.circle_id);
}

// Eligibility runs in SQL: not already joined, public, not full, not dormant.
// `dormantCutoff` is an ISO string; last_activity_at must be strictly after it.
export function eligibleCircles(db, memberId, dormantCutoff) {
  return db.prepare(`
    SELECT c.*
    FROM circles c
    WHERE c.access = 'public'
      AND (c.max_members IS NULL OR c.member_count < c.max_members)
      AND c.last_activity_at > ?
      AND c.id NOT IN (SELECT circle_id FROM memberships WHERE user_id = ?)
  `).all(dormantCutoff, memberId);
}

export function circleTags(db) {
  const map = new Map();
  for (const { circle_id, tag } of db.prepare("SELECT circle_id, tag FROM circle_tags").all()) {
    if (!map.has(circle_id)) map.set(circle_id, []);
    map.get(circle_id).push(tag);
  }
  return map;
}

// circle_id -> [{ user_id, industry }]
export function circleMembers(db) {
  const map = new Map();
  const rows = db.prepare(`
    SELECT m.circle_id, m.user_id, u.industry
    FROM memberships m JOIN users u ON u.id = m.user_id
  `).all();
  for (const r of rows) {
    if (!map.has(r.circle_id)) map.set(r.circle_id, []);
    map.get(r.circle_id).push({ user_id: r.user_id, industry: r.industry });
  }
  return map;
}

export function topicLabels(db) {
  return new Map(db.prepare("SELECT slug, label FROM topics").all().map((r) => [r.slug, r.label]));
}

// p90 of posts and chat across the whole snapshot, used to normalise activity to 0..1.
export function activityScale(db) {
  const p90 = (col) => {
    const xs = db.prepare(`SELECT ${col} AS v FROM circles ORDER BY v`).all().map((r) => r.v);
    return xs[Math.floor(0.9 * (xs.length - 1))] || 1;
  };
  return { postsP90: p90("feed_posts_30d"), chatP90: p90("chat_messages_30d") };
}
