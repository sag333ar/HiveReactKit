import React, { useEffect, useState, useCallback } from 'react';
import { apiService } from '@/services/apiService';
import { Discussion } from '@/types/comment';
import { MessageCircle, Loader2, AlertCircle, RefreshCw, MessageCirclePlus } from 'lucide-react';
import CommentTile from './comments/CommentTile';
import AddCommentInput from './comments/AddCommentInput';

interface CommentsListProps {
  author: string;
  permlink: string;
  currentUser?: string;
  token?: string;
  onClickUpvoteButton?: (currentUser?: string, token?: string) => void;
  onClickCommentUpvote?: (comment: Discussion) => void;
  onClickCommentReply?: (comment: Discussion) => void;
}

export function CommentsList({
  author,
  permlink,
  currentUser,
  token,
  onClickUpvoteButton,
  onClickCommentUpvote,
  onClickCommentReply,
}: CommentsListProps) {
  const [comments, setComments] = useState<Discussion[]>([]);
  const [filteredComments, setFilteredComments] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddComment, setShowAddComment] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ author: string; permlink: string } | null>(null);

  const fetchComments = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const fetchedComments = await apiService.getCommentsList(author, permlink);
      setComments(fetchedComments);
      setFilteredComments(fetchedComments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [author, permlink]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleCommentSubmitted = async (parentAuthor: string, parentPermlink: string, body: string) => {
    if (!token) {
      alert('Please login to comment');
      return;
    }
    try {
      await apiService.handleComment({
        author: parentAuthor,
        permlink: parentPermlink,
        body,
        authToken: token,
      });
      setShowAddComment(false);
      setReplyingTo(null);
      setIsRefreshing(true);
      setTimeout(async () => {
        await fetchComments(true);
        setIsRefreshing(false);
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to post comment';
      alert(message);
    }
  };

  const handleReply = (parentAuthor: string, parentPermlink: string) => {
    setReplyingTo({ author: parentAuthor, permlink: parentPermlink });
  };

  const topLevelComments = filteredComments.filter(c => !(c.author === author && c.permlink === permlink));

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Failed to load comments
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
        <button
          onClick={() => fetchComments()}
          className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with refresh and add comment */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Comments ({topLevelComments.length})
          </h3>
          {isRefreshing && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchComments(true)}
            disabled={isRefreshing}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50"
            title="Refresh comments"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 dark:text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          {currentUser && (
            <button
              onClick={() => {
                if (onClickCommentReply) {
                  onClickCommentReply({ author, permlink } as any);
                } else {
                  setShowAddComment(!showAddComment);
                }
              }}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
              title="Add comment"
            >
              <MessageCirclePlus className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Add Comment Input */}
      {showAddComment && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
          <AddCommentInput
            onSubmit={(body) => handleCommentSubmitted(author, permlink, body)}
            onCancel={() => setShowAddComment(false)}
            currentUser={currentUser}
            placeholder="Add a comment..."
          />
        </div>
      )}

      {/* Reply Input */}
      {replyingTo && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
          <AddCommentInput
            onSubmit={(body) => handleCommentSubmitted(replyingTo.author, replyingTo.permlink, body)}
            onCancel={() => setReplyingTo(null)}
            currentUser={currentUser}
            placeholder={`Reply to @${replyingTo.author}...`}
          />
        </div>
      )}

      {/* Comments List */}
      {topLevelComments.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 p-8">
          <MessageCirclePlus className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No comments yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Be the first to share your thoughts!
          </p>
          {!showAddComment && currentUser && (
            <button
              onClick={() => setShowAddComment(true)}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors duration-200"
            >
              Add Comment
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {topLevelComments.map((comment) => (
            <CommentTile
              key={comment.permlink}
              comment={comment}
              allComments={filteredComments}
              onReply={handleReply}
              currentUser={currentUser}
              token={token}
              searchQuery=""
              depth={0}
              onVotedRefresh={() => fetchComments(true)}
              onClickCommentUpvote={onClickCommentUpvote}
              onClickCommentReply={onClickCommentReply}
              onClickUpvoteButton={onClickUpvoteButton}
            />
          ))}
        </div>
      )}
    </div>
  );
}
