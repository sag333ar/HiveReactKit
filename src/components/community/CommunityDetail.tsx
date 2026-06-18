/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * CommunityDetail — UserDetailProfile-style layout for a Hive community.
 *
 * Header: avatar + title + about + member count + creation year + actions.
 * Tabs:   Posts · Snaps · About · Subscribers · Activities
 *   - Posts / Snaps render via <BlogPostList/> using
 *     `apiService.getRankedPosts(sort, communityId, observer)`.
 *   - About / Subscribers reuse the existing <CommunityAbout/> +
 *     <CommunityMembers/> kit components.
 *   - Activities streams from `communityService.getCommunityActivities`.
 *
 * Theme: hivesuite Hive-red on dark surface (#212529 / #262b30 / #2f353d
 *        / #3a424a / #e31337). Forced dark — no `dark:` variants.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Calendar,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  Rss,
  Bookmark,
  Share2,
  Users,
  Info,
  Activity,
  Bell,
  AtSign,
  MessageCircle,
  Heart,
  Repeat2,
  UserPlus,
  ChevronDown,
  Shield,
  Settings,
} from 'lucide-react'
import CommunityAbout from './CommunityAbout'
import CommunityMembers from './CommunityMembers'
import CommunitySnapsTab from './CommunitySnapsTab'
import { communityService } from '../../services/communityService'
import { apiService } from '../../services/apiService'
import { CommunityDetailsResponse } from '../../types/community'
import type { Post, PostSort } from '../../types/post'
import type { RewardOption } from '../../utils/commentOptions'
import BlogPostList from '../BlogPostList'

export interface CommunityDetailProps {
  /** Community id (e.g. `hive-167922`). */
  communityId: string
  /** Logged-in observer username — drives feed personalisation + auth-gated actions. */
  currentUser?: string
  /** Back-arrow handler. */
  onBack: () => void

  // Navigation
  onUserClick?: (username: string) => void
  onPostClick?: (author: string, permlink: string, title?: string) => void
  onCommentClick?: (author: string, permlink: string) => void
  // URL builders — forwarded into the embedded BlogPostList /
  // SnapsFeedView so post & author surfaces render as real <a href>
  // links ("open in new tab" etc.). Plain clicks still route through
  // the on*Click callbacks.
  getPostUrl?: (author: string, permlink: string) => string
  getUserUrl?: (username: string) => string
  getTagUrl?: (tag: string) => string
  getCommunityUrl?: (community: string) => string

  // Action callbacks (forwarded into BlogPostList → PostActionButton)
  onUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>
  onSubmitComment?: (parentAuthor: string, parentPermlink: string, body: string) => void | Promise<void>
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>
  onReblog?: (author: string, permlink: string) => void
  isPostReblogged?: (author: string, permlink: string) => boolean
  onCheckReblogged?: (author: string, permlink: string) => void
  onTip?: (author: string, permlink: string) => void
  onSharePost?: (author: string, permlink: string) => void
  onReportPost?: (author: string, permlink: string) => void
  /** Per-row bookmark toggle on every BlogPostList card. Consumer
   *  decides add vs remove based on `isPostBookmarked`. */
  onToggleBookmark?: (author: string, permlink: string) => void
  /** Read function — controls the filled vs outline bookmark icon
   *  per row in the embedded BlogPostList. */
  isPostBookmarked?: (author: string, permlink: string) => boolean
  /** Toggle the *community itself* (backend category `community`).
   *  Renders a Bookmark icon button next to the community header
   *  actions. Omit to hide the entry. */
  onToggleCommunityBookmark?: (communityId: string) => void
  /** Read flag — controls the filled vs outline state of the
   *  community-header bookmark button. */
  isCommunityBookmarked?: boolean
  /** Author-only — forwarded into the embedded <BlogPostList/> so the
   *  card kebab gets a red Delete entry when `currentUser === author`. */
  onDeletePost?: (author: string, permlink: string) => void

  /** Community admin/mod — surfaces Pin / Unpin entries on each post's
   *  kebab. The consumer gates `canPin` by role and broadcasts. */
  canPin?: boolean
  onPinPost?: (author: string, permlink: string) => void
  onUnpinPost?: (author: string, permlink: string) => void

  /** Broadcasts a poll vote — forwarded to the feed's <BlogPostList/> so
   *  poll posts can be voted on inline. */
  onVotePoll?: (
    author: string,
    permlink: string,
    choiceNums: number[],
  ) => void | boolean | Promise<void | boolean>

  // Composer tokens
  ecencyToken?: string
  threeSpeakApiKey?: string
  giphyApiKey?: string
  templateToken?: string
  templateApiBaseUrl?: string

  // Vote settings
  defaultVotePercent?: number
  voteWeightStep?: number
  allowLandscapeVideos?: boolean
  /** Forwarded to the embedded <BlogPostList/> — when true, each
   *  card's vote slider surfaces a blinking "Open Keychain App &
   *  Approve" hint while a broadcast is in flight. */
  awaitingWalletApproval?: boolean
  defaultReward?: RewardOption

  /** Collapse the per-post secondary actions (reblog · share · tip ·
   *  flag) into a single 3-dot kebab menu inside the embedded
   *  `<BlogPostList/>`. */
  actionsAsMenu?: boolean

  /** @deprecated The Snaps tab now uses the kit's built-in
   *  CommunitySnapsTab (multi-container SnapsFeedView). This prop is
   *  retained for backward compatibility but no longer consumed. */
  loadCommunitySnaps?: (
    communityId: string,
    cursor?: { author: string; permlink: string },
  ) => Promise<import('@/types/post').Post[]>

  /** Authors the user has reported / muted — forwarded into the snaps
   *  tab so their snaps drop out of the per-card list. */
  reportedAuthors?: string[]
  /** Reported posts (author + permlink pairs) — same purpose. */
  reportedPosts?: { author: string; permlink: string }[]

  // Header actions
  onShare?: () => void
  onRss?: () => void

  /** Whether the current viewer is subscribed to this community.
   *  When omitted (undefined) the kit queries
   *  `bridge.list_all_subscriptions` for `currentUser` itself; pass an
   *  explicit boolean to override (e.g. to share status with the host
   *  app). */
  isSubscribed?: boolean
  /** Fired when the user taps the Subscribe / Unsubscribe button.
   *  Receives the next intended state (true = subscribe). Implement on
   *  the host to broadcast the `community` custom_json operation, then
   *  reflect the new state via `isSubscribed`. */
  onToggleSubscribe?: (next: boolean) => void | Promise<void>
  /** Show a spinner on the button — set this true while a broadcast is
   *  in flight on the host. */
  subscribePending?: boolean

  /** When true (current user is owner/admin), the header swaps the
   *  Subscribe button for an "Actions" dropdown (Unsubscribe + Roles &
   *  Titles). The host gates this by role. */
  canManage?: boolean
  /** Opens the host's Roles & Titles management UI. */
  onManageRoles?: () => void
  /** Opens the host's Community Settings UI. */
  onOpenSettings?: () => void

  /** Controlled top-level tab. Pass alongside `onActiveTabChange` to
   *  drive the tab from the URL or any other external store. When
   *  omitted, the component manages tab state internally (default
   *  `'posts'`). */
  activeTab?: 'posts' | 'snaps' | 'about' | 'subscribers' | 'activities'
  onActiveTabChange?: (
    next: 'posts' | 'snaps' | 'about' | 'subscribers' | 'activities',
  ) => void

  /** Controlled posts-sort (trending / hot / created). Same controlled
   *  pattern as `activeTab`. */
  postSort?: PostSort
  onPostSortChange?: (next: PostSort) => void

  /** When `true`, the component restores the last cached scroll
   *  position for `(communityId, activeTab, postSort)` on mount —
   *  used by the consumer for Back-navigation, where we want the
   *  user to land back on the same card. When `false` (or omitted),
   *  the view starts at the top, matching forward navigation. */
  shouldRestoreScroll?: boolean
}

interface ActivityItem {
  id: number
  type: string
  date: string
  msg: string
  url: string
}

const TABS = [
  { id: 'posts', label: 'Posts', icon: FileText },
  { id: 'snaps', label: 'Snaps', icon: Layers },
  { id: 'about', label: 'About', icon: Info },
  { id: 'subscribers', label: 'Subscribers', icon: Users },
  { id: 'activities', label: 'Activities', icon: Activity },
] as const
type TabId = (typeof TABS)[number]['id']

const POST_SORT_TABS: { id: PostSort; label: string }[] = [
  { id: 'created', label: 'New' },
  { id: 'hot', label: 'Hot' },
  { id: 'trending', label: 'Trending' },
]

const ACTIVITY_TYPE_META: Record<string, { icon: typeof Bell; tone: string }> = {
  vote: { icon: Heart, tone: 'text-pink-400' },
  mention: { icon: AtSign, tone: 'text-[var(--hrk-brand)]' },
  reply: { icon: MessageCircle, tone: 'text-blue-400' },
  reply_comment: { icon: MessageCircle, tone: 'text-blue-400' },
  reblog: { icon: Repeat2, tone: 'text-green-400' },
  follow: { icon: UserPlus, tone: 'text-amber-400' },
  subscribe: { icon: Users, tone: 'text-amber-400' },
}

function formatTimeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(dateString).toLocaleDateString()
}

// Per-community in-memory cache so Back-navigation from a post detail
// or user profile lands the user on the same tab/sort with the same
// posts already rendered and the scroll position restored. Keyed by
// `${communityId}|${tab}|${sort}` so each tab+sort combination gets
// its own slot; the consumer passes `shouldRestoreScroll` to opt into
// the scroll restore (forward navigation skips it and lands at the
// top of the view).
interface CommunityFeedCacheEntry {
  posts: Post[]
  hasMore: boolean
  scrollTop: number
}
const communityFeedCache: Map<string, CommunityFeedCacheEntry> = new Map()

const CommunityDetail = ({
  communityId,
  currentUser,
  onBack,
  onUserClick,
  onPostClick,
  getPostUrl,
  getUserUrl,
  getTagUrl,
  getCommunityUrl,
  onCommentClick,
  onUpvote,
  onSubmitComment,
  onClickCommentUpvote,
  onReblog,
  isPostReblogged,
  onCheckReblogged,
  onTip,
  onSharePost,
  onReportPost,
  onToggleBookmark,
  isPostBookmarked,
  onToggleCommunityBookmark,
  isCommunityBookmarked = false,
  onDeletePost,
  canPin,
  onPinPost,
  onUnpinPost,
  onVotePoll,
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
  onShare,
  onRss,
  isSubscribed: controlledIsSubscribed,
  onToggleSubscribe,
  subscribePending = false,
  canManage = false,
  onManageRoles,
  onOpenSettings,
  loadCommunitySnaps: _loadCommunitySnaps,
  reportedAuthors = [],
  reportedPosts = [],
  activeTab: controlledActiveTab,
  onActiveTabChange,
  postSort: controlledPostSort,
  onPostSortChange,
  shouldRestoreScroll = false,
}: CommunityDetailProps) => {
  // Controlled-or-uncontrolled tab + sort. When the consumer passes
  // `activeTab` / `postSort`, those drive the UI (and we still fire
  // the change callbacks so the parent can mirror them to URL state).
  // Without the prop, we fall back to the internal `useState`.
  const [internalActiveTab, setInternalActiveTab] = useState<TabId>('posts')
  const activeTab = controlledActiveTab ?? internalActiveTab
  const setActiveTab = useCallback(
    (next: TabId) => {
      if (controlledActiveTab === undefined) setInternalActiveTab(next)
      onActiveTabChange?.(next)
    },
    [controlledActiveTab, onActiveTabChange],
  )

  const [internalPostSort, setInternalPostSort] = useState<PostSort>('created')
  const postSort = controlledPostSort ?? internalPostSort
  const setPostSort = useCallback(
    (next: PostSort) => {
      if (controlledPostSort === undefined) setInternalPostSort(next)
      onPostSortChange?.(next)
    },
    [controlledPostSort, onPostSortChange],
  )

  // Hydrate posts + hasMore from the cache so we don't briefly render
  // an empty list before the fetch effect repopulates it.
  const initialCacheKey = `${communityId}|${activeTab}|${postSort}`
  const initialEntry = communityFeedCache.get(initialCacheKey)

  const [communityDetails, setCommunityDetails] = useState<CommunityDetailsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Internal subscription state. Resolved from
  // bridge.list_all_subscriptions when the consumer doesn't pass an
  // explicit `isSubscribed`. While the lookup is in flight (or no
  // user is logged in) we leave the value undefined so the button
  // disables instead of flashing a wrong label.
  const [internalIsSubscribed, setInternalIsSubscribed] = useState<boolean | undefined>(undefined)
  const isSubscribed = controlledIsSubscribed ?? internalIsSubscribed

  useEffect(() => {
    if (controlledIsSubscribed !== undefined) return
    if (!currentUser || !communityId) {
      setInternalIsSubscribed(undefined)
      return
    }
    let cancelled = false
    void communityService
      .isUserSubscribedToCommunity(currentUser, communityId)
      .then((subscribed) => {
        if (!cancelled) setInternalIsSubscribed(subscribed)
      })
      .catch(() => {
        if (!cancelled) setInternalIsSubscribed(false)
      })
    return () => { cancelled = true }
  }, [controlledIsSubscribed, currentUser, communityId])

  const handleToggleSubscribe = useCallback(async () => {
    if (!currentUser || subscribePending || isSubscribed === undefined) return
    const next = !isSubscribed
    try {
      await onToggleSubscribe?.(next)
      // Only update internal state if consumer isn't driving it.
      if (controlledIsSubscribed === undefined) setInternalIsSubscribed(next)
    } catch {
      // Host already surfaces a toast — leave the prior state alone.
    }
  }, [currentUser, subscribePending, isSubscribed, onToggleSubscribe, controlledIsSubscribed])

  const [actionsOpen, setActionsOpen] = useState(false)
  const actionsRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!actionsOpen) return
    const onDown = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [actionsOpen])

  const [posts, setPosts] = useState<Post[]>(() => initialEntry?.posts ?? [])
  const [postsLoading, setPostsLoading] = useState(false)
  const [postsLoadingMore, setPostsLoadingMore] = useState(false)
  const [postsHasMore, setPostsHasMore] = useState<boolean>(() => initialEntry?.hasMore ?? true)
  const [postsError, setPostsError] = useState<string | null>(null)

  // Activities state
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [activitiesError, setActivitiesError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchCommunityDetails = async () => {
      try {
        setLoading(true)
        const details = await communityService.getCommunityDetails(communityId)
        if (!cancelled) setCommunityDetails(details)
      } catch (e) {
        console.error('Failed to fetch community details:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchCommunityDetails()
    return () => { cancelled = true }
  }, [communityId])


  // Posts/Snaps loader. `tab` toggles which sort to use:
  //   posts → respects the user-picked sort tab.
  //   snaps → forced to `created` (most recent short-form items).
  const loadPosts = useCallback(
    async (tab: 'posts' | 'snaps', append: boolean) => {
      if (append) setPostsLoadingMore(true)
      else setPostsLoading(true)
      setPostsError(null)
      try {
        const sort: PostSort = tab === 'snaps' ? 'created' : postSort
        const last = append && posts.length > 0 ? posts[posts.length - 1] : null
        const data = await apiService.getRankedPosts(
          sort,
          communityId,
          currentUser || 'hive.blog',
          20,
          last?.author,
          last?.permlink,
        )
        const next = append && data.length > 0 && last
          ? data.filter((p) => !(p.author === last.author && p.permlink === last.permlink))
          : data
        // First page: hoist pinned posts to the top (admins pin them, and
        // not every sort/node returns them first). Stable sort keeps the
        // rest in their original order. Later pages stay untouched.
        const ordered = append
          ? next
          : [...next].sort(
              (a, b) =>
                (b.stats?.is_pinned ? 1 : 0) - (a.stats?.is_pinned ? 1 : 0),
            )
        setPosts((prev) => (append ? [...prev, ...next] : ordered))
        setPostsHasMore(data.length >= 20)
      } catch (e) {
        setPostsError(e instanceof Error ? e.message : 'Failed to load')
        if (!append) setPostsHasMore(false)
      } finally {
        setPostsLoading(false)
        setPostsLoadingMore(false)
      }
    },
    [postSort, posts, communityId, currentUser],
  )

  const loadActivities = useCallback(async () => {
    setActivitiesLoading(true)
    setActivitiesError(null)
    try {
      const data = await communityService.getCommunityActivities(communityId, 100)
      setActivities(
        (data || []).map((a: any) => ({
          id: a.id,
          type: a.type,
          date: a.date,
          msg: a.msg,
          url: a.url,
        })),
      )
    } catch (e) {
      setActivitiesError(e instanceof Error ? e.message : 'Failed to load activities')
    } finally {
      setActivitiesLoading(false)
    }
  }, [communityId])

  // Reset post list when active feed-tab or sort changes. The snaps
  // tab no longer flows through `loadPosts` — <CommunitySnapsTab/> owns
  // its own data plane (4-container parallel fetch + filter) so we only
  // hit ranked-posts for the Posts tab here.
  //
  // When the (communityId, tab, sort) combination already has a cached
  // post list (because the user navigated into a post detail / user
  // profile and came back), hydrate from the cache instead of
  // refetching. Otherwise fall through to a fresh load.
  useEffect(() => {
    if (activeTab !== 'posts') return
    const cacheKey = `${communityId}|${activeTab}|${postSort}`
    const entry = communityFeedCache.get(cacheKey)
    if (entry && entry.posts.length > 0) {
      setPosts(entry.posts)
      setPostsHasMore(entry.hasMore)
      return
    }
    setPosts([])
    setPostsHasMore(true)
    void loadPosts('posts', false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, postSort, communityId])

  // Keep the cache snapshot in sync with the live state, so the next
  // mount of this community (after a Back-navigation) sees the latest
  // posts + hasMore.
  useEffect(() => {
    if (activeTab !== 'posts') return
    const cacheKey = `${communityId}|${activeTab}|${postSort}`
    const prev = communityFeedCache.get(cacheKey)
    communityFeedCache.set(cacheKey, {
      posts,
      hasMore: postsHasMore,
      scrollTop: prev?.scrollTop ?? 0,
    })
  }, [activeTab, postSort, communityId, posts, postsHasMore])

  useEffect(() => {
    if (activeTab === 'activities') void loadActivities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, communityId])

  const handleShare = () => {
    const url = `https://peakd.com/c/${communityId}`
    if (navigator.share) {
      navigator.share({ title: communityDetails?.result?.title || communityId, url })
    } else {
      void navigator.clipboard.writeText(url)
    }
  }
  const handleMemberClick = (username: string) => {
    onUserClick?.(username)
  }

  const community = communityDetails?.result
  const blogPostListProps = useMemo(
    () => ({
      currentUser: currentUser || undefined,
      onUpvote,
      onSubmitComment,
      onClickCommentUpvote,
      onReblog,
      isPostReblogged,
      onCheckReblogged,
      onTip,
      onSharePost,
      onReportPost,
      onToggleBookmark,
      isPostBookmarked,
      onDeletePost,
      canPin,
      onPinPost,
      onUnpinPost,
      onVotePoll,
      onUserClick,
      onPostClick,
      getPostUrl,
      getUserUrl,
      getCommunityUrl,
      onCommentClick,
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
    }),
    [
      currentUser,
      onUpvote,
      onSubmitComment,
      onClickCommentUpvote,
      onReblog,
      isPostReblogged,
      onCheckReblogged,
      onTip,
      onSharePost,
      onReportPost,
      onToggleBookmark,
      isPostBookmarked,
      onDeletePost,
      canPin,
      onPinPost,
      onUnpinPost,
      onVotePoll,
      onUserClick,
      onPostClick,
      getPostUrl,
      getUserUrl,
      getCommunityUrl,
      onCommentClick,
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
    ],
  )

  // Single shared scroll container — header scrolls away, tab strip
  // pins to the top. Scroll policy:
  //
  //   • Mount with `shouldRestoreScroll === true` AND the
  //     (communityId, tab, sort) hasn't been touched mid-session
  //     by the user — restore the cached scrollTop once posts have
  //     rendered. rAF retry loop handles late-laid-out cards
  //     (avatars / images / embeds resolve over a handful of frames
  //     after the initial paint, so setting scrollTop too early
  //     gets clamped by the still-short scroll range).
  //   • Anything else (forward nav, user-driven tab/sort change,
  //     consumer-driven route param change) — snap to top.
  //
  // We compare the *previous* tab/sort/communityId against the
  // current ones to tell apart "first effect run for this mount"
  // (refs were initialized to current values, so prev === current)
  // from "user just switched tabs" (prev !== current). The refs
  // approach is StrictMode-safe — both dev double-invokes see the
  // same prev===current relationship on first mount, so the restore
  // path doesn't get clobbered to zero on the second invoke.
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const prevTabRef = useRef(activeTab)
  const prevSortRef = useRef(postSort)
  const prevCommunityIdRef = useRef(communityId)

  // Track scrollTop so the cache stays current — used for Back-nav
  // restore on the next mount.
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    let scheduled = false
    const onScroll = () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(() => {
        scheduled = false
        const cacheKey = `${communityId}|${activeTab}|${postSort}`
        const entry = communityFeedCache.get(cacheKey)
        if (entry) entry.scrollTop = node.scrollTop
      })
    }
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => { node.removeEventListener('scroll', onScroll) }
  }, [activeTab, postSort, communityId])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return

    const cacheKey = `${communityId}|${activeTab}|${postSort}`
    const isInternalChange =
      prevTabRef.current !== activeTab ||
      prevSortRef.current !== postSort ||
      prevCommunityIdRef.current !== communityId
    prevTabRef.current = activeTab
    prevSortRef.current = postSort
    prevCommunityIdRef.current = communityId

    const target =
      shouldRestoreScroll && !isInternalChange
        ? communityFeedCache.get(cacheKey)?.scrollTop ?? 0
        : 0

    if (target === 0) {
      node.scrollTop = 0
      return
    }

    let cancelled = false
    let attempts = 0
    const MAX_ATTEMPTS = 120 // ~2 s @60Hz — covers slower image/embed loads.
    const tryRestore = () => {
      if (cancelled) return
      const el = scrollRef.current
      if (!el) return
      el.scrollTop = target
      const maxScroll = el.scrollHeight - el.clientHeight
      if (maxScroll >= target || attempts >= MAX_ATTEMPTS) return
      attempts += 1
      requestAnimationFrame(tryRestore)
    }
    requestAnimationFrame(tryRestore)
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, postSort, communityId, posts.length === 0 ? 0 : 1])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--hrk-bg-app)] text-[var(--hrk-text-primary)]">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {/* Community header — compact on mobile, larger on desktop.
            Lives inside the scroller so it scrolls away as the user
            moves down through the feed. */}
        {loading ? (
          <div className="m-3 rounded-xl border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] p-3 animate-pulse sm:m-0 sm:p-5">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-12 w-12 rounded-full bg-[var(--hrk-bg-hover)] sm:h-16 sm:w-16" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-[var(--hrk-border-default)] sm:h-5" />
                <div className="h-2.5 w-2/3 rounded bg-[var(--hrk-bg-hover)] sm:h-3" />
              </div>
            </div>
          </div>
        ) : (
          <div className="m-3 rounded-xl border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] p-3 sm:m-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-5">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
              <img
                src={communityService.userOwnerThumb(communityId)}
                alt={community?.title || communityId}
                className="h-12 w-12 flex-shrink-0 rounded-full bg-[var(--hrk-bg-hover)] object-cover sm:h-16 sm:w-16"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://images.hive.blog/u/${community?.title || communityId}/avatar`
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <h1 className="min-w-0 flex-1 truncate text-base font-bold text-[var(--hrk-text-primary)] sm:text-xl">
                    {community?.title || communityId}
                  </h1>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {currentUser && canManage ? (
                      /* Owner / admin — an Actions menu replaces the plain
                         Subscribe button (themed, not a PeakD copy). */
                      <div className="relative" ref={actionsRef}>
                        <button
                          type="button"
                          onClick={() => setActionsOpen((o) => !o)}
                          aria-haspopup="menu"
                          aria-expanded={actionsOpen}
                          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--hrk-border-default)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--hrk-text-primary)] transition-colors hover:bg-[var(--hrk-bg-hover)] sm:px-3 sm:py-1.5 sm:text-xs"
                        >
                          <Shield className="h-3.5 w-3.5" />
                          <span>Actions</span>
                          <ChevronDown className={`h-3 w-3 transition-transform ${actionsOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {actionsOpen && (
                          <div
                            role="menu"
                            className="absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-lg border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] py-1 shadow-xl"
                          >
                            {onManageRoles && (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => { setActionsOpen(false); onManageRoles() }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--hrk-text-primary)] transition-colors hover:bg-[var(--hrk-bg-hover)]"
                              >
                                <Shield className="h-3.5 w-3.5 text-[var(--hrk-brand)]" />
                                <span>Roles &amp; Titles</span>
                              </button>
                            )}
                            {onOpenSettings && (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => { setActionsOpen(false); onOpenSettings() }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--hrk-text-primary)] transition-colors hover:bg-[var(--hrk-bg-hover)]"
                              >
                                <Settings className="h-3.5 w-3.5 text-[var(--hrk-brand)]" />
                                <span>Settings</span>
                              </button>
                            )}
                            {onToggleSubscribe && (
                              <button
                                type="button"
                                role="menuitem"
                                disabled={subscribePending || isSubscribed === undefined}
                                onClick={() => { setActionsOpen(false); void handleToggleSubscribe() }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--hrk-text-primary)] transition-colors hover:bg-[var(--hrk-bg-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {subscribePending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Users className="h-3.5 w-3.5" />
                                )}
                                <span>{isSubscribed ? 'Unsubscribe' : 'Subscribe'}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : currentUser && onToggleSubscribe ? (
                      <button
                        type="button"
                        onClick={() => void handleToggleSubscribe()}
                        disabled={subscribePending || isSubscribed === undefined}
                        title={isSubscribed ? 'Unsubscribe from community' : 'Subscribe to community'}
                        aria-label={isSubscribed ? 'Unsubscribe' : 'Subscribe'}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors sm:px-3 sm:py-1.5 sm:text-xs ${
                          isSubscribed
                            ? 'border border-[var(--hrk-border-default)] text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-hover)]'
                            : 'bg-[var(--hrk-brand)] text-white hover:opacity-90'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {subscribePending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isSubscribed ? (
                          <Users className="h-3.5 w-3.5" />
                        ) : (
                          <UserPlus className="h-3.5 w-3.5" />
                        )}
                        <span>{isSubscribed ? 'Unsubscribe' : 'Subscribe'}</span>
                      </button>
                    ) : null}
                    {onToggleCommunityBookmark && (
                      <button
                        onClick={() => onToggleCommunityBookmark(communityId)}
                        title={isCommunityBookmarked ? 'Remove community bookmark' : 'Bookmark community'}
                        aria-label={isCommunityBookmarked ? 'Remove community bookmark' : 'Bookmark community'}
                        aria-pressed={isCommunityBookmarked}
                        className="rounded-md border border-[var(--hrk-border-default)] p-1.5 text-[var(--hrk-text-tertiary)] transition-colors hover:bg-[var(--hrk-bg-hover)] hover:text-[var(--hrk-text-primary)] sm:p-2"
                      >
                        <Bookmark
                          className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
                            isCommunityBookmarked ? 'fill-current text-[var(--hrk-brand)]' : ''
                          }`}
                        />
                      </button>
                    )}
                    <button
                      onClick={onShare || handleShare}
                      title="Share"
                      aria-label="Share"
                      className="rounded-md border border-[var(--hrk-border-default)] p-1.5 text-[var(--hrk-text-tertiary)] transition-colors hover:bg-[var(--hrk-bg-hover)] hover:text-[var(--hrk-text-primary)] sm:p-2"
                    >
                      <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                </div>
                {community?.about && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--hrk-text-tertiary)] sm:mt-1 sm:line-clamp-none sm:text-sm">
                    {community.about}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--hrk-text-tertiary)] sm:mt-3 sm:gap-x-4 sm:text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    {(community?.subscribers || 0).toLocaleString()} members
                  </span>
                  {community?.created_at && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      Created {new Date(community.created_at).getFullYear()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sticky tab strip — pinned to the top of the scroll container
            with a blurred background, so the user can always see the
            active tab while moving through the feed below. */}
        <div className="sticky top-0 z-10 border-b border-[var(--hrk-border-default)]/60 bg-[var(--hrk-bg-app)]/95 px-3 py-2 backdrop-blur sm:px-0 sm:py-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto md:overflow-visible">
            {TABS.map((t) => {
              const Icon = t.icon
              const active = activeTab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs transition ${
                    active
                      ? 'bg-[var(--hrk-brand)] text-white'
                      : 'border border-[var(--hrk-border-default)] text-[var(--hrk-text-secondary)] hover:bg-[var(--hrk-bg-hover)]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab body — flows in the same scroll container as everything
            above, so the header scrolls away while the tab strip
            stays pinned. */}
        <div className="px-3 py-3 sm:px-0 sm:py-4">
        {postsError && (activeTab === 'posts' || activeTab === 'snaps') && (
          <div className="mb-3 rounded-md border border-[var(--hrk-brand)] bg-red-900/20 p-2 text-xs font-medium text-red-400">
            {postsError}
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              {POST_SORT_TABS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setPostSort(s.id)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition ${
                    postSort === s.id
                      ? 'bg-[var(--hrk-brand)] text-white'
                      : 'border border-[var(--hrk-border-default)] text-[var(--hrk-text-secondary)] hover:bg-[var(--hrk-bg-hover)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { void loadPosts('posts', false) }}
                title="Refresh"
                aria-label="Refresh"
                disabled={postsLoading}
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-[var(--hrk-border-default)] px-2 py-1 text-xs text-[var(--hrk-text-secondary)] hover:bg-[var(--hrk-bg-hover)] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${postsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <BlogPostList
              {...blogPostListProps}
              posts={posts}
              loading={postsLoading}
              loadingMore={postsLoadingMore}
              hasMore={postsHasMore}
              onLoadMore={() => { void loadPosts('posts', true) }}
              emptyMessage={`No posts in @${communityId} yet.`}
            />
          </div>
        )}

        {activeTab === 'snaps' && (
          // Mirrors UserDetailProfile's snaps tab — 1-col-mobile /
          // 4-col-desktop SnapsFeedView, one slot per snap container
          // (peak.snaps · ecency.waves · leothreads · liketu.moments)
          // filtered to this community.
          <CommunitySnapsTab
            communityId={communityId}
            currentUser={currentUser}
            reportedPosts={reportedPosts}
            reportedAuthors={reportedAuthors}
            onUpvote={onUpvote}
            onSubmitComment={onSubmitComment}
            onClickCommentUpvote={onClickCommentUpvote}
            onReblog={onReblog}
            isPostReblogged={isPostReblogged}
            onCheckReblogged={onCheckReblogged}
            onTip={onTip}
            onSharePost={onSharePost}
            onCommentClick={onCommentClick}
            onReportPost={onReportPost}
            onUserClick={onUserClick}
            onPostClick={onPostClick}
            getPostUrl={getPostUrl}
            getUserUrl={getUserUrl}
            getTagUrl={getTagUrl}
            getCommunityUrl={getCommunityUrl}
            ecencyToken={ecencyToken}
            threeSpeakApiKey={threeSpeakApiKey}
            giphyApiKey={giphyApiKey}
            templateToken={templateToken}
            templateApiBaseUrl={templateApiBaseUrl}
            defaultVotePercent={defaultVotePercent}
            voteWeightStep={voteWeightStep}
            allowLandscapeVideos={allowLandscapeVideos}
            awaitingWalletApproval={awaitingWalletApproval}
            defaultReward={defaultReward}
            actionsAsMenu={actionsAsMenu}
            pageScroll={true}
          />
        )}

        {activeTab === 'about' && <CommunityAbout communityId={communityId} />}

        {activeTab === 'subscribers' && (
          <CommunityMembers
            communityId={communityId}
            onSelectCommunityMember={handleMemberClick}
          />
        )}

        {activeTab === 'activities' && (
          <ActivitiesList
            items={activities}
            loading={activitiesLoading}
            error={activitiesError}
            onRetry={() => { void loadActivities() }}
            onUserClick={onUserClick}
            onPostClick={onPostClick}
          />
        )}
      </div>
      </div>
    </div>
  )
}

// ─── Activities list (inline) ─────────────────────────────────────────────

interface ActivitiesListProps {
  items: ActivityItem[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onUserClick?: (username: string) => void
  onPostClick?: (author: string, permlink: string) => void
}

const ActivitiesList = ({
  items,
  loading,
  error,
  onRetry,
  onUserClick,
  onPostClick,
}: ActivitiesListProps) => {
  if (loading && items.length === 0) {
    return (
      <ul className="divide-y divide-[var(--hrk-border-default)]">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="flex items-start gap-3 px-3 py-2.5 animate-pulse">
            <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--hrk-bg-hover)]" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-[var(--hrk-border-default)]" />
                <div className="h-3 w-16 rounded bg-[var(--hrk-border-default)]" />
                <div className="h-2 w-12 rounded bg-[var(--hrk-bg-hover)]" />
              </div>
              <div className="h-3 w-11/12 rounded bg-[var(--hrk-border-default)]" />
              <div className="h-3 w-3/5 rounded bg-[var(--hrk-bg-hover)]" />
            </div>
          </li>
        ))}
      </ul>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <p className="mb-3 text-sm text-red-400">{error}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--hrk-border-default)] px-3 py-1.5 text-xs text-[var(--hrk-text-secondary)] hover:bg-[var(--hrk-bg-hover)]"
        >
          <Loader2 className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Activity className="h-10 w-10 text-[var(--hrk-border-default)] mb-3" />
        <p className="text-sm text-[var(--hrk-text-tertiary)]">No recent activities.</p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-[var(--hrk-border-default)]">
      {items.map((n) => {
        const meta = ACTIVITY_TYPE_META[n.type] ?? { icon: Bell, tone: 'text-[var(--hrk-text-tertiary)]' }
        const Icon = meta.icon
        const author = n.url.replace(/^@/, '').split('/')[0] || 'hive'
        const handleClick = () => {
          const url = n.url.replace(/^@/, '')
          if (url.includes('/')) {
            const [a, p] = url.split('/')
            onPostClick?.(a, p.split('#')[0])
          } else {
            onUserClick?.(url)
          }
        }
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={handleClick}
              className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--hrk-bg-surface)]"
            >
              <img
                src={`https://images.hive.blog/u/${author}/avatar`}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full bg-[var(--hrk-bg-hover)] object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs">
                  <Icon className={`h-3.5 w-3.5 ${meta.tone}`} />
                  <span className="font-medium text-[var(--hrk-text-secondary)] capitalize">
                    {n.type.replace('_', ' ')}
                  </span>
                  <span className="text-[var(--hrk-text-tertiary)]">·</span>
                  <span className="text-[var(--hrk-text-tertiary)]">{formatTimeAgo(`${n.date}Z`)}</span>
                </div>
                <p className="mt-0.5 text-sm text-[var(--hrk-text-primary)] line-clamp-2">{n.msg}</p>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export default CommunityDetail
