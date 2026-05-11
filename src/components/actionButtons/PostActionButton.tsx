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
import CommentsModal from "@/components/comments/CommentsModal";
import { apiService } from "@/services/apiService";
import { ActiveVote } from "@/types/video";
import { getHiveApiEndpoint } from "@/config/hiveEndpoint";
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
  /** Optional: Tooltip text shown on hover over the payout value (e.g. payout breakdown) */
  payoutTooltip?: string;
  /** Optional: Pre-loaded active votes array from the Post object. Skips the API call when provided. */
  initialVotes?: ActiveVote[];
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
  /** Called when comment button is clicked (e.g. open comments). */
  onComments?: () => void;
  /** Called when the Edit action is clicked. Pass only when the current
   *  user is the post's author — the kit renders the Edit entry-point
   *  iff this handler is provided. */
  onEdit?: () => void;
  /** Called when reblog is clicked (when logged in). */
  onReblog?: () => void;
  /** Called when share is clicked. */
  onShare?: () => void;
  /** Called when tip is clicked (when logged in). */
  onTip?: () => void;
  /** Called when report is clicked (when logged in). */
  onReport?: () => void;
  /** Called when user confirms comment upvote with (author, permlink, percent). Frontend handles signing. Voted comments show icon in blue. */
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
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
  initialVotes,
  initialCommentsCount,
  onUpvote,
  onSubmitComment,
  onComments,
  onEdit,
  onReblog,
  onShare,
  onTip,
  onReport,
  onClickCommentUpvote,
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
}: PostActionButtonProps) {
  const currentUser =
    currentUserProp == null || currentUserProp === ""
      ? null
      : currentUserProp;
  const isLoggedIn = currentUser != null;

  const [votes, setVotes] = useState<ActiveVote[]>(initialVotes ?? []);
  const [commentsCount, setCommentsCount] = useState(initialCommentsCount ?? 0);
  const [showVoteSlider, setShowVoteSlider] = useState(false);
  const [showUpvoteListModal, setShowUpvoteListModal] = useState(false);
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
    } catch {
      // Silently fail — keep using initialVotes
    }
  }, [author, permlink]);

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

  const handleUpvoteClick = () => {
    requireLogin("Upvote", () => {
      if (hasVoted) {
        showToast("You have already upvoted this post");
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
    if (isLoggedIn && !hasVoted) setShowVoteSlider(true);
    else if (!isLoggedIn) showToast("Please Login to Upvote");
    else showToast("You have already upvoted this post");
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

  const tooltipClass =
    "absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs font-medium text-white bg-gray-700 rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-[60]";

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-4 text-xs sm:text-sm w-full">
      {/* All action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-3 shrink-0">
      {/* Upvotes count + Upvote button */}
      <div className="flex items-center gap-0.5">
        <div className="relative group">
          <span className={tooltipClass}>Upvote</span>
          <button
            type="button"
            onClick={handleUpvoteClick}
            disabled={voteLoading}
            className="p-0.5 sm:p-1 rounded hover:bg-gray-700 disabled:opacity-50"
            aria-label="Upvote"
          >
            {voteLoading ? (
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-blue-600" />
            ) : (
              <ThumbsUp
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                  hasVoted
                    ? "fill-[#e31337] text-[#e31337]"
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
            className="flex items-center gap-0.5 text-gray-300 hover:text-blue-400 transition-colors"
            aria-label="View upvotes"
          >
            <span>{votes.length}</span>
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
        <div className="relative group flex items-center gap-0.5 text-gray-300">
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
              className="rounded p-0.5 transition-colors hover:text-blue-400"
              aria-label={hasCommented ? "Reply to post (you've already commented)" : 'Reply to post'}
            >
              <MessageCircle
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                  hasCommented ? 'fill-[#e31337] text-[#e31337]' : ''
                }`}
              />
            </button>
            {hasCommented && showCommentPreview && (
              <div className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-lg border border-[#3a424a] bg-[#1f2429] p-3 shadow-xl">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#ff8fa3]">
                  Your comment
                </p>
                {loadingMyReply && (
                  <p className="text-xs text-[#9ca3b0]">Loading…</p>
                )}
                {!loadingMyReply && myReplyPreviewText && (
                  <p className="line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed text-[#e7e7f1]">
                    {myReplyPreviewText}
                  </p>
                )}
                {!loadingMyReply && !myReplyPreviewText && myReplyBody !== null && (
                  <p className="text-xs italic text-[#9ca3b0]">No preview available.</p>
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
            className={`rounded px-0.5 text-xs transition-colors ${
              hasCommented ? 'text-[#ff8fa3]' : 'text-gray-300 hover:text-blue-400'
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
            className={`flex items-center gap-0.5 transition-colors hover:text-blue-400 ${
              hasCommented ? 'text-[#ff8fa3]' : 'text-gray-300'
            }`}
            aria-label="Comments"
          >
            <MessageCircle
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                hasCommented ? 'fill-[#e31337] text-[#e31337]' : ''
              }`}
            />
            <span>{commentsCount}</span>
          </button>
          {hasCommented && showCommentPreview && (
            <div className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-lg border border-[#3a424a] bg-[#1f2429] p-3 shadow-xl">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#ff8fa3]">
                Your comment
              </p>
              {loadingMyReply && (
                <p className="text-xs text-[#9ca3b0]">Loading…</p>
              )}
              {!loadingMyReply && myReplyPreviewText && (
                <p className="line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed text-[#e7e7f1]">
                  {myReplyPreviewText}
                </p>
              )}
              {!loadingMyReply && !myReplyPreviewText && myReplyBody !== null && (
                <p className="text-xs italic text-[#9ca3b0]">No preview available.</p>
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
          onShare={handleShareClick}
          onTip={onTip ? handleTipClick : undefined}
          onReport={onReport ? handleReportClick : undefined}
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
              className="flex items-center gap-0.5 text-gray-300 hover:text-blue-400 transition-colors p-0.5 sm:p-1 rounded"
              aria-label="Reblog"
            >
              <Repeat2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
          )}

          {/* Share */}
          <div className="relative group">
            <span className={tooltipClass}>Share</span>
            <button
              type="button"
              onClick={handleShareClick}
              className="flex items-center gap-0.5 text-gray-300 hover:text-blue-400 transition-colors p-0.5 sm:p-1 rounded"
              aria-label="Share"
            >
              <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* Report */}
          {onReport && (
          <div className="relative group">
            <span className={tooltipClass}>Report</span>
            <button
              type="button"
              onClick={handleReportClick}
              className="flex items-center gap-0.5 text-gray-300 hover:text-red-400 transition-colors p-0.5 sm:p-1 rounded"
              aria-label="Report"
            >
              <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
              className="flex items-center gap-0.5 text-gray-300 hover:text-green-400 transition-colors p-0.5 sm:p-1 rounded"
              aria-label="Tip"
            >
              <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
          )}

          {/* Owner kebab — small 3-dot menu containing the Edit action
              for the author. Rendered alongside the inline icons when
              `actionsAsMenu` is off (snap cards already collapse Edit
              into their combined kebab via `onEdit` on MoreActionsMenu). */}
          {onEdit && (
            <MoreActionsMenu onEdit={onEdit} ariaLabel="More post actions" />
          )}
        </>
      )}
      </div>

      {/* Hive Value at end with icon and tooltip */}
      <div className="flex-1 flex justify-end min-w-0 shrink-0">
        {hiveValue != null && hiveValue !== "" && (
          <div className="relative group">
            <div className="flex items-center gap-1 cursor-default">
              <span className="font-semibold text-green-400 text-xs sm:text-sm">
                {hiveValue}
              </span>
              {hiveIconUrl && (
                <img src={hiveIconUrl} alt="Hive" className="w-4 h-4 rounded-full" />
              )}
            </div>
            {payoutTooltip && (
              <div className="absolute right-0 bottom-full mb-2 w-64 px-3 py-2 text-xs text-gray-200 bg-gray-900 border border-gray-700 rounded-lg shadow-xl whitespace-pre-line opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 z-[60]">
                {payoutTooltip}
              </div>
            )}
          </div>
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
