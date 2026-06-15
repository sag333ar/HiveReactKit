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
  // Snap-specific frontends — needed so re-snap bodies (a single URL
  // to a snap on snapie.io / hivesuite.app) get recognised as a Hive
  // post target and trigger the embedded re-snap card.
  'snapie.io',
  'www.snapie.io',
  'hivesuite.app',
  'www.hivesuite.app',
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

/**
 * Pre-convert bare `@username` mentions in a markdown body into explicit
 * markdown links so `@hiveio/content-renderer` never sees them as bare
 * mentions.
 *
 * Why: that library's `HtmlDOMParser.processTextNode` linkifies a text
 * node containing an `@mention` by building a new `<span>` and
 * **appending** it to the parent (instead of inserting at the original
 * position) — which shuffles the first paragraph line to the end of the
 * rendered output. The bug shows up whenever a comment body starts with
 * `Hello @user,` followed by `<br>`-separated lines.
 *
 * Pre-linking sidesteps the buggy path: the renderer sees a proper
 * markdown link and emits a regular `<a>` inline, no DOM reordering.
 *
 * Conservative regex — only matches `@account` patterns Hive allows
 * (lower-case, dot/dash, 3–17 chars), and only when the `@` is at the
 * start of the body or preceded by a non-identifier char.
 */
export function preLinkMentions(
  body: string,
  usertagUrlFn?: (username: string) => string,
): string {
  if (!body) return body;
  const buildUrl = usertagUrlFn ?? ((u: string) => `https://peakd.com/@${u}`);
  return body.replace(
    /(^|[^A-Za-z0-9_!#$%&*@/＠])@([a-z][a-z0-9.-]{1,15}[a-z0-9])(?![a-z0-9.-])/gi,
    (_m, pre: string, user: string) => {
      const lower = user.toLowerCase();
      return `${pre}[@${user}](${buildUrl(lower)})`;
    },
  );
}

/**
 * Pre-convert bare URLs in a markdown body into explicit markdown auto-links `<url>`
 * so `@hiveio/content-renderer` doesn't shuffle them to the end of the text node.
 * 
 * Works similarly to `preLinkMentions`, by preventing `HtmlDOMParser` from
 * extracting text-node URLs and appending them.
 */
const MEDIA_DOMAINS = [
  'youtube.com',
  'youtu.be',
  '3speak.tv',
  '3speak.co',
  'odysee.com',
  'lbry.tv',
  'spotify.com',
  'vimeo.com',
  'twitch.tv',
  'soundcloud.com',
  'twitter.com',
  'x.com',
];

const IMAGE_EXTENSIONS = /\.(?:jpe?g|png|gif|webp|avif|bmp|svg)(?:\?[^\s"'<>)]*)?$/i;
const AUDIO_EXTENSIONS = /\.(?:mp3|wav|ogg|m4a|aac|flac|webm|opus)(?:\?[^\s"'<>)]*)?$/i;

function isEmbeddableUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();
    const pathname = url.pathname;
    
    // Check domains
    const isDomain = MEDIA_DOMAINS.some(domain => host === domain || host.endsWith('.' + domain));
    if (isDomain) return true;

    // Check IPFS
    if (pathname.includes('/ipfs/')) return true;

    // Check image and audio extensions
    if (IMAGE_EXTENSIONS.test(urlStr) || AUDIO_EXTENSIONS.test(urlStr)) return true;

    return false;
  } catch {
    return false;
  }
}

export function preLinkUrls(body: string): string {
  if (!body) return body;
  return body.replace(
    /(^|[^<"'(])(https?:\/\/[^\s<>"']+?)(?=[.,!?]*(?:[\s>)"']|$))/gi,
    (_match, pre, url) => {
      if (isEmbeddableUrl(url)) {
        return _match;
      }
      return `${pre}<${url}>`;
    }
  );
}
