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
    for (const entry of list) {
      if (!entry?.account || typeof entry.weight !== 'number') continue;
      // Frontend slots are deduplicated across memes (one slot per embedding
      // frontend, regardless of meme count). Only exact-role matches qualify;
      // collapsed roles like 'submitter+creator+frontend' should be impossible
      // (frontend never collapses with submitter/creator in the spec) but if
      // they appear we sum them like normal accounts to be safe.
      if (entry.role === 'frontend') {
        if (!frontendSeen.has(entry.account)) {
          frontendSeen.set(entry.account, entry.weight);
        }
        continue;
      }
      sums.set(entry.account, (sums.get(entry.account) ?? 0) + entry.weight);
    }
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

  // Total-weight cap. Scale by `cap / total` and floor; under-cap by 1–2bp
  // due to flooring is safe (Hive only rejects over-cap).
  const cap = kind === 'post' ? POST_CAP_BP : COMMENT_CAP_BP;
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  if (total > cap) {
    const scale = cap / total;
    entries = entries.map((e) => ({ account: e.account, weight: Math.floor(e.weight * scale) }));
  }

  return entries;
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
