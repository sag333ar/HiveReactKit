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
import { FileText, Repeat } from 'lucide-react';
import { apiService } from '@/services/apiService';
import type { Post } from '@/types/post';
import { getHivePostLevel } from '@/utils/hivePostReferences';

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
  /** Emits true when a preview card is shown (post or re-snap). Emits false
   *  when the fetch fails or top-level posts are hidden (`showTopLevelPostPreview`
   *  is false). */
  onPreviewVisibilityChange?: (visible: boolean) => void;
  /** When true, depth-0 targets render a compact "Post" preview instead of
   *  being hidden. Used in Snaps feed and detail pages. */
  showTopLevelPostPreview?: boolean;
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
  onPreviewVisibilityChange,
  showTopLevelPostPreview = false,
}) => {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [hiddenTopLevelPost, setHiddenTopLevelPost] = useState(false);
  const [previewKind, setPreviewKind] = useState<'resnap' | 'post' | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrored(false);
    setPost(null);
    setHiddenTopLevelPost(false);
    setPreviewKind(null);
    onPreviewVisibilityChange?.(false);
    apiService.getPostContent(author, permlink, observer ?? '')
      .then((p) => {
        if (cancelled) return;
        if (!p || !(p as Post).author) {
          setErrored(true);
          setLoading(false);
          onPreviewVisibilityChange?.(false);
          return;
        }
        const fetchedPost = p as Post;
        const isTopLevelPost = getHivePostLevel(fetchedPost) === 0;
        if (isTopLevelPost && !showTopLevelPostPreview) {
          setHiddenTopLevelPost(true);
          setLoading(false);
          onPreviewVisibilityChange?.(false);
          return;
        }
        setPost(fetchedPost);
        setPreviewKind(isTopLevelPost ? 'post' : 'resnap');
        setLoading(false);
        onPreviewVisibilityChange?.(true);
      })
      .catch(() => {
        if (cancelled) return;
        setErrored(true);
        setLoading(false);
        onPreviewVisibilityChange?.(false);
      });
    return () => { cancelled = true; };
  }, [author, permlink, observer, onPreviewVisibilityChange, showTopLevelPostPreview]);

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

  if (hiddenTopLevelPost) return null;

  if (!loading && !errored && post && previewKind === 'post') {
    const communityLabel = post.community_title || post.community || '';
    const title = post.title || `@${post.author}/${post.permlink}`;
    return (
      <div
        className="@container w-full cursor-pointer overflow-hidden rounded-lg border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] transition hover:border-[var(--hrk-brand)]/50"
        onClick={handleOpen}
      >
        <div className="flex flex-col gap-3 p-3 @[28rem]:flex-row">
          {previewImage && (
            <img
              src={previewImage}
              alt=""
              loading="lazy"
              className="h-36 w-full shrink-0 rounded-md object-cover @[28rem]:h-32 @[28rem]:w-44"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className="min-w-0 w-full flex-1">
            <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--hrk-text-tertiary)]">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onUserClick?.(post.author); }}
                  className="flex min-w-0 items-center gap-1.5 hover:text-[var(--hrk-brand)]"
                >
                  <img
                    src={`https://images.hive.blog/u/${post.author}/avatar`}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${post.author}&background=random&size=20`;
                    }}
                  />
                  <span className="truncate font-medium">@{post.author}</span>
                </button>
                <span className="shrink-0">·</span>
                <span className="shrink-0">{formatTimeAgo(post.created)}</span>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--hrk-brand)]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--hrk-brand-fg-soft)]">
                <FileText className="h-3 w-3" />
                Post
              </span>
            </div>
            <h3 className="line-clamp-2 break-words text-sm font-semibold leading-snug text-[var(--hrk-text-primary)] @[28rem]:text-base">
              {title}
            </h3>
            {previewText && (
              <p className="mt-1 line-clamp-3 break-words text-sm leading-relaxed text-[var(--hrk-text-secondary)]">
                {previewText}
              </p>
            )}
            {communityLabel && (
              <span className="mt-2 inline-flex max-w-full rounded-md bg-[var(--hrk-brand)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--hrk-brand-fg-soft)]">
                <span className="truncate">{communityLabel}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="@container w-full cursor-pointer overflow-hidden rounded-lg border border-emerald-500/30 bg-[var(--hrk-bg-surface-sunken)] transition hover:border-emerald-500/60"
      onClick={handleOpen}
    >
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
          {/* Header — embedded author + time + badge. */}
          <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
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
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              <Repeat className="h-3 w-3" />
              Re-snap
            </span>
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
