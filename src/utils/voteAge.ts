/**
 * Vote-window helpers.
 *
 * Hive posts stop earning curation rewards at the 7-day payout cutoff —
 * a vote cast after that just spends voting mana with no effect on the
 * author or the voter. The kit gates upvote interactions on that
 * boundary so users don't waste votes.
 *
 * Hive's API returns `created` timestamps as bare ISO strings without a
 * trailing `Z` (e.g. `2024-05-12T10:30:00`). JavaScript's `Date`
 * parser then treats them as **local time**, which on a non-UTC
 * machine yields ages that drift by the local offset. We force-UTC by
 * appending `Z` when it's missing, so the age calc is correct
 * regardless of where the user is.
 */

export const VOTE_WINDOW_DAYS = 7;
export const VOTE_WINDOW_MS = VOTE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** Parse a Hive `created` string as UTC, returning `null` if unusable. */
export function parseHiveCreated(created?: string | null): Date | null {
  if (!created) return null;
  const raw = String(created).trim();
  if (!raw) return null;
  // Hive returns timestamps without a timezone suffix; treat them as UTC.
  // Anything already carrying `Z` or an explicit `+hh:mm` offset is left alone.
  const normalized = /Z|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Returns true when the post/comment was created more than
 * `VOTE_WINDOW_DAYS` ago and voting on it would have no effect.
 * Unknown / unparseable timestamps return `false` so we never block
 * a vote on missing data.
 */
export function isPostTooOldToVote(created?: string | null): boolean {
  const d = parseHiveCreated(created);
  if (!d) return false;
  return Date.now() - d.getTime() > VOTE_WINDOW_MS;
}

export const VOTE_WINDOW_MESSAGE = `Voting is closed — this post is older than ${VOTE_WINDOW_DAYS} days.`;
