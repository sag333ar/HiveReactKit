/* eslint-disable prefer-const */
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
import { getWeb2Identity } from '../feed/AttachmentStrip';
import { getGlobalPostFilter } from '@/config/hiveEndpoint';

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
  /**
   * Web2 firebase UID or account identifier for filtering snaps created by a
   * specific Web2 user on a shared proxy account (e.g. `hivesuite-w2prxy`).
   */
  web2IdFilter?: string;
  /**
   * Hive account to pass as `observer` to `getUserSnaps`. Defaults to
   * `currentUsername` when omitted — pass this separately when
   * `currentUsername` isn't a valid Hive account (e.g. a Web2 viewer),
   * while `currentUsername` stays their real identity for permission
   * checks (edit/delete on their own snaps).
   */
  observer?: string;

  reportedPosts?: { author: string; permlink: string }[];
  reportedAuthors?: string[];

  onUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onSubmitComment?: (parentAuthor: string, parentPermlink: string, body: string) => void | boolean | Promise<void | boolean>;
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onReblog?: (author: string, permlink: string) => void;
  isPostReblogged?: (author: string, permlink: string) => boolean;
  onCheckReblogged?: (author: string, permlink: string) => void;
  onTip?: (author: string, permlink: string) => void;
  onSharePost?: (author: string, permlink: string) => void;
  onCommentClick?: (author: string, permlink: string) => void;
  /** Comment-icon click (per card) — typical use: open inline composer. */
  onClickCommentIcon?: (author: string, permlink: string) => void;
  /** Comment-count click (per card) — typical use: open post detail. */
  onClickCommentCount?: (author: string, permlink: string) => void;
  onReportPost?: (author: string, permlink: string) => void;
  /** Author-only Delete entry — forwarded into <SnapsFeedView/> so
   *  each snap's kebab gets a red Delete item when the viewed
   *  profile is the current user. */
  onDeletePost?: (author: string, permlink: string) => void;
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
  onWeb2IdentityFound?: (identity: {
    displayName: string;
    avatarUrl: string;
    provider?: string;
    web2id: string;
  }) => void;
  onWeb2UserClick?: (web2id: string, name?: string, dpUrl?: string, provider?: string) => void;
  getWeb2UserUrl?: (web2id: string, name?: string, dpUrl?: string, provider?: string) => string;
  onUserClick?: (username: string) => void;
  onPostClick?: (author: string, permlink: string, title?: string) => void;
  // URL builders — forwarded to <SnapsFeedView/> so the snap cards
  // render real <a href> links ("open in new tab" etc.).
  getPostUrl?: (author: string, permlink: string) => string;
  getUserUrl?: (username: string) => string;
  getTagUrl?: (tag: string) => string;
  getCommunityUrl?: (community: string) => string;

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

  /** When true, a heart button is shown on each snap card so the curator
   *  can request an on-chain upvote. Forwarded to <SnapsFeedView/>. */
  isCurator?: boolean;
  /** Usernames who've opted out of ever receiving a curation vote —
   *  forwarded to <SnapsFeedView/>. See postVotes.ts. */
  optedOutAuthors?: Set<string>;
  /** Called when the curator submits a curation request on a snap.
   *  `ownVoteWeight` is the curator's own vote weight on this snap
   *  (0–100), recorded alongside the request for review. */
  onCurationRequest?: (author: string, permlink: string, weight: number, ownVoteWeight: number) => void | Promise<void>;
  /** Looks up the server-configured max curation weight for a content
   *  type, plus whether it's already been submitted for curation.
   *  Forwarded to <SnapsFeedView/>. */
  onFetchCurationStatus?: (author: string, permlink: string, type: 'post' | 'snap' | 'comment') => Promise<{ maxWeight: number; alreadySubmitted: boolean }>;
  isWeb2User?: boolean;
}

const ProfileSnapsTab: React.FC<ProfileSnapsTabProps> = ({
  username,
  currentUsername,
  observer: observerProp,
  web2IdFilter,
  reportedPosts = [],
  reportedAuthors = [],
  onWeb2IdentityFound,
  ...feedProps
}) => {
  const observer = observerProp ?? currentUsername;

  const fullCacheKey = useMemo(
    () => (web2IdFilter ? `${username}:${web2IdFilter}` : username),
    [username, web2IdFilter],
  );

  // Initialize from the module-level cache so we keep every page the
  // user had already loaded for this profile in this session.
  const [state, setState] = useState<Record<SnapSubType, SubTypeState>>(
    () => profileSnapsCache.get(fullCacheKey) ?? makeInitialState(),
  );

  // Track which cache key `state` belongs to.
  const stateKeyRef = useRef(fullCacheKey);

  // When username or web2IdFilter prop changes, re-hydrate state from cache
  useEffect(() => {
    if (stateKeyRef.current === fullCacheKey) return;
    stateKeyRef.current = fullCacheKey;
    setState(profileSnapsCache.get(fullCacheKey) ?? makeInitialState());
  }, [fullCacheKey]);

  // Mirror state into the cache on every change
  useEffect(() => {
    if (stateKeyRef.current !== fullCacheKey) return;
    profileSnapsCache.set(fullCacheKey, state);
  }, [fullCacheKey, state]);

  // Reported-post / reported-author / web2id filter, mirroring UserDetailProfile.
  const reportedPostKeys = useMemo(
    () => new Set(reportedPosts.map((p) => `${p.author}/${p.permlink}`)),
    [reportedPosts],
  );
  const reportedAuthorSet = useMemo(() => new Set(reportedAuthors), [reportedAuthors]);
  const filterPost = useCallback(
    <T extends { author: string; permlink: string; json_metadata?: unknown }>(items: T[]): T[] => {
      const globalFilter = getGlobalPostFilter();
      return items.filter(
        (item) =>
          !reportedAuthorSet.has(item.author) &&
          !reportedPostKeys.has(`${item.author}/${item.permlink}`) &&
          globalFilter(item) &&
          (!web2IdFilter || getWeb2Identity(item.author, item.json_metadata, '').web2id === web2IdFilter),
      );
    },
    [reportedPostKeys, reportedAuthorSet, web2IdFilter],
  );

  // First-time hydration per cache key. If the cache already has data
  // for this key, we skip the fetch entirely and keep the previously
  // loaded pages.
  useEffect(() => {
    const cached = profileSnapsCache.get(fullCacheKey);
    if (cached && isHydrated(cached)) {
      setState(cached);
      if (web2IdFilter && onWeb2IdentityFound) {
        const allCached = [...cached.snaps.posts, ...cached.ecency.posts, ...cached.threads.posts, ...cached.liketu.posts];
        const match = allCached.find((item) => {
          const ident = getWeb2Identity(item.author, item.json_metadata, '');
          return ident.isWeb2 && ident.web2id === web2IdFilter;
        });
        if (match) {
          const ident = getWeb2Identity(match.author, match.json_metadata, '');
          if (ident.isWeb2 && ident.web2id) {
            onWeb2IdentityFound({
              displayName: ident.displayName,
              avatarUrl: ident.avatarUrl,
              provider: ident.provider,
              web2id: ident.web2id,
            });
          }
        }
      }
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
        let { snaps: raw, nextStartId } = await userService.getUserSnaps(
          username,
          undefined,
          observer,
          controller.signal,
          SNAP_SUBTYPE_PARENTS[sub],
        );
        if (aborted) return;

        // If web2IdFilter is set and initial batch has 0 matching posts, auto-advance
        while(
          web2IdFilter &&
          filterPost(raw).length === 0 &&
          nextStartId !== null &&
          !aborted
        ) {
          const nextRes = await userService.getUserSnaps(
            username,
            nextStartId,
            observer,
            controller.signal,
            SNAP_SUBTYPE_PARENTS[sub],
          );
          if (aborted) return;
          raw = [...raw, ...nextRes.snaps];
          nextStartId = nextRes.nextStartId;
        }

        if (web2IdFilter && onWeb2IdentityFound) {
          const match = raw.find((item) => {
            const ident = getWeb2Identity(item.author, item.json_metadata, '');
            return ident.isWeb2 && ident.web2id === web2IdFilter;
          });
          if (match) {
            const ident = getWeb2Identity(match.author, match.json_metadata, '');
            if (ident.isWeb2 && ident.web2id) {
              onWeb2IdentityFound({
                displayName: ident.displayName,
                avatarUrl: ident.avatarUrl,
                provider: ident.provider,
                web2id: ident.web2id,
              });
            }
          }
        }

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
  }, [fullCacheKey, username, observer, web2IdFilter, filterPost]);

  const loadMore = useCallback(
    async (sub: SnapSubType) => {
      const slot = state[sub];
      if (!slot || slot.loadingMore || slot.nextStartId === null) return;
      setState((prev) => ({ ...prev, [sub]: { ...prev[sub], loadingMore: true } }));
      try {
        const initialRes = await userService.getUserSnaps(
          username,
          slot.nextStartId,
          observer,
          undefined,
          SNAP_SUBTYPE_PARENTS[sub],
        );

        let accumulated = initialRes.snaps;
        let nextStartId = initialRes.nextStartId;
        while (
          web2IdFilter &&
          filterPost(accumulated).length === 0 &&
          nextStartId !== null
        ) {
          const nextRes = await userService.getUserSnaps(
            username,
            nextStartId,
            observer,
            undefined,
            SNAP_SUBTYPE_PARENTS[sub],
          );
          accumulated = [...accumulated, ...nextRes.snaps];
          nextStartId = nextRes.nextStartId;
        }

        setState((prev) => ({
          ...prev,
          [sub]: {
            posts: [...prev[sub].posts, ...accumulated],
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
    [state, username, observer, web2IdFilter, filterPost],
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
      // Snapie and HiveSuite not yet supported at profile level.
      snapie: { posts: [], loading: false, hasMore: false, error: null },
      hivesuite: { posts: [], loading: false, hasMore: false, error: null },
    }),
    [state, filterPost, loadMore],
  );

  return (
    <SnapsFeedView
      feeds={feeds}
      currentUser={currentUsername}
      observer={observer}
      {...feedProps}
    />
  );
};

export default ProfileSnapsTab;
