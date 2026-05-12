/**
 * ProfileSnapsTab — Snaps tab body for the user-profile page.
 *
 * Wraps <SnapsFeedView/> so a profile renders the same 1-col-mobile /
 * 4-col-desktop snaps layout as the unified Snaps page. Each of the four
 * container types (peak.snaps · ecency.waves · leothreads · liketu.moments)
 * gets its own slot, fetched in parallel from the user's snaps for that
 * container.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Post } from '@/types/post';
import SnapsFeedView, { type SnapsFeedKey, type SnapsFeedSlot } from '../feed/SnapsFeedView';
import { userService, SNAP_SUBTYPE_PARENTS, type SnapSubType } from '@/services/userService';
import type { RewardOption } from '../../utils/commentOptions';

const SUBTYPES: SnapSubType[] = ['snaps', 'ecency', 'threads', 'liketu'];

interface SubTypeState {
  posts: Post[];
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

/**
 * Module-level pagination cache, keyed by `username`. Survives mount/
 * unmount so navigating to a post detail and back to the same profile
 * restores every page the user had already loaded — no re-fetch, no
 * jump back to the top of the list.
 */
const profileSnapsCache = new Map<string, Record<SnapSubType, SubTypeState>>();

/** True if every subtype slot has at least loaded once (or finished). */
function isHydrated(state: Record<SnapSubType, SubTypeState>): boolean {
  return SUBTYPES.some((s) => state[s].posts.length > 0 || state[s].nextStartId !== null || state[s].error !== null);
}

export interface ProfileSnapsTabProps {
  username: string;
  currentUsername?: string;

  reportedPosts?: { author: string; permlink: string }[];
  reportedAuthors?: string[];

  onUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onSubmitComment?: (parentAuthor: string, parentPermlink: string, body: string) => void | Promise<void>;
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onReblog?: (author: string, permlink: string) => void;
  onTip?: (author: string, permlink: string) => void;
  onSharePost?: (author: string, permlink: string) => void;
  onCommentClick?: (author: string, permlink: string) => void;
  /** Comment-icon click (per card) — typical use: open inline composer. */
  onClickCommentIcon?: (author: string, permlink: string) => void;
  /** Comment-count click (per card) — typical use: open post detail. */
  onClickCommentCount?: (author: string, permlink: string) => void;
  onReportPost?: (author: string, permlink: string) => void;
  /** Edit entry-point inside each snap's 3-dot menu — gated to the
   *  snap's author. Forwarded directly to <SnapsFeedView/>. */
  onEditSnap?: (data: {
    author: string;
    permlink: string;
    body: string;
    title: string;
    parent_author: string;
    parent_permlink: string;
    json_metadata: string;
  }) => void;
  /** Cast a poll vote from inside a snap card. */
  onVotePoll?: (
    author: string,
    permlink: string,
    choiceNums: number[],
  ) => void | boolean | Promise<void | boolean>;
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
  /** Forwarded to every <SnapsFeedCard/>'s vote slider for the
   *  blinking wallet-approval hint. */
  awaitingWalletApproval?: boolean;
  defaultReward?: RewardOption;

  /** Per-card right-side header action menu slot (e.g. Edit / Flag). */
  renderHeaderActions?: (post: Post) => ReactNode;
}

const ProfileSnapsTab: React.FC<ProfileSnapsTabProps> = ({
  username,
  currentUsername,
  reportedPosts = [],
  reportedAuthors = [],
  ...feedProps
}) => {
  // Initialize from the module-level cache so we keep every page the
  // user had already loaded for this profile in this session.
  const [state, setState] = useState<Record<SnapSubType, SubTypeState>>(
    () => profileSnapsCache.get(username) ?? makeInitialState(),
  );

  // Track which username `state` belongs to. The mirror effect must
  // never write state into the cache slot of a *different* username —
  // otherwise switching profiles briefly persists the previous user's
  // data under the new user's key and we end up showing stale snaps.
  const stateUsernameRef = useRef(username);

  // When the username prop changes, re-hydrate state from the cache
  // for the new user (or fall back to the initial empty state). This
  // runs synchronously before the mirror effect, so the cache for
  // the previous username is never overwritten with stale data.
  useEffect(() => {
    if (stateUsernameRef.current === username) return;
    stateUsernameRef.current = username;
    setState(profileSnapsCache.get(username) ?? makeInitialState());
  }, [username]);

  // Mirror state into the cache on every change — but only when the
  // state actually belongs to this username.
  useEffect(() => {
    if (stateUsernameRef.current !== username) return;
    profileSnapsCache.set(username, state);
  }, [username, state]);

  // Reported-post / reported-author filter, mirroring UserDetailProfile.
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

  // First-time hydration per username. If the cache already has data
  // for this user, we skip the fetch entirely and keep the previously
  // loaded pages — that's what makes "open a post → come back" land on
  // the same scroll/page as before. New profiles fall through to a
  // parallel fetch of all 4 subtypes.
  useEffect(() => {
    const cached = profileSnapsCache.get(username);
    if (cached && isHydrated(cached)) {
      setState(cached);
      return;
    }

    let aborted = false;
    const controller = new AbortController();

    setState({
      snaps: { ...initialSubState, loading: true },
      ecency: { ...initialSubState, loading: true },
      threads: { ...initialSubState, loading: true },
      liketu: { ...initialSubState, loading: true },
    });

    const fetchOne = async (sub: SnapSubType) => {
      try {
        const { snaps: raw, nextStartId } = await userService.getUserSnaps(
          username,
          undefined,
          currentUsername,
          controller.signal,
          SNAP_SUBTYPE_PARENTS[sub],
        );
        if (aborted) return;
        setState((prev) => ({
          ...prev,
          [sub]: {
            posts: raw,
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
  }, [username, currentUsername]);

  const loadMore = useCallback(
    async (sub: SnapSubType) => {
      const slot = state[sub];
      if (!slot || slot.loadingMore || slot.nextStartId === null) return;
      setState((prev) => ({ ...prev, [sub]: { ...prev[sub], loadingMore: true } }));
      try {
        const { snaps: raw, nextStartId } = await userService.getUserSnaps(
          username,
          slot.nextStartId,
          currentUsername,
          undefined,
          SNAP_SUBTYPE_PARENTS[sub],
        );
        setState((prev) => ({
          ...prev,
          [sub]: {
            posts: [...prev[sub].posts, ...raw],
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
    [state, username, currentUsername],
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
      currentUser={currentUsername}
      {...feedProps}
    />
  );
};

export default ProfileSnapsTab;
