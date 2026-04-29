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
import { useState, type FC } from 'react';
import { Loader2, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import type { Post } from '@/types/post';
import type { ActiveVote } from '@/types/video';
import { PostActionButton } from './actionButtons/PostActionButton';
import { TranslatedText } from './TranslatedText';
import type { RewardOption } from '../utils/commentOptions';

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
}

// ─── Inline helpers (mirror of UserDetailProfile's locals) ────────────────

const formatTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
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

const PostImageCarousel: FC<{ images: string[] }> = ({ images }) => {
  const [idx, setIdx] = useState(0);
  const [preview, setPreview] = useState(false);
  if (images.length === 0) return null;
  return (
    <>
      <div className="relative w-16 flex-shrink-0 mt-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); setPreview(true); }}
          className="block w-16 h-16 rounded-lg overflow-hidden border border-[#3a424a] hover:border-[#e31337] transition-colors cursor-pointer"
        >
          <img
            src={images[idx]}
            alt=""
            className="w-full h-full object-cover bg-[#2f353d]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </button>
        {images.length > 1 && (
          <div className="flex items-center justify-between mt-1">
            <button
              onClick={(e) => { e.stopPropagation(); setIdx((p) => (p - 1 + images.length) % images.length); }}
              className="p-0.5 text-[#9ca3b0] hover:text-white transition-colors"
              title="Previous"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] text-[#9ca3b0]">{idx + 1}/{images.length}</span>
            <button
              onClick={(e) => { e.stopPropagation(); setIdx((p) => (p + 1) % images.length); }}
              className="p-0.5 text-[#9ca3b0] hover:text-white transition-colors"
              title="Next"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={(e) => { e.stopPropagation(); setPreview(false); }}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={images[idx]} alt="" className="max-w-full max-h-[80vh] rounded-lg object-contain" />
            <button
              onClick={(e) => { e.stopPropagation(); setPreview(false); }}
              className="absolute top-2 right-2 text-white/70 hover:text-white bg-black/50 rounded-full p-1.5 transition-colors"
              title="Close"
            >
              <span className="text-lg leading-none">&times;</span>
            </button>
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setIdx((p) => (p - 1 + images.length) % images.length); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setIdx((p) => (p + 1) % images.length); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
                  {idx + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        </div>
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
}) => {
  if (loading && posts.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="border border-[#3a424a] rounded-lg p-4 bg-[#262b30] animate-pulse"
          >
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16">
                <div className="h-10 w-10 rounded-full bg-[#2f353d]" />
                <div className="h-16 w-16 rounded-lg bg-[#2f353d]/70" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-24 rounded bg-[#2f353d]" />
                  <div className="h-2 w-12 rounded bg-[#2f353d]/70" />
                </div>
                <div className="h-4 w-5/6 rounded bg-[#2f353d]" />
                <div className="h-3 w-full rounded bg-[#2f353d]/70" />
                <div className="h-3 w-4/6 rounded bg-[#2f353d]/70" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#3a424a]/60 flex gap-3">
              <div className="h-3 w-10 rounded bg-[#2f353d]/70" />
              <div className="h-3 w-10 rounded bg-[#2f353d]/70" />
              <div className="h-3 w-10 rounded bg-[#2f353d]/70" />
              <div className="h-3 w-10 rounded bg-[#2f353d]/70 ml-auto" />
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
        const postImages = item.json_metadata?.image?.length ? item.json_metadata.image : [];
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
            className={`border border-[#3a424a] rounded-lg p-4 bg-[#262b30] hover:bg-[#2f353d] transition-colors ${handleClick ? 'cursor-pointer' : ''}`}
            onClick={handleClick}
          >
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16">
                <img
                  src={`https://images.hive.blog/u/${item.author}/avatar`}
                  alt={item.author}
                  className="w-10 h-10 rounded-full bg-[#2f353d] flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${item.author}&background=random&size=40`;
                  }}
                />
                <PostImageCarousel images={postImages} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onUserClick?.(item.author); }}
                    className="font-medium text-white hover:text-[#e31337] text-sm"
                  >
                    @{item.author}
                  </button>
                  <span className="text-xs text-[#9ca3b0]">{formatTimeAgo(item.created)}</span>
                </div>

                {item.title && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onPostClick?.(item.author, item.permlink, item.title); }}
                    className="text-left text-base font-semibold text-white mb-1 line-clamp-2 hover:text-[#e31337]"
                  >
                    <TranslatedText text={item.title} />
                  </button>
                )}

                {previewText && (
                  <p className="text-[#9ca3b0] text-sm line-clamp-2">
                    <TranslatedText text={previewText.substring(0, 200)} />
                  </p>
                )}

                {item.community_title && (
                  <span className="inline-block mt-1 text-xs text-[#e31337] font-medium">
                    #{item.community_title}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-[#3a424a]/60" onClick={(e) => e.stopPropagation()}>
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
