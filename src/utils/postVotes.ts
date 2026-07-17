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

export interface CurationEligibilityInput {
  /** Is the logged-in user a curator at all? */
  isCurator?: boolean | null;
  /** Did the consumer actually wire up an `onCurationRequest` handler? */
  hasCurationHandler: boolean;
  currentUser?: string | null;
  author: string;
  jsonMetadata: unknown;
}

/**
 * Whether the curation-request toggle/button should be offered at all, for
 * this piece of content, to this logged-in user. This is the ONE place
 * these checks live — every render site (blog list, post detail, profile
 * tabs, snaps feed, inline comments) calls this instead of repeating the
 * chain inline, so disabling a check means editing one function, not
 * hunting through five call sites.
 *
 * These are the "hard" gates — about who's asking / whether the feature
 * applies at all, not about this content's current curation status — so
 * they fail silently (the toggle just never appears). Checked in order,
 * numbered so an individual gate can be commented out:
 *   1. Caller is a curator
 *   2. A curation-request handler was actually wired up by the consumer
 *   3. Caller isn't the curation bot itself (voting on its own request is a no-op)
 *   4. Caller isn't the content's author (curators recommend OTHERS' content —
 *      recommending your own isn't curation, it's self-promotion; Hive still
 *      lets you vote for yourself in the same dialog, only the *request* is gated)
 *   5. The content was actually published via the HiveSuite app
 *
 * Three more checks happen later, inside `<VoteSlider/>` itself, once the
 * dialog is actually open. Unlike the gates above, these are about THIS
 * content's status, so instead of silently hiding they show the curator an
 * explanatory message in place of the toggle:
 *   6. The curation bot hasn't already voted on this content (synchronous —
 *      caller passes `hasCurationVoterVoted(votes)` as `curationBotAlreadyVoted`)
 *   7. Author's KE ratio isn't over the configured max (MAX_AUTHOR_KE)
 *   8. Content hasn't already been submitted for curation by another curator
 *      (`onFetchCurationStatus`)
 * See VoteSlider.tsx.
 */
export function isCurationEligible({
  isCurator,
  hasCurationHandler,
  currentUser,
  author,
  jsonMetadata,
}: CurationEligibilityInput): boolean {
  // 1. Caller must be a curator.
  if (!isCurator) return false;

  // 2. A curation-request handler must be wired up by the consumer.
  if (!hasCurationHandler) return false;

  // 3. The curation bot voting on its own request would be a no-op.
  if (currentUser?.toLowerCase() === CURATION_VOTER_ACCOUNT) return false;

  // 4. Curators recommend OTHER people's content, not their own.
  if (author.toLowerCase() === currentUser?.toLowerCase()) return false;

  // // 5. Curation is only offered for content actually published via HiveSuite.
  // if (!isHiveSuiteContent(jsonMetadata)) return false;

  return true;
}

/** The reply containers snap-like apps post into — a "snap" is really
 *  just a comment whose direct parent is one of these accounts. Anything
 *  else with a parent is a genuine comment/reply. Mirrors the containers
 *  hive-inbox itself recognizes for curation weight limits. */
const SNAP_CONTAINER_ACCOUNTS = new Set([
  'peak.snaps',
  'ecency.waves',
  'leothreads',
  'liketu.moments',
]);

/**
 * The REAL curation content type for a piece of content, independent of
 * which page/component happens to be displaying it. Needed because a
 * single "post details" view can render a genuine top-level post, a snap,
 * or a comment — all three are just `comment` ops on Hive, distinguished
 * only by `depth`/`parent_author` — and hardcoding `curationType="post"`
 * there let curators bypass the snap (6%) / comment (3%) weight caps
 * entirely by opening the same content's own permalink page instead of
 * viewing it in its feed:
 *   - `depth === 0` → top-level post (max 15%)
 *   - parent is a known snap container → snap (max 6%)
 *   - otherwise → comment/reply (max 3%)
 */
export function getCurationTypeForContent(
  depth: number | null | undefined,
  parentAuthor?: string | null,
): 'post' | 'snap' | 'comment' {
  if (!depth || depth <= 0) return 'post';
  if (parentAuthor && SNAP_CONTAINER_ACCOUNTS.has(parentAuthor.toLowerCase())) return 'snap';
  return 'comment';
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
