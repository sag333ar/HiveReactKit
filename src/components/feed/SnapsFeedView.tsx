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
import { useEffect, useState, type ReactNode } from 'react';
import type { Post } from '@/types/post';
import SnapsFeedList from './SnapsFeedList';
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
  onTip?: (author: string, permlink: string) => void;
  onSharePost?: (author: string, permlink: string) => void;
  onCommentClick?: (author: string, permlink: string) => void;
  onReportPost?: (author: string, permlink: string) => void;
  onUserClick?: (username: string) => void;
  onPostClick?: (author: string, permlink: string, title?: string) => void;

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
  defaultReward?: RewardOption;

  /** Optional top-row content rendered above the columns (e.g. a Compose FAB
   *  trigger or filter dropdown). Sticky to the top of the viewport. */
  toolbar?: ReactNode;
  /** Optional element rendered at the bottom of the layout (e.g. Compose FAB). */
  footer?: ReactNode;
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
 * 1 col on mobile · 4 cols at tablet+ (≥ 768 px). The intermediate 2-col
 * tablet view from hSnaps is intentionally dropped — the user wants all
 * four feeds visible on a single page on every desktop / tablet width.
 */
function useFeedColumnCount(): 1 | 4 {
  const [cols, setCols] = useState<1 | 4>(() => {
    if (typeof window === 'undefined') return 1;
    return window.innerWidth >= 768 ? 4 : 1;
  });

  useEffect(() => {
    const update = () => {
      setCols(window.innerWidth >= 768 ? 4 : 1);
    };
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
  toolbar,
  footer,
}: SnapsFeedViewProps) {
  const cols = useFeedColumnCount();
  const finalLabels = { ...DEFAULT_LABELS, ...labels };
  const finalAvatars = { ...DEFAULT_AVATARS, ...avatars };

  // Mobile column selection (single visible column, switched via the
  // top-of-page pill switcher).
  const [col1, setCol1] = useState<SnapsFeedKey>(defaultPrimary);

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
  };

  const renderColumn = (key: SnapsFeedKey, opts?: { titled?: boolean }) => {
    const slot = feeds[key];
    return (
      <div className="flex h-full min-h-0 flex-col">
        {opts?.titled && (
          <h2 className="mb-3 flex shrink-0 items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#9ca3b0]">
            <img
              src={finalAvatars[key]}
              alt=""
              className="h-6 w-6 rounded-full object-cover ring-1 ring-[#3a424a]"
            />
            {finalLabels[key]}
          </h2>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
          {slot.error && (
            <div className="mb-3 rounded-md border border-[#e31337] bg-red-900/20 p-2 text-xs font-medium text-red-400">
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
        </div>
      </div>
    );
  };

  // ── 1 column: mobile ──────────────────────────────────────────────────
  if (cols === 1) {
    const mobileOptions: SnapsFeedKey[] = ['snaps', 'ecency', 'threads', 'liketu'];
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        {toolbar}
        <div className="shrink-0 overflow-x-auto">
          <FeedSegmentControl
            options={mobileOptions.map(segOpt)}
            value={col1}
            onChange={(id) => setCol1(id as SnapsFeedKey)}
          />
        </div>
        <div className="min-h-0 flex-1">{renderColumn(col1)}</div>
        {footer}
      </div>
    );
  }

  // ── 4 columns: tablet+ (≥ 768 px) — no intermediate 2-col view ───────
  return (
    <div className="mx-auto flex h-full min-h-0 max-w-[1600px] flex-col gap-3">
      {toolbar}
      <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-1 gap-4">
        {(['snaps', 'ecency', 'threads', 'liketu'] as SnapsFeedKey[]).map((k) => (
          <div key={k} className="flex h-full min-h-0 flex-col">
            {renderColumn(k, { titled: true })}
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}

export default SnapsFeedView;
