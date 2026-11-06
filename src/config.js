// Reference time: the moment "now" is measured from (see docs/adr/0001-anchored-reference-time.md).
// The seed snapshot was generated against 2026-09-21T00:00:00Z. Override with REFERENCE_TIME.
export const SNAPSHOT_REFERENCE_TIME = "2026-09-21T00:00:00Z";

export function resolveReferenceTime(value = process.env.REFERENCE_TIME) {
  const raw = value === undefined ? SNAPSHOT_REFERENCE_TIME : value;
  const parts = typeof raw === "string"
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(raw)
    : null;
  if (parts) {
    const [year, month, day, hour, minute, second] = parts.slice(1, 7).map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const time = Date.parse(raw);
    if (month >= 1 && month <= 12 && day >= 1 && day <= monthDays[month - 1]
        && hour < 24 && minute < 60 && second < 60 && Number.isFinite(time)) {
      return new Date(time).toISOString();
    }
  }
  throw new Error("Invalid REFERENCE_TIME: use a valid ISO timestamp with Z or a numeric time-zone offset");
}

export const DORMANT_DAYS = 180;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 20;
