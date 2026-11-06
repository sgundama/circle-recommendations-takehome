import { DEFAULT_LIMIT, DORMANT_DAYS, resolveReferenceTime } from "./config.js";
import * as repo from "./repo.js";
import { byRank, collapseByTopic, scoreCircle } from "./scoring.js";
import { buildReasons } from "./reasons.js";

const DAY = 86_400_000;

// Returns null when the member does not exist.
export function recommendFor(db, memberId, { referenceTime = resolveReferenceTime(), limit = DEFAULT_LIMIT, explain = false } = {}) {
  referenceTime = resolveReferenceTime(referenceTime);
  const member = repo.getMember(db, memberId);
  if (!member) return null;

  const interests = new Set(repo.memberInterests(db, memberId));
  const joined = repo.memberCircleIds(db, memberId);
  const dormantCutoff = new Date(Date.parse(referenceTime) - DORMANT_DAYS * DAY).toISOString();
  const candidates = repo.eligibleCircles(db, memberId, dormantCutoff);

  const tags = repo.circleTags(db);
  const members = repo.circleMembers(db);
  const { postsP90, chatP90 } = repo.activityScale(db);
  const coMembers = new Set(joined.flatMap((cid) => (members.get(cid) ?? []).map((m) => m.user_id)));
  coMembers.delete(memberId);

  const scored = candidates
    .map((circle) =>
      scoreCircle({
        circle,
        tags: tags.get(circle.id) ?? [],
        interests,
        member,
        members: members.get(circle.id) ?? [],
        coMembers,
        referenceTime,
        postsP90,
        chatP90,
      }),
    )
    .sort(byRank);

  const main = collapseByTopic(scored, { limit });
  const topicLabels = repo.topicLabels(db);

  return {
    member_id: member.id,
    reference_time: referenceTime,
    recommendations: main.map((r) => present(r, { explain, topicLabels })),
  };
}

function present(r, { explain, topicLabels }) {
  const { reason, reasons } = buildReasons(r, { topicLabels, alternativesCount: r.alternatives.length });
  const out = {
    circle: circleView(r.circle),
    reason,
    reasons,
    alternatives: r.alternatives.map((a) => ({ id: a.circle.id, name: a.circle.name, format: a.circle.format, join_policy: a.circle.join_policy })),
  };
  if (explain) out.explain = { tier: r.tier, score: round(r.score), topic: round(r.topic), activity: round(r.activity), peers: round(r.peers), adjustment: round(r.adjustment), matched_topics: r.matched };
  return out;
}

const circleView = (c) => ({
  id: c.id,
  name: c.name,
  topic: c.topic_slug,
  format: c.format,
  join_policy: c.join_policy,
  member_count: c.member_count,
  max_members: c.max_members,
});

const round = (x) => Math.round(x * 1000) / 1000;
