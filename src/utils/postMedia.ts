/**
 * Shared media-extraction helpers for the post-card lists. Walks
 * `post.json_metadata.image` plus the body for embedded images, YouTube
 * links, 3Speak links, and X.com / Twitter status links — returns a
 * deduped, ordered list. Used by both <BlogPostList/> and
 * <UserDetailProfile/>'s renderPostItem to drive the right-side media
 * strip.
 */
import type { Post } from '@/types/post';

export type PostMedia =
  | { kind: 'image'; url: string }
  | { kind: 'youtube'; id: string }
  | { kind: 'threespeak'; url: string }
  | { kind: 'twitter'; id: string; url: string };

const IMG_MD = /!\[[^\]]*\]\(([^\s)]+)\)/g;
const IMG_HTML = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
const YOUTUBE =
  /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([^&\s]+)|https?:\/\/youtu\.be\/([^?\s]+)|https?:\/\/(?:www\.)?youtube\.com\/shorts\/([^?\s]+)/gi;
const THREE_SPEAK = /https?:\/\/(?:play\.)?3speak\.tv\/[^\s"'<>)]+/gi;
const TWITTER = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/gi;

function dedupe(media: PostMedia[]): PostMedia[] {
  const seen = new Set<string>();
  const out: PostMedia[] = [];
  for (const m of media) {
    const key =
      m.kind === 'image'
        ? `image:${m.url}`
        : m.kind === 'youtube'
          ? `youtube:${m.id}`
          : m.kind === 'twitter'
            ? `twitter:${m.id}`
            : `threespeak:${m.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

export function extractPostMedia(post: Post): PostMedia[] {
  const media: PostMedia[] = [];

  // Images declared in json_metadata.image first (these are the post's
  // canonical thumbnails — usually the cover image).
  const meta = post.json_metadata as { image?: string[] } | string | undefined;
  if (meta && typeof meta === 'object' && Array.isArray(meta.image)) {
    for (const u of meta.image) {
      if (typeof u === 'string' && u) media.push({ kind: 'image', url: u });
    }
  }

  const body = post.body ?? '';
  let m: RegExpExecArray | null;

  // Inline markdown / HTML images embedded in the body.
  while ((m = IMG_MD.exec(body))) media.push({ kind: 'image', url: m[1] });
  while ((m = IMG_HTML.exec(body))) media.push({ kind: 'image', url: m[1] });

  // YouTube videos.
  while ((m = YOUTUBE.exec(body))) {
    const id = (m[1] || m[2] || m[3])!;
    if (id) media.push({ kind: 'youtube', id });
  }

  // 3Speak videos.
  while ((m = THREE_SPEAK.exec(body))) {
    media.push({ kind: 'threespeak', url: m[0] });
  }

  // X / Twitter status links.
  while ((m = TWITTER.exec(body))) {
    media.push({ kind: 'twitter', id: m[1], url: m[0] });
  }

  return dedupe(media);
}

/** Pull `?v=author/permlink` out of any 3Speak URL shape. Returns null
 *  for unrecognised URLs (rare; older 3Speak embeds use a path-style
 *  identifier instead of a query param). */
export function parseThreeSpeakRef(url: string): { author: string; permlink: string } | null {
  try {
    const u = new URL(url);
    const v = u.searchParams.get('v');
    if (!v) return null;
    const [author, permlink] = v.split('/');
    if (!author || !permlink) return null;
    return { author, permlink };
  } catch {
    return null;
  }
}
