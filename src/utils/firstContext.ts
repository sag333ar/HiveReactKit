/**
 * FirstContext helper utilities.
 *
 * FirstContext posts/snaps typically include a header link in the markdown body:
 * `[**Re: Author — "..." · X**](https://beta.firstcontext.app/creator/...)`
 * while the original X.com / Twitter status URL is preserved in `json_metadata.contentUrl`
 * (e.g. `"https://x.com/username/status/1375587132023144450"`).
 *
 * These utilities strip the FirstContext link wrapper from the rendered body
 * and extract the underlying X.com / Twitter status so it can be previewed directly.
 */

export const FIRST_CONTEXT_MD_LINK_REGEX =
  /\[[\s\S]*?\]\(\s*https?:\/\/(?:[a-zA-Z0-9-]+\.)?firstcontext\.app\/[^\s)]*\s*\)/gi;

export const FIRST_CONTEXT_HTML_LINK_REGEX =
  /<a\b[^>]*href=["']https?:\/\/(?:[a-zA-Z0-9-]+\.)?firstcontext\.app\/[^"']*["'][^>]*>[\s\S]*?<\/a>/gi;

export const FIRST_CONTEXT_URL_REGEX =
  /https?:\/\/(?:[a-zA-Z0-9-]+\.)?firstcontext\.app\/[^\s<>)\]]*/gi;

export const TWITTER_STATUS_URL_REGEX =
  /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i;

/** Parse json_metadata if it is a JSON string or return it as an object. */
export function parseMetadataObject(meta: unknown): Record<string, unknown> {
  if (!meta) return {};
  if (typeof meta === 'string') {
    try {
      return JSON.parse(meta) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof meta === 'object') {
    return meta as Record<string, unknown>;
  }
  return {};
}

/**
 * Remove FirstContext markdown links, HTML links, and bare URLs from a post body.
 * Also trims leading/trailing whitespace and collapses excess blank lines.
 */
export function stripFirstContextLink(body: string): string {
  if (!body || typeof body !== 'string') return body ?? '';

  let cleaned = body;
  cleaned = cleaned.replace(FIRST_CONTEXT_MD_LINK_REGEX, '');
  cleaned = cleaned.replace(FIRST_CONTEXT_HTML_LINK_REGEX, '');
  cleaned = cleaned.replace(FIRST_CONTEXT_URL_REGEX, '');

  // Collapse 3+ newlines down to 2
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

/**
 * Extract Twitter/X status ID from json_metadata.contentUrl, fcLink, or body.
 */
export function extractFirstContextTwitterId(
  jsonMetadata: unknown,
  body?: string,
): string | null {
  const meta = parseMetadataObject(jsonMetadata);

  // Check contentUrl first (canonical FirstContext location)
  if (typeof meta.contentUrl === 'string') {
    const match = meta.contentUrl.match(TWITTER_STATUS_URL_REGEX);
    if (match && match[1]) return match[1];
  }

  // Check links array if present
  if (Array.isArray(meta.links)) {
    for (const link of meta.links) {
      if (typeof link === 'string') {
        const match = link.match(TWITTER_STATUS_URL_REGEX);
        if (match && match[1]) return match[1];
      }
    }
  }

  // Check body as fallback
  if (body && typeof body === 'string') {
    const match = body.match(TWITTER_STATUS_URL_REGEX);
    if (match && match[1]) return match[1];
  }

  return null;
}

/**
 * Check whether a post originated from FirstContext.
 */
export function isFirstContextPost(post: {
  body?: string;
  json_metadata?: unknown;
}): boolean {
  if (!post) return false;
  const meta = parseMetadataObject(post.json_metadata);

  if (
    meta.signed_by_service === 'firstcontext' ||
    typeof meta.fcLink === 'string' ||
    typeof meta.fcContainer === 'string' ||
    (typeof meta.contentUrl === 'string' &&
      (meta.contentUrl.includes('twitter.com') || meta.contentUrl.includes('x.com')))
  ) {
    return true;
  }

  const body = post.body ?? '';
  return /firstcontext\.app/i.test(body);
}
