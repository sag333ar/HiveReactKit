import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { apiService } from '@/services/apiService';
import { Discussion } from '@/types/comment';
import { X, Search, MessageCirclePlus, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import CommentTile from './CommentTile';
import ReplyModal from './ReplyModal';
import CommentSearchBar from './CommentSearchBar';
import AddCommentInput from './AddCommentInput';
import { toast } from '@/hooks';

interface CommentsModalProps {
  author: string;
  permlink: string;
  onClose: () => void;
  currentUser?: string;
  token?: string;
  /** Called with (author, permlink, percent) when user confirms comment upvote; frontend handles signing. */
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onClickCommentReply?: (comment: Discussion) => void;
  onClickUpvoteButton?: (currentUser?: string, token?: string) => void;
  /** When provided, used instead of apiService.handleComment (e.g. for aioha wallet).
   *  Return `false` to indicate the operation was cancelled — the composer text will be preserved.
   *  `voteWeight` is non-null when the composer's upvote-on-publish toggle is enabled
   *  (value in 1–100, step 0.25); consumer should broadcast vote+comment atomically. */
  onSubmitComment?: (
    parentAuthor: string,
    parentPermlink: string,
    body: string,
    voteWeight?: number | null,
  ) => Promise<void | boolean>;
  /** Show the upvote-on-publish toggle in the composer (the parent decides — usually `!alreadyVoted`). */
  showVoteButton?: boolean;
  /** Locked default tags for the top-level composer (typically the parent post's tags, app tag first). */
  parentTags?: string[];
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
}

const CommentsModal = ({ author, permlink, onClose, currentUser, token, onClickCommentUpvote, onClickCommentReply, onClickUpvoteButton, onSubmitComment, ecencyToken, threeSpeakApiKey, giphyApiKey, templateToken, templateApiBaseUrl, showVoteButton, parentTags }: CommentsModalProps) => {
  const [comments, setComments] = useState<Discussion[]>([]);
  const [filteredComments, setFilteredComments] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ author: string; permlink: string } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddComment, setShowAddComment] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Latest vote-on-publish selection from AddCommentInput. Null when toggle is off.
  const voteRef = useRef<{ enabled: boolean; percent: number }>({ enabled: false, percent: 100 });

  const fetchComments = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const fetchedComments = await apiService.getCommentsList(author, permlink, currentUser ?? '');
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
    // When callback is provided: use only the callback. No token, no apiService. (Same pattern as CommentTile onClickCommentUpvote.)
    if (onSubmitComment) {
      try {
        const { enabled, percent } = voteRef.current;
        const voteWeight = enabled ? percent : null;
        const result = await Promise.resolve(onSubmitComment(parentAuthor, parentPermlink, body, voteWeight));
        // If callback returns false, the operation was cancelled — preserve composer text
        if (result === false) return;
        setShowAddComment(false);
        setIsRefreshing(true);
        setTimeout(async () => {
          await fetchComments(true);
          setIsRefreshing(false);
        }, 3000);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to post comment';
        toast({ title: 'Error', description: message });
        setIsRefreshing(false);
      }
      return;
    }
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
      toast({ title: 'Error', description: message });
      setIsRefreshing(false);
    }
  };

  // When currentUser is set, show their comments at the top
  const sortedForDisplay = useMemo(() => {
    if (!currentUser?.trim()) return filteredComments;
    const user = currentUser.toLowerCase();
    return [...filteredComments].sort((a, b) => {
      const aIsCurrent = a.author?.toLowerCase() === user;
      const bIsCurrent = b.author?.toLowerCase() === user;
      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;
      return 0;
    });
  }, [filteredComments, currentUser]);

  // Direct replies to the post only (root post is excluded in apiService.getCommentsList)
  const topLevelComments = sortedForDisplay.filter(
    (c) => c.parent_author === author && c.parent_permlink === permlink
  );


  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 h-screen">
        <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col">
          <div className="flex justify-center items-center h-full">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-gray-300">Loading comments...</p>
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
        <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
          <div className="flex justify-center items-center h-full">
            <div className="text-center p-6">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Failed to load comments
              </h3>
              <p className="text-gray-300 mb-6">{error}</p>
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
        <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">{/* Header */}
          <div className="flex justify-between items-center p-4 md:p-6 border-b border-gray-700 bg-gray-900/50">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg md:text-xl font-bold text-white">
                Comments ({comments.length})
              </h2>
              {isRefreshing && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => fetchComments(true)}
                disabled={isRefreshing}
                className="p-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50"
                title="Refresh comments"
              >
                <RefreshCw className={`w-5 h-5 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 rounded-lg hover:bg-gray-700 transition-colors duration-200"
                title="Search comments"
              >
                <Search className="w-5 h-5 text-gray-400" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-700 transition-colors duration-200"
              >
                <X className="w-6 h-6 text-gray-400" />
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
              <div className="border-b border-gray-700">
                <AddCommentInput
                  onSubmit={(body) => handleCommentSubmitted(author, permlink, body)}
                  onCancel={() => setShowAddComment(false)}
                  currentUser={currentUser}
                  placeholder="Add a comment..."
                  ecencyToken={ecencyToken}
                  threeSpeakApiKey={threeSpeakApiKey}
                  giphyApiKey={giphyApiKey}
                  templateToken={templateToken}
                  templateApiBaseUrl={templateApiBaseUrl}
                  showVoteButton={showVoteButton}
                  onVoteChange={(enabled, percent) => { voteRef.current = { enabled, percent }; }}
                  defaultTags={parentTags}
                />
              </div>
            )}

            {topLevelComments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <MessageCirclePlus className="w-16 h-16 text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  {searchQuery ? 'No comments found' : 'No comments yet'}
                </h3>
                <p className="text-gray-400 mb-6">
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
              <div className="divide-y divide-gray-700">
                {topLevelComments.map((comment) => (
                  <CommentTile
                    key={comment.permlink}
                    comment={comment}
                    allComments={sortedForDisplay}
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
            <div className="p-4 md:p-6 border-t border-gray-700 bg-gray-900/50">
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
          ecencyToken={ecencyToken}
          threeSpeakApiKey={threeSpeakApiKey}
          giphyApiKey={giphyApiKey}
          templateToken={templateToken}
          templateApiBaseUrl={templateApiBaseUrl}
        />
      )}
    </>
  );
};

export default CommentsModal;