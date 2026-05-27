/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Mention-autocomplete helpers for the composer.
 *
 *   - extractMentionsFromBody: pull every `@account` token from a Hive post
 *     body so the composer can seed its suggestion list with people the post
 *     itself already mentions.
 *   - searchHiveAccounts: hit `condenser_api.get_account_reputations` with
 *     a lowercase prefix — the same API peakd / ecency use for "type @abc
 *     and see matching accounts". Wrapped with a tiny in-memory + in-flight
 *     cache so the composer can call it on every keystroke without
 *     hammering the RPC.
 */
import { getHiveClient } from "../config/hiveEndpoint";

const dhiveClient = getHiveClient();

const MENTION_RE = /(?:^|[^a-z0-9._-])@([a-z][a-z0-9.-]{1,15}[a-z0-9])/gi;

/** Pull deduped lowercase usernames out of a Hive post body. */
export function extractMentionsFromBody(body: string | null | undefined): string[] {
  if (!body) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE.source, MENTION_RE.flags);
  while ((m = re.exec(body)) !== null) {
    const name = (m[1] || "").toLowerCase();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

interface ReputationResult {
  account: string;
  reputation: string | number;
}

const cache = new Map<string, string[]>();
const inFlight = new Map<string, Promise<string[]>>();

/** Look up Hive accounts by lowercase prefix. Returns deduped, ordered usernames. */
export async function searchHiveAccounts(query: string, limit = 10): Promise<string[]> {
  const q = (query || "").trim().toLowerCase();
  if (q.length < 3) return [];
  const cacheKey = `${q}|${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const result: any = await dhiveClient.call(
        "condenser_api",
        "get_account_reputations",
        [q, limit],
      );
      const rows: ReputationResult[] = Array.isArray(result) ? result : [];
      const names = rows
        .map((r) => (r?.account || "").toLowerCase())
        .filter(Boolean);
      const out = Array.from(new Set(names));
      cache.set(cacheKey, out);
      return out;
    } catch {
      return [];
    } finally {
      inFlight.delete(cacheKey);
    }
  })();
  inFlight.set(cacheKey, promise);
  return promise;
}
