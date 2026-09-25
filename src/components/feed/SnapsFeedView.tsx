/**
 * SnapsFeedView — single-feed-at-a-time shell ported from the hSnaps
 * `UnifiedFeedPage`.
 *
 * At every viewport width (mobile, tablet, desktop) exactly ONE of the
 * feeds is mounted at a time: a pill switcher lets the user pick which
 * one, and only that feed's posts are fetched/rendered/kept in memory.
 * Switching pills unmounts the previous feed's list — it's never just
 * hidden-but-still-loaded — which is what keeps memory flat regardless of
 * how many feed types exist. (Previously desktop mounted every feed
 * side-by-side simultaneously, which could use up to ~2GB of memory and
 * made the page painfully slow, especially on tablets/lower-power
 * devices — this component now applies the same single-container
 * behavior mobile already had to every breakpoint.)
 *
 * Data is supplied by the host app: each feed slot receives `posts`,
 * loading/error/pagination flags, plus an optional `onLoadMore`. Per-post
 * action callbacks (vote / comment / reblog / share / tip / report) are
 * forwarded to the embedded <BlogPostList/> exactly the way <BlogsPage/>
 * already does — so the rendered cards behave identically to the rest of
 * the hivesuite Blog-style surfaces.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
// SnapsFeedView layout: one column, at every viewport width. The pill
// switcher (<FeedSegmentControl/>) is the ONE mechanism for choosing
// which single feed is mounted; the parent scroll container owns
// scrolling. The switcher's own styling can still respond to viewport
// width (FeedSegmentControl grows a bit via `md:` classes), but desktop
// no longer renders every feed side-by-side.
import type { Post } from '@/types/post';
import SnapsFeedList from './SnapsFeedList';
import { ArrowUp } from 'lucide-react';
import FeedSegmentControl from './FeedSegmentControl';
import type { RewardOption } from '../../utils/commentOptions';

export type SnapsFeedKey = 'snaps' | 'ecency' | 'threads' | 'liketu' | 'slothbuzz';

export interface SnapsFeedSlot {
  posts: Post[];
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  error?: string | null;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  newCount?: number;
  newAvatars?: string[];
  onShowNew?: () => void;
}

export interface SnapsFeedViewProps {
  feeds: Record<SnapsFeedKey, SnapsFeedSlot>;

  /** Override per-feed display name (default labels: Snaps / Ecency / Threads / Liketu / SlothBuzz). */
  labels?: Partial<Record<SnapsFeedKey, string>>;
  /** Override per-feed avatar URL (defaults to canonical container account avatars). */
  avatars?: Partial<Record<SnapsFeedKey, string>>;

  /** Initial feed shown (the only mounted feed at any viewport width).
   *  Defaults to `snaps`. */
  defaultPrimary?: SnapsFeedKey;

  /** Logged-in observer username (drives auth-gated buttons inside post cards). */
  currentUser?: string;
  /**
   * Hive account to use as the bridge API `observer` for embedded re-snap
   * previews. Defaults to `currentUser` when omitted — pass this
   * separately when `currentUser` isn't a valid Hive account (e.g. a Web2
   * viewer), while `currentUser` stays their real identity for the
   * auth-gated buttons above.
   */
  observer?: string;

  // ── BlogPostList action callbacks (forwarded per column) ──────────────
  onUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onSubmitComment?: (parentAuthor: string, parentPermlink: string, body: string) => void | boolean | Promise<void | boolean>;
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onReblog?: (author: string, permlink: string) => void;
  isPostReblogged?: (author: string, permlink: string) => boolean;
  onCheckReblogged?: (author: string, permlink: string) => void;
  /** Called when the viewer taps "Re-snap" in a snap's more menu.
   *  Host implements the broadcast — see SnapsFeedCard's `onReSnap`.
   *  The `parentTags` argument carries the original snap's
   *  `json_metadata.tags` so the broadcast can stay under the same
   *  community / topic. */
  onReSnap?: (
    author: string,
    permlink: string,
    parentTags?: string[],
  ) => void;
  onTip?: (author: string, permlink: string) => void;
  onSharePost?: (author: string, permlink: string) => void;
  onCommentClick?: (author: string, permlink: string) => void;
  /** Comment-icon click (per card) — typical use: open inline composer. */
  /** Forwarded to every <SnapsFeedCard/>. The optional `parentTags`
   *  argument carries `json_metadata.tags` of the snap so the
   *  consumer's reply composer can pre-fill them. */
  onClickCommentIcon?: (
    author: string,
    permlink: string,
    parentTags?: string[],
  ) => void;
  /** Comment-count click (per card) — typical use: open post detail. */
  onClickCommentCount?: (author: string, permlink: string, contextPosts?: Post[]) => void;
  onReportPost?: (author: string, permlink: string) => void;
  /** Forwarded to every <SnapsFeedCard/> — Bookmark entry on the
   *  action-bar kebab. Consumer decides add vs remove based on
   *  `isPostBookmarked`. */
  onToggleBookmark?: (author: string, permlink: string) => void;
  /** Forwarded to every <SnapsFeedCard/> — controls the filled vs
   *  outline bookmark icon per snap. Typically backed by a Zustand
   *  store like hivesuite's `useBookmarkStore`. */
  isPostBookmarked?: (author: string, permlink: string) => boolean;
  /** Forwarded to every <SnapsFeedCard/> — Delete entry on the
   *  action-bar kebab, gated to the snap's author. Consumer owns
   *  the confirm dialog + broadcast. */
  onDeletePost?: (author: string, permlink: string) => void;
  /** Forwarded to every <SnapsFeedCard/> — Edit entry on the action-bar
   *  kebab, gated to the snap's author. */
  onEditSnap?: (data: {
    author: string;
    permlink: string;
    body: string;
    title: string;
    parent_author: string;
    parent_permlink: string;
    json_metadata: string;
  }) => void;
  /** Cast a poll vote from inside a snap card (custom_json id: "polls"). */
  onVotePoll?: (
    author: string,
    permlink: string,
    choiceNums: number[],
  ) => void | boolean | Promise<void | boolean>;
  onUserClick?: (username: string) => void;
  onPostClick?: (author: string, permlink: string, title?: string, contextPosts?: Post[]) => void;
  onWeb2UserClick?: (web2id: string, name?: string, dpUrl?: string, provider?: string) => void;
  // URL builders — forwarded to every <SnapsFeedCard/> so its
  // clickable surfaces render as real <a href> links ("open in new
  // tab" etc.). See SnapsFeedCard for details.
  getPostUrl?: (author: string, permlink: string) => string;
  getUserUrl?: (username: string) => string;
  getWeb2UserUrl?: (web2id: string, name?: string, dpUrl?: string, provider?: string) => string;
  getTagUrl?: (tag: string) => string;
  getCommunityUrl?: (community: string) => string;

  // Composer tokens
  ecencyToken?: string;
  threeSpeakApiKey?: string;
  giphyApiKey?: string;
  templateToken?: string;
  templateApiBaseUrl?: string;

  // Vote settings
  defaultVotePercent?: number;
  voteWeightStep?: number;
  allowLandscapeVideos?: boolean;
  /** Forwarded to each snap card's vote slider — when true, a
   *  blinking "Open Keychain App & Approve" hint is shown while a
   *  broadcast is in flight. */
  awaitingWalletApproval?: boolean;
  defaultReward?: RewardOption;

  /** Optional top-row content rendered above the feed (e.g. a Compose FAB
   *  trigger or filter dropdown). Sticky to the top of the viewport. */
  toolbar?: ReactNode;
  /** Optional element rendered at the bottom of the layout (e.g. Compose FAB). */
  footer?: ReactNode;

  /** Optional render slot for a per-card right-side header action menu
   *  (Edit / Delete / Flag). Forwarded to every <SnapsFeedCard/>. */
  renderHeaderActions?: (post: import('@/types/post').Post) => ReactNode;

  /** Collapse the per-card secondary actions (reblog · share · tip ·
   *  flag) into a single 3-dot kebab menu. Forwarded to every
   *  <SnapsFeedCard/>. */
  actionsAsMenu?: boolean;
  /**
   * @deprecated No longer changes rendering. SnapsFeedView now always
   * mounts exactly one feed at a time (the previous mobile behavior)
   * and always relies on the parent's scroll container — there's no
   * more multi-column desktop grid with its own per-column scrollers
   * to opt out of. Kept as a no-op prop so existing callers that pass
   * `pageScroll` don't need an immediate update.
   */
  pageScroll?: boolean;
  onActiveFeedChange?: (feed: SnapsFeedKey) => void;
  isWeb2User?: boolean;
}

const DEFAULT_LABELS: Record<SnapsFeedKey, string> = {
  snaps: 'Snaps',
  ecency: 'Waves',
  threads: 'Threads',
  liketu: 'Moments',
  slothbuzz: 'Hangs',
};

const DEFAULT_AVATARS: Record<SnapsFeedKey, string> = {
  snaps: 'https://images.hive.blog/u/peak.snaps/avatar',
  ecency: 'https://images.hive.blog/u/ecency.waves/avatar',
  threads: 'https://images.hive.blog/u/leothreads/avatar',
  liketu: 'https://images.hive.blog/u/liketu.moments/avatar',
  slothbuzz: 'https://images.hive.blog/u/slothbuzz.hangs/avatar',
};

/**
 * Module-level cache of the pill-switcher selection. Without this, every
 * remount (e.g. coming back from a post detail) resets the active feed
 * to `defaultPrimary` — so a user on threads page 3 would land back on
 * snaps page 1 after closing a post. Persisting the key makes them land
 * on the same feed they left, on every viewport width.
 */
let lastActiveFeed: string | null = null;

export function SnapsFeedView({
  feeds,
  labels,
  avatars,
  defaultPrimary = 'snaps',
  currentUser,
  observer,
  onUpvote,
  onSubmitComment,
  onClickCommentUpvote,
  onReblog,
  isPostReblogged,
  onCheckReblogged,
  onReSnap,
  onTip,
  onSharePost,
  onCommentClick,
  onClickCommentIcon,
  onClickCommentCount,
  onReportPost,
  onToggleBookmark,
  isPostBookmarked,
  onDeletePost,
  onEditSnap,
  onVotePoll,
  onUserClick,
  onPostClick,
  onWeb2UserClick,
  getPostUrl,
  getUserUrl,
  getWeb2UserUrl,
  getTagUrl,
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
  toolbar,
  footer,
  renderHeaderActions,
  actionsAsMenu,
  onActiveFeedChange,
  isWeb2User,
}: SnapsFeedViewProps) {
  const finalLabels = { ...DEFAULT_LABELS, ...labels };
  const finalAvatars = { ...DEFAULT_AVATARS, ...avatars };

  // The pill switcher picks which single feed is mounted, at every
  // viewport width — only the active feed's data is fetched/rendered/
  // kept in memory; switching pills unmounts the previous one instead of
  // just hiding it. Initialized from the module-level cache so the user
  // lands back on the same feed they were viewing before navigating to a
  // post.
  const [activeFeed, setActiveFeed] = useState<SnapsFeedKey>(() => {
    const cached = lastActiveFeed;
    if (cached === 'snaps' || cached === 'ecency' || cached === 'threads' || cached === 'liketu' || cached === 'slothbuzz') {
      return cached;
    }
    return defaultPrimary;
  });
  // Keep the module cache in sync on every change.
  useEffect(() => {
    lastActiveFeed = activeFeed;
    if (onActiveFeedChange) onActiveFeedChange(activeFeed);
  }, [activeFeed, onActiveFeedChange]);

  const [scrolled, setScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Monitor the ambient scroll container (whatever ancestor actually
  // scrolls — the parent page owns scrolling since there's only ever one
  // feed body mounted) so the "N posted" pill can show/hide.
  useEffect(() => {
    let scrollParent: HTMLElement | Window | null = null;
    let curr: HTMLElement | null = containerRef.current;
    while (curr) {
      const overflow = window.getComputedStyle(curr).overflowY;
      if (curr.scrollHeight > curr.clientHeight && (overflow === 'auto' || overflow === 'scroll')) {
        scrollParent = curr;
        break;
      }
      curr = curr.parentElement;
    }
    if (!scrollParent) {
      scrollParent = window;
    }

    const handleScroll = () => {
      const scrollTop = scrollParent === window
        ? window.scrollY
        : (scrollParent as HTMLElement).scrollTop;
      setScrolled(scrollTop > 150);
    };

    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      if (scrollParent) {
        scrollParent.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const segOpt = (k: SnapsFeedKey) => ({
    id: k,
    label: finalLabels[k],
    avatarUrl: finalAvatars[k],
  });

  const sharedListProps = {
    currentUser,
    observer,
    onUpvote,
    onSubmitComment,
    onClickCommentUpvote,
    onReblog,
    isPostReblogged,
    onCheckReblogged,
    onReSnap,
    onTip,
    onSharePost,
    onCommentClick,
    onClickCommentIcon,
    onClickCommentCount,
    onReportPost,
    onToggleBookmark,
    isPostBookmarked,
    onDeletePost,
    onEditSnap,
    onVotePoll,
    onUserClick,
    onPostClick,
    onWeb2UserClick,
    getPostUrl,
    getUserUrl,
    getWeb2UserUrl,
    getTagUrl,
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
    renderHeaderActions,
    actionsAsMenu,
    isWeb2User,
  };

  const feedOptions: SnapsFeedKey[] = ['snaps', 'ecency', 'threads', 'liketu', 'slothbuzz'];

  /** The active feed's body (error banner + list). This is the ONLY feed
   *  body ever rendered — switching `activeFeed` unmounts this and
   *  mounts a fresh one for the newly-selected key, so a non-active
   *  feed's posts are never kept mounted/in memory. */
  const renderBody = (key: SnapsFeedKey) => {
    const slot = feeds[key];
    // Guard: if the host hasn't wired up this feed yet, show nothing.
    if (!slot) return null;
    return (
      <>
        {slot.error && (
          <div className="mb-3 rounded-md border border-[var(--hrk-brand)] bg-red-900/20 p-2 text-xs font-medium text-red-400">
            {slot.error}
          </div>
        )}
        <SnapsFeedList
          {...sharedListProps}
          posts={slot.posts}
          loading={!!slot.loading}
          loadingMore={!!slot.loadingMore}
          hasMore={!!slot.hasMore}
          onLoadMore={slot.onLoadMore}
          emptyMessage={`No ${finalLabels[key].toLowerCase()} yet.`}
        />
      </>
    );
  };

  // ── Single feed, with a pill switcher — same shell at every viewport
  //    width. Only `feeds[activeFeed]` is ever rendered/mounted below;
  //    picking a different pill mounts that feed fresh and lets the
  //    previous one (and its in-memory post list) get garbage collected.
  const slot = feeds[activeFeed];
  const showPill = !!(slot && slot.newCount && slot.newCount > 0 && scrolled);

  return (
    <div ref={containerRef} className="mx-auto flex w-full max-w-[720px] md:max-w-[880px] flex-col gap-3">
      <div className="sticky top-0 z-20 -mx-2 bg-[var(--hrk-bg-app)]/85 px-2 py-1.5 backdrop-blur flex items-center justify-between gap-2">
        <div className="overflow-x-auto min-w-0 flex-1 scrollbar-none">
          <FeedSegmentControl
            options={feedOptions.map(segOpt)}
            value={activeFeed}
            onChange={(id) => setActiveFeed(id as SnapsFeedKey)}
          />
        </div>
        {toolbar && (
          <div className="shrink-0">
            {toolbar}
          </div>
        )}
      </div>
      <div className="relative flex flex-col">
        {showPill && (
          <div className="sticky top-14 left-0 right-0 z-30 h-0 overflow-visible flex justify-center pointer-events-none">
            <button
              type="button"
              onClick={slot.onShowNew}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#1d9bf0] px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-[#1a8cd8] active:scale-95 cursor-pointer"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              {slot.newAvatars && slot.newAvatars.length > 0 && (
                <div className="flex -space-x-1.5 overflow-hidden mr-1">
                  {slot.newAvatars.slice(0, 3).map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt=""
                      className="inline-block h-5 w-5 rounded-full ring-2 ring-[#1d9bf0] object-cover"
                    />
                  ))}
                </div>
              )}
              <span>{slot.newCount} posted</span>
            </button>
          </div>
        )}
        {renderBody(activeFeed)}
      </div>
      {footer}
    </div>
  );
}

export default SnapsFeedView;
