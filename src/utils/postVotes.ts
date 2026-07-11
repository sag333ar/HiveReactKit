import type { ActiveVote } from '@/types/video';

export function isDownvote(vote: ActiveVote): boolean {
  const rshares = Number(vote.rshares ?? 0);
  if (Number.isFinite(rshares) && rshares < 0) return true;
  const percent = Number(vote.percent ?? 0);
  return Number.isFinite(percent) && percent < 0;
}

/** The curation service account — once it has voted on a post/snap/
 *  comment, that content no longer needs a curation request, so the
 *  curate button hides itself. */
export const CURATION_VOTER_ACCOUNT = 'sagarkothari88';

/** True when `CURATION_VOTER_ACCOUNT` already voted on this content. */
export function hasCurationVoterVoted(votes?: ActiveVote[] | null): boolean {
  if (!votes?.length) return false;
  return votes.some((v) => v.voter?.toLowerCase() === CURATION_VOTER_ACCOUNT);
}

/** True when `username` already voted on this content. Used to detect
 *  the "curator already spent their own vote" case — since the vote
 *  slider won't reopen for content the user already voted on, curation
 *  needs a separate, vote-free entry point for that scenario. */
export function hasUserVoted(votes: ActiveVote[] | null | undefined, username: string | null | undefined): boolean {
  if (!votes?.length || !username) return false;
  const target = username.toLowerCase();
  return votes.some((v) => v.voter?.toLowerCase() === target);
}

/** The vote weight (0–100) `username` already cast on this content, or 0
 *  if they haven't voted. Companion to `hasUserVoted` — the curation
 *  request needs the curator's own vote weight reported alongside it,
 *  and in the already-voted flow (see `VoteSlider`'s `alreadyVoted` mode)
 *  that vote already happened, so it has to be read back from
 *  `active_votes` rather than captured live from a slider. Hive's raw
 *  `percent` field is basis points (10000 = 100%), hence the /100. */
export function getUserVoteWeight(votes: ActiveVote[] | null | undefined, username: string | null | undefined): number {
  if (!votes?.length || !username) return 0;
  const target = username.toLowerCase();
  const vote = votes.find((v) => v.voter?.toLowerCase() === target);
  if (!vote) return 0;
  const percent = Number(vote.percent ?? 0);
  return Number.isFinite(percent) ? percent / 100 : 0;
}

/** True when the content was published via the HiveSuite app. Checks,
 *  in order:
 *   - `json_metadata.app` names it (e.g. `"hivesuite/1.2.3"`)
 *   - `json_metadata.developer` is the HiveSuite dev account
 *   - `json_metadata.tags` includes `"hivesuite"` — video posts made via
 *     the 3Speak encoder carry `app: "3speak/x.y.z"` (that's the actual
 *     uploader), so the `hivesuite` tag is the only signal that the post
 *     itself was authored through HiveSuite.
 *  The curate button (and the curation backend) only ever considers this
 *  content — curation isn't offered for posts/snaps/comments from other
 *  apps. */
export function isHiveSuiteContent(jsonMetadata: unknown): boolean {
  let meta: Record<string, unknown> = {};
  if (typeof jsonMetadata === 'string') {
    try {
      meta = JSON.parse(jsonMetadata) as Record<string, unknown>;
    } catch {
      meta = {};
    }
  } else if (jsonMetadata && typeof jsonMetadata === 'object') {
    meta = jsonMetadata as Record<string, unknown>;
  }
  const app = typeof meta.app === 'string' ? meta.app.toLowerCase() : '';
  if (app.includes('hivesuite')) return true;
  if (meta.developer === 'sagarkothari88') return true;
  const tags = Array.isArray(meta.tags) ? meta.tags : [];
  return tags.some((t) => typeof t === 'string' && t.toLowerCase() === 'hivesuite');
}

/** True when the post has received at least one downvote / flag.
 *  Prefer `stats.flag_weight` when available — Hive's canonical
 *  signal — and fall back to scanning `active_votes` for negative
 *  rshares or percent. */
export function postHasDownvotes(
  votes?: ActiveVote[] | null,
  flagWeight?: number | null,
): boolean {
  if (typeof flagWeight === 'number' && Number.isFinite(flagWeight) && flagWeight > 0) {
    return true;
  }
  if (!votes?.length) return false;
  return votes.some(isDownvote);
}
