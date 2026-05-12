/**
 * CommunitySnapsTab — Snaps tab body for the community-detail page.
 *
 * Mirrors `ProfileSnapsTab` so a community renders the same 1-col-mobile
 * / 4-col-desktop snaps layout as the unified Snaps page. Each of the
 * four container types (peak.snaps · ecency.waves · leothreads ·
 * liketu.moments) gets its own slot, fetched in parallel from
 * `communityService.getCommunitySnaps` and filtered to the current
 * community.
 *
 * The kit's CommunityDetail used to render the snaps tab as a flat
 * `<BlogPostList/>` driven by ranked-posts; this swaps in the rich
 * snaps UI (swipeable image carousels, inline composer, per-feed
 * pagination) so community snaps look and behave exactly like the
 * profile-level snaps tab.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Post } from '@/types/post';
import SnapsFeedView, { type SnapsFeedKey, type SnapsFeedSlot } from '../feed/SnapsFeedView';
import { communityService } from '@/services/communityService';
import { SNAP_SUBTYPE_PARENTS, type SnapSubType } from '@/services/userService';
import type { RewardOption } from '../../utils/commentOptions';

const SUBTYPES: SnapSubType[] = ['snaps', 'ecency', 'threads', 'liketu'];

interface SubTypeState {
  posts: Post[];
  /** Cursor handed back by `getCommunitySnaps`; null = end of list. */
  nextStartId: number | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

const initialSubState: SubTypeState = {
  posts: [],
  nextStartId: null,
  loading: false,
  loadingMore: false,
  error: null,
};

const makeInitialState = (): Record<SnapSubType, SubTypeState> => ({
  snaps: { ...initialSubState },
  ecency: { ...initialSubState },
  threads: { ...initialSubState },
  liketu: { ...initialSubState },
});

/** Module-level cache so navigating to a post detail and back keeps the
 *  pages already loaded. Keyed by communityId. */
const communitySnapsCache = new Map<string, Record<SnapSubType, SubTypeState>>();

export interface CommunitySnapsTabProps {
  communityId: string;
  currentUser?: string;

  reportedPosts?: { author: string; permlink: string }[];
  reportedAuthors?: string[];

  onUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onSubmitComment?: (parentAuthor: string, parentPermlink: string, body: string) => void | Promise<void>;
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onReblog?: (author: string, permlink: string) => void;
  onTip?: (author: string, permlink: string) => void;
  onSharePost?: (author: string, permlink: string) => void;
  onCommentClick?: (author: string, permlink: string) => void;
  onClickCommentIcon?: (author: string, permlink: string) => void;
  onClickCommentCount?: (author: string, permlink: string) => void;
  onReportPost?: (author: string, permlink: string) => void;
  onUserClick?: (username: string) => void;
  onPostClick?: (author: string, permlink: string, title?: string) => void;

  ecencyToken?: string;
  threeSpeakApiKey?: string;
  giphyApiKey?: string;
  templateToken?: string;
  templateApiBaseUrl?: string;
  defaultVotePercent?: number;
  voteWeightStep?: number;
  allowLandscapeVideos?: boolean;
  /** Forwarded to the embedded <SnapsFeedView/> — when true, each
   *  snap card's vote slider surfaces a blinking "Open Keychain
   *  App & Approve" hint while a broadcast is in flight. */
  awaitingWalletApproval?: boolean;
  defaultReward?: RewardOption;

  /** Per-card right-side header action menu slot. */
  renderHeaderActions?: (post: Post) => ReactNode;
  /** Collapse the per-card secondary actions (reblog · share · tip ·
   *  flag) into a single 3-dot kebab. Forwarded into <SnapsFeedView/>. */
  actionsAsMenu?: boolean;
}

const CommunitySnapsTab: React.FC<CommunitySnapsTabProps> = ({
  communityId,
  currentUser,
  reportedPosts = [],
  reportedAuthors = [],
  ...feedProps
}) => {
  const [state, setState] = useState<Record<SnapSubType, SubTypeState>>(
    () => communitySnapsCache.get(communityId) ?? makeInitialState(),
  );

  // Mirror state into the cache so back-navigation restores pages.
  useEffect(() => {
    communitySnapsCache.set(communityId, state);
  }, [communityId, state]);

  const reportedPostKeys = useMemo(
    () => new Set(reportedPosts.map((p) => `${p.author}/${p.permlink}`)),
    [reportedPosts],
  );
  const reportedAuthorSet = useMemo(() => new Set(reportedAuthors), [reportedAuthors]);
  const filterPost = useCallback(
    <T extends { author: string; permlink: string }>(items: T[]): T[] =>
      items.filter(
        (item) =>
          !reportedAuthorSet.has(item.author) &&
          !reportedPostKeys.has(`${item.author}/${item.permlink}`),
      ),
    [reportedPostKeys, reportedAuthorSet],
  );

  // First-time hydration per community. Cache hit short-circuits the
  // 4-container parallel fetch.
  useEffect(() => {
    const cached = communitySnapsCache.get(communityId);
    if (
      cached &&
      SUBTYPES.some(
        (s) =>
          cached[s].posts.length > 0 ||
          cached[s].nextStartId !== null ||
          cached[s].error,
      )
    ) {
      setState(cached);
      return;
    }
    const controller = new AbortController();
    let aborted = false;

    setState({
      snaps: { ...initialSubState, loading: true },
      ecency: { ...initialSubState, loading: true },
      threads: { ...initialSubState, loading: true },
      liketu: { ...initialSubState, loading: true },
    });

    const fetchOne = async (sub: SnapSubType) => {
      try {
        // First page: hreplier-api `/snaps?parent=&tag=<communityId>`
        // → ref list, then bridge.get_post in batches of 5 to materialise
        // the first 20 snap posts. Mirrors peakd's tag flow but routes
        // through our backend.
        const { snaps, nextStartId } = await communityService.getCommunitySnaps(
          communityId,
          SNAP_SUBTYPE_PARENTS[sub],
          undefined,
          currentUser,
          controller.signal,
        );
        if (aborted) return;
        setState((prev) => ({
          ...prev,
          [sub]: {
            posts: snaps,
            nextStartId,
            loading: false,
            loadingMore: false,
            error: null,
          },
        }));
      } catch (err) {
        if (aborted) return;
        const e = err as Error;
        if (e.name === 'AbortError') return;
        setState((prev) => ({
          ...prev,
          [sub]: { ...prev[sub], loading: false, error: e.message ?? 'Failed to load' },
        }));
      }
    };

    void Promise.all(SUBTYPES.map(fetchOne));

    return () => {
      aborted = true;
      controller.abort();
    };
  }, [communityId, currentUser]);

  const loadMore = useCallback(
    async (sub: SnapSubType) => {
      const slot = state[sub];
      if (!slot || slot.loadingMore || slot.nextStartId === null) return;
      setState((prev) => ({ ...prev, [sub]: { ...prev[sub], loadingMore: true } }));
      try {
        const { snaps, nextStartId } = await communityService.getCommunitySnaps(
          communityId,
          SNAP_SUBTYPE_PARENTS[sub],
          slot.nextStartId,
          currentUser,
          undefined,
        );
        setState((prev) => ({
          ...prev,
          [sub]: {
            posts: [...prev[sub].posts, ...snaps],
            nextStartId,
            loading: false,
            loadingMore: false,
            error: null,
          },
        }));
      } catch (err) {
        const e = err as Error;
        if (e.name === 'AbortError') return;
        setState((prev) => ({
          ...prev,
          [sub]: { ...prev[sub], loadingMore: false, error: e.message ?? 'Failed to load' },
        }));
      }
    },
    [state, communityId, currentUser],
  );

  const feeds = useMemo<Record<SnapsFeedKey, SnapsFeedSlot>>(
    () => ({
      snaps: {
        posts: filterPost(state.snaps.posts),
        loading: state.snaps.loading,
        loadingMore: state.snaps.loadingMore,
        hasMore: state.snaps.nextStartId !== null,
        error: state.snaps.error,
        onLoadMore: () => { void loadMore('snaps'); },
      },
      ecency: {
        posts: filterPost(state.ecency.posts),
        loading: state.ecency.loading,
        loadingMore: state.ecency.loadingMore,
        hasMore: state.ecency.nextStartId !== null,
        error: state.ecency.error,
        onLoadMore: () => { void loadMore('ecency'); },
      },
      threads: {
        posts: filterPost(state.threads.posts),
        loading: state.threads.loading,
        loadingMore: state.threads.loadingMore,
        hasMore: state.threads.nextStartId !== null,
        error: state.threads.error,
        onLoadMore: () => { void loadMore('threads'); },
      },
      liketu: {
        posts: filterPost(state.liketu.posts),
        loading: state.liketu.loading,
        loadingMore: state.liketu.loadingMore,
        hasMore: state.liketu.nextStartId !== null,
        error: state.liketu.error,
        onLoadMore: () => { void loadMore('liketu'); },
      },
    }),
    [state, filterPost, loadMore],
  );

  return (
    <SnapsFeedView
      feeds={feeds}
      currentUser={currentUser}
      {...feedProps}
    />
  );
};

export default CommunitySnapsTab;
