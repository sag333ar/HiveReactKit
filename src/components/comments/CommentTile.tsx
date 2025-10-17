/* eslint-disable @typescript-eslint/no-explicit-any */
import { Discussion } from '@/types/comment';
import { useMemo, useState } from 'react';
import { ThumbsUp, MessageSquare, MoreHorizontal, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
// remark-gfm no longer needed since we use hive renderer
import { DefaultRenderer } from '@hiveio/content-renderer';
import { apiService } from '@/services/apiService';
import { VoteSlider } from '../VoteSlider';

interface CommentTileProps {
  comment: Discussion;
  allComments: Discussion[];
  onReply: (author: string, permlink: string) => void;
  currentUser?: string;
  token?: string;
  searchQuery?: string;
  depth?: number;
  onVotedRefresh?: () => void;
  onClickCommentUpvote?: (comment: Discussion) => void;
  onClickCommentReply?: (comment: Discussion) => void;

  onClickUpvoteButton?: (currentUser?: string, token?: string) => void;
}

const CommentTile = ({
  comment,
  allComments,
  onReply,
  currentUser,
  token,
  searchQuery,
  depth = 0,
  onVotedRefresh,
  onClickCommentUpvote,
  onClickCommentReply,
  onClickUpvoteButton,
}: CommentTileProps) => {
  const [isUpvoted, setIsUpvoted] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [showVoteSlider, setShowVoteSlider] = useState(false);
  const hasAlreadyVoted = useMemo(() => {
    const activeVotes = comment.active_votes || [];
    return !!currentUser && activeVotes.some(v => v.voter === currentUser);
  }, [comment.active_votes, currentUser]);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastOpen(true);
    setTimeout(() => setToastOpen(false), 2500);
  };

  // Find direct replies to this comment.
  // Prefer exact parent_author/parent_permlink match, but also support
  // bridge's replies[] string keys ("author/permlink") when present.
  const parentDepth = (comment.depth || 0);
  const directReplies = allComments.filter(c =>
    c.parent_author === comment.author &&
    c.parent_permlink === comment.permlink &&
    (typeof c.depth !== 'number' || c.depth === parentDepth + 1)
  );

  let replies = directReplies;
  if ((!replies || replies.length === 0) && Array.isArray(comment.replies) && comment.replies.length > 0) {
    const replyKeys = new Set(comment.replies as string[]);
    replies = allComments.filter(c => replyKeys.has(`${c.author}/${c.permlink}`));
  }

  const hasReplies = replies.length > 0;
  const isMaxDepth = depth >= 4; // Limit nesting to prevent too deep threading

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
  };

  const handleOpenVote = () => {
    setShowVoteSlider(true);
  };

  const handlePerformUpvote = async (percent: number) => {
    if (!token) {
      onVotedRefresh?.();
      showToast('Vote submitted successfully ✅');
      return;
    }
    try {
      const weight = Math.round(percent * 100);
      await apiService.handleUpvote({
        author: comment.author,
        permlink: comment.permlink,
        weight,
        authToken: token,
      });
      setIsUpvoted(true);
      setShowVoteSlider(false);
      setIsRefreshing(true);
      setTimeout( () => {
        onVotedRefresh?.();
        setIsRefreshing(false);
        showToast('Vote submitted successfully ✅');
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upvote';
      alert(message);
    }
  };

  const handleReply = () => {
    if (currentUser) {
      onReply(comment.author, comment.permlink);
    } else {
      showToast("Please login to upvote");
    }
  };

  // Parse metadata if available
  const metadata = (comment as unknown as { json_metadata_parsed?: any; json_metadata?: string }).json_metadata_parsed
    || (() => {
      try { return comment.json_metadata ? JSON.parse(comment.json_metadata) : undefined; } catch { return undefined; }
    })();

  // Sanitize body: remove hashtag-only lines (tags footer)
  const rawBody = comment.body || '';
  const sanitizeHashtagBlock = (text: string) => {
    // Remove lines that are only hashtags separated by spaces or commas
    const pattern = /^(\s*(?:#[\p{L}\p{N}_-]+\s*(?:,\s*)?)+\s*)$/gimu;
    return text.replace(pattern, '').trim();
  };
  const sanitizedBody = sanitizeHashtagBlock(rawBody);

  const displayBody = searchQuery
    ? highlightText(sanitizedBody, searchQuery)
    : sanitizedBody;

  const hasMarkdownImagesInBody = /!\[[^\]]*\]\([^)]+\)/.test(sanitizedBody) || /<img\s/i.test(sanitizedBody);
  const metadataImages: string[] = Array.isArray(metadata?.image) ? metadata.image : [];

  // Hive content renderer instance (memoized per render)
  const hiveRenderer = new DefaultRenderer({
    baseUrl: 'https://hive.blog/',
    breaks: true,
    skipSanitization: false,
    allowInsecureScriptTags: false,
    addNofollowToLinks: true,
    doNotShowImages: false,
    assetsWidth: 640,
    assetsHeight: 480,
    imageProxyFn: (url: string) => url,
    usertagUrlFn: (account: string) => `/@${account}`,
    hashtagUrlFn: (hashtag: string) => `/trending/${hashtag}`,
    isLinkSafeFn: (_url: string) => true,
    addExternalCssClassToMatchingLinksFn: (_url: string) => true,
    ipfsPrefix: 'https://ipfs.io/ipfs/'
  });

  // Get vote count from stats or net_votes
  const voteCount = comment.stats?.total_votes || comment.net_votes || 0;

  return (
    <div className={`${depth > 0 ? 'ml-4 md:ml-8 border-l-2 border-gray-200 dark:border-gray-700 pl-4 md:pl-6' : ''}`}>
      <div className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200 p-4 md:p-6">
        <div className="flex items-start space-x-3 md:space-x-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <img
              src={`https://images.hive.blog/u/${comment.author}/avatar`}
              alt={comment.author}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-700"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${comment.author}&background=random`;
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center flex-wrap gap-2 mb-2">
              <button
                className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 text-sm md:text-base"
                onClick={() => {
                  // TODO: Navigate to user profile
                }}
              >
                @{comment.author}
              </button>
              <div className="flex items-center text-xs md:text-sm text-gray-500 dark:text-gray-400 space-x-1">
                <Clock className="w-3 h-3 md:w-4 md:h-4" />
                <span>
                  {formatDistanceToNow(new Date(comment.created + 'Z'), { addSuffix: true })}
                </span>
              </div>
              {comment.author === currentUser && (
                <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                  You
                </span>
              )}
            </div>

            {/* Content */}
            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none mb-3 comment-content text-gray-900 dark:text-gray-100 prose-a:text-blue-600 dark:prose-a:text-blue-400">
              {searchQuery ? (
                <div dangerouslySetInnerHTML={{ __html: displayBody }} />
              ) : (
                <div dangerouslySetInnerHTML={{ __html: hiveRenderer.render(sanitizedBody) }} />
              )}
            </div>

            {/* Render metadata images if body has no inline images */}
            {!hasMarkdownImagesInBody && metadataImages.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {metadataImages.map((src, idx) => (
                  <img
                    key={src + idx}
                    src={src}
                    alt={`image-${idx}`}
                    className="max-w-full h-auto rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200"
                    onClick={() => window.open(src, '_blank')}
                  />
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center space-x-4 md:space-x-6">
              <button
                onClick={() => {
                  if (onClickCommentUpvote) {
                    onClickCommentUpvote(comment);
                  } else if (onClickUpvoteButton) {
                    onClickUpvoteButton(currentUser, token);
                  } else {
                    if (!currentUser) {
                      showToast("Please login to upvote");
                      return;
                    }

                    if (!token) {
                      onVotedRefresh?.();
                      showToast('Vote submitted successfully ✅');
                    } else if (hasAlreadyVoted) {
                      showToast('You have already upvoted this comment');
                    } else {
                      handleOpenVote();
                    }
                  }
                }}
                className={`flex items-center space-x-1 md:space-x-2 text-xs md:text-sm font-medium transition-colors duration-200 ${isUpvoted
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
              >
                <ThumbsUp className={`w-4 h-4 ${hasAlreadyVoted || isUpvoted ? 'fill-current text-blue-600 dark:text-blue-400' : ''}`} />
                <span>{voteCount}</span>
              </button>

              <button
                onClick={() => {
                  if (onClickCommentReply) {
                    onClickCommentReply(comment);
                  } else {
                    handleReply();
                  }
                }}
                className="flex items-center space-x-1 md:space-x-2 text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Reply</span>
              </button>

              {hasReplies && (
                <button
                  onClick={() => setShowReplies(!showReplies)}
                  className="flex items-center space-x-1 md:space-x-2 text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
                >
                  <span>{showReplies ? 'Hide' : 'Show'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
                </button>
              )}

              <button
                onClick={() => onClickCommentReply?.(comment)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
              >
                <MoreHorizontal className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {showVoteSlider && !hasAlreadyVoted && (
              <div className="mt-3">
                <VoteSlider
                  author={comment.author}
                  permlink={comment.permlink}
                  onUpvote={handlePerformUpvote}
                  onCancel={() => setShowVoteSlider(false)}
                />
              </div>
            )}
            {isRefreshing && (
              <div className="mt-3 inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
                <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></span>
                Updating votes...
              </div>
            )}
            {toastOpen && (
              <div className="fixed bottom-4 right-4 w-[280px] z-50">
                <div className="bg-gray-800 text-white rounded px-3 py-2 shadow-lg text-sm">
                  {toastMessage}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {hasReplies && showReplies && !isMaxDepth && (
        <div className="space-y-0">
          {replies.map((reply) => (
            <CommentTile
              key={reply.permlink}
              comment={reply}
              allComments={allComments}
              onReply={onReply}
              currentUser={currentUser}
              searchQuery={searchQuery}
              depth={depth + 1}
              onVotedRefresh={onVotedRefresh}
            />
          ))}
        </div>
      )}

      {/* Max depth reached indicator */}
      {hasReplies && isMaxDepth && (
        <div className="ml-4 md:ml-8 p-3 text-sm text-gray-500 dark:text-gray-400 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
          <button
            onClick={() => {
              // TODO: Open replies in new modal or expand view
              console.log('Show more replies for:', comment.author, comment.permlink);
            }}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            View {replies.length} more {replies.length === 1 ? 'reply' : 'replies'}
          </button>
        </div>
      )}
    </div>
  );
};

export default CommentTile;