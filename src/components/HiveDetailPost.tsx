import { useEffect, useState, useMemo } from 'react';
import { apiService } from '@/services/apiService';
import { Post } from '@/types/post';
import { ThumbsUp, MessageCircle, Loader2, AlertCircle, Clock, Tag } from 'lucide-react';
import { UpvoteList } from './UpvoteList';
import { CommentsList } from './CommentsList';
import { VoteSlider } from './VoteSlider';
import { DefaultRenderer } from '@hiveio/content-renderer';
import { Discussion } from '@/types';

interface HiveDetailPostProps {
  author: string;
  permlink: string;
  currentUser?: string;
  token?: string;
  onClickUpvoteButton?: (currentUser?: string, token?: string) => void;
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onClickCommentReply?: (comment: Discussion) => void;
}

export function HiveDetailPost({
  author,
  permlink,
  currentUser,
  token,
  onClickUpvoteButton,
  onClickCommentUpvote,
  onClickCommentReply
}: HiveDetailPostProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVoteSlider, setShowVoteSlider] = useState(false);
  const [activeTab, setActiveTab] = useState<'votes' | 'comments'>('votes');



  const hasAlreadyVoted = !!currentUser && post?.active_votes?.some(v => v.voter === currentUser);

  const renderedBody = useMemo(() => {
    if (!post?.body) return '';
    const renderer = new DefaultRenderer({
      baseUrl: 'https://hive.blog/',
      breaks: true,
      skipSanitization: false,
      allowInsecureScriptTags: false,
      addNofollowToLinks: true,
      doNotShowImages: false,
      assetsWidth: 640,
      assetsHeight: 480,
      imageProxyFn: (url: string) => url,
      hashtagUrlFn: (tag: string) => `https://hive.blog/trending/${tag}`,
      usertagUrlFn: (user: string) => `https://hive.blog/@${user}`,
      isLinkSafeFn: () => true,
      addExternalCssClassToMatchingLinksFn: () => false,
    });
    const html = renderer.render(post.body);
    // Add dark mode styling to the rendered HTML
    return html.replace(/<p>/g, '<p class="text-gray-900 dark:text-gray-100">')
               .replace(/<h1>/g, '<h1 class="text-gray-900 dark:text-gray-100">')
               .replace(/<h2>/g, '<h2 class="text-gray-900 dark:text-gray-100">')
               .replace(/<h3>/g, '<h3 class="text-gray-900 dark:text-gray-100">')
               .replace(/<h4>/g, '<h4 class="text-gray-900 dark:text-gray-100">')
               .replace(/<h5>/g, '<h5 class="text-gray-900 dark:text-gray-100">')
               .replace(/<h6>/g, '<h6 class="text-gray-900 dark:text-gray-100">')
               .replace(/<li>/g, '<li class="text-gray-900 dark:text-gray-100">')
               .replace(/<blockquote>/g, '<blockquote class="text-gray-700 dark:text-gray-300 border-l-4 border-gray-300 dark:border-gray-600">');
  }, [post?.body]);

  useEffect(() => {
    fetchPostContent();
  }, [author, permlink]);



  const fetchPostContent = async () => {
    setLoading(true);
    setError(null);
    try {
      const content = await apiService.getPostContent(author, permlink);
      if (content) {
        setPost(content);
      } else {
        setError('Post not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load post');
    } finally {
      setLoading(false);
    }
  };



  const handleUpvote = async (percent: number) => {
    if (!token || !currentUser) {
      alert('Please login to upvote');
      return;
    }
    try {
      const weight = Math.round(percent * 100);
      await apiService.handleUpvote({
        author,
        permlink,
        weight,
        authToken: token,
      });
      setShowVoteSlider(false);
      setTimeout(() => {
        fetchPostContent();
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upvote';
      alert(message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen p-8">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Loading post...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex justify-center items-center min-h-screen p-8">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Failed to load post
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
          <button
            onClick={fetchPostContent}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 py-8 h-full">
        {/* Mobile Layout */}
        <div className="block lg:hidden space-y-6 h-full overflow-y-auto">
          {/* Mobile: User Profile */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex flex-col items-center">
              <img
                src={`https://images.hive.blog/u/${post.author}/avatar`}
                alt={post.author}
                className="w-24 h-24 rounded-full mb-4"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${post.author}&background=random&size=96`;
                }}
              />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                @{post.author}
              </h2>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                {new Date(post.created).toLocaleDateString()}
              </div>

              {/* Post Tags */}
              {post.json_metadata?.tags && post.json_metadata.tags.length > 0 && (
                <div className="w-full mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                    <Tag className="w-4 h-4 mr-1" />
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {post.json_metadata.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile: Post Content */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            {/* Post Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                {post.title}
              </h1>

              {/* Action Buttons */}
              <div className="flex items-center space-x-4">
                {/* Upvote Button */}
                <button
                  onClick={() => {
                    if (onClickUpvoteButton) {
                      onClickUpvoteButton(currentUser, token);
                      return;
                    }
                    if (!currentUser || !token) {
                      alert('Please login to upvote');
                      return;
                    }
                    if (hasAlreadyVoted) {
                      alert('You have already upvoted this post');
                    } else {
                      setShowVoteSlider(true);
                    }
                  }}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                    hasAlreadyVoted
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <ThumbsUp className={`w-5 h-5 ${hasAlreadyVoted ? 'fill-current' : ''}`} />
                  <span className="font-medium">Upvote</span>
                </button>

                {/* Voters List Button */}
                <button
                  onClick={() => setActiveTab('votes')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                    activeTab === 'votes'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <ThumbsUp className="w-5 h-5" />
                  <span className="font-medium">{post.active_votes?.length || 0} Votes</span>
                </button>

                {/* Comments Button */}
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                    activeTab === 'comments'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <MessageCircle className="w-5 h-5" />
                  <span className="font-medium">{post.children || 0} Comments</span>
                </button>
              </div>

              {/* Payout Info */}
              <div className="mt-4 flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                <span>Pending Payout: {post.pending_payout_value}</span>
                <span>•</span>
                <span>Author Payout: {post.author_payout_value}</span>
              </div>
            </div>

            {/* Post Body */}
            <div className="p-6">
              <div
                className="prose dark:prose-invert max-w-none prose-gray dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: renderedBody
                }}
              />
            </div>
          </div>

          {/* Mobile: Tabs Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            {/* Tab Headers */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
              <button
                onClick={() => setActiveTab('votes')}
                className={`flex-1 px-3 py-2 text-center font-medium text-sm transition-colors duration-200 ${
                  activeTab === 'votes'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                Votes ({post.active_votes?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('comments')}
                className={`flex-1 px-3 py-2 text-center font-medium text-sm transition-colors duration-200 ${
                  activeTab === 'comments'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                Comments ({post.children || 0})
              </button>
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">
              {activeTab === 'votes' && (
                <UpvoteList
                  author={author}
                  permlink={permlink}
                  currentUser={currentUser}
                  token={token}
                  onClickUpvoteButton={onClickUpvoteButton}
                />
              )}

              {activeTab === 'comments' && (
                <CommentsList
                  author={author}
                  permlink={permlink}
                  currentUser={currentUser}
                  token={token}
                  onClickUpvoteButton={onClickUpvoteButton}
                  onClickCommentUpvote={onClickCommentUpvote}
                  onClickCommentReply={onClickCommentReply}
                />
              )}
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-8 h-full">
          {/* Left Column - User Info and Tabs */}
          <div className="space-y-6">
            {/* User Profile */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex flex-col items-center">
                <img
                  src={`https://images.hive.blog/u/${post.author}/avatar`}
                  alt={post.author}
                  className="w-24 h-24 rounded-full mb-4"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${post.author}&background=random&size=96`;
                  }}
                />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  @{post.author}
                </h2>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {new Date(post.created).toLocaleDateString()}
                </div>

                {/* Post Tags */}
                {post.json_metadata?.tags && post.json_metadata.tags.length > 0 && (
                  <div className="w-full mt-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                      <Tag className="w-4 h-4 mr-1" />
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {post.json_metadata.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tabs Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              {/* Tab Headers */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                <button
                  onClick={() => setActiveTab('votes')}
                  className={`flex-1 px-3 py-2 text-center font-medium text-sm transition-colors duration-200 ${
                    activeTab === 'votes'
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  Votes ({post.active_votes?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`flex-1 px-3 py-2 text-center font-medium text-sm transition-colors duration-200 ${
                    activeTab === 'comments'
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  Comments ({post.children || 0})
                </button>
              </div>

              {/* Tab Content */}
              <div className="max-h-96 overflow-y-auto">
                {activeTab === 'votes' && (
                  <UpvoteList
                    author={author}
                    permlink={permlink}
                    currentUser={currentUser}
                    token={token}
                    onClickUpvoteButton={onClickUpvoteButton}
                  />
                )}

                {activeTab === 'comments' && (
                  <CommentsList
                    author={author}
                    permlink={permlink}
                    currentUser={currentUser}
                    token={token}
                    onClickUpvoteButton={onClickUpvoteButton}
                      onClickCommentUpvote={onClickCommentUpvote}
                      onClickCommentReply={onClickCommentReply}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Post Content */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden h-full flex flex-col">
            {/* Post Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                {post.title}
              </h1>

              {/* Action Buttons */}
              <div className="flex items-center space-x-4">
                {/* Upvote Button */}
                <button
                  onClick={() => {
                    if (onClickUpvoteButton) {
                      onClickUpvoteButton(currentUser, token);
                      return;
                    }
                    if (!currentUser || !token) {
                      alert('Please login to upvote');
                      return;
                    }
                    if (hasAlreadyVoted) {
                      alert('You have already upvoted this post');
                    } else {
                      setShowVoteSlider(true);
                    }
                  }}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                    hasAlreadyVoted
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <ThumbsUp className={`w-5 h-5 ${hasAlreadyVoted ? 'fill-current' : ''}`} />
                  <span className="font-medium">Upvote</span>
                </button>

                {/* Voters List Button */}
                <button
                  onClick={() => setActiveTab('votes')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                    activeTab === 'votes'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <ThumbsUp className="w-5 h-5" />
                  <span className="font-medium">{post.active_votes?.length || 0} Votes</span>
                </button>

                {/* Comments Button */}
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                    activeTab === 'comments'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <MessageCircle className="w-5 h-5" />
                  <span className="font-medium">{post.children || 0} Comments</span>
                </button>
              </div>

              {/* Payout Info */}
              <div className="mt-4 flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                <span>Pending Payout: {post.pending_payout_value}</span>
                <span>•</span>
                <span>Author Payout: {post.author_payout_value}</span>
              </div>
            </div>

            {/* Post Body */}
            <div className="p-6 flex-1 overflow-y-auto">
              <div
                className="prose dark:prose-invert max-w-none prose-gray dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: renderedBody
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Modals
  if (showVoteSlider) {
    return (
      <VoteSlider
        author={author}
        permlink={permlink}
        onUpvote={handleUpvote}
        onCancel={() => setShowVoteSlider(false)}
      />
    );
  }
}
