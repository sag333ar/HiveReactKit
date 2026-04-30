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
} from 'lucide-react'
import CommunityAbout from './CommunityAbout'
import CommunityMembers from './CommunityMembers'
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

  // Action callbacks (forwarded into BlogPostList → PostActionButton)
  onUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>
  onSubmitComment?: (parentAuthor: string, parentPermlink: string, body: string) => void | Promise<void>
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>
  onReblog?: (author: string, permlink: string) => void
  onTip?: (author: string, permlink: string) => void
  onSharePost?: (author: string, permlink: string) => void
  onReportPost?: (author: string, permlink: string) => void

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
  defaultReward?: RewardOption

  // Header actions
  onShare?: () => void
  onRss?: () => void
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
  { id: 'trending', label: 'Trending' },
  { id: 'hot', label: 'Hot' },
  { id: 'created', label: 'New' },
]

const ACTIVITY_TYPE_META: Record<string, { icon: typeof Bell; tone: string }> = {
  vote: { icon: Heart, tone: 'text-pink-400' },
  mention: { icon: AtSign, tone: 'text-[#e31337]' },
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

const CommunityDetail = ({
  communityId,
  currentUser,
  onBack,
  onUserClick,
  onPostClick,
  onCommentClick,
  onUpvote,
  onSubmitComment,
  onClickCommentUpvote,
  onReblog,
  onTip,
  onSharePost,
  onReportPost,
  ecencyToken,
  threeSpeakApiKey,
  giphyApiKey,
  templateToken,
  templateApiBaseUrl,
  defaultVotePercent,
  voteWeightStep,
  allowLandscapeVideos,
  defaultReward,
  onShare,
  onRss,
}: CommunityDetailProps) => {
  const [activeTab, setActiveTab] = useState<TabId>('posts')
  const [communityDetails, setCommunityDetails] = useState<CommunityDetailsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Posts/Snaps state (one feed cache each — flips when active tab changes)
  const [postSort, setPostSort] = useState<PostSort>('trending')
  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [postsLoadingMore, setPostsLoadingMore] = useState(false)
  const [postsHasMore, setPostsHasMore] = useState(true)
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
        setPosts((prev) => (append ? [...prev, ...next] : next))
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

  // Reset post list when active feed-tab or sort changes.
  useEffect(() => {
    if (activeTab === 'posts' || activeTab === 'snaps') {
      setPosts([])
      setPostsHasMore(true)
      void loadPosts(activeTab, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, postSort, communityId])

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
      onTip,
      onSharePost,
      onReportPost,
      onUserClick,
      onPostClick,
      onCommentClick,
      ecencyToken,
      threeSpeakApiKey,
      giphyApiKey,
      templateToken,
      templateApiBaseUrl,
      defaultVotePercent,
      voteWeightStep,
      allowLandscapeVideos,
      defaultReward,
    }),
    [
      currentUser,
      onUpvote,
      onSubmitComment,
      onClickCommentUpvote,
      onReblog,
      onTip,
      onSharePost,
      onReportPost,
      onUserClick,
      onPostClick,
      onCommentClick,
      ecencyToken,
      threeSpeakApiKey,
      giphyApiKey,
      templateToken,
      templateApiBaseUrl,
      defaultVotePercent,
      voteWeightStep,
      allowLandscapeVideos,
      defaultReward,
    ],
  )

  // Single shared scroll container so the header scrolls away while
  // the tab strip sticks to the top edge. Reset to top when the tab
  // changes so each tab opens at its first row instead of inheriting
  // the previous tab's offset.
  const scrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [activeTab])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#212529] text-[#f0f0f8]">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {/* Community header — compact on mobile, larger on desktop.
            Lives inside the scroller so it scrolls away as the user
            moves down through the feed. */}
        {loading ? (
          <div className="m-3 rounded-xl border border-[#3a424a] bg-[#262b30] p-3 animate-pulse sm:m-0 sm:p-5">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-12 w-12 rounded-full bg-[#2f353d] sm:h-16 sm:w-16" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-[#3a424a] sm:h-5" />
                <div className="h-2.5 w-2/3 rounded bg-[#2f353d] sm:h-3" />
              </div>
            </div>
          </div>
        ) : (
          <div className="m-3 rounded-xl border border-[#3a424a] bg-[#262b30] p-3 sm:m-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-5">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
              <img
                src={communityService.userOwnerThumb(communityId)}
                alt={community?.title || communityId}
                className="h-12 w-12 flex-shrink-0 rounded-full bg-[#2f353d] object-cover sm:h-16 sm:w-16"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://images.hive.blog/u/${community?.title || communityId}/avatar`
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <h1 className="min-w-0 flex-1 truncate text-base font-bold text-[#f0f0f8] sm:text-xl">
                    {community?.title || communityId}
                  </h1>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={onShare || handleShare}
                      title="Share"
                      aria-label="Share"
                      className="rounded-md border border-[#3a424a] p-1.5 text-[#9ca3b0] transition-colors hover:bg-[#2f353d] hover:text-[#f0f0f8] sm:p-2"
                    >
                      <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                </div>
                {community?.about && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-[#9ca3b0] sm:mt-1 sm:line-clamp-none sm:text-sm">
                    {community.about}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#9ca3b0] sm:mt-3 sm:gap-x-4 sm:text-xs">
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
        <div className="sticky top-0 z-10 border-b border-[#3a424a]/60 bg-[#212529]/95 px-3 py-2 backdrop-blur sm:px-0 sm:py-2.5">
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
                      ? 'bg-[#e31337] text-white'
                      : 'border border-[#3a424a] text-[#e7e7f1] hover:bg-[#2f353d]'
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
          <div className="mb-3 rounded-md border border-[#e31337] bg-red-900/20 p-2 text-xs font-medium text-red-400">
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
                      ? 'bg-[#e31337] text-white'
                      : 'border border-[#3a424a] text-[#e7e7f1] hover:bg-[#2f353d]'
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
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-[#3a424a] px-2 py-1 text-xs text-[#e7e7f1] hover:bg-[#2f353d] disabled:opacity-50"
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#9ca3b0]">
                Latest short-form posts in this community.
              </p>
              <button
                type="button"
                onClick={() => { void loadPosts('snaps', false) }}
                title="Refresh"
                aria-label="Refresh"
                disabled={postsLoading}
                className="inline-flex items-center gap-1 rounded-md border border-[#3a424a] px-2 py-1 text-xs text-[#e7e7f1] hover:bg-[#2f353d] disabled:opacity-50"
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
              onLoadMore={() => { void loadPosts('snaps', true) }}
              emptyMessage="No recent snaps in this community."
            />
          </div>
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
      <ul className="divide-y divide-[#3a424a]">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="flex items-start gap-3 px-3 py-2.5 animate-pulse">
            <div className="h-8 w-8 shrink-0 rounded-full bg-[#2f353d]" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-[#3a424a]" />
                <div className="h-3 w-16 rounded bg-[#3a424a]" />
                <div className="h-2 w-12 rounded bg-[#2f353d]" />
              </div>
              <div className="h-3 w-11/12 rounded bg-[#3a424a]" />
              <div className="h-3 w-3/5 rounded bg-[#2f353d]" />
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
          className="inline-flex items-center gap-2 rounded-md border border-[#3a424a] px-3 py-1.5 text-xs text-[#e7e7f1] hover:bg-[#2f353d]"
        >
          <Loader2 className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Activity className="h-10 w-10 text-[#3a424a] mb-3" />
        <p className="text-sm text-[#9ca3b0]">No recent activities.</p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-[#3a424a]">
      {items.map((n) => {
        const meta = ACTIVITY_TYPE_META[n.type] ?? { icon: Bell, tone: 'text-[#9ca3b0]' }
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
              className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#262b30]"
            >
              <img
                src={`https://images.hive.blog/u/${author}/avatar`}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full bg-[#2f353d] object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs">
                  <Icon className={`h-3.5 w-3.5 ${meta.tone}`} />
                  <span className="font-medium text-[#e7e7f1] capitalize">
                    {n.type.replace('_', ' ')}
                  </span>
                  <span className="text-[#9ca3b0]">·</span>
                  <span className="text-[#9ca3b0]">{formatTimeAgo(`${n.date}Z`)}</span>
                </div>
                <p className="mt-0.5 text-sm text-[#f0f0f8] line-clamp-2">{n.msg}</p>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export default CommunityDetail
