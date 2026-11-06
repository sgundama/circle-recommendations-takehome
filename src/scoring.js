// Pure scoring. No I/O. Values calibrated in prototype/ against the four planted users.

export const WEIGHTS = Object.freeze({
  topic: 0.6,
  activity: 0.3,
  peers: 0.1,
  tag: 0.3,              // per distinct matching Tag beyond the Primary Topic
  coldOpenBonus: 0.05,   // cold-start: Circle is open to join
  coldNoTopicPenalty: 0.05, // cold-start: Circle has no Primary Topic
  maxAlternatives: 2,
});

const DAY = 86_400_000;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function scoreCircle(
  { circle, tags, interests, member, members, coMembers, referenceTime, postsP90, chatP90 },
  w = WEIGHTS,
) {
  const cold = interests.size === 0;
  const matched = [...new Set([circle.topic_slug, ...tags].filter((t) => t && interests.has(t)))];
  const primary = interests.has(circle.topic_slug) ? 1 : 0;
  const topic = primary + w.tag * (matched.length - primary);

  const ageDays = (Date.parse(referenceTime) - Date.parse(circle.last_activity_at)) / DAY;
  const recency = clamp01(1 - ageDays / 30);
  const activity =
    0.5 * Math.min(circle.feed_posts_30d / postsP90, 1) +
    0.3 * Math.min(circle.chat_messages_30d / chatP90, 1) +
    0.2 * recency;

  let industryPeers = 0, coMemberPeers = 0, peerCount = 0;
  for (const m of members) {
    if (m.user_id === member.id) continue;
    const sameIndustry = Boolean(member.industry) && m.industry === member.industry;
    const co = coMembers.has(m.user_id);
    if (sameIndustry) industryPeers++;
    if (co) coMemberPeers++;
    if (sameIndustry || co) peerCount++;
  }
  const peers = members.length ? peerCount / members.length : 0;

  let adjustment = 0;
  if (cold) {
    if (circle.join_policy === "open") adjustment += w.coldOpenBonus;
    if (circle.topic_slug === null) adjustment -= w.coldNoTopicPenalty;
  }

  return {
    circle,
    matched,
    primary,
    tier: primary, // LOCKED in prototype: only a Primary Topic match earns a tier
    topic,
    activity,
    recency,
    ageDays,
    peers,
    peerCount,
    industryPeers,
    coMemberPeers,
    adjustment,
    score: w.topic * topic + w.activity * activity + w.peers * peers + adjustment,
  };
}

export const byRank = (a, b) => b.tier - a.tier || b.score - a.score || a.circle.id - b.circle.id;

// One main Recommendation per non-null Primary Topic (ADR-0002). Circles without a Primary Topic
// are always main. Overflow on a Topic attaches to that Topic's main row as Alternatives.
export function collapseByTopic(sorted, { limit, maxAlternatives = WEIGHTS.maxAlternatives }) {
  const main = [];
  const headFor = new Map();
  const overflow = [];
  for (const r of sorted) {
    const t = r.circle.topic_slug;
    if (t === null) { if (main.length < limit) main.push(r); continue; }
    if (!headFor.has(t)) {
      if (main.length < limit) { headFor.set(t, r); main.push(r); }
    } else {
      overflow.push(r);
    }
  }
  const alternatives = new Map(main.map((r) => [r, []]));
  for (const r of overflow) {
    const head = headFor.get(r.circle.topic_slug);
    if (head && alternatives.get(head).length < maxAlternatives) alternatives.get(head).push(r);
  }
  return main.map((r) => ({ ...r, alternatives: alternatives.get(r) }));
}
