import React, { useEffect, useState, useCallback } from 'react';
import { apiService } from '@/services/apiService';
import { Discussion } from '@/types/comment';
import { X, Search, MessageCirclePlus, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import CommentTile from './CommentTile';
import ReplyModal from './ReplyModal';
import CommentSearchBar from './CommentSearchBar';
import AddCommentInput from './AddCommentInput';

interface CommentsModalProps {
  author: string;
  permlink: string;
  onClose: () => void;
  currentUser?: string;
  token?: string;
  onClickCommentUpvote?: (comment: Discussion) => void;
  onClickCommentReply?: (comment: Discussion) => void;
  onClickUpvoteButton?: (currentUser?: string, token?: string) => void;
}

const CommentsModal = ({ author, permlink, onClose, currentUser, token, onClickCommentUpvote, onClickCommentReply, onClickUpvoteButton }: CommentsModalProps) => {
  const [comments, setComments] = useState<Discussion[]>([]);
  const [filteredComments, setFilteredComments] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ author: string; permlink: string } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddComment, setShowAddComment] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredComments(comments);
    } else {
      const filtered = comments.filter(comment =>
        comment.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        comment.author.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredComments(filtered);
    }
  }, [searchQuery, comments]);

  const handleReply = (parentAuthor: string, parentPermlink: string) => {
    setReplyingTo({ author: parentAuthor, permlink: parentPermlink });
  };

  // Handler for overlay clicks
  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

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

  const topLevelComments = filteredComments.filter(c => c.author === author && c.permlink === permlink);


  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col">
          <div className="flex justify-center items-center h-full">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-300">Loading comments...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40 p-4 h-screen"
        onClick={onOverlayClick}
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
          <div className="flex justify-center items-center h-full">
            <div className="text-center p-6">
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40 p-4 h-screen"
        onClick={onOverlayClick}  // <-- Add listener here
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">{/* Header */}
          <div className="flex justify-between items-center p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                Comments ({comments.length - 1})
              </h2>
              {isRefreshing && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => fetchComments(true)}
                disabled={isRefreshing}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50"
                title="Refresh comments"
              >
                <RefreshCw className={`w-5 h-5 text-gray-500 dark:text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                title="Search comments"
              >
                <Search className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <CommentSearchBar
            isVisible={showSearch}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onClose={() => setShowSearch(false)}
          />

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto">
            {showAddComment && (
              <div className="border-b border-gray-200 dark:border-gray-700">
                <AddCommentInput
                  onSubmit={(body) => handleCommentSubmitted(author, permlink, body)}
                  onCancel={() => setShowAddComment(false)}
                  currentUser={currentUser}
                  placeholder="Add a comment..."
                />
              </div>
            )}

            {topLevelComments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <MessageCirclePlus className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {searchQuery ? 'No comments found' : 'No comments yet'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  {searchQuery
                    ? 'Try adjusting your search terms'
                    : 'Be the first to share your thoughts!'
                  }
                </p>
                {!searchQuery && currentUser && (
                  <button
                    onClick={() => setShowAddComment(true)}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors duration-200"
                  >
                    Add Comment
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {topLevelComments.map((comment) => (
                  <CommentTile
                    key={comment.permlink}
                    comment={comment}
                    allComments={filteredComments}
                    onReply={handleReply}
                    currentUser={currentUser}
                    token={token}
                    searchQuery={searchQuery}
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

          {/* Footer with Add Comment Button */}
          {!showAddComment && currentUser && topLevelComments.length > 0 && (
            <div className="p-4 md:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <button
                onClick={() => setShowAddComment(true)}
                className="w-full md:w-auto px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-[1.02] flex items-center justify-center space-x-2"
              >
                <MessageCirclePlus className="w-5 h-5" />
                <span>Add Comment</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {replyingTo && (
        <ReplyModal
          parentAuthor={replyingTo.author}
          parentPermlink={replyingTo.permlink}
          onClose={() => setReplyingTo(null)}
          onCommentSubmitted={handleCommentSubmitted}
          currentUser={currentUser}
        />
      )}
    </>
  );
};

export default CommentsModal;