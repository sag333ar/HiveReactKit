import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Loader2, AlertCircle, RefreshCw, MessageCirclePlus, Search } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { Discussion } from '@/types/comment';
import InlineCommentItem from './InlineCommentItem';
import { PostComposer } from '../comments/AddCommentInput';
import { toast } from '@/hooks';

interface InlineCommentSectionProps {
  author: string;
  permlink: string;
  currentUser?: string;
  token?: string;
  /** `voteWeight` is non-null when the top-level composer's upvote-on-publish toggle is on (only fires for the post-reply composer). */
  onSubmitComment?: (parentAuthor: string, parentPermlink: string, body: string, voteWeight?: number | null) => void | boolean | Promise<void | boolean>;
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  /** Show the upvote-on-publish toggle on the top-level composer. Auto-hidden when `alreadyVoted`. */
  showVoteButton?: boolean;
  /** If true, the current user already upvoted the post — hides the toggle. */
  alreadyVoted?: boolean;
  /** Locked default tags for the top-level composer (parent post's tags, app tag first). */
  parentTags?: string[];
  ecencyToken?: string;
  threeSpeakApiKey?: string;
  giphyApiKey?: string;
  templateToken?: string;
  templateApiBaseUrl?: string;
  /** Usernames whose comments should be hidden for the current logged-in user. */
  reportedAuthors?: string[];
  /** Specific posts/comments to hide for the current logged-in user. */
  reportedPosts?: { author: string; permlink: string }[];
  hiveIconUrl?: string;
  onShareComment?: (author: string, permlink: string) => void;
  onTipComment?: (author: string, permlink: string) => void;
  onReportComment?: (author: string, permlink: string) => void;
  /** Intercept intra-body Hive post links in comment bodies. */
  onNavigateToPost?: (author: string, permlink: string) => void;
  /** Intercept intra-body Hive profile links in comment bodies. */
  onUserClick?: (username: string) => void;
}

export default function InlineCommentSection({
  author,
  permlink,
  currentUser,
  token,
  onSubmitComment,
  onClickCommentUpvote,
  ecencyToken,
  threeSpeakApiKey,
  giphyApiKey,
  templateToken,
  templateApiBaseUrl,
  reportedAuthors,
  reportedPosts,
  hiveIconUrl,
  onShareComment,
  onTipComment,
  onReportComment,
  onNavigateToPost,
  onUserClick,
  showVoteButton,
  alreadyVoted,
  parentTags,
}: InlineCommentSectionProps) {
  const [comments, setComments] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  /** "author/permlink" key of the comment being replied to, or null for top-level / no reply */
  const [activeReplyKey, setActiveReplyKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const fetchComments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const fetched = await apiService.getCommentsList(author, permlink, currentUser ?? '');
      setComments(fetched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [author, permlink]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  // Search filter
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return comments;
    const q = searchQuery.toLowerCase();
    return comments.filter(
      (c) => c.body?.toLowerCase().includes(q) || c.author.toLowerCase().includes(q)
    );
  }, [searchQuery, comments]);

  // Reported authors/posts filter — only applies when currentUser is set
  const filteredComments = useMemo(() => {
    if (!currentUser) return searchFiltered;
    const blockedAuthors = new Set((reportedAuthors ?? []).map((a) => a.toLowerCase()));
    const blockedPosts = new Set((reportedPosts ?? []).map((p) => `${p.author.toLowerCase()}/${p.permlink.toLowerCase()}`));
    if (blockedAuthors.size === 0 && blockedPosts.size === 0) return searchFiltered;
    return searchFiltered.filter((c) => {
      if (blockedAuthors.has(c.author.toLowerCase())) return false;
      if (blockedPosts.has(`${c.author.toLowerCase()}/${c.permlink.toLowerCase()}`)) return false;
      return true;
    });
  }, [searchFiltered, currentUser, reportedAuthors, reportedPosts]);

  const sorted = useMemo(() => {
    if (!currentUser?.trim()) return filteredComments;
    const user = currentUser.toLowerCase();
    return [...filteredComments].sort((a, b) => {
      const aIs = a.author?.toLowerCase() === user;
      const bIs = b.author?.toLowerCase() === user;
      if (aIs && !bIs) return -1;
      if (!aIs && bIs) return 1;
      return 0;
    });
  }, [filteredComments, currentUser]);

  const topLevel = sorted.filter(
    (c) => c.parent_author === author && c.parent_permlink === permlink
  );

  // Called from any InlineCommentItem reply button → hides top composer, shows inline composer on that comment
  const handleReply = (parentAuthor: string, parentPermlink: string) => {
    setActiveReplyKey(`${parentAuthor}/${parentPermlink}`);
  };

  const handleCancelReply = () => {
    setActiveReplyKey(null);
  };

  // Vote-on-publish state for the TOP-LEVEL composer only (post reply). Nested reply composers
  // don't surface vote toggles because their targets are sub-comments, not the post.
  const topVoteRef = useRef<{ enabled: boolean; percent: number }>({ enabled: false, percent: 100 });

  const handleCommentSubmit = async (parentAuthor: string, parentPermlink: string, body: string) => {
    // Only the post-reply composer carries a vote weight. Sub-comment replies always send null.
    const isPostReply = parentAuthor === author && parentPermlink === permlink;
    const { enabled, percent } = topVoteRef.current;
    const voteWeight = isPostReply && enabled ? percent : null;
    if (onSubmitComment) {
      try {
        const result = await Promise.resolve(onSubmitComment(parentAuthor, parentPermlink, body, voteWeight));
        // If callback returns false, the operation was cancelled (e.g. keychain denied) — preserve text
        if (result === false) return false;
        setActiveReplyKey(null);
        setIsRefreshing(true);
        setTimeout(async () => { await fetchComments(true); }, 3000);
      } catch (err: unknown) {
        toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to post comment' });
        setIsRefreshing(false);
      }
      return;
    }
    if (!token) { alert('Please login to comment'); return; }
    try {
      await apiService.handleComment({ author: parentAuthor, permlink: parentPermlink, body, authToken: token });
      setActiveReplyKey(null);
      setIsRefreshing(true);
      setTimeout(async () => { await fetchComments(true); }, 3000);
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to post comment' });
      setIsRefreshing(false);
    }
  };

  // Top-level composer is always visible when logged in
  const showTopComposer = !!currentUser;
  const isSelfPost = currentUser === author;

  return (
    <div className="border-t border-gray-700/50 mt-2">
      {/* Section header */}
      <div className="flex items-center justify-between px-1 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">
            Comments {comments.length > 0 && `(${comments.length})`}
          </h3>
          {isRefreshing && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-1.5 rounded-lg hover:bg-gray-700/60 transition-colors"
            title="Search comments"
          >
            <Search className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => fetchComments(true)}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg hover:bg-gray-700/60 transition-colors disabled:opacity-50"
            title="Refresh comments"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-1 pb-3">
          <input
            type="text"
            placeholder="Search comments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            autoFocus
          />
        </div>
      )}

      {/* Top-level composer — reply to the post author (hidden when replying to a comment) */}
      {showTopComposer && (
        <div className="border border-gray-700 rounded-xl mb-3 overflow-hidden bg-gray-800/50">
          {/* Header: currentUser replying to post author */}
          <div className="px-3 py-2.5 border-b border-gray-700 bg-gray-900/50">
            <div className="flex items-center gap-2.5">
              <img
                src={`https://images.hive.blog/u/${currentUser}/avatar`}
                alt={currentUser}
                className="w-6 h-6 rounded-full flex-shrink-0 bg-gray-700 border border-gray-600"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${currentUser}&background=random`;
                }}
              />
              <span className="text-xs font-medium text-white">@{currentUser}</span>
              {isSelfPost ? (
                <span className="text-gray-500 text-[11px]">commenting on your post</span>
              ) : (
                <>
                  <span className="text-gray-500 text-[11px]">replying to</span>
                  <img
                    src={`https://images.hive.blog/u/${author}/avatar`}
                    alt={author}
                    className="w-6 h-6 rounded-full flex-shrink-0 bg-gray-700 border border-gray-600"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${author}&background=random`;
                    }}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-blue-400 truncate">@{author}/{permlink}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          <PostComposer
            onSubmit={(body) => handleCommentSubmit(author, permlink, body)}
            currentUser={currentUser}
            parentAuthor={author}
            parentPermlink={permlink}
            placeholder={`Write a comment to @${author}...`}
            ecencyToken={ecencyToken}
            threeSpeakApiKey={threeSpeakApiKey}
            giphyApiKey={giphyApiKey}
            templateToken={templateToken}
            templateApiBaseUrl={templateApiBaseUrl}
            hideUserHeader
            disableAutoFocus
            showVoteButton={!!showVoteButton && !alreadyVoted}
            defaultTags={parentTags}
            onVoteChange={(enabled, percent) => { topVoteRef.current = { enabled, percent }; }}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
          <span className="text-sm text-gray-400">Loading comments...</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center py-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
          <p className="text-sm text-gray-400 mb-3">{error}</p>
          <button
            onClick={() => fetchComments()}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && topLevel.length === 0 && (
        <div className="flex flex-col items-center py-8 text-center">
          <MessageCirclePlus className="w-10 h-10 text-gray-600 mb-3" />
          <p className="text-sm text-gray-400">
            {searchQuery ? 'No comments match your search' : 'No comments yet. Be the first!'}
          </p>
        </div>
      )}

      {/* Comment list */}
      {!loading && !error && topLevel.length > 0 && (
        <div className="divide-y divide-gray-800/50">
          {topLevel.map((comment) => (
            <InlineCommentItem
              key={comment.permlink}
              comment={comment}
              allComments={sorted}
              onReply={handleReply}
              onCancelReply={handleCancelReply}
              onCommentSubmit={handleCommentSubmit}
              activeReplyKey={activeReplyKey}
              currentUser={currentUser}
              token={token}
              depth={0}
              onVotedRefresh={() => fetchComments(true)}
              onClickCommentUpvote={onClickCommentUpvote}
              ecencyToken={ecencyToken}
              threeSpeakApiKey={threeSpeakApiKey}
              giphyApiKey={giphyApiKey}
              templateToken={templateToken}
              templateApiBaseUrl={templateApiBaseUrl}
              hiveIconUrl={hiveIconUrl}
              onShareComment={onShareComment}
              onTipComment={onTipComment}
              onReportComment={onReportComment}
              onNavigateToPost={onNavigateToPost}
              onUserClick={onUserClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
