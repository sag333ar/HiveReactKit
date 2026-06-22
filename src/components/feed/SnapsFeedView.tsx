/**
 * SnapsFeedView — responsive multi-feed shell ported from the hSnaps
 * `UnifiedFeedPage`.
 *
 *   • Mobile (1 col):  full-width pill switcher above a single feed
 *                      column. The user picks one of the four feeds.
 *   • Tablet (2 col):  two columns, each with its own segment-control
 *                      switcher (snaps/ecency on the left, threads/liketu
 *                      on the right by default — both fully overridable).
 *   • Desktop (4 col): all four feeds visible side-by-side, each titled
 *                      with the canonical feed avatar + label.
 *
 * Data is supplied by the host app: each feed slot receives `posts`,
 * loading/error/pagination flags, plus an optional `onLoadMore`. Per-post
 * action callbacks (vote / comment / reblog / share / tip / report) are
 * forwarded to the embedded <BlogPostList/> exactly the way <BlogsPage/>
 * already does — so the rendered cards behave identically to the rest of
 * the hivesuite Blog-style surfaces.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
// SnapsFeedView layout:
//   • mobile (< 768 px): single column with a pill switcher; the parent
//     scroll container owns scrolling.
//   • desktop (≥ 768 px): 4 columns side-by-side, each with its OWN
//     overflow-y-auto. Each column scrolls independently and the
//     SnapsFeedList sentinel auto-detects that per-column scroll
//     ancestor, so each feed paginates on its own until exhausted.
import type { Post } from '@/types/post';
import SnapsFeedList from './SnapsFeedList';
import { ArrowUp } from 'lucide-react';
import FeedSegmentControl from './FeedSegmentControl';
import type { RewardOption } from '../../utils/commentOptions';

export type SnapsFeedKey = 'snaps' | 'ecency' | 'threads' | 'liketu';

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

  /** Override per-feed display name (default labels: Snaps / Ecency / Threads / Liketu). */
  labels?: Partial<Record<SnapsFeedKey, string>>;
  /** Override per-feed avatar URL (defaults to canonical container account avatars). */
  avatars?: Partial<Record<SnapsFeedKey, string>>;

  /** Initial feed shown on mobile (the only visible column at < 768 px).
   *  Defaults to `snaps`. */
  defaultPrimary?: SnapsFeedKey;

  /** Logged-in observer username (drives auth-gated buttons inside post cards). */
  currentUser?: string;

  // ── BlogPostList action callbacks (forwarded per column) ──────────────
  onUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onSubmitComment?: (parentAuthor: string, parentPermlink: string, body: string) => void | Promise<void>;
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
  onClickCommentCount?: (author: string, permlink: string) => void;
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
  onPostClick?: (author: string, permlink: string, title?: string) => void;
  // URL builders — forwarded to every <SnapsFeedCard/> so its
  // clickable surfaces render as real <a href> links ("open in new
  // tab" etc.). See SnapsFeedCard for details.
  getPostUrl?: (author: string, permlink: string) => string;
  getUserUrl?: (username: string) => string;
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

  /** Optional top-row content rendered above the columns (e.g. a Compose FAB
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

  /** When `true`, the desktop 4-column layout grows naturally with its
   *  content instead of pinning each column to a fixed-height per-column
   *  scroller. Use this when the parent page already provides a single
   *  scroll surface (e.g. a wrapping `overflow-y-auto`) so users get one
   *  page-level scrollbar instead of four independent ones. Column
   *  headers stay visible via `sticky top-0`. Mobile is unaffected. */
  pageScroll?: boolean;
  onActiveFeedChange?: (feed: SnapsFeedKey) => void;
}

const DEFAULT_LABELS: Record<SnapsFeedKey, string> = {
  snaps: 'Snaps',
  ecency: 'Ecency',
  threads: 'Threads',
  liketu: 'Liketu',
};

const DEFAULT_AVATARS: Record<SnapsFeedKey, string> = {
  snaps: 'https://images.hive.blog/u/peak.snaps/avatar',
  ecency: 'https://images.hive.blog/u/ecency.waves/avatar',
  threads: 'https://images.hive.blog/u/leothreads/avatar',
  liketu: 'https://images.hive.blog/u/liketu.moments/avatar',
};


/**
 * Module-level scroll cache for the desktop per-column scroll
 * containers — survives mount/unmount so navigating into a post detail
 * and back lands every column at the exact scrollTop it was at before.
 *
 * Pagination state itself (loaded posts, nextStartId, hasMore) is owned
 * by the host (Zustand stores on the unified page; module cache in
 * ProfileSnapsTab), so this just lines the scroll position up on top
 * of that. Mobile uses one outer scroll container which the host owns,
 * so it's preserved by the host (e.g. SnapsUnifiedPage's savedScrollTop).
 */
const scrollCache: Record<string, number> = {
  snaps: 0,
  ecency: 0,
  threads: 0,
  liketu: 0,
};

/**
 * Module-level cache of the mobile pill-switcher selection. Without
 * this, every remount (e.g. coming back from a post detail) resets the
 * active feed to `defaultPrimary` — so a user on threads page 3 would
 * land back on snaps page 1 after closing a post. Persisting the key
 * makes them land on the same feed they left.
 */
let lastActiveFeed: string | null = null;

/** 1 col on mobile · 4 cols at tablet+ (≥ 768 px). Each desktop column
 *  manages its own scroll so users can drill into one feed without
 *  losing position in the others. */
function useFeedColumnCount(): 1 | 4 {
  const [cols, setCols] = useState<1 | 4>(() => {
    if (typeof window === 'undefined') return 1;
    return window.innerWidth >= 768 ? 4 : 1;
  });

  useEffect(() => {
    const update = () => setCols(window.innerWidth >= 768 ? 4 : 1);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return cols;
}

export function SnapsFeedView({
  feeds,
  labels,
  avatars,
  defaultPrimary = 'snaps',
  currentUser,
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
  getPostUrl,
  getUserUrl,
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
  pageScroll,
  onActiveFeedChange,
}: SnapsFeedViewProps) {
  const cols = useFeedColumnCount();
  const finalLabels = { ...DEFAULT_LABELS, ...labels };
  const finalAvatars = { ...DEFAULT_AVATARS, ...avatars };

  // Mobile only: pill switcher picks which of the four containers to
  // render. Ignored on desktop, which renders all four side-by-side.
  // Initialized from the module-level cache so the user lands back on
  // the same feed they were viewing before navigating to a post.
  const [activeFeed, setActiveFeed] = useState<SnapsFeedKey>(() => {
    const cached = lastActiveFeed;
    if (cached === 'snaps' || cached === 'ecency' || cached === 'threads' || cached === 'liketu') {
      return cached;
    }
    return defaultPrimary;
  });
  // Keep the module cache in sync on every change.
  useEffect(() => {
    lastActiveFeed = activeFeed;
    if (onActiveFeedChange) onActiveFeedChange(activeFeed);
  }, [activeFeed, onActiveFeedChange]);

  const [scrolledFeeds, setScrolledFeeds] = useState<Record<SnapsFeedKey, boolean>>({
    snaps: false,
    ecency: false,
    threads: false,
    liketu: false,
  });
  const [mobileScrolled, setMobileScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Monitor parent scrolling for mobile layout
  useEffect(() => {
    if (cols !== 1) return;
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
      setMobileScrolled(scrollTop > 150);
    };

    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      if (scrollParent) {
        scrollParent.removeEventListener('scroll', handleScroll);
      }
    };
  }, [cols]);

  // Per-column scroll containers. Restored from `scrollCache` on
  // mount; saved into `scrollCache` on unmount via the cleanup of a
  // single mount-lifetime effect (so we don't miss the unmount tick
  // when the user navigates away to a post detail). Also persists
  // continuously through a scroll listener so back/forward navigation
  // through multiple posts always restores from the most recent
  // observed position.
  const columnRefs = useRef<Partial<Record<SnapsFeedKey, HTMLDivElement | null>>>({});

  const setColumnRef = useCallback(
    (key: SnapsFeedKey) => (node: HTMLDivElement | null) => {
      const prev = columnRefs.current[key];
      if (prev && prev !== node) {
        // Stash the outgoing element's last position before we lose it.
        scrollCache[key] = prev.scrollTop;
      }
      columnRefs.current[key] = node;
      if (node && scrollCache[key] > 0) {
        // Defer one frame so the cached posts can lay out before we scroll.
        const target = scrollCache[key];
        requestAnimationFrame(() => {
          if (columnRefs.current[key] === node) node.scrollTop = target;
        });
      }
    },
    [],
  );

  // Persist on unmount (covers the navigate-to-post-detail case).
  useEffect(() => {
    return () => {
      for (const key of ['snaps', 'ecency', 'threads', 'liketu'] as SnapsFeedKey[]) {
        const el = columnRefs.current[key];
        if (el) scrollCache[key] = el.scrollTop;
      }
    };
  }, []);

  // Persist on every scroll so even pagecache / browser-native back
  // (which can fire teardown asynchronously) gets a fresh value.
  useEffect(() => {
    const handlers: { el: HTMLDivElement; fn: () => void; key: SnapsFeedKey }[] = [];
    for (const key of ['snaps', 'ecency', 'threads', 'liketu'] as SnapsFeedKey[]) {
      const el = columnRefs.current[key];
      if (!el) continue;
      const fn = () => {
        scrollCache[key] = el.scrollTop;
        const isScrolled = el.scrollTop > 150;
        setScrolledFeeds((prev) => {
          if (prev[key] === isScrolled) return prev;
          return { ...prev, [key]: isScrolled };
        });
      };
      el.addEventListener('scroll', fn, { passive: true });
      handlers.push({ el, fn, key });
      fn();
    }
    return () => { for (const h of handlers) h.el.removeEventListener('scroll', h.fn); };
  }, [cols]);

  const segOpt = (k: SnapsFeedKey) => ({
    id: k,
    label: finalLabels[k],
    avatarUrl: finalAvatars[k],
  });

  const sharedListProps = {
    currentUser,
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
    getPostUrl,
    getUserUrl,
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
  };

  const feedOptions: SnapsFeedKey[] = ['snaps', 'ecency', 'threads', 'liketu'];

  /** A single feed body (error banner + list). Used both for the
   *  mobile branch and inside each desktop column. */
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

  const desktopWrapperRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (cols === 1 || pageScroll) return;
    const el = desktopWrapperRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.hrk-feed-column-scroll')) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      const dy = e.deltaY;
      for (const key of feedOptions) {
        const col = columnRefs.current[key];
        if (col) col.scrollTop += dy;
      }
      e.preventDefault();
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [cols, pageScroll, feedOptions]);

  // ── Mobile: single column with pill switcher ─────────────────────────
  if (cols === 1) {
    const slot = feeds[activeFeed];
    const showPill = !!(slot && slot.newCount && slot.newCount > 0 && mobileScrolled);

    return (
      <div ref={containerRef} className="mx-auto flex max-w-[720px] flex-col gap-3">
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

  // ── Desktop: 4 columns ─────────────────────────────────────────────
  // Two layouts:
  //  • default — each column has its own `overflow-y-auto` (legacy,
  //    fixed-height per column).
  //  • `pageScroll` — columns flow naturally; the parent page provides
  //    a single scroll surface so users see one page-level scrollbar
  //    instead of four independent ones. Column headers stay visible
  //    via `sticky top-0`.
  // SnapsFeedList's IntersectionObserver auto-detects whichever scroll
  // ancestor it finds, so pagination works in both modes.
  if (pageScroll) {
    return (
      <div ref={containerRef} className="mx-auto flex max-w-[1600px] flex-col gap-3">
        {toolbar}
        <div className="grid grid-cols-4 gap-4">
          {feedOptions.map((k) => {
            const slot = feeds[k];
            const showPill = !!(slot && slot.newCount && slot.newCount > 0 && mobileScrolled);
            return (
              <div key={k} className="relative flex flex-col">
                <h2 className="sticky top-0 z-10 mb-3 flex shrink-0 items-center gap-2 bg-[var(--hrk-bg-app)]/95 py-1 text-sm font-semibold uppercase tracking-wide text-[var(--hrk-text-tertiary)] backdrop-blur">
                  <img
                    src={finalAvatars[k]}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover ring-1 ring-[var(--hrk-border-default)]"
                  />
                  {finalLabels[k]}
                </h2>
                {showPill && (
                  <div className="sticky top-12 left-0 right-0 z-30 h-0 overflow-visible flex justify-center pointer-events-none">
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
                {/* No per-column overflow — content grows naturally and the
                    page wrapper handles scrolling. The columnRef is still
                    attached so SnapsFeedList knows what to observe. */}
                <div ref={setColumnRef(k)} className="pr-1">
                  {renderBody(k)}
                </div>
              </div>
            );
          })}
        </div>
        {footer}
      </div>
    );
  }


  return (
    <div
      ref={(el) => {
        desktopWrapperRef.current = el;
        containerRef.current = el;
      }}
      className="mx-auto flex h-full min-h-0 max-w-[1600px] flex-col gap-3"
    >
      {toolbar}
      <div className="grid min-h-0 flex-1 grid-cols-4 gap-4">
        {feedOptions.map((k) => {
          const slot = feeds[k];
          const isColumnScrolled = scrolledFeeds[k];
          const showPill = !!(slot && slot.newCount && slot.newCount > 0 && isColumnScrolled);
          return (
            <div key={k} className="flex h-full min-h-0 flex-col">
              <h2 className="mb-3 flex shrink-0 items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--hrk-text-tertiary)]">
                <img
                  src={finalAvatars[k]}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover ring-1 ring-[var(--hrk-border-default)]"
                />
                {finalLabels[k]}
              </h2>
              <div
                ref={setColumnRef(k)}
                data-snaps-column-body
                className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 hrk-feed-column-scroll"
              >
                {showPill && (
                  <div className="sticky top-2 left-0 right-0 z-30 h-0 overflow-visible flex justify-center pointer-events-none">
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
                {renderBody(k)}
              </div>
            </div>
          );
        })}
      </div>
      {footer}
    </div>
  );
}

export default SnapsFeedView;
