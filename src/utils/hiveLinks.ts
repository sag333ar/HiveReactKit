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
  'leofinance.io',
  'www.leofinance.io',
  'waivio.com',
  'www.waivio.com',
  'liketu.com',
  'www.liketu.com',
  'travelfeed.io',
  'www.travelfeed.io',
  'splintertalk.io',
  'www.splintertalk.io',
  'worldmappin.com',
  'www.worldmappin.com',
  'snapie.io',
  'www.snapie.io',
  'slothbuzz.com',
  'www.slothbuzz.com',
  'hivesuite.app',
  'www.hivesuite.app',
]);

export type HiveLinkTarget =
  | { kind: 'post'; author: string; permlink: string; hash?: string; commentAuthor?: string; commentPermlink?: string }
  | { kind: 'user'; author: string }
  | { kind: 'map' };

function targetFromParts(
  author: string | undefined,
  permlink: string | undefined,
  hash?: string,
): HiveLinkTarget | null {
  const a = author?.toLowerCase();
  if (!a) return null;
  if (permlink) {
    const [rawP, pHash] = permlink.split('#');
    const cleanPermlink = rawP.split('?')[0];
    const effectiveHash = hash || (pHash ? `#${pHash}` : undefined);
    let commentAuthor: string | undefined;
    let commentPermlink: string | undefined;
    if (effectiveHash) {
      const cleanH = effectiveHash.replace(/^#/, '');
      const match = cleanH.match(/^@?([a-z0-9.-]+)\/([a-z0-9.-]+)/i);
      if (match) {
        commentAuthor = match[1].toLowerCase();
        commentPermlink = match[2];
      }
    }
    return {
      kind: 'post',
      author: a,
      permlink: cleanPermlink,
      hash: effectiveHash,
      commentAuthor,
      commentPermlink,
    };
  }
  return { kind: 'user', author: a };
}

const HIVE_HOSTS_REGEX =
  /https?:\/\/(?:www\.)?(?:peakd\.com|hive\.blog|ecency\.com|inleo\.io|leofinance\.io|waivio\.com|liketu\.com|travelfeed\.io|splintertalk\.io|snapie\.io|slothbuzz\.com)\/([^\s<>"')\]]+)/gi;

/**
 * Replace external Hive frontend URLs (PeakD, Ecency, Hive.blog, etc.) with HiveSuite URLs.
 */
export function rewriteHiveUrlsToHiveSuite(body: string, baseUrl: string = 'https://hivesuite.app'): string {
  if (!body || typeof body !== 'string') return body ?? '';

  const cleanBase = baseUrl.replace(/\/+$/, '');
  return body.replace(HIVE_HOSTS_REGEX, (_fullUrl, path: string) => {
    const m = path.match(/^(.*?)([.,;:!?)\]>]+)?$/);
    let cleanPath = m ? m[1] : path;
    const trailing = m && m[2] ? m[2] : '';

    if (!cleanPath) return `${cleanBase}${trailing}`;

    // inleo.io thread permalinks: threads/view/author/permlink
    if (cleanPath.startsWith('threads/view/')) {
      const parts = cleanPath.split('/').filter(Boolean);
      if (parts.length >= 4) {
        return `${cleanBase}/@${parts[2].replace(/^@/, '')}/${parts[3]}${trailing}`;
      }
    }

    // slothbuzz.com hangs or post permalinks: hangs/author/permlink or post/author/permlink
    if (cleanPath.startsWith('hangs/') || cleanPath.startsWith('post/')) {
      const parts = cleanPath.split('/').filter(Boolean);
      if (parts.length >= 3) {
        return `${cleanBase}/@${parts[1].replace(/^@/, '')}/${parts[2]}${trailing}`;
      }
    }

    // Community/category post: hive-12345/@author/permlink#hash -> @author/permlink#hash
    const atMatch = cleanPath.match(/^(?:c\/)?[a-z0-9.-]+\/(@[a-z0-9.-]+\/.*)$/i);
    if (atMatch) {
      cleanPath = atMatch[1];
    } else if (cleanPath.startsWith('c/') && cleanPath.includes('/@')) {
      cleanPath = cleanPath.slice(2);
    }

    // Community page: c/hive-12345 -> dashboard/communities/hive-12345
    if (cleanPath.startsWith('c/') && cleanPath.split('/').filter(Boolean).length === 2) {
      const comm = cleanPath.split('/')[1];
      return `${cleanBase}/dashboard/communities/${comm}${trailing}`;
    }

    // Tags: created/tag, trending/tag, hot/tag
    if (cleanPath.startsWith('created/') || cleanPath.startsWith('trending/') || cleanPath.startsWith('hot/')) {
      const tag = cleanPath.split('/')[1];
      if (tag) return `${cleanBase}/tags/${tag}${trailing}`;
    }

    return `${cleanBase}/${cleanPath}${trailing}`;
  });
}

/**
 * Return the in-app target for a Hive-frontend URL, or null if the URL does
 * not match a recognised pattern.
 */
export function parseHiveFrontendUrl(href: string): HiveLinkTarget | null {
  if (!href) return null;

  // Split out explicit hash if present
  let rawHash: string | undefined;
  let cleanHref = href;
  const hashIdx = href.indexOf('#');
  if (hashIdx !== -1 && !href.startsWith('#/')) {
    rawHash = href.slice(hashIdx);
    cleanHref = href.slice(0, hashIdx);
  }

  // In-app hash-router link: "#/@alice" or "#/@alice/permlink"
  if (cleanHref.startsWith('#/@')) {
    const parts = cleanHref.slice(3).split('/').filter(Boolean);
    return targetFromParts(parts[0], parts[1], rawHash);
  }

  // Root-relative path with @author: "/@alice" or "/@alice/permlink"
  if (cleanHref.startsWith('/@')) {
    const parts = cleanHref.slice(2).split('/').filter(Boolean);
    return targetFromParts(parts[0], parts[1], rawHash);
  }

  // Root-relative path with hangs or post: "/hangs/alice/permlink" or "/post/alice/permlink"
  if (cleanHref.startsWith('/hangs/') || cleanHref.startsWith('/post/')) {
    const parts = cleanHref.slice(1).split('/').filter(Boolean);
    if (parts.length >= 3) {
      return targetFromParts(parts[1]?.replace(/^@/, ''), parts[2], rawHash);
    }
    if (parts.length === 2) {
      return targetFromParts(parts[1]?.replace(/^@/, ''), undefined, rawHash);
    }
  }

  // Root-relative path with category: "/hive-12345/@alice/permlink" or "/c/hive-12345/@alice/permlink"
  if (cleanHref.startsWith('/')) {
    const parts = cleanHref.slice(1).split('/').filter(Boolean);
    const atIdx = parts.findIndex((p) => p.startsWith('@'));
    if (atIdx !== -1) {
      return targetFromParts(parts[atIdx].slice(1), parts[atIdx + 1], rawHash);
    }
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
  const urlHash = url.hash || rawHash;

  // inleo.io thread permalinks: /threads/view/{author}/{permlink} — no @ prefix.
  if ((host === 'inleo.io' || host === 'www.inleo.io') && parts[0] === 'threads' && parts[1] === 'view') {
    return targetFromParts(parts[2], parts[3], urlHash);
  }

  // slothbuzz.com hangs or post: /hangs/{author}/{permlink} or /post/{author}/{permlink}
  if ((host === 'slothbuzz.com' || host === 'www.slothbuzz.com') && (parts[0] === 'hangs' || parts[0] === 'post')) {
    if (parts.length >= 3) {
      return targetFromParts(parts[1]?.replace(/^@/, ''), parts[2], urlHash);
    }
    if (parts.length === 2) {
      return targetFromParts(parts[1]?.replace(/^@/, ''), undefined, urlHash);
    }
  }

  if (host === 'worldmappin.com' || host === 'www.worldmappin.com') {
    const atIdx = parts.findIndex((p) => p.startsWith('@'));
    if (atIdx !== -1) {
      return targetFromParts(parts[atIdx].slice(1), parts[atIdx + 1], urlHash);
    }
    if ((parts[0] === 'p' || parts[0] === 'post') && parts.length >= 3) {
      return targetFromParts(parts[1].replace(/^@/, ''), parts[2], urlHash);
    }
    if ((parts[0] === 'p' || parts[0] === 'post') && parts.length === 2) {
      return { kind: 'post', author: '', permlink: parts[1], hash: urlHash };
    }
    return { kind: 'map' };
  }

  const atIdx = parts.findIndex((p) => p.startsWith('@'));
  if (atIdx === -1) return null;
  return targetFromParts(parts[atIdx].slice(1), parts[atIdx + 1], urlHash);
}

/**
 * Pre-convert bare `@username` mentions in a markdown body into explicit
 * markdown links so `@hiveio/content-renderer` never sees them as bare
 * mentions.
 */
export function preLinkMentions(
  body: string,
  usertagUrlFn?: (username: string) => string,
): string {
  if (!body) return body;
  const buildUrl = usertagUrlFn ?? ((u: string) => `/@${u}`);
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

export function preLinkHashtags(
  body: string,
  tagLinkUrlFn?: (tag: string) => string,
): string {
  if (!body) return body;
  const buildUrl = tagLinkUrlFn ?? ((t: string) => `/tags/${t}`);
  return body.replace(
    /(^|[^A-Za-z0-9_!#$%&*@/＠])#([a-zA-Z0-9_]+)(?![a-zA-Z0-9_])/g,
    (match, pre, tag) => {
      // Avoid matching hex colors like #fff or #000000
      if (/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(tag)) {
        return match;
      }
      return `${pre}[#${tag}](${buildUrl(tag)})`;
    }
  );
}

