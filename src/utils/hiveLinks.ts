/**
 * Parse a URL to detect Hive-frontend post or profile links so consumers can
 * route them in-app instead of opening peakd/hive.blog/ecency externally.
 */

const HIVE_FRONTEND_HOSTS = new Set([
  'peakd.com',
  'www.peakd.com',
  'hive.blog',
  'www.hive.blog',
  'ecency.com',
  'www.ecency.com',
  'inleo.io',
  'www.inleo.io',
]);

export type HiveLinkTarget =
  | { kind: 'post'; author: string; permlink: string }
  | { kind: 'user'; author: string };

function targetFromParts(author: string | undefined, permlink: string | undefined): HiveLinkTarget | null {
  const a = author?.toLowerCase();
  if (!a) return null;
  if (permlink) return { kind: 'post', author: a, permlink };
  return { kind: 'user', author: a };
}

/**
 * Return the in-app target for a Hive-frontend URL, or null if the URL does
 * not match a recognised pattern.
 *
 * Handles:
 *   https://peakd.com/@alice                             → user
 *   https://peakd.com/@alice/permlink                    → post
 *   https://peakd.com/hive-178315/@alice/permlink        → post (community prefix)
 *   https://peakd.com/trending/@alice/permlink           → post (tag prefix)
 *   https://hive.blog/@alice/permlink                    → post
 *   https://ecency.com/@alice/permlink                   → post
 *   https://inleo.io/threads/view/alice/permlink         → post
 *
 * Also resolves relative/hash hrefs emitted by @snapie/renderer (`convertHiveUrls`)
 * and in-app hash router links:
 *   /@alice                                              → user
 *   /@alice/permlink                                     → post
 *   #/@alice                                             → user
 *   #/@alice/permlink                                    → post
 */
export function parseHiveFrontendUrl(href: string): HiveLinkTarget | null {
  if (!href) return null;

  // In-app hash-router link: "#/@alice" or "#/@alice/permlink"
  if (href.startsWith('#/@')) {
    const [author, permlink] = href.slice(3).split('/').filter(Boolean);
    return targetFromParts(author, permlink);
  }

  // Root-relative path: "/@alice" or "/@alice/permlink"
  if (href.startsWith('/@')) {
    const [author, permlink] = href.slice(2).split('/').filter(Boolean);
    return targetFromParts(author, permlink);
  }

  // Absolute URLs
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!HIVE_FRONTEND_HOSTS.has(host)) return null;
  const parts = url.pathname.split('/').filter(Boolean);

  // inleo.io thread permalinks: /threads/view/{author}/{permlink} — no @ prefix.
  if ((host === 'inleo.io' || host === 'www.inleo.io') && parts[0] === 'threads' && parts[1] === 'view') {
    return targetFromParts(parts[2], parts[3]);
  }

  const atIdx = parts.findIndex((p) => p.startsWith('@'));
  if (atIdx === -1) return null;
  return targetFromParts(parts[atIdx].slice(1), parts[atIdx + 1]);
}
