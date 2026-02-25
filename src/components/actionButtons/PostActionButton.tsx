import { useState, useEffect, useCallback } from "react";
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

export interface PostActionButtonProps {
  author: string;
  permlink: string;
  /** Current logged-in username; null or '' means not logged in */
  currentUser?: string | null;
  /** Optional: Hive payout/value to display */
  hiveValue?: number;
  /** Called when user confirms vote with percent (1–100). Frontend handles signing/broadcast. */
  onUpvote?: (percent: number) => void | Promise<void>;
  /** Called when user submits a comment. Frontend handles signing/broadcast. */
  onSubmitComment?: (
    parentAuthor: string,
    parentPermlink: string,
    body: string
  ) => void | Promise<void>;
  /** Called when comment button is clicked (e.g. open comments). */
  onComments?: () => void;
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
}

export function PostActionButton({
  author,
  permlink,
  currentUser: currentUserProp,
  hiveValue = 0,
  onUpvote,
  onSubmitComment,
  onComments,
  onReblog,
  onShare,
  onTip,
  onReport,
  onClickCommentUpvote,
}: PostActionButtonProps) {
  const currentUser =
    currentUserProp == null || currentUserProp === ""
      ? null
      : currentUserProp;
  const isLoggedIn = currentUser != null;

  const [votes, setVotes] = useState<ActiveVote[]>([]);
  const [commentsCount, setCommentsCount] = useState(0);
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

  const fetchVotes = useCallback(async () => {
    const list = await apiService.getActiveVotes(author, permlink);
    setVotes(list);
  }, [author, permlink]);

  useEffect(() => {
    fetchVotes();
  }, [fetchVotes]);

  useEffect(() => {
    apiService.getCommentsList(author, permlink).then((list) => {
      setCommentsCount(list.length);
    });
  }, [author, permlink]);

  const hasVoted =
    isLoggedIn &&
    !!currentUser &&
    votes.some((v) => v.voter.toLowerCase() === currentUser.toLowerCase());

  const requireLogin = (action: string, onLoggedIn: () => void) => {
    if (!isLoggedIn) {
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
      await fetchVotes();
      showToast("Vote submitted successfully");
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
    body: string
  ) => {
    if (!isLoggedIn) {
      showToast("Please Login to comment");
      return;
    }
    if (!onSubmitComment) return;
    try {
      await Promise.resolve(
        onSubmitComment(parentAuthor, parentPermlink, body)
      );
      showToast("Comment posted");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to post comment";
      showToast(msg);
      throw err;
    }
  };

  const tooltipClass =
    "absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs font-medium text-white bg-gray-800 dark:bg-gray-700 rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-[60]";

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
      {/* Upvotes count + Upvote button */}
      <div className="flex items-center gap-1">
        <div className="relative group">
          <span className={tooltipClass}>Upvote</span>
          <button
            type="button"
            onClick={handleUpvoteClick}
            disabled={voteLoading}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            aria-label="Upvote"
          >
            {voteLoading ? (
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-blue-600" />
            ) : (
              <ThumbsUp
                className={`w-4 h-4 sm:w-5 sm:h-5 ${
                  hasVoted
                    ? "text-blue-600 dark:text-blue-400 fill-current"
                    : "text-gray-600 dark:text-gray-400"
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
            className="flex items-center gap-1 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            aria-label="View upvotes"
          >
            <span>{votes.length}</span>
          </button>
        </div>
      </div>

      {/* Comments */}
      <div className="relative group">
        <span className={tooltipClass}>Comments</span>
        <button
          type="button"
          onClick={handleCommentClick}
          className="flex items-center gap-1 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          aria-label="Comments"
        >
          <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>{commentsCount}</span>
        </button>
      </div>

      {/* Reblog */}
      <div className="relative group">
        <span className={tooltipClass}>Reblog</span>
        <button
          type="button"
          onClick={handleReblogClick}
          className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1 rounded"
          aria-label="Reblog"
        >
          <Repeat2 className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* Share */}
      <div className="relative group">
        <span className={tooltipClass}>Share</span>
        <button
          type="button"
          onClick={handleShareClick}
          className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1 rounded"
          aria-label="Share"
        >
          <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* Report */}
      <div className="relative group">
        <span className={tooltipClass}>Report</span>
        <button
          type="button"
          onClick={handleReportClick}
          className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1 rounded"
          aria-label="Report"
        >
          <Flag className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* Tip */}
      <div className="relative group">
        <span className={tooltipClass}>Tip</span>
        <button
          type="button"
          onClick={handleTipClick}
          className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors p-1 rounded"
          aria-label="Tip"
        >
          <Gift className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* Hive Value */}
      {hiveValue > 0 && (
        <span className="font-semibold text-green-600 dark:text-green-400">
          ${hiveValue.toFixed(2)}
        </span>
      )}

      {/* Vote slider overlay */}
      {showVoteSlider && (
        <VoteSlider
          author={author}
          permlink={permlink}
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
        />
      )}

      {/* Toast */}
      {toast.visible && (
        <div className="fixed bottom-4 right-4 z-[100] max-w-[280px] rounded-lg bg-gray-800 dark:bg-gray-900 text-white px-3 py-2 shadow-lg text-sm">
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default PostActionButton;
