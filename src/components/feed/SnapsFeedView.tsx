/**
 * SnapsFeedView — single-feed-at-a-time shell ported from the hSnaps
 * `UnifiedFeedPage`.
 *
 * At every viewport width (mobile, tablet, desktop) exactly ONE feed is
 * mounted at a time — either one of the 5 named feed types (Snaps /
 * Waves / Threads / Moments / Hangs) or, when the host opts into the
 * trending-tags feature, one trending tag. A single `SnapsFeedSelection`
 * value tracks which of those two mutually-exclusive things is active;
 * switching either unmounts whatever was previously showing (and its
 * in-memory post list) instead of just hiding it, so memory stays flat
 * regardless of how many feed types / tags exist. (Previously desktop
 * mounted every feed side-by-side simultaneously, which could use up to
 * ~2GB of memory — this component must never regress back to that.)
 *
 * Desktop chrome ("Where does the picker live?"): by default
 * (`desktopNav="topPills"`) this renders the original horizontal pill
 * switcher above the feed, unchanged — existing consumers (e.g.
 * `CommunitySnapsTab`) get zero visual change. Passing
 * `desktopNav="sidebar"` switches desktop (`md:` and up) to a left-rail
 * vertical nav for the 5 feed types, freeing the old empty right-hand
 * space for an optional trending-tags panel (opt in by passing
 * `trendingTags`). Mobile is unaffected by `desktopNav` — it always uses
 * the pill row, extended with a "Tags" entry point (see below) when
 * `trendingTags` is provided.
 *
 * Mobile tags UX: rather than cramming N extra tag pills into the
 * already-scrollable pill row, one more entry is appended — "Tags"
 * (or the active tag's own "#tag" chip, once one is selected) — which
 * opens a bottom sheet listing the same trending tags the desktop rail
 * shows. This keeps the row scannable at any tag-list length and mirrors
 * a pattern already used elsewhere in the app (filter dropdowns, more
 * menus) rather than inventing a new interaction.
 *
 * Data is supplied by the host app: each named feed slot receives
 * `posts`, loading/error/pagination flags, plus an optional
 * `onLoadMore` — and so does `tagFeed`, the slot for whichever tag is
 * currently selected. Per-post action callbacks (vote / comment /
 * reblog / share / tip / report) are forwarded to the embedded
 * <BlogPostList/> exactly the way <BlogsPage/> already does — so the
 * rendered cards behave identically to the rest of the hivesuite
 * Blog-style surfaces.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Post } from '@/types/post';
import SnapsFeedList from './SnapsFeedList';
import { ArrowUp, Hash } from 'lucide-react';
import FeedSegmentControl, { type FeedSegmentOption } from './FeedSegmentControl';
import SnapsFeedSidebarNav from './SnapsFeedSidebarNav';
import TrendingTagsPanel, { type SnapsTrendingTag } from './TrendingTagsPanel';
import TagsBottomSheet from './TagsBottomSheet';
import type { RewardOption } from '../../utils/commentOptions';

export type SnapsFeedKey = 'snaps' | 'ecency' | 'threads' | 'liketu' | 'slothbuzz';

export type { SnapsTrendingTag };

/**
 * The single thing currently on screen: either one of the 5 named feed
 * types, or a trending tag. A discriminated union (rather than two
 * independent booleans/flags) makes "exactly one of these is active"
 * structurally true instead of a rule callers have to maintain by hand.
 */
export type SnapsFeedSelection =
  | { kind: 'feed'; feed: SnapsFeedKey }
  | { kind: 'tag'; tag: string };

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

  /**
   * Where the desktop (`md:`+) feed picker lives.
   *   'topPills' (default) — the original horizontal pill switcher
   *     above the feed. Zero change for existing consumers that don't
   *     pass this prop.
   *   'sidebar' — a left-rail vertical nav for the 5 feed types,
   *     freeing the old empty right-hand space for an optional
   *     trending-tags panel (see `trendingTags`).
   * Mobile always uses the pill row regardless of this setting.
   */
  desktopNav?: 'topPills' | 'sidebar';

  /**
   * Trending tags to offer as an alternate way to pick the single
   * active feed (desktop right rail when `desktopNav="sidebar"`; a
   * "Tags" entry point + bottom sheet on mobile, at any `desktopNav`
   * setting). Omit entirely to hide the trending-tags feature — e.g.
   * a profile's Snaps tab opts out since network-wide trending tags
   * don't make contextual sense there; a standalone Snaps page passes
   * whatever `/custom-snaps` already fetches for its own trending-tags
   * feature.
   */
  trendingTags?: SnapsTrendingTag[];
  trendingTagsLoading?: boolean;
  /**
   * Data slot for whichever tag is currently selected
   * (`selection.kind === 'tag'`) — mirrors a `feeds[key]` slot. The host
   * is responsible for fetching this tag's posts, gated on it being the
   * active selection (same pattern as the 5 named feeds' `active` flag
   * upstream).
   */
  tagFeed?: SnapsFeedSlot;

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
  /**
   * Fires whenever the active selection changes — a named feed OR a
   * trending tag, whichever the viewer picked. Replaces the previous
   * feed-only `onActiveFeedChange`; check `selection.kind` to see which
   * branch fired.
   */
  onSelectionChange?: (selection: SnapsFeedSelection) => void;
  isWeb2User?: boolean;
  /**
   * When true, every card's iframe-based attachment previews (YouTube,
   * 3Speak, Twitter, 3Speak audio, Spotify, Odysee) render as a plain
   * link instead of mounting their embed. See
   * `AttachmentStripProps.disableIframePreviews` for the full rationale
   * — forwarded straight through to every <SnapsFeedCard/>.
   */
  disableIframePreviews?: boolean;
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

const FEED_KEYS: SnapsFeedKey[] = ['snaps', 'ecency', 'threads', 'liketu', 'slothbuzz'];

function isFeedKey(id: string): id is SnapsFeedKey {
  return (FEED_KEYS as string[]).includes(id);
}

/**
 * Module-level cache of the active selection. Without this, every
 * remount (e.g. coming back from a post detail) resets the active
 * selection to `defaultPrimary` — so a user on threads page 3, or
 * viewing a trending tag, would land back on snaps page 1 after closing
 * a post. Persisting it makes them land on the same thing they left, at
 * every viewport width.
 */
let lastSelection: SnapsFeedSelection | null = null;

const TAGS_PILL_ID = '__tags__';

export function SnapsFeedView({
  feeds,
  labels,
  avatars,
  defaultPrimary = 'snaps',
  desktopNav = 'topPills',
  trendingTags,
  trendingTagsLoading,
  tagFeed,
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
  onSelectionChange,
  isWeb2User,
  disableIframePreviews,
}: SnapsFeedViewProps) {
  const finalLabels = { ...DEFAULT_LABELS, ...labels };
  const finalAvatars = { ...DEFAULT_AVATARS, ...avatars };

  // Trending-tags feature is opt-in: only enabled when the host actually
  // passes a `trendingTags` array (even an empty one while it's still
  // loading). Omitting the prop entirely (e.g. ProfileSnapsTab) hides
  // every bit of tags UI — desktop right rail, mobile "Tags" entry
  // point, and the sheet.
  const tagsEnabled = Array.isArray(trendingTags);

  // The selection picks which single thing is mounted — a named feed or
  // a trending tag — at every viewport width. Only the active selection's
  // data is fetched/rendered/kept in memory; switching unmounts whatever
  // was previously showing instead of just hiding it. Initialized from
  // the module-level cache so the user lands back on the same thing they
  // were viewing before navigating to a post.
  const [selection, setSelection] = useState<SnapsFeedSelection>(() => {
    if (lastSelection) {
      if (lastSelection.kind === 'feed' && isFeedKey(lastSelection.feed)) return lastSelection;
      if (lastSelection.kind === 'tag' && tagsEnabled) return lastSelection;
    }
    return { kind: 'feed', feed: defaultPrimary };
  });
  // Keep the module cache in sync on every change.
  useEffect(() => {
    lastSelection = selection;
    if (onSelectionChange) onSelectionChange(selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const selectFeed = (feed: SnapsFeedKey) => setSelection({ kind: 'feed', feed });
  const selectTag = (tag: string) => setSelection({ kind: 'tag', tag });

  const [tagsSheetOpen, setTagsSheetOpen] = useState(false);

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

  const segOpt = (k: SnapsFeedKey): FeedSegmentOption => ({
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
    disableIframePreviews,
  };

  const feedOptions: SnapsFeedKey[] = FEED_KEYS;

  /** The active selection's body (error banner + list). This is the
   *  ONLY feed body ever rendered — switching `selection` unmounts this
   *  and mounts a fresh one for the newly-selected feed/tag, so nothing
   *  else is ever kept mounted/in memory at the same time. */
  const renderBody = () => {
    const slot = selection.kind === 'feed' ? feeds[selection.feed] : tagFeed;
    // Guard: if the host hasn't wired up this slot yet, show nothing.
    if (!slot) return null;
    const emptyLabel = selection.kind === 'feed'
      ? finalLabels[selection.feed].toLowerCase()
      : `#${selection.tag}`;
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
          emptyMessage={`No ${emptyLabel} posts yet.`}
        />
      </>
    );
  };

  const activeSlot = selection.kind === 'feed' ? feeds[selection.feed] : tagFeed;
  const showPill = !!(activeSlot && activeSlot.newCount && activeSlot.newCount > 0 && scrolled);
  const activeFeedForHighlight = selection.kind === 'feed' ? selection.feed : null;
  const activeTagForHighlight = selection.kind === 'tag' ? selection.tag : null;

  // Mobile pill row: the 5 named feeds, plus (when the host opted into
  // trending tags) one more entry — "Tags" normally, or the active
  // tag's own "#tag" chip once one is selected — that opens the bottom
  // sheet. Tapping any of the 5 feed pills leaves tag mode directly.
  const mobileOptions: FeedSegmentOption[] = [
    ...feedOptions.map(segOpt),
    ...(tagsEnabled
      ? [{
          id: TAGS_PILL_ID,
          // The pill's Hash icon already reads as "#", so avoid a
          // redundant "# #tag" — just show the tag name once selected.
          label: selection.kind === 'tag' ? selection.tag : 'Tags',
          icon: <Hash className="h-3.5 w-3.5" />,
        }]
      : []),
  ];
  const mobileValue = selection.kind === 'tag' ? TAGS_PILL_ID : selection.feed;

  const showSidebarLayout = desktopNav === 'sidebar';
  const showTagsRail = showSidebarLayout && tagsEnabled;

  return (
    <div
      ref={containerRef}
      className={
        showSidebarLayout
          ? `mx-auto flex w-full max-w-[1200px] items-start gap-4 md:grid ${
              showTagsRail ? 'md:grid-cols-[200px_minmax(0,1fr)_240px]' : 'md:grid-cols-[200px_minmax(0,1fr)]'
            }`
          : 'mx-auto flex w-full max-w-[720px] md:max-w-[880px] flex-col gap-3'
      }
    >
      {/* Desktop left rail — the 5 named feeds as a vertical nav. Only
          rendered when the host opts into `desktopNav="sidebar"`;
          existing consumers (e.g. CommunitySnapsTab) that don't pass it
          keep the original top-pill layout untouched. */}
      {showSidebarLayout && (
        <aside className="hidden md:block md:sticky md:top-0 md:max-h-screen md:overflow-y-auto">
          <SnapsFeedSidebarNav
            options={feedOptions.map(segOpt)}
            activeFeed={activeFeedForHighlight}
            onSelect={(id) => { if (isFeedKey(id)) selectFeed(id); }}
          />
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="sticky top-0 z-20 -mx-2 bg-[var(--hrk-bg-app)]/85 px-2 py-1.5 backdrop-blur flex items-center justify-between gap-2">
          {/* On the sidebar layout, the pill row is mobile-only (the
              left rail takes over on desktop). On the legacy top-pills
              layout it's shown at every width, unchanged. */}
          <div className={`overflow-x-auto min-w-0 flex-1 scrollbar-none ${showSidebarLayout ? 'md:hidden' : ''}`}>
            <FeedSegmentControl
              options={mobileOptions}
              value={mobileValue}
              onChange={(id) => {
                if (id === TAGS_PILL_ID) { setTagsSheetOpen(true); return; }
                if (isFeedKey(id)) selectFeed(id);
              }}
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
                onClick={activeSlot?.onShowNew}
                className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#1d9bf0] px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-[#1a8cd8] active:scale-95 cursor-pointer"
              >
                <ArrowUp className="h-3.5 w-3.5" />
                {activeSlot?.newAvatars && activeSlot.newAvatars.length > 0 && (
                  <div className="flex -space-x-1.5 overflow-hidden mr-1">
                    {activeSlot.newAvatars.slice(0, 3).map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt=""
                        className="inline-block h-5 w-5 rounded-full ring-2 ring-[#1d9bf0] object-cover"
                      />
                    ))}
                  </div>
                )}
                <span>{activeSlot?.newCount} posted</span>
              </button>
            </div>
          )}
          {renderBody()}
        </div>
        {footer}
      </div>

      {/* Desktop right rail — trending tags, filling the space that used
          to sit empty next to the feed. Only rendered on the sidebar
          layout, and only when the host opted into trending tags. */}
      {showTagsRail && (
        <aside className="hidden md:block md:sticky md:top-0 md:max-h-screen md:overflow-y-auto">
          <h3 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-[var(--hrk-text-tertiary)]">
            Trending Tags
          </h3>
          <TrendingTagsPanel
            tags={trendingTags ?? []}
            loading={trendingTagsLoading}
            activeTag={activeTagForHighlight}
            onSelectTag={selectTag}
          />
        </aside>
      )}

      {tagsEnabled && (
        <TagsBottomSheet
          isOpen={tagsSheetOpen}
          onClose={() => setTagsSheetOpen(false)}
          tags={trendingTags ?? []}
          loading={trendingTagsLoading}
          activeTag={activeTagForHighlight}
          onSelectTag={selectTag}
        />
      )}
    </div>
  );
}

export default SnapsFeedView;
