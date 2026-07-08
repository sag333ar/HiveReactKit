/**
 * DecentMemes integration helpers — types + aggregation utilities.
 *
 * Spec: https://decentmemes.com/docs/peakd-integration.md
 *
 * The widget sends one `memeCreated` postMessage per inserted meme,
 * each carrying its own beneficiary list and template id. When a post
 * or comment embeds multiple memes, the host must aggregate the
 * beneficiaries before broadcasting:
 *
 *   1. Union all entries from every received meme's list.
 *   2. Sum same-account weights.
 *   3. Cap at 8 slots (drop the lowest-weight first — Hive rejects > 8).
 *   4. Cap total weight at 10% (post) or 30% (comment); scale & floor
 *      proportionally if exceeded.
 *
 * For `role === 'frontend'` the spec calls for deduplication (not
 * summing) across memes — that's a single 1% slot per embedding
 * frontend, no matter how many memes are in the post. PeakD has opted
 * out of that slot per the spec; other hosts who declare
 * `frontendInit` with an account get the dedup behaviour.
 */

export const DECENTMEMES_WIDGET_URL = 'https://decentmemes.com/widget/';
export const DECENTMEMES_WIDGET_ORIGIN = 'https://decentmemes.com';
export const DECENTMEMES_TAG = 'decentmemes';
export const DECENTMEMES_SCHEMA_VERSION = 2;

const MAX_BENEFICIARY_SLOTS = 8;
const POST_CAP_BP = 1000;   // 10%
const COMMENT_CAP_BP = 3000; // 30%

/**
 * Per-broadcast attachment limits. After the user hits the limit the
 * composer disables the DecentMemes toolbar button — further memes can't
 * be added until they remove a body image or the broadcast happens.
 *
 *   - Posts: 3 attachments. With a 10% total beneficiary cap and ~3% per
 *     creator slot, a 4th meme is already inside the scaled-down territory
 *     where each entry rounds to 2% and the holding-pool split loses
 *     resolution — 3 is the practical sweet spot before payouts get muddy.
 *   - Comments: 2 attachments. 30% total cap with 15% submitter+creator
 *     collapsed slots means a 3rd attachment by a third party would push
 *     all entries into the dust threshold after scaling.
 */
export const DECENTMEMES_MAX_PER_POST = 3;
export const DECENTMEMES_MAX_PER_COMMENT = 2;

/** Convenience accessor for the attachment limit by broadcast kind. */
export function getDecentMemesLimit(kind: 'post' | 'comment'): number {
  return kind === 'post' ? DECENTMEMES_MAX_PER_POST : DECENTMEMES_MAX_PER_COMMENT;
}

/** A single beneficiary entry as the widget emits it. */
export interface DecentMemesBeneficiary {
  account: string;
  /** Basis points (100 = 1%). */
  weight: number;
  /** `submitter` | `creator` | `holding` | `frontend` | `+`-joined combos. UI/debug only. */
  role?: string;
}

export interface DecentMemesTemplate {
  id: string;
  name?: string;
  isOriginalCreator?: boolean;
  hiveAccount?: string;
  submittedBy?: string;
  postWeight?: number;
  commentWeight?: number;
}

/** Normalised record we keep per inserted meme for later aggregation. */
export interface DecentMemesMeme {
  /** Public URL the parent uploaded the image to. Lets hosts re-render the
   *  list (e.g. show a chip per meme) without re-uploading. */
  imageUrl: string;
  template: DecentMemesTemplate;
  beneficiaries: {
    post: DecentMemesBeneficiary[];
    comment: DecentMemesBeneficiary[];
  };
}

/** Shape of the raw `memeCreated` postMessage payload. */
export interface DecentMemesCreatedEvent {
  type: 'memeCreated';
  imageDataUrl: string;
  imageMimeType: string;
  imageFileName: string;
  template: DecentMemesTemplate;
  beneficiaries: {
    post: DecentMemesBeneficiary[];
    comment: DecentMemesBeneficiary[];
  };
}

/** Validate-and-narrow helper for incoming postMessages. */
export function isDecentMemesCreatedEvent(data: unknown): data is DecentMemesCreatedEvent {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.type !== 'memeCreated') return false;
  if (typeof d.imageDataUrl !== 'string' || !d.imageDataUrl.startsWith('data:')) return false;
  if (!d.template || typeof (d.template as { id?: unknown }).id !== 'string') return false;
  const ben = d.beneficiaries as { post?: unknown; comment?: unknown } | undefined;
  if (!ben || !Array.isArray(ben.post) || !Array.isArray(ben.comment)) return false;
  return true;
}

/**
 * Pick the right beneficiary kind from the comment op's `parent_author`.
 *
 * Hive convention:
 *   - `parent_author === ''` (or absent) → top-level post → `'post'`
 *   - `parent_author !== ''`              → reply / comment → `'comment'`
 *
 * The caps differ (10% post / 30% comment) so getting this wrong silently
 * applies the wrong cap. Always derive `kind` from the same `parent_author`
 * you put on the `comment` op rather than hardcoding.
 */
export function pickDecentMemesKind(parentAuthor: string | null | undefined): 'post' | 'comment' {
  return parentAuthor && parentAuthor.trim() !== '' ? 'comment' : 'post';
}

/**
 * Aggregate per-meme beneficiary lists into the final list to attach to
 * `comment_options.extensions[0][1].beneficiaries` at broadcast time.
 *
 * Returns plain `{ account, weight }` entries (Hive op format — `role`
 * is dropped). When `memes` is empty, returns `[]`.
 */
export function aggregateDecentMemesBeneficiaries(
  memes: DecentMemesMeme[],
  kind: 'post' | 'comment',
): Array<{ account: string; weight: number }> {
  if (memes.length === 0) return [];

  const sums = new Map<string, number>();
  const frontendSeen = new Map<string, number>(); // account -> first-seen weight (dedup, not sum)

  for (const meme of memes) {
    const list = kind === 'post' ? meme.beneficiaries.post : meme.beneficiaries.comment;

    // Process frontend slots
    for (const entry of list) {
      if (!entry?.account || typeof entry.weight !== 'number') continue;
      if (entry.role === 'frontend') {
        if (!frontendSeen.has(entry.account)) {
          frontendSeen.set(entry.account, entry.weight);
        }
      }
    }

    // Determine the single target account for this template's creator/holding payout.
    // Give beneficiary to submittedBy if present, otherwise fallback to hiveAccount, or decentmemeshold.
    let targetAccount = 'decentmemeshold';
    if (meme.template.submittedBy?.trim()) {
      targetAccount = meme.template.submittedBy.trim();
    } else if (meme.template.hiveAccount?.trim()) {
      targetAccount = meme.template.hiveAccount.trim();
    } else {
      // Fallback: look at meme.beneficiaries.comment for any submitter account (uploader)
      const commentList = meme.beneficiaries?.comment || [];
      const submitterEntry = commentList.find((entry) => 
        entry && typeof entry.role === 'string' && entry.role.toLowerCase().includes('submitter')
      );
      const creatorEntry = commentList.find((entry) => 
        entry && typeof entry.role === 'string' && entry.role.toLowerCase().includes('creator')
      );
      const holdingEntry = commentList.find((entry) => 
        entry && typeof entry.role === 'string' && entry.role.toLowerCase().includes('holding')
      );

      if (submitterEntry?.account?.trim()) {
        targetAccount = submitterEntry.account.trim();
      } else if (creatorEntry?.account?.trim()) {
        targetAccount = creatorEntry.account.trim();
      } else if (holdingEntry?.account?.trim()) {
        targetAccount = holdingEntry.account.trim();
      } else {
        const nonFrontend = list.find((entry) => entry && entry.role !== 'frontend' && entry.account);
        if (nonFrontend) {
          targetAccount = nonFrontend.account.trim();
        }
      }
    }

    // Enforce the template weights: 300 for post (3%), 600 for comment (6%)
    const targetWeight = kind === 'post'
      ? (typeof meme.template.postWeight === 'number' ? meme.template.postWeight : 300)
      : (typeof meme.template.commentWeight === 'number' ? meme.template.commentWeight : 600);

    sums.set(targetAccount, (sums.get(targetAccount) ?? 0) + targetWeight);
  }

  for (const [account, weight] of frontendSeen) {
    sums.set(account, (sums.get(account) ?? 0) + weight);
  }

  let entries = Array.from(sums.entries())
    .map(([account, weight]) => ({ account, weight }))
    .sort((a, b) => b.weight - a.weight);

  // Hive rejects > 8 beneficiary entries — drop the lowest-weight first.
  if (entries.length > MAX_BENEFICIARY_SLOTS) {
    entries = entries.slice(0, MAX_BENEFICIARY_SLOTS);
  }

  // Total-weight cap. Scale entries by `cap / total` and floor; under-cap
  // by 1–2bp due to flooring is safe (Hive only rejects over-cap).
  //
  // Done in integer math (`floor((weight * cap) / total)`) rather than as
  // `floor(weight * (cap/total))` because the float ratio drifts: for the
  // common 5-meme-same-creator case, `1500 * (1000/1500)` evaluates to
  // 999.999…bp in IEEE 754, which would shave the on-chain weight to 999bp
  // (and then to 9% after the whole-percent conversion). Integer math
  // gives the exact 1000bp.
  const cap = kind === 'post' ? POST_CAP_BP : COMMENT_CAP_BP;
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  if (total > cap) {
    entries = entries.map((e) => ({
      account: e.account,
      weight: Math.floor((e.weight * cap) / total),
    }));
  }

  return entries;
}

/**
 * Convert the aggregated meme beneficiaries (basis points) into the
 * whole-percent `{ account, weight }` shape the composer's `Beneficiary`
 * type uses. Pair with `enforceLockedBeneficiaries` to merge into the
 * composer's working list — same pattern as the `threespeakfund` 10%
 * video lock.
 *
 * Conversion uses `Math.floor(bp / 100)` and drops entries that round
 * to 0%. This is the cap-safe direction:
 *
 *   - `Math.round` would overshoot. Example: a top-level post with 3
 *     creators landing on 350bp / 350bp / 300bp (sum 1000bp = the 10%
 *     post cap) would round to 4% / 4% / 3% = 11% in UI, which the
 *     downstream `toWireWeights` then sends as 1100bp on-chain —
 *     **over the spec's 10% cap**. The DecentMemes spec explicitly
 *     calls out flooring (under-cap by 1–2bp) as safe and over-cap as
 *     unsafe (Hive only rejects over-cap).
 *
 *   - Dropping sub-1% entries matches the same safety story: a tiny
 *     scaled-down frontend slot (e.g. 33bp after capping a heavy
 *     multi-meme comment) would otherwise be forced up to 100bp via
 *     `Math.max(1, …)`, pushing several such overflows back over the
 *     cap. Better to lose the dust than the broadcast.
 */
export function decentMemesAsBeneficiaries(
  memes: DecentMemesMeme[],
  kind: 'post' | 'comment',
): Array<{ account: string; weight: number }> {
  return aggregateDecentMemesBeneficiaries(memes, kind)
    .map(({ account, weight }) => ({ account, weight: Math.floor(weight / 100) }))
    .filter((b) => b.weight > 0);
}

/**
 * Build the `decentmemes` block for `json_metadata`. Returns `null` when
 * no memes are attached so callers can skip emitting the field.
 *
 *   { v: 2, templateIds: [...], frontend?: 'peakd' }
 *
 * Per spec, duplicate template ids are fine — the watcher dedupes
 * internally — so we don't dedupe here either.
 */
export function buildDecentMemesMetadata(
  memes: DecentMemesMeme[],
  frontend?: string,
): { v: number; templateIds: string[]; frontend?: string } | null {
  if (memes.length === 0) return null;
  const meta: { v: number; templateIds: string[]; frontend?: string } = {
    v: DECENTMEMES_SCHEMA_VERSION,
    templateIds: memes.map((m) => m.template.id),
  };
  if (frontend) meta.frontend = frontend;
  return meta;
}
