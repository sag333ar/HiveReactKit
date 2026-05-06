/**
 * Standalone "Blogs" feed list — same per-post card layout as the Blogs tab
 * in <UserDetailProfile/>, but accepts a `posts: Post[]` array directly so
 * the consumer owns the data source (per-user blogs, global trending,
 * tag-filtered, search results, etc.).
 *
 * Cards render: avatar + side image carousel + author/time + title + body
 * preview + community tag, and a <PostActionButton/> action bar at the
 * bottom (upvote / comment / reblog / share / tip / report).
 *
 * Helpers (`formatTimeAgo`, `extractPlainText`, `PostImageCarousel`) are
 * inlined here to keep the component self-contained — they mirror the
 * implementations in UserDetailProfile and can be lifted to a shared util
 * module later if more lists need them.
 */
import { useEffect, useState, type FC } from 'react';
import { Loader2, ChevronLeft, ChevronRight, FileText, Play, X } from 'lucide-react';
import type { Post } from '@/types/post';
import type { ActiveVote } from '@/types/video';
import { PostActionButton } from './actionButtons/PostActionButton';
import { TranslatedText } from './TranslatedText';
import type { RewardOption } from '../utils/commentOptions';
import { extractPostMedia, parseThreeSpeakRef, type PostMedia } from '../utils/postMedia';

export interface BlogPostListProps {
  /** Post records, in the order they should render. */
  posts: Post[];
  /** Logged-in username (used by the action bar's auth-gated buttons). */
  currentUser?: string;

  /** Initial-page loader spinner. */
  loading?: boolean;
  /** Pagination loader (shown at the bottom while fetching the next page). */
  loadingMore?: boolean;
  /** True when more pages are available. Drives "Load more" + observer. */
  hasMore?: boolean;
  /** Called when the user requests the next page (button click or scroll). */
  onLoadMore?: () => void;
  /** Optional empty-state message override. */
  emptyMessage?: string;

  // Action callbacks — same shape used by <UserDetailProfile/>.
  onUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onSubmitComment?: (parentAuthor: string, parentPermlink: string, body: string) => void | Promise<void>;
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onReblog?: (author: string, permlink: string) => void;
  onTip?: (author: string, permlink: string) => void;
  onSharePost?: (author: string, permlink: string) => void;
  onCommentClick?: (author: string, permlink: string) => void;
  onReportPost?: (author: string, permlink: string) => void;

  // Click-throughs.
  onUserClick?: (username: string) => void;
  onPostClick?: (author: string, permlink: string, title?: string) => void;

  // Composer tokens forwarded to <PostActionButton/>'s comments modal.
  ecencyToken?: string;
  threeSpeakApiKey?: string;
  giphyApiKey?: string;
  templateToken?: string;
  templateApiBaseUrl?: string;

  // Vote settings (forwarded down to every embedded slider on the page).
  defaultVotePercent?: number;
  voteWeightStep?: number;
  /** Allow landscape video uploads in the inline comment composer. */
  allowLandscapeVideos?: boolean;
  /** Default reward routing for inline comment composers. */
  defaultReward?: RewardOption;
  /** Collapse the per-card secondary actions (reblog · share · tip ·
   *  flag) into a single 3-dot kebab menu. Forwarded to
   *  `<PostActionButton/>`. */
  actionsAsMenu?: boolean;
}

// ─── Inline helpers (mirror of UserDetailProfile's locals) ────────────────

const formatTimeAgo = (dateString: string): string => {
  // Hive returns UTC timestamps without a `Z` suffix; without this the
  // browser interprets them as local time, which skews the relative
  // label by the user's timezone offset (e.g. "in 5h" on the US west
  // coast for a brand-new post). Append the suffix when missing.
  const iso = /Z|[+-]\d{2}:?\d{2}$/.test(dateString)
    ? dateString
    : `${dateString}Z`;
  const now = new Date();
  const date = new Date(iso);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

const extractPlainText = (body: string): string => {
  let text = body;
  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/!\[.*?\]\([^\s)]+\)/g, '');
  text = text.replace(/\[([^\]]*)\]\([^\s)]+\)/g, '$1');
  text = text.replace(/https?:\/\/[^\s)>\]]+/g, '');
  text = text.replace(/\[.*?\]/g, '');
  text = text.replace(/\(https?:\/\/[^\s)]*\)/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
};

/**
 * Renders the visible "tile" for one media entry inside the right-side
 * strip. Tiles fill their parent absolutely so they cover the full
 * stretched height of the card row.
 *
 * Per-kind treatment:
 *   • image      → cover-fit thumbnail
 *   • youtube    → official hqdefault thumbnail + play badge
 *   • threespeak → dark backdrop + play badge (no public thumbnail
 *                  endpoint without a metadata round-trip; consumers
 *                  open the embed iframe in the lightbox)
 *   • twitter    → branded "𝕏" tile that opens the tweet in a new tab
 */
const MediaTile: FC<{ media: PostMedia }> = ({ media }) => {
  if (media.kind === 'image') {
    return (
      <img
        src={media.url}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  if (media.kind === 'youtube') {
    return (
      <>
        <img
          src={`https://i.ytimg.com/vi/${media.id}/hqdefault.jpg`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-90"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white">
            <Play className="h-5 w-5 fill-current" />
          </span>
        </span>
        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          YouTube
        </span>
      </>
    );
  }
  if (media.kind === 'threespeak') {
    return (
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1a1d22]">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e31337]/15 text-[#e31337]">
          <Play className="h-5 w-5 fill-current" />
        </span>
        <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          3Speak
        </span>
      </span>
    );
  }
  // twitter
  return (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0f1419] text-white">
      <span className="text-3xl font-semibold">𝕏</span>
      <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium">
        Tweet
      </span>
    </span>
  );
};

/**
 * Lightbox / preview overlay for one media entry. Images render
 * inline; YouTube and 3Speak open their official embed iframes.
 * Twitter is opened in a new tab at click time, so this overlay is
 * never invoked for it.
 */
const MediaLightbox: FC<{ media: PostMedia; onClose: () => void }> = ({ media, onClose }) => {
  // Lock body scroll + listen for Escape while the lightbox is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-3xl items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute -top-10 right-0 z-10 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        {media.kind === 'image' && (
          <img src={media.url} alt="" className="max-h-[80vh] max-w-full rounded-lg object-contain" />
        )}
        {media.kind === 'youtube' && (
          <div className="w-full overflow-hidden rounded-lg" style={{ aspectRatio: '16/9' }}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${media.id}?autoplay=1&rel=0&playsinline=1`}
              title="YouTube"
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        {media.kind === 'threespeak' && (() => {
          const ref = parseThreeSpeakRef(media.url);
          const src = ref
            ? `https://play.3speak.tv/embed?v=${encodeURIComponent(`${ref.author}/${ref.permlink}`)}&mode=iframe&noscroll=1&autoplay=1`
            : media.url;
          return (
            <div className="w-full overflow-hidden rounded-lg" style={{ aspectRatio: '9/16', maxWidth: '380px' }}>
              <iframe
                src={src}
                title="3Speak"
                className="h-full w-full border-0"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
};

/**
 * Right-side media strip for a post card. Combines images (from
 * `json_metadata.image` and inline body images), YouTube embeds,
 * 3Speak embeds, and X / Twitter status links into one carousel that
 * fills the card row's full height. The strip itself is inset from
 * the card edges (`my-3 mr-3` + `rounded-lg`) so it has visual
 * padding around it instead of butting against the border.
 *
 * Click on a tile:
 *   • image / youtube / threespeak → open in <MediaLightbox/>
 *   • twitter                      → open the tweet in a new tab
 */
const PostMediaCarousel: FC<{ media: PostMedia[] }> = ({ media }) => {
  const [idx, setIdx] = useState(0);
  const [preview, setPreview] = useState<PostMedia | null>(null);
  if (media.length === 0) return null;
  const safeIdx = Math.min(idx, media.length - 1);
  const current = media[safeIdx];
  const onTileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (current.kind === 'twitter') {
      window.open(current.url, '_blank', 'noopener,noreferrer');
      return;
    }
    setPreview(current);
  };
  return (
    <>
      {/* Mobile renders a fixed landscape thumbnail (28 × 20 ≈ 7:5);
          tablet+ stretches to fill the row height again. */}
      <div className="relative my-2 mr-2 h-20 w-28 flex-shrink-0 overflow-hidden rounded-lg bg-[#2f353d] sm:my-3 sm:mr-3 sm:h-auto sm:w-32 sm:self-stretch md:w-40 lg:w-48">
        <button
          onClick={onTileClick}
          className="absolute inset-0 block cursor-pointer"
          aria-label="Open media preview"
        >
          <MediaTile media={current} />
        </button>
        {media.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setIdx((p) => (p - 1 + media.length) % media.length); }}
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              title="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIdx((p) => (p + 1) % media.length); }}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              title="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {safeIdx + 1}/{media.length}
            </span>
          </>
        )}
      </div>

      {preview && (
        <MediaLightbox media={preview} onClose={() => setPreview(null)} />
      )}
    </>
  );
};

// ─── Component ───────────────────────────────────────────────────────────

export const BlogPostList: FC<BlogPostListProps> = ({
  posts,
  currentUser,
  loading = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  emptyMessage = 'No blogs to show.',
  onUpvote,
  onSubmitComment,
  onClickCommentUpvote,
  onReblog,
  onTip,
  onSharePost,
  onCommentClick,
  onReportPost,
  onUserClick,
  onPostClick,
  ecencyToken,
  threeSpeakApiKey,
  giphyApiKey,
  templateToken,
  templateApiBaseUrl,
  defaultVotePercent,
  voteWeightStep,
  allowLandscapeVideos,
  defaultReward,
  actionsAsMenu,
}) => {
  if (loading && posts.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-lg border border-[#3a424a] bg-[#262b30] animate-pulse"
          >
            <div className="flex items-stretch">
              <div className="min-w-0 flex-1 space-y-1.5 p-2.5 sm:space-y-2 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="h-7 w-7 rounded-full bg-[#2f353d] sm:h-9 sm:w-9" />
                  <div className="h-2.5 w-20 rounded bg-[#2f353d] sm:h-3 sm:w-24" />
                  <div className="h-2 w-10 rounded bg-[#2f353d]/70 sm:w-12" />
                </div>
                <div className="h-3 w-5/6 rounded bg-[#2f353d] sm:h-4" />
                <div className="h-2.5 w-full rounded bg-[#2f353d]/70 sm:h-3" />
                <div className="h-2.5 w-4/6 rounded bg-[#2f353d]/70 sm:h-3" />
              </div>
              <div className="my-2 mr-2 h-20 w-28 flex-shrink-0 rounded-lg bg-[#2f353d]/70 sm:my-3 sm:mr-3 sm:h-auto sm:w-32 sm:self-stretch md:w-40 lg:w-48" />
            </div>
            <div className="flex gap-3 border-t border-[#3a424a]/60 px-2.5 py-2 sm:px-4">
              <div className="h-3 w-10 rounded bg-[#2f353d]/70" />
              <div className="h-3 w-10 rounded bg-[#2f353d]/70" />
              <div className="h-3 w-10 rounded bg-[#2f353d]/70" />
              <div className="ml-auto h-3 w-10 rounded bg-[#2f353d]/70" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!loading && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-10 w-10 text-[#6f7780] mb-3" />
        <p className="text-sm text-[#9ca3b0]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((item) => {
        const postMedia = extractPostMedia(item);
        const previewText =
          item.json_metadata?.description || (item.body ? extractPlainText(item.body) : '');

        const rawPayout = item.payout
          ? item.payout.toFixed(3)
          : item.pending_payout_value
            ? item.pending_payout_value.replace(/[^\d.]/g, '')
            : '0.000';

        const tooltipLines: string[] = [];
        const hbdPercent = item.percent_hbd ?? 10000;
        if (hbdPercent === 0) {
          tooltipLines.push('Hive Rewards Payout 100% Powered Up');
        } else {
          tooltipLines.push(
            `Hive Rewards Payout (${(hbdPercent / 200).toFixed(0)}%/${100 - hbdPercent / 200}%)`,
          );
        }
        if (item.is_paidout) {
          const authorVal = item.author_payout_value
            ? item.author_payout_value.replace(/[^\d.]/g, '')
            : '';
          tooltipLines.push('Past payouts:');
          tooltipLines.push(`${rawPayout} Hive Rewards${authorVal ? ` (Author ${authorVal})` : ''}`);
        } else if (hbdPercent === 0) {
          tooltipLines.push(`${rawPayout} Hive Rewards (100% Powered Up)`);
        } else {
          tooltipLines.push(
            `${rawPayout} Hive Rewards (${(hbdPercent / 200).toFixed(0)}%/${100 - hbdPercent / 200}%)`,
          );
        }
        const payoutTooltip = tooltipLines.join('\n');

        const handleClick = onPostClick
          ? () => onPostClick(item.author, item.permlink, item.title)
          : undefined;

        return (
          <div
            key={`${item.author}/${item.permlink}`}
            className={`overflow-hidden rounded-lg border border-[#3a424a] bg-[#262b30] transition-colors hover:bg-[#2f353d] ${handleClick ? 'cursor-pointer' : ''}`}
            onClick={handleClick}
          >
            {/* Body row: text on the left, image on the right. The image
                column uses `self-stretch` so it always covers the full
                height of the text column — taller bodies make the
                image taller, not the other way around. */}
            <div className="flex items-stretch">
              <div className="min-w-0 flex-1 p-2.5 sm:p-4">
                <div className="mb-1 flex items-center gap-2 sm:mb-1.5 sm:gap-3">
                  <img
                    src={`https://images.hive.blog/u/${item.author}/avatar`}
                    alt={item.author}
                    className="h-7 w-7 flex-shrink-0 rounded-full bg-[#2f353d] sm:h-9 sm:w-9"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${item.author}&background=random&size=40`;
                    }}
                  />
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0 sm:gap-x-2 sm:gap-y-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); onUserClick?.(item.author); }}
                      className="text-[11px] font-medium text-white hover:text-[#e31337] sm:text-sm"
                    >
                      @{item.author}
                    </button>
                    <span className="text-[10px] text-[#9ca3b0] sm:text-xs">{formatTimeAgo(item.created)}</span>
                    {item.community_title && (
                      <span className="text-[10px] font-medium text-[#e31337] sm:text-xs">
                        #{item.community_title}
                      </span>
                    )}
                  </div>
                </div>

                {item.title && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onPostClick?.(item.author, item.permlink, item.title); }}
                    className="mb-0.5 line-clamp-2 text-left text-[13px] font-semibold leading-snug text-white hover:text-[#e31337] sm:mb-1 sm:text-base"
                  >
                    <TranslatedText text={item.title} />
                  </button>
                )}

                {previewText && (
                  <p className="line-clamp-2 text-[11px] leading-snug text-[#9ca3b0] sm:line-clamp-3 sm:text-sm sm:leading-relaxed">
                    <TranslatedText text={previewText.substring(0, 240)} />
                  </p>
                )}
              </div>

              <PostMediaCarousel media={postMedia} />
            </div>

            <div className="border-t border-[#3a424a]/60 px-2.5 py-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
              <PostActionButton
                author={item.author}
                permlink={item.permlink}
                currentUser={currentUser}
                hiveValue={rawPayout}
                hiveIconUrl="/images/hive_logo.png"
                payoutTooltip={payoutTooltip}
                initialVotes={(item.active_votes as ActiveVote[] | undefined) ?? []}
                initialCommentsCount={item.children || 0}
                onUpvote={onUpvote ? (percent) => onUpvote(item.author, item.permlink, percent) : undefined}
                onSubmitComment={onSubmitComment ? (pAuthor, pPermlink, body) => onSubmitComment(pAuthor, pPermlink, body) : undefined}
                onClickCommentUpvote={onClickCommentUpvote}
                onReblog={item.author !== currentUser && onReblog ? () => onReblog(item.author, item.permlink) : undefined}
                onShare={onSharePost ? () => onSharePost(item.author, item.permlink) : undefined}
                onTip={item.author !== currentUser && onTip ? () => onTip(item.author, item.permlink) : undefined}
                onReport={item.author !== currentUser && onReportPost ? () => onReportPost(item.author, item.permlink) : undefined}
                disableCommentsModal={!!onCommentClick}
                onComments={onCommentClick ? () => onCommentClick(item.author, item.permlink) : undefined}
                ecencyToken={ecencyToken}
                threeSpeakApiKey={threeSpeakApiKey}
                giphyApiKey={giphyApiKey}
                templateToken={templateToken}
                templateApiBaseUrl={templateApiBaseUrl}
                defaultReward={defaultReward}
                defaultVotePercent={defaultVotePercent}
                voteWeightStep={voteWeightStep}
                allowLandscapeVideos={allowLandscapeVideos}
                actionsAsMenu={actionsAsMenu}
              />
            </div>
          </div>
        );
      })}

      {hasMore && onLoadMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-md border border-[#3a424a] px-4 py-2 text-sm text-[#f0f0f8] hover:bg-[#262b30] disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </>
            ) : (
              'Load more'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default BlogPostList;
