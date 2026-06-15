/**
 * Beneficiary helpers used by PostComposer's BeneficiariesEditor and by
 * apps that broadcast Hive `comment_options`. The composer emits the chosen
 * list via `onBeneficiariesChange`; the consumer calls
 * `buildBeneficiariesCommentOptions(...)` (or `mergeBeneficiariesIntoCommentOptions`)
 * at broadcast time.
 *
 * In the UI we work in **whole percent** units (1–100). On the wire Hive uses
 * basis points (1% = 100, 100% = 10_000). The conversion happens when we
 * build the operation tuple.
 */

import type { RewardOption } from './commentOptions';
import { buildCommentOptions } from './commentOptions';

/** 3Speak fund account that must receive 10% on any video post or video comment. */
export const THREESPEAK_FUND_ACCOUNT = 'threespeakfund';
/** Locked weight for the 3Speak fund beneficiary, expressed in whole-percent UI units. */
export const THREESPEAK_FUND_PERCENT = 10;

export interface Beneficiary {
  /** Hive account name (lowercase, no leading @). */
  account: string;
  /** Whole-percent weight in [1, 100]. Hive's basis-point weight is computed as `weight * 100`. */
  weight: number;
}

/** Detect a 3Speak video embed in the body — matches the URLs the composer appends. */
export function bodyHasVideo(body: string): boolean {
  return /https?:\/\/play\.3speak\.tv\/(?:watch|embed)\?v=/.test(body || '');
}

/** Normalize an account name — lowercase, strip leading `@`, trim whitespace. */
export function normalizeBeneficiaryAccount(account: string): string {
  return String(account || '').trim().toLowerCase().replace(/^@+/, '');
}

/**
 * Sanitize a beneficiary list:
 * - normalize account names, drop empty/invalid entries
 * - clamp weights to [1, 100] (whole percent)
 * - dedupe by account (later entries override earlier)
 */
export function sanitizeBeneficiaries(list: Beneficiary[] | undefined): Beneficiary[] {
  if (!list || list.length === 0) return [];
  const map = new Map<string, number>();
  for (const b of list) {
    const account = normalizeBeneficiaryAccount(b.account);
    if (!account) continue;
    const weight = Math.max(0, Math.min(100, Math.round((Number(b.weight) || 0) * 100) / 100));
    if (weight <= 0) continue;
    map.set(account, weight);
  }
  return Array.from(map.entries()).map(([account, weight]) => ({ account, weight }));
}

/** Sum of beneficiary weights in whole-percent units. */
export function totalBeneficiaryWeight(list: Beneficiary[] | undefined): number {
  return sanitizeBeneficiaries(list).reduce((s, b) => s + b.weight, 0);
}

/**
 * Enforce the 3Speak fund rule: when a post/comment has video content, the
 * `threespeakfund` account must receive 10% and is non-removable, so the
 * remaining user-controlled allocation is capped at 90%.
 *
 * Strategy:
 * 1. Strip any existing `threespeakfund` entry from `userList`.
 * 2. Scale the remaining entries proportionally so their sum ≤ 90%.
 * 3. Prepend a locked `threespeakfund` 10% entry.
 *
 * If `hasVideo` is false, returns `sanitizeBeneficiaries(userList)` unchanged.
 */
export function enforceVideoBeneficiaries(
  userList: Beneficiary[] | undefined,
  hasVideo: boolean,
): Beneficiary[] {
  const sanitized = sanitizeBeneficiaries(userList);
  if (!hasVideo) return sanitized;

  const withoutFund = sanitized.filter((b) => b.account !== THREESPEAK_FUND_ACCOUNT);
  const userTotal = withoutFund.reduce((s, b) => s + b.weight, 0);
  const cap = 100 - THREESPEAK_FUND_PERCENT; // 90
  let scaled = withoutFund;
  if (userTotal > cap) {
    const factor = cap / userTotal;
    scaled = withoutFund
      .map((b) => ({ ...b, weight: Math.max(0.01, Math.floor(b.weight * factor * 100) / 100) }))
      .filter((b) => b.weight > 0);
    // After flooring, the total may be slightly under the cap; that is fine —
    // Hive does not require the beneficiaries to sum to 100%.
  }
  return [{ account: THREESPEAK_FUND_ACCOUNT, weight: THREESPEAK_FUND_PERCENT }, ...scaled];
}

/**
 * Generalised version of `enforceVideoBeneficiaries`. Takes an explicit list
 * of `locked` entries that must appear in the final list at their stated
 * weights — `threespeakfund` 10% on video posts, plus DecentMemes creator /
 * submitter / frontend entries on meme posts.
 *
 * Steps:
 * 1. Sanitize both lists.
 * 2. Drop user entries whose account collides with any locked account (lock wins).
 * 3. Scale remaining user entries proportionally so the *total* (locked + user)
 *    sits at or below 100%.
 * 4. Return `[ ...locked, ...scaledUser ]` — locked entries lead so they're
 *    obvious in the chip strip and editor.
 *
 * Hive's 8-beneficiary cap is enforced as a last-resort safety net: if locked
 * alone exceeds 8 we drop the lightest locked entries; otherwise we drop the
 * lightest user entries until the combined list fits. Locked entries are
 * preferred since dropping them breaks compliance (3Speak fund, DM creator
 * shares, etc.).
 */
const MAX_BENEFICIARY_SLOTS = 8;
export function enforceLockedBeneficiaries(
  userList: Beneficiary[] | undefined,
  locked: Beneficiary[] | undefined,
): Beneficiary[] {
  const sanitizedLocked = sanitizeBeneficiaries(locked);
  const sanitizedUser = sanitizeBeneficiaries(userList);

  if (sanitizedLocked.length === 0) return sanitizedUser;

  const lockedAccounts = new Set(sanitizedLocked.map((b) => b.account));
  const lockedTotal = sanitizedLocked.reduce((s, b) => s + b.weight, 0);
  const userCap = Math.max(0, 100 - lockedTotal);

  const userWithoutConflicts = sanitizedUser.filter((b) => !lockedAccounts.has(b.account));
  const userTotal = userWithoutConflicts.reduce((s, b) => s + b.weight, 0);
  let scaledUser = userWithoutConflicts;
  if (userTotal > userCap) {
    if (userCap <= 0) {
      scaledUser = [];
    } else {
      const factor = userCap / userTotal;
      scaledUser = userWithoutConflicts
        .map((b) => ({ ...b, weight: Math.max(0.01, Math.floor(b.weight * factor * 100) / 100) }))
        .filter((b) => b.weight > 0);
    }
  }

  let combined = [...sanitizedLocked, ...scaledUser];
  if (combined.length > MAX_BENEFICIARY_SLOTS) {
    if (sanitizedLocked.length >= MAX_BENEFICIARY_SLOTS) {
      // Locked alone exceeds the slot cap — keep the heaviest, in original order.
      const keep = new Set(
        [...sanitizedLocked]
          .sort((a, b) => b.weight - a.weight)
          .slice(0, MAX_BENEFICIARY_SLOTS)
          .map((b) => b.account),
      );
      combined = sanitizedLocked.filter((b) => keep.has(b.account));
    } else {
      const userBudget = MAX_BENEFICIARY_SLOTS - sanitizedLocked.length;
      const keepUser = new Set(
        [...scaledUser]
          .sort((a, b) => b.weight - a.weight)
          .slice(0, userBudget)
          .map((b) => b.account),
      );
      combined = [...sanitizedLocked, ...scaledUser.filter((b) => keepUser.has(b.account))];
    }
  }
  return combined;
}

/** Convert whole-percent UI weights to Hive on-chain basis-point weights. */
function toWireWeights(list: Beneficiary[]): Array<{ account: string; weight: number }> {
  // Hive requires beneficiaries sorted alphabetically by account.
  return [...list]
    .sort((a, b) => (a.account < b.account ? -1 : a.account > b.account ? 1 : 0))
    .map((b) => ({ account: b.account, weight: Math.round(b.weight * 100) }));
}

type CommentOptionsOp = [
  'comment_options',
  {
    author: string;
    permlink: string;
    allow_votes: boolean;
    allow_curation_rewards: boolean;
    max_accepted_payout: string;
    percent_hbd: number;
    extensions: unknown[];
  },
];

/**
 * Build a standalone `comment_options` op carrying the beneficiary list.
 * Returns `null` when there are no beneficiaries.
 *
 * For most posts this is what consumers want when reward routing is `'default'`.
 * To combine beneficiaries with non-default reward routing, use
 * `mergeBeneficiariesIntoCommentOptions` instead.
 */
export function buildBeneficiariesCommentOptions(
  author: string,
  permlink: string,
  beneficiaries: Beneficiary[] | undefined,
): CommentOptionsOp | null {
  const list = sanitizeBeneficiaries(beneficiaries);
  if (list.length === 0) return null;
  return [
    'comment_options',
    {
      author,
      permlink,
      allow_votes: true,
      allow_curation_rewards: true,
      max_accepted_payout: '1000000.000 HBD',
      percent_hbd: 10000,
      extensions: [[0, { beneficiaries: toWireWeights(list) }]],
    },
  ];
}

/**
 * Combine reward routing (power_up / burn / decline / default) with a
 * user-chosen beneficiary list into a single `comment_options` op.
 *
 * Notes:
 * - For `'burn'`, all rewards already go to `null` — additional beneficiaries
 *   are ignored to keep the burn intent clean.
 * - For all other options, the user's beneficiary list is included verbatim.
 * - Returns `null` when there is nothing to broadcast (default reward + no
 *   beneficiaries).
 */
export function mergeBeneficiariesIntoCommentOptions(
  author: string,
  permlink: string,
  reward: RewardOption,
  beneficiaries: Beneficiary[] | undefined,
): CommentOptionsOp | null {
  const list = sanitizeBeneficiaries(beneficiaries);
  const baseOp = buildCommentOptions(author, permlink, reward);

  if (reward === 'burn') return baseOp;

  if (!baseOp) {
    return buildBeneficiariesCommentOptions(author, permlink, list);
  }
  if (list.length === 0) return baseOp;

  const merged: CommentOptionsOp = [
    'comment_options',
    {
      ...baseOp[1],
      extensions: [[0, { beneficiaries: toWireWeights(list) }]],
    },
  ];
  return merged;
}
