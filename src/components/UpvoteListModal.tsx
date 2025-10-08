import { useEffect, useState } from "react";
import { apiService } from "@/services/apiService";
import { ActiveVote } from "@/types/video";
import { ThumbsUp } from "lucide-react";
import { VoteSlider } from "./VoteSlider"

interface UpvoteListModalProps {
  author: string;
  permlink: string;
  onClose: () => void;
  currentUser?: string;
  token?: string;
  onClickUpvoteButton?: (currentUser?: string, token?: string) => void;
}

export function formatTimeAgo(date: string | Date): string {
  const _date = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - _date.getTime()) / 1000);
  const intervals: Record<string, number> = {
    year: 31536000,
    month: 2628000,
    day: 86400,
    hour: 3600,
    minute: 60,
  };
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval > 1) return `${interval} ${unit}s ago`;
    if (interval === 1) return `${interval} ${unit} ago`;
  }
  return "just now";
}

const UpvoteListModal = ({ author, permlink, onClose, currentUser, token, onClickUpvoteButton }: UpvoteListModalProps) => {
  const [votes, setVotes] = useState<ActiveVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVoteSlider, setShowVoteSlider] = useState(false);
  const hasAlreadyVoted = !!currentUser && votes.some(v => v.voter === currentUser);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastOpen(true);
    setTimeout(() => setToastOpen(false), 2500);
  };

  const refreshVotes = async () => {
    setLoading(true);
    const fetchedVotes = await apiService.getActiveVotes(author, permlink);
    fetchedVotes.sort((a, b) => {
      if (!a.time || !b.time) return 0;
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    });
    setVotes(fetchedVotes);
    setLoading(false);
  };

  useEffect(() => {
    refreshVotes();
  }, [author, permlink]);

  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleUpvote = async (percent: number) => {
    if (!token || !currentUser) {
      alert("Please login to upvote");
      return;
    }
    try {
      // Hive expects weight in hundredths of a percent (-10000..10000)
      const weight = Math.round(percent * 100);
      await apiService.handleUpvote({
        author,
        permlink,
        weight,
        authToken: token,
      });
      setShowVoteSlider(false);
      setIsRefreshing(true);
      setTimeout(async () => {
        await refreshVotes();
        setIsRefreshing(false);
        showToast("Vote submitted successfully ✅");
        onClose();
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upvote";
      alert(message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4 h-screen"
      onClick={onOverlayClick}
    >
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <span>Voters ({votes.length})</span>
            {isRefreshing && (
              <span className="inline-flex items-center ml-2">
                <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
              </span>
            )}
          </h2>
          {!showVoteSlider && (
            <button
              onClick={() => {
                if (onClickUpvoteButton) {
                  onClickUpvoteButton(currentUser, token);
                  return;
                }

                if (!currentUser || !token) {
                  // User not logged in → show login message
                  showToast("Please login to upvote");
                  return;
                }

                if (hasAlreadyVoted) {
                  showToast('You have already upvoted this post');
                } else {
                  setShowVoteSlider(true);
                }
              }}
              aria-label="Open Vote Slider"
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              type="button"
            >
              <ThumbsUp className={`w-5 h-5 ${hasAlreadyVoted ? 'text-blue-600 dark:text-blue-400 fill-current' : 'text-gray-600 dark:text-gray-300'}`} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center h-full p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : showVoteSlider && !hasAlreadyVoted ? (
            <VoteSlider
              author={author}
              permlink={permlink}
              onUpvote={handleUpvote}
              onCancel={() => setShowVoteSlider(false)}
            />
          ) : (
            <ul>
              {votes.map((vote) => (
                <li key={vote.voter} className="flex items-center p-4 border-b dark:border-gray-700">
                  <img
                    src={`https://images.hive.blog/u/${vote.voter}/avatar`}
                    alt={vote.voter}
                    className="w-10 h-10 rounded-full mr-4"
                    onError={(e) => {
                      (
                        e.target as HTMLImageElement
                      ).src = `https://ui-avatars.com/api/?name=${vote.voter}&background=random`;
                    }}
                  />
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {vote.voter}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {((vote.percent || 0) / 100).toFixed(0)}%
                      {vote.time && ` · ${formatTimeAgo(vote.time + "Z")}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {toastOpen && (
        <div className="fixed bottom-4 right-4 w-[280px] z-50">
          <div className="bg-gray-800 text-white rounded px-3 py-2 shadow-lg text-sm">
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
};

export default UpvoteListModal;
