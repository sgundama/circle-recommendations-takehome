import { SNAPSHOT_REFERENCE_TIME } from "./config.js";

// Builds the member-facing Reason for one scored Circle. Every fragment is gated on the signal
// that justifies it, so the text never claims something that is not true for this Circle.
// Returns { reason: string, reasons: [{ kind, ... }] } built from the same evidence.

const MAX_FRAGMENTS = 3;
// feed_posts_30d and chat_messages_30d are computed over the 30 days before the snapshot was
// generated — not over the 30 days before the request's reference time. Name the window.
const WINDOW_END = SNAPSHOT_REFERENCE_TIME.slice(0, 10);

export function buildReasons(r, { topicLabels, alternativesCount = 0 }) {
  const label = (slug) => (topicLabels.get(slug) ?? slug).toLowerCase();
  const list = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
  const circle = r.circle;
  const structured = [];
  const text = [];

  // 1. Topic. Primary match leads with the interest; tag-only match leads with the Circle's subject.
  if (r.primary) {
    structured.push({ kind: "topic_match", topics: r.matched });
    text.push(`Matches your interest in ${list(r.matched.map(label))}`);
  } else if (r.matched.length) {
    structured.push({ kind: "related_topic", circle_topic: circle.topic_slug, topics: r.matched });
    const lead = circle.topic_slug ? `Focused on ${label(circle.topic_slug)}, also covers` : "Covers";
    text.push(`${lead} ${list(r.matched.map(label))}`);
  }

  // 2. Activity, relative to the snapshot's 30-day window.
  const level = circle.feed_posts_30d >= 8 ? "very active" : circle.feed_posts_30d >= 3 ? "active" : "quiet";
  structured.push({ kind: "activity", level, posts_30d: circle.feed_posts_30d, chat_messages_30d: circle.chat_messages_30d, last_active_days: Math.round(r.ageDays) });
  text.push(`${level} (${circle.feed_posts_30d} posts in the 30 days before ${WINDOW_END})`);

  // 3. Peers, as two counts.
  if (r.peerCount > 0) {
    structured.push({ kind: "peers", same_industry: r.industryPeers, from_your_circles: r.coMemberPeers });
    const bits = [];
    if (r.industryPeers) bits.push(`${r.industryPeers} in your industry`);
    if (r.coMemberPeers) bits.push(`${r.coMemberPeers} from your Circles`);
    text.push(`members you may know: ${bits.join(", ")}`);
  }

  // Evidence fragments are capped; navigation fragments (alternatives, join policy) always append.
  const body = text.slice(0, MAX_FRAGMENTS);

  // 4. Alternatives.
  if (alternativesCount > 0) {
    structured.push({ kind: "alternatives", count: alternativesCount, topic: circle.topic_slug });
    body.push(`${alternativesCount} similar ${alternativesCount === 1 ? "Circle" : "Circles"} on ${label(circle.topic_slug)}`);
  }

  // 5. Format and join policy. Always in structured form; request-to-join is always in the text.
  structured.push({ kind: circle.join_policy === "open" ? "open_to_join" : "request_to_join", format: circle.format });
  const joinText = `${circle.format.replace("_", "-")}, ${circle.join_policy === "open" ? "open to join" : "request to join"}`;
  if (circle.join_policy === "request" || text.length < MAX_FRAGMENTS) body.push(joinText);

  const reason = body.join(" · ");
  return { reason: reason.charAt(0).toUpperCase() + reason.slice(1), reasons: structured };
}
