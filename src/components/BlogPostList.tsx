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
import { useEffect, useRef, useState, type FC } from 'react';
import { Loader2, ChevronLeft, ChevronRight, FileText, Play } from 'lucide-react';
import type { Post } from '@/types/post';
import type { ActiveVote } from '@/types/video';
import { PostActionButton } from './actionButtons/PostActionButton';
import { TranslatedText } from './TranslatedText';
import type { RewardOption } from '../utils/commentOptions';
import { extractPostMedia, type PostMedia } from '../utils/postMedia';
import { MediaLightbox } from './MediaLightbox';
import { HiveLink } from './common/HiveLink';

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
  /** Per-row bookmark toggle. Forwarded to each PostActionButton's
   *  kebab. Consumer decides add vs remove based on
   *  `isPostBookmarked`. */
  onToggleBookmark?: (author: string, permlink: string) => void;
  /** Read function — controls the filled vs outline bookmark icon
   *  per row. Typically backed by the consumer's bookmark store. */
  isPostBookmarked?: (author: string, permlink: string) => boolean;
  /** Author-only — when the consumer's current user is `post.author`,
   *  PostActionButton's kebab gets a red "Delete" entry that calls
   *  this handler. The kit does no ownership check; the consumer
   *  decides whether to pass the prop. */
  onDeletePost?: (author: string, permlink: string) => void;

  // Click-throughs.
  onUserClick?: (username: string) => void;
  onPostClick?: (author: string, permlink: string, title?: string) => void;
  // URL builders — when provided, the post title + author render as
  // real <a href> links so the browser offers "open in new tab" /
  // Cmd-click. Plain clicks still route through the callbacks above.
  getPostUrl?: (author: string, permlink: string) => string;
  getUserUrl?: (username: string) => string;
  getCommunityUrl?: (community: string) => string;

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
  /** Surface a blinking "Open Keychain App & Approve" hint on each
   *  card's vote slider while a broadcast is in flight. Set when the
   *  logged-in user is on Keychain / HiveAuth / PeakVault. */
  awaitingWalletApproval?: boolean;
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
/**
 * Single thumbnail in the carousel strip. Tracks its own load state
 * so flipping between images shows a small spinner while the next
 * src downloads — keying the load state on `media.url` resets it
 * whenever the parent swaps the active item.
 */
const MediaTile: FC<{ media: PostMedia }> = ({ media }) => {
  // Image thumbnails carry their own loading state so we can overlay
  // a spinner until the bitmap is on screen. YouTube hqdefault.jpg
  // gets the same treatment.
  const [loaded, setLoaded] = useState(false);
  // Reset on every distinct media identity. The union has either a
  // `url` or an `id` depending on kind, so we hash both into one key.
  const mediaKey = media.kind + ':' + ('url' in media ? media.url : media.id);
  useEffect(() => { setLoaded(false); }, [mediaKey]);

  if (media.kind === 'image') {
    return (
      <>
        {!loaded && (
          <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 pointer-events-none">
            <Loader2 className="h-5 w-5 animate-spin text-white/80" />
          </span>
        )}
        <img
          src={media.url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            setLoaded(true);
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </>
    );
  }
  if (media.kind === 'youtube') {
    return (
      <>
        {!loaded && (
          <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 pointer-events-none">
            <Loader2 className="h-5 w-5 animate-spin text-white/80" />
          </span>
        )}
        <img
          src={`https://i.ytimg.com/vi/${media.id}/hqdefault.jpg`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-90"
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            setLoaded(true);
            (e.target as HTMLImageElement).style.display = 'none';
          }}
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
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--hrk-bg-surface-sunken)]">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--hrk-brand)]/15 text-[var(--hrk-brand)]">
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
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--hrk-bg-surface-sunken)] text-white">
      <span className="text-3xl font-semibold">𝕏</span>
      <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium">
        Tweet
      </span>
    </span>
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
  // Track the lightbox open state by start index instead of a single
  // media reference so the prev/next nav inside the lightbox can
  // traverse the whole list.
  const [previewStart, setPreviewStart] = useState<number | null>(null);
  if (media.length === 0) return null;
  const safeIdx = Math.min(idx, media.length - 1);
  const current = media[safeIdx];
  const onTileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (current.kind === 'twitter') {
      window.open(current.url, '_blank', 'noopener,noreferrer');
      return;
    }
    setPreviewStart(safeIdx);
  };
  return (
    <>
      {/* Mobile renders a fixed landscape thumbnail (28 × 20 ≈ 7:5);
          tablet+ stretches to fill the row height again. */}
      <div className="relative my-2 mr-2 h-20 w-28 flex-shrink-0 overflow-hidden rounded-[10px] bg-[var(--hrk-bg-surface-sunken)] ring-1 ring-[var(--hrk-border-subtle)] sm:my-3 sm:mr-3 sm:h-auto sm:w-32 sm:self-stretch md:w-40 lg:w-48">
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

      {previewStart !== null && (
        <MediaLightbox
          // Twitter tiles are opened in a new tab from the carousel
          // itself, so drop them from the lightbox traversal — the
          // user can't preview a tweet inline anyway.
          items={media.filter((m) => m.kind !== 'twitter')}
          startIndex={Math.min(
            previewStart,
            // Re-map the start index in case the filter shifted it.
            Math.max(0, media.slice(0, previewStart + 1).filter((m) => m.kind !== 'twitter').length - 1),
          )}
          onClose={() => setPreviewStart(null)}
        />
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
  onToggleBookmark,
  isPostBookmarked,
  onDeletePost,
  onUserClick,
  onPostClick,
  getPostUrl,
  getUserUrl,
  getCommunityUrl,
  ecencyToken,
  threeSpeakApiKey,
  giphyApiKey,
  templateToken,
  templateApiBaseUrl,
  defaultVotePercent,
  voteWeightStep,
  allowLandscapeVideos,
  awaitingWalletApproval,
  defaultReward,
  actionsAsMenu,
}) => {
  if (loading && posts.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-[14px] border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] animate-pulse"
          >
            <div className="flex items-stretch">
              <div className="min-w-0 flex-1 space-y-1.5 p-2.5 sm:space-y-2 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="h-7 w-7 rounded-full bg-[var(--hrk-bg-surface-sunken)] sm:h-9 sm:w-9" />
                  <div className="h-2.5 w-20 rounded bg-[var(--hrk-bg-surface-sunken)] sm:h-3 sm:w-24" />
                  <div className="h-2 w-10 rounded bg-[var(--hrk-bg-surface-sunken)] opacity-70 sm:w-12" />
                </div>
                <div className="h-3 w-5/6 rounded bg-[var(--hrk-bg-surface-sunken)] sm:h-4" />
                <div className="h-2.5 w-full rounded bg-[var(--hrk-bg-surface-sunken)] opacity-70 sm:h-3" />
                <div className="h-2.5 w-4/6 rounded bg-[var(--hrk-bg-surface-sunken)] opacity-70 sm:h-3" />
              </div>
              <div className="my-2 mr-2 h-20 w-28 flex-shrink-0 rounded-[10px] bg-[var(--hrk-bg-surface-sunken)] opacity-80 sm:my-3 sm:mr-3 sm:h-auto sm:w-32 sm:self-stretch md:w-40 lg:w-48" />
            </div>
            <div className="flex gap-3 border-t border-[var(--hrk-border-subtle)] px-2.5 py-2 sm:px-4">
              <div className="h-3 w-10 rounded bg-[var(--hrk-bg-surface-sunken)] opacity-70" />
              <div className="h-3 w-10 rounded bg-[var(--hrk-bg-surface-sunken)] opacity-70" />
              <div className="h-3 w-10 rounded bg-[var(--hrk-bg-surface-sunken)] opacity-70" />
              <div className="ml-auto h-3 w-10 rounded bg-[var(--hrk-bg-surface-sunken)] opacity-70" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!loading && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--hrk-bg-hover)] text-[var(--hrk-text-tertiary)]">
          <FileText className="h-5 w-5" />
        </div>
        <p className="text-sm text-[var(--hrk-text-secondary)]">{emptyMessage}</p>
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

        // Structured payout details consumed by the rewards modal when
        // the user taps the payout chip.
        const parseDollar = (v?: string) =>
          parseFloat((v ?? '').replace(/[^\d.]/g, '')) || 0;
        const pendingValue = parseDollar(item.pending_payout_value);
        const authorValue = parseDollar(item.author_payout_value);
        const curatorValue = parseDollar(item.curator_payout_value);
        const totalValue = item.payout && item.payout > 0
          ? item.payout
          : (pendingValue > 0 ? pendingValue : authorValue + curatorValue);
        const payoutDetails = {
          pendingValue,
          authorValue,
          curatorValue,
          totalValue,
          isPaidout: !!item.is_paidout,
          payoutAt: item.payout_at,
          percentHbd: item.percent_hbd ?? 10000,
          beneficiaries: (item.beneficiaries ?? []).map((b) => ({
            account: b.account,
            weight: b.weight,
          })),
        };

        const handleClick = onPostClick
          ? (e: React.MouseEvent) => {
              // Let modified / non-primary clicks fall through to the
              // browser so any underlying link (title / author) can
              // open in a new tab.
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              onPostClick(item.author, item.permlink, item.title);
            }
          : undefined;

        return (
          <div
            key={`${item.author}/${item.permlink}`}
            className={`group overflow-hidden rounded-[14px] border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] transition-[background-color,border-color] duration-150 ease-out hover:border-[var(--hrk-border-default)] hover:bg-[var(--hrk-bg-surface-raised)] ${handleClick ? 'cursor-pointer' : ''}`}
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
                    className="h-7 w-7 flex-shrink-0 rounded-full bg-[var(--hrk-bg-surface-sunken)] object-cover ring-1 ring-[var(--hrk-border-subtle)] sm:h-9 sm:w-9"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${item.author}&background=random&size=40`;
                    }}
                  />
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0 sm:gap-x-2 sm:gap-y-0.5">
                    <HiveLink
                      href={getUserUrl?.(item.author)}
                      onActivate={() => onUserClick?.(item.author)}
                      className="text-[11px] font-medium text-white hover:text-[var(--hrk-brand)] sm:text-sm"
                    >
                      @{item.author}
                    </HiveLink>
                    {/* Timestamp is the post permalink so the card has a
                        right-clickable "open in new tab" target even if
                        the title is absent. */}
                    <HiveLink
                      href={getPostUrl?.(item.author, item.permlink)}
                      onActivate={() => onPostClick?.(item.author, item.permlink, item.title)}
                      className="text-[10px] text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-brand)] hover:underline sm:text-xs"
                    >
                      {formatTimeAgo(item.created)}
                    </HiveLink>
                    {item.community_title && (
                      <HiveLink
                        href={item.community ? getCommunityUrl?.(item.community) : undefined}
                        onActivate={() => {
                          if (item.community) onUserClick?.(item.community);
                        }}
                        className="text-[10px] font-medium text-[var(--hrk-brand)] hover:underline sm:text-xs"
                      >
                        #{item.community_title}
                      </HiveLink>
                    )}
                  </div>
                </div>

                {item.title && (
                  <HiveLink
                    href={getPostUrl?.(item.author, item.permlink)}
                    onActivate={() => onPostClick?.(item.author, item.permlink, item.title)}
                    className="mb-0.5 line-clamp-2 block text-left text-[13px] font-semibold leading-snug text-white hover:text-[var(--hrk-brand)] sm:mb-1 sm:text-base"
                  >
                    <TranslatedText text={item.title} />
                  </HiveLink>
                )}

                {previewText && (
                  <p className="line-clamp-2 text-[11px] leading-snug text-[var(--hrk-text-tertiary)] sm:line-clamp-3 sm:text-sm sm:leading-relaxed">
                    <TranslatedText text={previewText.substring(0, 240)} />
                  </p>
                )}
              </div>

              <PostMediaCarousel media={postMedia} />
            </div>

            <div className="border-t border-[var(--hrk-border-subtle)] px-2.5 py-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
              <PostActionButton
                author={item.author}
                permlink={item.permlink}
                currentUser={currentUser}
                onUserClick={onUserClick}
                getUserUrl={getUserUrl}
                hiveValue={rawPayout}
                hiveIconUrl="/images/hive_logo.png"
                payoutTooltip={payoutTooltip}
                payoutDetails={payoutDetails}
                initialVotes={(item.active_votes as ActiveVote[] | undefined) ?? []}
                initialVoteCount={
                  (item as { stats?: { total_votes?: number } }).stats?.total_votes
                  ?? (item as { net_votes?: number }).net_votes
                  ?? (item.active_votes as ActiveVote[] | undefined)?.length
                  ?? 0
                }
                initialCommentsCount={item.children || 0}
                postCreatedAt={item.created}
                onUpvote={onUpvote ? (percent) => onUpvote(item.author, item.permlink, percent) : undefined}
                onSubmitComment={onSubmitComment ? (pAuthor, pPermlink, body) => onSubmitComment(pAuthor, pPermlink, body) : undefined}
                onClickCommentUpvote={onClickCommentUpvote}
                onReblog={item.author !== currentUser && onReblog ? () => onReblog(item.author, item.permlink) : undefined}
                onShare={onSharePost ? () => onSharePost(item.author, item.permlink) : undefined}
                onTip={item.author !== currentUser && onTip ? () => onTip(item.author, item.permlink) : undefined}
                onToggleBookmark={
                  onToggleBookmark ? () => onToggleBookmark(item.author, item.permlink) : undefined
                }
                isBookmarked={
                  isPostBookmarked ? isPostBookmarked(item.author, item.permlink) : false
                }
                onReport={item.author !== currentUser && onReportPost ? () => onReportPost(item.author, item.permlink) : undefined}
                onDelete={item.author === currentUser && onDeletePost ? () => onDeletePost(item.author, item.permlink) : undefined}
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
                awaitingWalletApproval={awaitingWalletApproval}
                actionsAsMenu={actionsAsMenu}
              />
            </div>
          </div>
        );
      })}

      {/* Infinite-scroll sentinel — replaces the explicit "Load more"
          button. An IntersectionObserver fires `onLoadMore` automatically
          when this row scrolls into view (with a 600px rootMargin so the
          fetch starts well before the user actually hits the bottom and
          the next page is usually in place by the time they need it). */}
      {hasMore && onLoadMore && (
        <LoadMoreSentinel
          onLoadMore={onLoadMore}
          loadingMore={loadingMore}
        />
      )}
    </div>
  );
};

interface LoadMoreSentinelProps {
  onLoadMore: () => void;
  loadingMore?: boolean;
}

const LoadMoreSentinel: FC<LoadMoreSentinelProps> = ({ onLoadMore, loadingMore }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  // Hold the latest callback in a ref so re-firing the observer doesn't
  // trip on a stale closure (the consumer recreates `onLoadMore` each
  // render). Read inside the observer callback instead of capturing.
  const callbackRef = useRef(onLoadMore);
  const loadingMoreRef = useRef(!!loadingMore);
  useEffect(() => { callbackRef.current = onLoadMore; }, [onLoadMore]);
  useEffect(() => { loadingMoreRef.current = !!loadingMore; }, [loadingMore]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !loadingMoreRef.current) {
          callbackRef.current();
        }
      },
      // Trigger 600px BEFORE the sentinel becomes visible — the
      // network round-trip usually lands before the user gets to the
      // bottom of the visible list, so scrolling feels seamless.
      { root: null, rootMargin: '600px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="flex justify-center py-3 text-xs text-[var(--hrk-text-tertiary)]"
      aria-hidden={!loadingMore}
    >
      {loadingMore ? (
        <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading more…
        </span>
      ) : (
        // 1px high "tripwire" — invisible to the user but the
        // observer's rootMargin: 600px ensures it triggers from
        // well above the fold.
        <span className="block h-px w-full" />
      )}
    </div>
  );
};

export default BlogPostList;
