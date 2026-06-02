import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ThumbsUp,
  MessageCircle,
  Repeat2,
  Share2,
  Flag,
  Loader2,
  Gift,
} from "lucide-react";
import { VoteSlider } from "@/components/VoteSlider";
import UpvoteListModal from "@/components/UpvoteListModal";
import { RewardsModal } from "@/components/RewardsModal";
import type { RewardsModalPayoutDetails } from "@/components/RewardsModal";
import CommentsModal from "@/components/comments/CommentsModal";
import { apiService } from "@/services/apiService";
import { ActiveVote } from "@/types/video";
import { getHiveApiEndpoint } from "@/config/hiveEndpoint";
import { isPostTooOldToVote, VOTE_WINDOW_MESSAGE } from "@/utils/voteAge";
import { MoreActionsMenu } from "./MoreActionsMenu";

export interface PostActionButtonProps {
  author: string;
  permlink: string;
  /** Current logged-in username; null or '' means not logged in */
  currentUser?: string | null;
  /** Optional: Hive value to display (numeric string, e.g. "8.500") */
  hiveValue?: string;
  /** Optional: URL to a Hive logo icon shown next to the payout value */
  hiveIconUrl?: string;
  /** Optional: Tooltip text shown on hover over the payout value (e.g. payout breakdown).
   *  Deprecated path used for compatibility — when `payoutDetails` is
   *  also provided the value pill becomes a tap target opening the
   *  full `RewardsModal` instead of a hover tooltip. */
  payoutTooltip?: string;
  /** Structured payout breakdown — when supplied, tapping the payout
   *  chip opens a `RewardsModal` showing pending/realised amounts,
   *  HBD↔HP split, time to payout, and a beneficiary list. */
  payoutDetails?: RewardsModalPayoutDetails;
  /** Optional: Pre-loaded active votes array from the Post object. Skips the API call when provided. */
  initialVotes?: ActiveVote[];
  /** True total vote count from the chain (`post.stats.total_votes`
   *  or `post.net_votes`). Hive's `bridge.get_discussion` /
   *  `condenser_api.get_active_votes` cap the `active_votes`
   *  array at 1000 entries, so `votes.length` under-counts on
   *  popular posts. Pass this when you have the canonical total so
   *  the chip reads "1.2k" instead of being capped at 1000. */
  initialVoteCount?: number;
  /** Optional: Pre-loaded comments count from the Post object (item.children). Skips the API call when provided. */
  initialCommentsCount?: number;
  /** Called when user confirms vote with percent (1–100). Frontend handles signing/broadcast. */
  onUpvote?: (percent: number) => void | Promise<void>;
  /** Called when user submits a comment. Frontend handles signing/broadcast.
   *  Return `false` to indicate the operation was cancelled — the composer text will be preserved.
   *  `voteWeight` is non-null when the composer's upvote-on-publish toggle is enabled
   *  (1–100, step 0.25) — consumer should broadcast vote+comment atomically.
   *  `beneficiaries` is the post-lock beneficiary list selected in the composer
   *  (already includes threespeakfund 10% on video posts). */
  onSubmitComment?: (
    parentAuthor: string,
    parentPermlink: string,
    body: string,
    voteWeight?: number | null,
    beneficiaries?: import('../../utils/beneficiaries').Beneficiary[],
  ) => void | boolean | Promise<void | boolean>;
  /** Show the upvote-on-publish toggle in the comment composer.
   *  Auto-hidden when the current user has already voted this post. */
  showVoteButton?: boolean;
  /** Locked default tags for the composer (usually the parent post's tags, app tag first). */
  parentTags?: string[];
  /** Default reward routing seeded into the comment composer. */
  defaultReward?: import('../../utils/commentOptions').RewardOption;
  /** Beneficiaries pre-populated into the comment composer. */
  defaultBeneficiaries?: import('../../utils/beneficiaries').Beneficiary[];
  /** Suggested beneficiary chips shown inside the composer's editor. */
  beneficiaryFavorites?: import('../../utils/beneficiaries').Beneficiary[];
  /** Initial percent for the upvote slider when opened (1–100). Default 100. */
  defaultVotePercent?: number;
  /** Slider precision used by both the post upvote slider AND the comment composer's
   *  "upvote-on-publish" slider. Use 0.25, 0.5, or 1. Default 0.25 (back-compat). */
  voteWeightStep?: number;
  /** Allow landscape videos in the embedded comment composer's uploader. Default false. */
  allowLandscapeVideos?: boolean;
  /** When true, the vote slider + reply composer surface a blinking
   *  "Open Keychain App & Approve" hint while a broadcast is in
   *  flight. Set this when the logged-in user is on a wallet
   *  provider (Keychain, HiveAuth, PeakVault). */
  awaitingWalletApproval?: boolean;
  /** Called when comment button is clicked (e.g. open comments). */
  onComments?: () => void;
  /** Called when the Edit action is clicked. Pass only when the current
   *  user is the post's author — the kit renders the Edit entry-point
   *  iff this handler is provided. */
  onEdit?: () => void;
  /** Called when reblog is clicked (when logged in). */
  onReblog?: () => void;
  /** Called when re-snap is clicked (when logged in). Re-snap appends
   *  a new snap to the latest peak.snaps container whose body is a URL
   *  to the original snap — receivers render the original inline. */
  onReSnap?: () => void;
  /** Called when share is clicked. */
  onShare?: () => void;
  /** Called when tip is clicked (when logged in). */
  onTip?: () => void;
  /** Called when report is clicked (when logged in). */
  onReport?: () => void;
  /** Called when the user toggles the bookmark item inside the kebab.
   *  The kit doesn't fetch bookmark state itself — pass `isBookmarked`
   *  from the consumer's store and decide inside the handler whether
   *  to add or remove. Surfaces wherever the kebab does (inline kebab
   *  on the bar, or the owner kebab when `actionsAsMenu` is off). */
  onToggleBookmark?: () => void;
  /** Current bookmark state — controls the filled vs outline icon. */
  isBookmarked?: boolean;
  /** Called when delete is clicked. Pass only when the current user
   *  is the post's author — the kit renders the Delete entry-point
   *  iff this handler is provided. Lives inside the kebab popover
   *  (always — not as a standalone inline action), styled in red. */
  onDelete?: () => void;
  /** Called when user confirms comment upvote with (author, permlink, percent). Frontend handles signing. Voted comments show icon in blue. */
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  /** Tapping a voter inside the upvote-list dialog calls this with the
   *  account name so the consumer can open that user's profile. */
  onUserClick?: (username: string) => void;
  /** Builds a profile URL for each voter row so they render as real
   *  <a href> links (open-in-new-tab); paired with `onUserClick`. */
  getUserUrl?: (username: string) => string;
  /** Ecency image hosting token — enables image upload in comment composer */
  ecencyToken?: string;
  /** 3Speak API key — enables audio/video upload in comment composer */
  threeSpeakApiKey?: string;
  /** GIPHY API key — enables GIF search in comment composer */
  giphyApiKey?: string;
  /** HReplier API token — enables template picker in comment composer */
  templateToken?: string;
  /** Custom template API endpoint */
  templateApiBaseUrl?: string;
  /** When true, clicking the comment icon calls onComments instead of opening the CommentsModal popup */
  disableCommentsModal?: boolean;

  /** Called when the comment ICON is clicked. When set, the icon is
   *  rendered as its own button (separate from the count) — typical
   *  use is to open an inline reply composer. */
  onClickCommentIcon?: () => void;
  /** Called when the comment COUNT is clicked. When set, the count is
   *  rendered as its own button — typical use is to navigate into
   *  the post detail / comments view. */
  onClickCommentCount?: () => void;

  /** Pre-computed "current user has commented on this post" flag —
   *  typically derived from `post.replies` matching `${currentUser}/…`.
   *  When true, the comment icon is highlighted in red and a hover
   *  tooltip with the user's reply body is enabled. Mirrors hSnaps. */
  hasCommented?: boolean;
  /** `${author}/${permlink}` of the current user's reply on this post.
   *  Used to lazy-fetch the reply body the first time the user hovers
   *  the comment icon, so the tooltip can show what they wrote. */
  myReplyKey?: string;

  /** Post's `created` timestamp (ISO string from Hive). When supplied,
   *  the upvote button shows a "voting closed" warning and skips the
   *  vote slider once the post is past the 7-day payout window —
   *  Hive ignores votes cast after the cutoff. */
  postCreatedAt?: string;
  /** Action-bar density. `default` keeps the existing compact sizing
   *  (best for dense blog/feed lists). `lg` bumps every icon and the
   *  count labels — used by the Snaps feed where the action bar is
   *  the primary tap target. */
  size?: 'default' | 'lg';

  /** Collapse the secondary actions (reblog · share · tip · report)
   *  into a single 3-dot kebab popover. Upvote / comment counters and
   *  the payout chip stay inline. Useful in dense card layouts (videos,
   *  polls, community detail) where there isn't room for four icons. */
  actionsAsMenu?: boolean;
}

export function PostActionButton({
  author,
  permlink,
  currentUser: currentUserProp,
  hiveValue,
  hiveIconUrl,
  payoutTooltip,
  payoutDetails,
  initialVotes,
  initialVoteCount,
  initialCommentsCount,
  onUpvote,
  onSubmitComment,
  onComments,
  onEdit,
  onReblog,
  onReSnap,
  onShare,
  onTip,
  onReport,
  onToggleBookmark,
  isBookmarked = false,
  onDelete,
  onClickCommentUpvote,
  onUserClick,
  getUserUrl,
  ecencyToken,
  threeSpeakApiKey,
  giphyApiKey,
  templateToken,
  templateApiBaseUrl,
  disableCommentsModal,
  onClickCommentIcon,
  onClickCommentCount,
  hasCommented = false,
  myReplyKey,
  showVoteButton,
  parentTags,
  defaultReward,
  defaultBeneficiaries,
  beneficiaryFavorites,
  defaultVotePercent = 100,
  voteWeightStep = 0.25,
  allowLandscapeVideos = false,
  actionsAsMenu = false,
  awaitingWalletApproval = false,
  postCreatedAt,
  size = 'default',
}: PostActionButtonProps) {
  // Tailwind class fragments for the action bar's icon / count
  // sizing. Two presets so consumers can opt into bigger tap
  // targets without restyling each icon individually.
  // `lg` is mobile-only: it bumps icon size, padding, and gaps on
  // small screens so taps are easy on a snap card, but uses the
  // exact same `sm:` desktop values as the default density so the
  // desktop layout stays compact and consistent with other feeds.
  const iconSizeClass = size === 'lg'
    ? 'w-4 h-4 sm:w-4 sm:h-4'
    : 'w-3.5 h-3.5 sm:w-4 sm:h-4';
  const countTextClass = size === 'lg'
    ? 'text-sm sm:text-sm'
    : 'text-xs sm:text-sm';
  const hiveIconClass = size === 'lg' ? 'w-5 h-5 sm:w-4 sm:h-4 rounded-full' : 'w-4 h-4 rounded-full';
  const actionBtnPadClass = size === 'lg' ? 'p-1.5 sm:p-1' : 'p-0.5 sm:p-1';
  const inlineGapClass = size === 'lg' ? 'gap-1.5 sm:gap-0.5' : 'gap-0.5';
  const actionsGapClass = size === 'lg' ? 'gap-2.5 sm:gap-3' : 'gap-1.5 sm:gap-3';
  const upvoteBtnPadClass = size === 'lg' ? 'p-1.5 sm:p-1' : 'p-0.5 sm:p-1';
  const currentUser =
    currentUserProp == null || currentUserProp === ""
      ? null
      : currentUserProp;
  const isLoggedIn = currentUser != null;

  // Users can't flag their own post/comment. When the signed-in user is
  // the author, drop the report handler so neither the inline Flag icon
  // nor the "Flag" menu item renders. (The kit owns this guard so every
  // surface — feed cards, detail bar, snaps — behaves consistently.)
  const isOwnContent =
    !!currentUser && !!author && author.toLowerCase() === currentUser.toLowerCase();
  const reportHandler = isOwnContent ? undefined : onReport;

  const [votes, setVotes] = useState<ActiveVote[]>(initialVotes ?? []);
  // Displayed vote count is decoupled from the `votes` array because
  // the chain caps that array at 1000 entries; the canonical total
  // lives in `initialVoteCount` (= `post.stats.total_votes` /
  // `post.net_votes`). Falls back to the array length only when no
  // count was supplied.
  const [voteCount, setVoteCount] = useState<number>(
    initialVoteCount ?? initialVotes?.length ?? 0,
  );
  const [commentsCount, setCommentsCount] = useState(initialCommentsCount ?? 0);
  const [showVoteSlider, setShowVoteSlider] = useState(false);
  const [showUpvoteListModal, setShowUpvoteListModal] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: "",
    visible: false,
  });
  const [voteLoading, setVoteLoading] = useState(false);

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2500);
  }, []);

  const hasInitialVotes = initialVotes !== undefined;
  const hasInitialComments = initialCommentsCount !== undefined;

  const fetchVotes = useCallback(async () => {
    try {
      const list = await apiService.getActiveVotes(author, permlink);
      setVotes(list);
      // Only overwrite the canonical count from the array length
      // when no upstream count was supplied — otherwise we'd cap
      // the display at the 1000-entry chain limit.
      if (initialVoteCount === undefined) {
        setVoteCount(list.length);
      }
    } catch {
      // Silently fail — keep using initialVotes
    }
  }, [author, permlink, initialVoteCount]);

  // Only fetch from API if NO initial data was provided
  useEffect(() => {
    if (!hasInitialVotes) {
      fetchVotes();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author, permlink, hasInitialVotes]);

  useEffect(() => {
    if (!hasInitialComments) {
      apiService.getCommentsList(author, permlink).then((list) => {
        setCommentsCount(list.length);
      }).catch(() => { /* silently fail */ });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author, permlink, hasInitialComments]);

  const hasVoted =
    isLoggedIn &&
    !!currentUser &&
    votes.some((v) => v.voter.toLowerCase() === currentUser.toLowerCase());

  // ── "I already commented" hover preview (mirrors hSnaps PostCard) ───
  // When `hasCommented` is true and a `myReplyKey` is provided, hovering
  // the comment icon lazy-fetches the user's reply body and shows a
  // small tooltip with a plain-text excerpt. Falls back to "No preview
  // available" if the body comes back empty.
  const [showCommentPreview, setShowCommentPreview] = useState(false);
  const [myReplyBody, setMyReplyBody] = useState<string | null>(null);
  const [loadingMyReply, setLoadingMyReply] = useState(false);

  const handleCommentHoverEnter = () => {
    if (!hasCommented) return;
    setShowCommentPreview(true);
    if (myReplyBody !== null || loadingMyReply || !myReplyKey) return;
    const [rAuthor, rPermlink] = myReplyKey.split('/');
    if (!rAuthor || !rPermlink) return;
    setLoadingMyReply(true);

    // Direct JSON-RPC fetch against the user-selected node. We can't use
    // `apiService.getCommentsList` here because it filters out the
    // root post (returns only replies), so the user's own reply would
    // be excluded. `bridge.get_post` returns the post itself with its
    // body; `condenser_api.get_content` is the universal fallback.
    const fetchReplyBody = async (): Promise<string> => {
      const tryCall = async (api: string, method: string, params: unknown) => {
        const res = await fetch(getHiveApiEndpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: `${api}.${method}`, params, id: 1 }),
        });
        if (!res.ok) throw new Error(`Hive RPC ${res.status}`);
        const data = (await res.json()) as { result?: unknown; error?: { message: string } };
        if (data.error) throw new Error(data.error.message ?? 'Hive RPC error');
        return data.result as { body?: string } | null;
      };
      try {
        const r = await tryCall('bridge', 'get_post', { author: rAuthor, permlink: rPermlink });
        if (r && typeof r === 'object' && typeof r.body === 'string') return r.body;
      } catch {
        // fall through
      }
      try {
        const r = await tryCall('condenser_api', 'get_content', [rAuthor, rPermlink]);
        if (r && typeof r === 'object' && typeof r.body === 'string') return r.body;
      } catch {
        /* swallow */
      }
      return '';
    };

    fetchReplyBody()
      .then((body) => setMyReplyBody(body))
      .catch(() => setMyReplyBody(''))
      .finally(() => setLoadingMyReply(false));
  };

  const myReplyPreviewText = useMemo(() => {
    if (!myReplyBody) return '';
    let t = myReplyBody;
    // Strip the trailing "via Apps from" attribution that some clients
    // append to every comment. The full suffix is
    //   <br><sub>[via Apps from](https://linktr.ee/...)</sub>
    // Without this, the link-replacer below would keep the literal
    // "via Apps from" text and leak it into the hover preview.
    t = t.replace(
      /\s*(?:<br\s*\/?>)?\s*<sub>\s*\[via Apps from\]\([^)]+\)\s*<\/sub>\s*$/i,
      '',
    );
    // Catch a couple of other common attributions for good measure.
    t = t.replace(/\s*posted using.*$/i, '');
    // Strip markdown images, HTML tags, links, and condense whitespace
    // for a clean tooltip excerpt.
    t = t.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
    t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    t = t.replace(/<[^>]+>/g, '');
    t = t.replace(/https?:\/\/\S+/g, '');
    t = t.replace(/[*_~`#>-]+/g, ' ');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }, [myReplyBody]);

  const requireLogin = (action: string, onLoggedIn: () => void) => {
    if (!isLoggedIn && action !== "Comment") {
      showToast(`Please Login to ${action}`);
      return;
    }
    onLoggedIn();
  };

  const isPastVoteWindow = useMemo(
    () => isPostTooOldToVote(postCreatedAt),
    [postCreatedAt],
  );

  const handleUpvoteClick = () => {
    requireLogin("Upvote", () => {
      if (hasVoted) {
        showToast("You have already upvoted this post");
        return;
      }
      if (isPastVoteWindow) {
        showToast(VOTE_WINDOW_MESSAGE);
        return;
      }
      setShowVoteSlider(true);
    });
  };

  const handleVoteSubmit = async (percent: number) => {
    if (!onUpvote) return;
    setVoteLoading(true);
    try {
      await Promise.resolve(onUpvote(percent));
      setShowVoteSlider(false);
      showToast("Vote submitted successfully");
      // Optimistic count bump so the chip reflects the new vote
      // before the chain round-trip lands. `fetchVotes` below will
      // overwrite this with the canonical number once the active
      // votes propagate (~3-6 s on Hive).
      if (initialVoteCount === undefined) {
        setVoteCount((c) => c + 1);
      } else {
        // When the host owns the canonical count, leave it alone —
        // the next feed refresh will reseed it. Bumping locally
        // would double-count for hosts that re-render on success.
      }
      // Immediately fetch to try to pick up the new vote
      await fetchVotes();
      // Hive blockchain may take a few seconds to propagate — re-fetch after 4s
      setTimeout(() => {
        fetchVotes();
      }, 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to upvote";
      showToast(msg);
    } finally {
      setVoteLoading(false);
    }
  };

  const handleUpvoteCountClick = () => {
    setShowUpvoteListModal(true);
  };

  const handleUpvoteFromModal = () => {
    setShowUpvoteListModal(false);
    if (!isLoggedIn) { showToast("Please Login to Upvote"); return; }
    if (hasVoted) { showToast("You have already upvoted this post"); return; }
    if (isPastVoteWindow) { showToast(VOTE_WINDOW_MESSAGE); return; }
    setShowVoteSlider(true);
  };

  const handleCommentClick = () => {
    if (disableCommentsModal) {
      onComments?.();
      return;
    }
    requireLogin("Comment", () => {
      onComments?.();
      setShowCommentsModal(true);
    });
  };

  const handleReblogClick = () => {
    requireLogin("Reblog", () => onReblog?.());
  };

  const handleReSnapClick = () => {
    requireLogin("Re-snap", () => onReSnap?.());
  };

  const handleReportClick = () => {
    requireLogin("Report", () => onReport?.());
  };

  const handleTipClick = () => {
    requireLogin("Tip", () => onTip?.());
  };

  const handleShareClick = () => {
    if (onShare) {
      onShare();
      return;
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator
        .share({
          title: `${author}'s post`,
          url: `https://peakd.com/@${author}/${permlink}`,
          text: `Check out this post by @${author}`,
        })
        .then(() => showToast("Shared"))
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(
        `https://peakd.com/@${author}/${permlink}`
      );
      showToast("Link copied to clipboard");
    }
  };

  const handleCommentSubmit = async (
    parentAuthor: string,
    parentPermlink: string,
    body: string,
    voteWeight?: number | null,
    beneficiaries?: import('../../utils/beneficiaries').Beneficiary[],
  ) => {
    // if (!isLoggedIn) {
    //   showToast("Please Login to comment");
    //   return;
    // }
    if (!onSubmitComment) return;
    try {
      const result = await Promise.resolve(
        onSubmitComment(parentAuthor, parentPermlink, body, voteWeight ?? null, beneficiaries)
      );
      // If callback returns false, the operation was cancelled — don't show success toast
      if (result === false) return false;
      showToast("Comment posted");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to post comment";
      showToast(msg);
      throw err;
    }
  };

  // Hover tooltips for the action buttons were too noisy in dense feeds —
  // every icon hover was firing a small "Upvote / Comments / Reblog" pill.
  // The button `aria-label`s carry the same intent for screen readers, so
  // we suppress the visible tooltip entirely.
  const tooltipClass = "hidden";

  return (
    <div className={`flex items-center justify-between gap-2 sm:gap-4 w-full ${countTextClass}`}>
      {/* All action buttons */}
      <div className={`flex flex-wrap items-center justify-center shrink-0 ${actionsGapClass}`}>
      {/* Upvotes count + Upvote button */}
      <div className={`flex items-center ${inlineGapClass}`}>
        <div className="relative group">
          <span className={tooltipClass}>Upvote</span>
          <button
            type="button"
            onClick={handleUpvoteClick}
            disabled={voteLoading}
            className={`${upvoteBtnPadClass} rounded hover:bg-gray-700 disabled:opacity-50`}
            aria-label="Upvote"
          >
            {voteLoading ? (
              <Loader2 className={`${iconSizeClass} animate-spin text-blue-600`} />
            ) : (
              <ThumbsUp
                className={`${iconSizeClass} ${
                  hasVoted
                    ? "fill-[var(--hrk-brand)] text-[var(--hrk-brand)]"
                    : "text-gray-300"
                }`}
              />
            )}
          </button>
        </div>
        <div className="relative group">
          <span className={tooltipClass}>View upvotes</span>
          <button
            type="button"
            onClick={handleUpvoteCountClick}
            className={`flex items-center text-gray-300 hover:text-blue-400 transition-colors ${inlineGapClass} ${upvoteBtnPadClass} rounded hover:bg-gray-700/40`}
            aria-label="View upvotes"
          >
            <span>{voteCount}</span>
          </button>
        </div>
      </div>

      {/* Comments — split into icon + count when the host wires both
          handlers separately (matches the hSnaps PostCard pattern: tap
          the icon for an inline reply composer, tap the count to open
          the post detail). When `hasCommented` is true the icon is
          highlighted red and hover shows a preview of the user's
          reply, lazy-fetched on first hover. */}
      {onClickCommentIcon || onClickCommentCount ? (
        <div className={`relative group flex items-center text-gray-300 ${inlineGapClass}`}>
          <span className={tooltipClass}>Comments</span>
          <div
            className="relative"
            onMouseEnter={handleCommentHoverEnter}
            onMouseLeave={() => setShowCommentPreview(false)}
          >
            <button
              type="button"
              onClick={() => {
                if (onClickCommentIcon) onClickCommentIcon();
                else handleCommentClick();
              }}
              className={`rounded transition-colors hover:text-blue-400 ${actionBtnPadClass}`}
              aria-label={hasCommented ? "Reply to post (you've already commented)" : 'Reply to post'}
            >
              <MessageCircle
                className={`${iconSizeClass} ${
                  hasCommented ? 'fill-[var(--hrk-brand)] text-[var(--hrk-brand)]' : ''
                }`}
              />
            </button>
            {hasCommented && showCommentPreview && (
              <div className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-lg border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface-sunken)] p-3 shadow-xl">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--hrk-brand-fg-soft)]">
                  Your comment
                </p>
                {loadingMyReply && (
                  <p className="text-xs text-[var(--hrk-text-tertiary)]">Loading…</p>
                )}
                {!loadingMyReply && myReplyPreviewText && (
                  <p className="line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed text-[var(--hrk-text-secondary)]">
                    {myReplyPreviewText}
                  </p>
                )}
                {!loadingMyReply && !myReplyPreviewText && myReplyBody !== null && (
                  <p className="text-xs italic text-[var(--hrk-text-tertiary)]">No preview available.</p>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (onClickCommentCount) onClickCommentCount();
              else handleCommentClick();
            }}
            className={`rounded transition-colors ${actionBtnPadClass} ${
              hasCommented ? 'text-[var(--hrk-brand-fg-soft)]' : 'text-gray-300 hover:text-blue-400'
            }`}
            aria-label="Open comments"
          >
            {commentsCount}
          </button>
        </div>
      ) : (
        <div
          className="relative group"
          onMouseEnter={handleCommentHoverEnter}
          onMouseLeave={() => setShowCommentPreview(false)}
        >
          <span className={tooltipClass}>Comments</span>
          <button
            type="button"
            onClick={handleCommentClick}
            className={`flex items-center transition-colors hover:text-blue-400 rounded ${inlineGapClass} ${actionBtnPadClass} ${
              hasCommented ? 'text-[var(--hrk-brand-fg-soft)]' : 'text-gray-300'
            }`}
            aria-label="Comments"
          >
            <MessageCircle
              className={`${iconSizeClass} ${
                hasCommented ? 'fill-[var(--hrk-brand)] text-[var(--hrk-brand)]' : ''
              }`}
            />
            <span>{commentsCount}</span>
          </button>
          {hasCommented && showCommentPreview && (
            <div className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-lg border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface-sunken)] p-3 shadow-xl">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--hrk-brand-fg-soft)]">
                Your comment
              </p>
              {loadingMyReply && (
                <p className="text-xs text-[var(--hrk-text-tertiary)]">Loading…</p>
              )}
              {!loadingMyReply && myReplyPreviewText && (
                <p className="line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed text-[var(--hrk-text-secondary)]">
                  {myReplyPreviewText}
                </p>
              )}
              {!loadingMyReply && !myReplyPreviewText && myReplyBody !== null && (
                <p className="text-xs italic text-[var(--hrk-text-tertiary)]">No preview available.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Secondary actions — either inline icons (default) or collapsed
          into a single 3-dot kebab popover when `actionsAsMenu` is set. */}
      {actionsAsMenu ? (
        <MoreActionsMenu
          onEdit={onEdit}
          onReblog={onReblog ? handleReblogClick : undefined}
          onReSnap={onReSnap ? handleReSnapClick : undefined}
          onShare={handleShareClick}
          onTip={onTip ? handleTipClick : undefined}
          onReport={reportHandler ? handleReportClick : undefined}
          onToggleBookmark={onToggleBookmark}
          isBookmarked={isBookmarked}
          onDelete={onDelete}
        />
      ) : (
        <>
          {/* Reblog */}
          {onReblog && (
          <div className="relative group">
            <span className={tooltipClass}>Reblog</span>
            <button
              type="button"
              onClick={handleReblogClick}
              className={`flex items-center text-gray-300 hover:text-blue-400 transition-colors rounded ${inlineGapClass} ${actionBtnPadClass}`}
              aria-label="Reblog"
            >
              <Repeat2 className={iconSizeClass} />
            </button>
          </div>
          )}

          {/* Share */}
          <div className="relative group">
            <span className={tooltipClass}>Share</span>
            <button
              type="button"
              onClick={handleShareClick}
              className={`flex items-center text-gray-300 hover:text-blue-400 transition-colors rounded ${inlineGapClass} ${actionBtnPadClass}`}
              aria-label="Share"
            >
              <Share2 className={iconSizeClass} />
            </button>
          </div>

          {/* Report — hidden on the user's own content. */}
          {reportHandler && (
          <div className="relative group">
            <span className={tooltipClass}>Report</span>
            <button
              type="button"
              onClick={handleReportClick}
              className={`flex items-center text-gray-300 hover:text-red-400 transition-colors rounded ${inlineGapClass} ${actionBtnPadClass}`}
              aria-label="Report"
            >
              <Flag className={iconSizeClass} />
            </button>
          </div>
          )}

          {/* Tip */}
          {onTip && (
          <div className="relative group">
            <span className={tooltipClass}>Tip</span>
            <button
              type="button"
              onClick={handleTipClick}
              className={`flex items-center text-gray-300 hover:text-green-400 transition-colors rounded ${inlineGapClass} ${actionBtnPadClass}`}
              aria-label="Tip"
            >
              <Gift className={iconSizeClass} />
            </button>
          </div>
          )}

          {/* Owner kebab — small 3-dot menu containing the Edit and
              Delete actions for the author. Bookmark also rides here
              so users have access to it even when the surface uses
              the inline-icon layout (blog/profile rows). Rendered
              alongside the inline icons when `actionsAsMenu` is off
              (snap cards already collapse everything into their
              combined kebab via the props on MoreActionsMenu above). */}
          {(onEdit || onDelete || onToggleBookmark) && (
            <MoreActionsMenu
              onEdit={onEdit}
              onToggleBookmark={onToggleBookmark}
              isBookmarked={isBookmarked}
              onDelete={onDelete}
              ariaLabel="More post actions"
            />
          )}
        </>
      )}
      </div>

      {/* Hive Value at end. When `payoutDetails` is supplied, the chip
          becomes a tap target opening the full RewardsModal. The
          legacy hover tooltip path is preserved for callers that have
          not migrated to the structured breakdown yet. */}
      <div className="flex-1 flex justify-end min-w-0 shrink-0">
        {hiveValue != null && hiveValue !== "" && (
          payoutDetails ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowRewardsModal(true); }}
              className="flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-white/5"
              aria-label="Show rewards breakdown"
            >
              <span className={`font-semibold text-green-400 ${countTextClass}`}>
                {hiveValue}
              </span>
              {hiveIconUrl && (
                <img src={hiveIconUrl} alt="Hive" className={hiveIconClass} />
              )}
            </button>
          ) : (
            <div className="relative group">
              <div className="flex items-center gap-1 cursor-default">
                <span className={`font-semibold text-green-400 ${countTextClass}`}>
                  {hiveValue}
                </span>
                {hiveIconUrl && (
                  <img src={hiveIconUrl} alt="Hive" className={hiveIconClass} />
                )}
              </div>
              {payoutTooltip && (
                <div className="absolute right-0 bottom-full mb-2 w-64 px-3 py-2 text-xs text-gray-200 bg-gray-900 border border-gray-700 rounded-lg shadow-xl whitespace-pre-line opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 z-[60]">
                  {payoutTooltip}
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Vote slider overlay */}
      {showVoteSlider && (
        <VoteSlider
          author={author}
          permlink={permlink}
          defaultValue={defaultVotePercent}
          step={voteWeightStep}
          onUpvote={handleVoteSubmit}
          onCancel={() => setShowVoteSlider(false)}
          awaitingWalletApproval={awaitingWalletApproval}
        />
      )}

      {/* Rewards / beneficiaries modal */}
      {showRewardsModal && payoutDetails && (
        <RewardsModal
          onClose={() => setShowRewardsModal(false)}
          details={payoutDetails}
          hiveIconUrl={hiveIconUrl}
        />
      )}

      {/* Upvote list modal */}
      {showUpvoteListModal && (
        <UpvoteListModal
          author={author}
          permlink={permlink}
          onClose={() => setShowUpvoteListModal(false)}
          currentUser={currentUser ?? undefined}
          token={undefined}
          onClickUpvoteButton={handleUpvoteFromModal}
          hiveIconUrl={hiveIconUrl}
          onUserClick={onUserClick}
          getUserUrl={getUserUrl}
        />
      )}

      {/* Comments modal */}
      {showCommentsModal && (
        <CommentsModal
          author={author}
          permlink={permlink}
          onClose={() => {
            setShowCommentsModal(false);
            apiService.getCommentsList(author, permlink).then((list) => setCommentsCount(list.length));
          }}
          currentUser={currentUser ?? undefined}
          token={undefined}
          onSubmitComment={onSubmitComment ? handleCommentSubmit : undefined}
          onClickCommentUpvote={onClickCommentUpvote}
          ecencyToken={ecencyToken}
          threeSpeakApiKey={threeSpeakApiKey}
          giphyApiKey={giphyApiKey}
          templateToken={templateToken}
          templateApiBaseUrl={templateApiBaseUrl}
          showVoteButton={!!showVoteButton && !hasVoted}
          parentTags={parentTags}
          defaultReward={defaultReward}
          defaultBeneficiaries={defaultBeneficiaries}
          beneficiaryFavorites={beneficiaryFavorites}
          defaultVotePercent={defaultVotePercent}
          voteWeightStep={voteWeightStep}
          allowLandscapeVideos={allowLandscapeVideos}
          awaitingWalletApproval={awaitingWalletApproval}
        />
      )}

      {/* Toast */}
      {toast.visible && (
        <div className="fixed bottom-4 right-4 z-[100] max-w-[280px] rounded-lg bg-gray-900 text-white px-3 py-2 shadow-lg text-sm">
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default PostActionButton;
