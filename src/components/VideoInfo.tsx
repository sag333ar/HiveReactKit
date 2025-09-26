import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, ThumbsUp, Share2, Heart, Info, Eye, Users } from "lucide-react";
import { VideoFeedItem } from "@/types/video";
import { apiService } from "@/services/apiService";

interface VideoInfoProps {
  title: string;
  author: string;
  permlink: string;
  createdAt?: Date;
  video: VideoFeedItem;
  currentUser?: string;
  isContentVoted?: boolean;
  description?: string;
  onTapComment?: (author: string, permlink: string) => void;
  onTapUpvote?: (author: string, permlink: string) => void;
  onTapShare?: (author: string, permlink: string) => void;
  onTapBookmark?: (author: string, permlink: string) => void;
  onTapAuthor?: (author: string, permlink: string) => void;
  onTapInfo?: (author: string, permlink: string) => void;
}

const contentCache = new Map<string, { comments: number; upvotes: number }>();

const VideoInfo = ({
  title,
  author,
  permlink,
  createdAt,
  video,
  currentUser,
  isContentVoted = false,
  description,
  onTapComment,
  onTapUpvote,
  onTapShare,
  onTapBookmark,
  onTapAuthor,
  onTapInfo,
}: VideoInfoProps) => {
  const [comments, setComments] = useState<number>(video.numOfComments || 0);
  const [upvotes, setUpvotes] = useState<number>(video.numOfUpvotes || 0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const getCacheKey = (author: string, permlink: string) =>
    `${author}:${permlink}`;

  useEffect(() => {
    const cacheKey = getCacheKey(author, permlink);
    const cachedStats = contentCache.get(cacheKey);
    if (cachedStats) {
      setComments(cachedStats.comments);
      setUpvotes(cachedStats.upvotes);
    } else {
      const fetchStats = async () => {
        const stats = await apiService.getContentStats(author, permlink);
        setUpvotes(stats.numOfUpvotes);
        setComments(stats.numOfComments);
        contentCache.set(getCacheKey(author, permlink), {
          comments: stats.numOfComments,
          upvotes: stats.numOfUpvotes,
        });
      };
      fetchStats();
    }
  }, [author, permlink]);

  const handleComment = () => {
    if (onTapComment) {
      onTapComment(author, permlink);
    } else {
      showToastMessage("Comments feature coming soon!");
    }
  };

  const handleUpvote = () => {
    if (onTapUpvote) {
      onTapUpvote(author, permlink);
    } else {
      showToastMessage("Upvote feature requires authentication!");
    }
  };

  const handleShare = () => {
    if (onTapShare) {
      onTapShare(author, permlink);
    } else {
      const url = `https://3speak.tv/user/${author}/${permlink}`;
      if (navigator.share) {
        navigator.share({ title, url });
      } else {
        navigator.clipboard.writeText(url);
        showToastMessage("Link copied to clipboard!");
      }
    }
  };

  const handleBookmark = () => {
    if (onTapBookmark) {
      onTapBookmark(author, permlink);
    } else {
      setIsBookmarked(!isBookmarked);
      showToastMessage(
        isBookmarked ? "Removed from bookmarks" : "Added to bookmarks"
      );
    }
  };

  const handleAuthor = () => onTapAuthor?.(author, permlink);

  const handleInfo = () => {
    if (onTapInfo) {
      onTapInfo(author, permlink);
    } else {
      showToastMessage("Video details coming soon!");
    }
  };

  return (
    <>
      <div className="p-6 bg-card border-b border-border">
        {/* Title */}
        <h1 className="text-xl font-bold text-card-foreground mb-4 line-clamp-2">
          {title}
        </h1>

        <div className="flex items-start gap-4">
          {/* Author Avatar */}
          <button
            onClick={handleAuthor}
            className="flex-shrink-0 group"
          >
            <img
              src={`https://images.hive.blog/u/${author}/avatar`}
              alt={author}
              className="w-12 h-12 rounded-full object-cover border-2 border-border group-hover:border-primary transition-all duration-200"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  `https://ui-avatars.com/api/?name=${author}&background=random`;
              }}
            />
          </button>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <button
                  onClick={handleAuthor}
                  className="font-semibold text-card-foreground hover:text-primary transition-colors text-base"
                >
                  @{author}
                </button>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  {video.views && (
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{video.views.toLocaleString()} views</span>
                    </div>
                  )}
                  {createdAt && (
                    <span>
                      {formatDistanceToNow(createdAt, { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Info Button */}
              <button
                type="button"
                onClick={handleInfo}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all duration-200"
                aria-label="Show description"
              >
                <Info className="w-4 h-4" />
                <span className="text-sm font-medium">Info</span>
              </button>

              {/* Comment Button */}
              <button
                type="button"
                onClick={handleComment}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all duration-200"
                aria-label="Show comments"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{comments}</span>
              </button>

              {/* Upvote Button */}
              <button
                type="button"
                onClick={handleUpvote}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                  isContentVoted
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                }`}
                aria-label="Show upvotes"
              >
                <ThumbsUp
                  className={`w-4 h-4 ${isContentVoted ? "fill-current" : ""}`}
                />
                <span className="text-sm font-medium">{upvotes}</span>
              </button>

              {/* Share Button */}
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground hover:bg-secondary/10 hover:text-secondary transition-all duration-200"
                aria-label="Share video"
              >
                <Share2 className="w-4 h-4" />
                <span className="text-sm font-medium">Share</span>
              </button>

              {/* Bookmark Button */}
              <button
                type="button"
                onClick={handleBookmark}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                  isBookmarked
                    ? "bg-error/10 text-error"
                    : "bg-muted text-muted-foreground hover:bg-error/10 hover:text-error"
                }`}
                aria-label="Bookmark video"
              >
                <Heart
                  className={`w-4 h-4 ${isBookmarked ? "fill-current" : ""}`}
                />
                <span className="text-sm font-medium">
                  {isBookmarked ? "Saved" : "Save"}
                </span>
              </button>
            </div>

            {/* Video Stats */}
            {(video.hiveValue || video.category) && (
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
                {video.hiveValue && video.hiveValue > 0 && (
                  <div className="flex items-center gap-1 text-success font-semibold">
                    <span>${video.hiveValue.toFixed(2)} earned</span>
                  </div>
                )}
                {video.category && (
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground capitalize">
                      {video.category}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div className="bg-card border border-border text-card-foreground rounded-lg px-4 py-3 shadow-lg max-w-sm">
            <div className="font-medium">{toastMessage}</div>
          </div>
        </div>
      )}
    </>
  );
};

export default VideoInfo;