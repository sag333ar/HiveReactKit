/**
 * ReSnapEmbed — inline preview of a "re-snapped" post.
 *
 * A re-snap on this network is a regular snap whose body is just a URL
 * pointing at another snap (e.g. `https://www.snapie.io/@user/permlink`
 * or `https://hivesuite.app/@user/permlink`). When SnapsFeedCard
 * detects that pattern it renders this component instead of the normal
 * body — fetching the referenced post and showing it as a compact card
 * with a "RE-SNAP" badge in the top-right corner.
 *
 * Loading / error states are kept lightweight on purpose: the outer
 * card already gives the row enough visual weight, so a skeleton row
 * here is plenty while we wait, and an "Original snap unavailable"
 * notice is enough when the fetch fails (deleted post, network
 * hiccup, etc.).
 *
 * Click handling — tapping the embedded card delegates to the same
 * `onPostClick(author, permlink)` callback the host wires into
 * SnapsFeedCard, so a re-snap opens the original snap's detail page.
 */
import { useEffect, useMemo, useState, type FC } from 'react';
import { Repeat } from 'lucide-react';
import { apiService } from '@/services/apiService';
import type { Post } from '@/types/post';

interface ReSnapEmbedProps {
  /** Snap author whose post is being re-snapped. */
  author: string;
  /** Snap permlink being re-snapped. */
  permlink: string;
  /** Observer for the bridge.get_post call — the currently-logged-in
   *  user, when available, so observer-aware stats / gray flags apply. */
  observer?: string;
  /** Callback for tapping the embedded card. Mirrors the outer
   *  SnapsFeedCard's `onPostClick(author, permlink)`. */
  onPostClick?: (author: string, permlink: string) => void;
  /** Optional callback for tapping the embedded author. */
  onUserClick?: (username: string) => void;
}

function formatTimeAgo(dateString: string): string {
  const iso = /Z|[+-]\d{2}:?\d{2}$/.test(dateString) ? dateString : `${dateString}Z`;
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Pull the first image URL out of a body. Mirrors the simple cases
 *  SnapsFeedCard handles in its own parser — enough for the preview. */
function firstImageUrl(body: string, jsonMetadata: unknown): string | null {
  if (jsonMetadata) {
    const meta = typeof jsonMetadata === 'string'
      ? (() => { try { return JSON.parse(jsonMetadata); } catch { return {}; } })()
      : (jsonMetadata as Record<string, unknown>);
    const imgs = (meta as { image?: unknown }).image;
    if (Array.isArray(imgs) && typeof imgs[0] === 'string') return imgs[0];
  }
  const md = body.match(/!\[[^\]]*\]\(([^)\s]+)\)/);
  if (md) return md[1];
  const html = body.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (html) return html[1];
  const bare = body.match(/https?:\/\/\S+?\.(?:jpe?g|png|gif|webp|avif)(?:\?\S*)?/i);
  if (bare) return bare[0];
  return null;
}

/** Strip the markdown image / bare URL we already render so the text
 *  preview underneath doesn't duplicate the image. */
function plainTextPreview(body: string): string {
  return body
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/<img[^>]+>/gi, '')
    .replace(/https?:\/\/\S+?\.(?:jpe?g|png|gif|webp|avif)(?:\?\S*)?/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_~`>#-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ReSnapEmbed: FC<ReSnapEmbedProps> = ({
  author,
  permlink,
  observer,
  onPostClick,
  onUserClick,
}) => {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrored(false);
    setPost(null);
    apiService.getPostContent(author, permlink, observer ?? '')
      .then((p) => {
        if (cancelled) return;
        if (!p || !(p as Post).author) {
          setErrored(true);
          setLoading(false);
          return;
        }
        setPost(p as Post);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setErrored(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [author, permlink, observer]);

  const previewImage = useMemo(
    () => post ? firstImageUrl(post.body ?? '', post.json_metadata as unknown) : null,
    [post],
  );
  const previewText = useMemo(
    () => post ? plainTextPreview(post.body ?? '').slice(0, 280) : '',
    [post],
  );

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post) onPostClick?.(post.author, post.permlink);
    else onPostClick?.(author, permlink);
  };

  return (
    <div
      className="relative cursor-pointer overflow-hidden rounded-lg border border-emerald-500/30 bg-[var(--hrk-bg-surface-sunken)] transition hover:border-emerald-500/60"
      onClick={handleOpen}
    >
      {/* RE-SNAP badge — top-right corner, always visible. */}
      <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
        <Repeat className="h-3 w-3" />
        Re-snap
      </span>

      {loading ? (
        <div className="space-y-2 p-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-[var(--hrk-bg-hover)]" />
            <div className="space-y-1">
              <div className="h-3 w-24 rounded bg-[var(--hrk-bg-hover)]" />
              <div className="h-2 w-16 rounded bg-[var(--hrk-bg-hover)]" />
            </div>
          </div>
          <div className="h-32 w-full rounded-md bg-[var(--hrk-bg-hover)]" />
          <div className="h-3 w-3/4 rounded bg-[var(--hrk-bg-hover)]" />
        </div>
      ) : errored || !post ? (
        <div className="p-3 text-xs text-[var(--hrk-text-tertiary)]">
          Original snap unavailable.
        </div>
      ) : (
        <div className="p-3">
          {/* Header — embedded author + time. */}
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onUserClick?.(post.author); }}
              className="shrink-0"
            >
              <img
                src={`https://images.hive.blog/u/${post.author}/avatar`}
                alt={post.author}
                className="h-7 w-7 rounded-full bg-[var(--hrk-bg-hover)] object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${post.author}&background=random&size=28`;
                }}
              />
            </button>
            <div className="min-w-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onUserClick?.(post.author); }}
                className="block truncate text-sm font-semibold text-[var(--hrk-text-primary)] hover:text-[var(--hrk-brand)]"
              >
                @{post.author}
              </button>
              <span className="text-[11px] text-[var(--hrk-brand)]">
                {formatTimeAgo(post.created)}
              </span>
            </div>
          </div>

          {previewImage && (
            <img
              src={previewImage}
              alt=""
              loading="lazy"
              className="mb-2 max-h-72 w-full rounded-md object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          {previewText && (
            <p className="line-clamp-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--hrk-text-secondary)]">
              {previewText}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ReSnapEmbed;
