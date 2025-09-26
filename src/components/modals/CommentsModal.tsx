import { useState, useEffect } from "react";
import { apiService } from "@/services/apiService";
import { Discussion } from "@/types/comment";
import Modal from "./Modal";
import { MessageCircle, Loader2, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CommentsModalProps {
  author: string;
  permlink: string;
  currentUser?: string;
  onClose: () => void;
}

const CommentsModal = ({ author, permlink, currentUser, onClose }: CommentsModalProps) => {
  const [comments, setComments] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        setLoading(true);
        const commentsList = await apiService.getCommentsList(author, permlink);
        // Filter out the main post and sort by creation date
        const filteredComments = commentsList
          .filter(comment => comment.depth && comment.depth > 0)
          .sort((a, b) => new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime());
        setComments(filteredComments);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load comments");
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [author, permlink]);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUser) return;

    try {
      setSubmitting(true);
      // This would require authentication - showing placeholder for now
      console.log("Would submit comment:", newComment);
      setNewComment("");
      // In real implementation, refresh comments after successful submission
    } catch (err) {
      console.error("Failed to submit comment:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const renderComment = (comment: Discussion) => {
    const indentLevel = Math.min(comment.depth || 0, 5);
    
    return (
      <div
        key={`${comment.author}-${comment.permlink}`}
        className={`border-l-2 border-border ${indentLevel > 0 ? `ml-${indentLevel * 4}` : ""}`}
      >
        <div className="p-4 bg-muted/30 rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <img
              src={`https://images.hive.blog/u/${comment.author}/avatar`}
              alt={comment.author}
              className="w-6 h-6 rounded-full object-cover border border-border"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${comment.author}&background=random`;
              }}
            />
            <span className="font-medium text-card-foreground text-sm">
              @{comment.author}
            </span>
            {comment.created && (
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.created), { addSuffix: true })}
              </span>
            )}
          </div>
          <div className="text-sm text-card-foreground leading-relaxed">
            {comment.body || "No content"}
          </div>
          {comment.net_votes && comment.net_votes > 0 && (
            <div className="flex items-center gap-1 mt-2">
              <span className="text-xs text-muted-foreground">
                {comment.net_votes} votes
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Comments (${comments.length})`}
      maxWidth="max-w-2xl"
    >
      <div className="p-6">
        {/* Comment Input */}
        {currentUser && (
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-start gap-3">
              <img
                src={`https://images.hive.blog/u/${currentUser}/avatar`}
                alt={currentUser}
                className="w-8 h-8 rounded-full object-cover border border-border"
              />
              <div className="flex-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="w-full p-3 bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || submitting}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">
                      {submitting ? "Posting..." : "Post Comment"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Comments List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading comments...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-error">{error}</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No comments yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Be the first to share your thoughts!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map(renderComment)}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CommentsModal;