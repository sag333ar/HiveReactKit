/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Post, PostSort } from '@/types/post';
import { apiService } from '@/services/apiService';
import { formatDistanceToNow } from 'date-fns';
import { ThumbsUp, MessageCircle, Repeat2, Loader2 } from 'lucide-react';
import { DefaultRenderer } from '@hiveio/content-renderer';

interface PostFeedListProps {
  sort?: PostSort;
  tag?: string;
  observer?: string;
  limit?: number;
  showSortDropdown?: boolean;
  theme?: 'dark' | 'light';
  onAuthorClick?: (author: string, avatar: string) => void;
  onPostClick?: (post: Post) => void;
  onCommunityClick?: (communityTitle: string) => void;
  onPayoutClick?: (payout: number) => void;
  onUpvoteClick?: (post: Post) => void;
  onCommentClick?: (post: Post) => void;
  onReblogClick?: (post: Post) => void;
}

export default function PostFeedList({
  sort = 'trending',
  tag = '',
  observer = 'hive.blog',
  limit = 20,
  showSortDropdown = true,
  theme = 'dark',
  onAuthorClick,
  onPostClick,
  onCommunityClick,
  onPayoutClick,
  onUpvoteClick,
  onCommentClick,
  onReblogClick,
}: PostFeedListProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<PostSort>(sort);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);

  // Hive content renderer instance
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

  const fetchPosts = useCallback(async (sortType: PostSort, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setHasMore(true);
    }
    setError(null);
    try {
      const lastPost = append && posts.length > 0 ? posts[posts.length - 1] : null;
      const data = await apiService.getRankedPosts(
        sortType,
        tag,
        observer,
        limit,
        lastPost?.author,
        lastPost?.permlink
      );
      if (append) {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.post_id));
          const newPosts = data.filter(p => !existingIds.has(p.post_id));
          return [...prev, ...newPosts];
        });
        setHasMore(data.length === limit);
      } else {
        setPosts(data);
        setHasMore(data.length === limit);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts');
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tag, observer, limit, posts]);

  const loadMorePosts = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      fetchPosts(selectedSort, true);
    }
  }, [loadingMore, hasMore, loading, selectedSort, fetchPosts]);

  useEffect(() => {
    fetchPosts(selectedSort);
  }, [selectedSort, tag, observer, limit]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMorePosts();
        }
      },
      { threshold: 1.0 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observer.unobserve(observerRef.current);
      }
    };
  }, [loadMorePosts]);

  const handleSortChange = (newSort: PostSort) => {
    setSelectedSort(newSort);
    setPosts([]);
    setHasMore(true);
  };

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  const getPayoutBreakdown = (post: Post) => {
    const hbd = post.payout * 0.5; // Assuming 50% HBD
    const hp = post.payout * 0.5; // Assuming 50% HP
    const commentRewarder = post.beneficiaries.find(b => b.account === 'commentrewarder')?.weight || 0;
    const commentRewarderPercent = commentRewarder / 10000 * 100; // Weight is in basis points
    return {
      pending: `$${post.payout.toFixed(2)}`,
      breakdown: `${hbd.toFixed(2)} HBD, ${hp.toFixed(2)} HP`,
      commentRewarder: `${commentRewarderPercent.toFixed(2)}%`,
      payoutInDays: Math.ceil((new Date(post.payout_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    };
  };

  const getDescriptionFromBody = (post: Post) => {
    const body = post.body || '';
    // Remove markdown images and links to get clean text
    const cleanBody = body
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // Remove markdown images
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with just text
      .replace(/^#+\s*/gm, '') // Remove headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();

    // Get first 200 characters as description
    return cleanBody.length > 200 ? cleanBody.substring(0, 200) + '...' : cleanBody;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h3 className="text-lg font-semibold text-card-foreground">Failed to load posts</h3>
        <p className="text-muted-foreground">{error}</p>
        <button
          onClick={() => fetchPosts(selectedSort)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className={`space-y-6 p-2 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
        {/* Sort Dropdown */}
        {showSortDropdown && (
          <div className="flex justify-center">
          <select
            value={selectedSort}
            onChange={(e) => handleSortChange(e.target.value as PostSort)}
            className={`px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-card text-card-foreground'}`}
          >
              <option value="trending">Trending</option>
              <option value="hot">Hot</option>
              <option value="created">New</option>
            </select>
          </div>
        )}

        {/* Posts List */}
        <div className="space-y-4">
        {posts.map((post) => {
          const firstImage = post.json_metadata?.image?.[0];
          const breakdown = getPayoutBreakdown(post);

          return (
            <div key={post.post_id} className={`border border-border rounded-xl p-4 shadow-card hover:shadow-card-hover transition-shadow ${theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-black'}`}>
              {/* Author Info */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <img
                  src={`https://images.hive.blog/u/${post.author}/avatar`}
                  alt={post.author}
                  className="w-8 h-8 rounded-full cursor-pointer flex-shrink-0"
                  onClick={() => onAuthorClick?.(post.author, `https://images.hive.blog/u/${post.author}/avatar`)}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${post.author}&background=random`;
                  }}
                />
                <span
                  className="font-medium cursor-pointer hover:text-primary"
                  onClick={() => onAuthorClick?.(post.author, `https://images.hive.blog/u/${post.author}/avatar`)}
                >
                  {post.author}
                </span>
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-muted-foreground'}>({post.author_reputation.toFixed(2)})</span>
                <span
                  className={`cursor-pointer hover:text-primary ${theme === 'dark' ? 'text-gray-400' : 'text-muted-foreground'}`}
                  onClick={() => onCommunityClick?.(post.community_title)}
                >
                  {post.community_title}
                </span>
                <span className={`hidden sm:inline ${theme === 'dark' ? 'text-gray-400' : 'text-muted-foreground'}`}>•</span>
                <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-muted-foreground'}`}>
                  {formatDistanceToNow(new Date(post.created+'Z'), { addSuffix: true })}
                </span>
              </div>

              {/* Content Row */}
              <div className="flex gap-3 sm:gap-4">
                {/* Image */}
                <div className="flex-shrink-0">
                  {firstImage ? (
                    <div className="relative">
                      <img
                        src={firstImage.startsWith('http') ? firstImage : `https://images.hive.blog/u/320x0/${firstImage}`}
                        alt={post.title}
                        className="w-20 h-20 sm:w-32 sm:h-32 object-cover rounded-lg cursor-pointer"
                        onClick={() => onPostClick?.(post)}
                        onError={(e) => {
                          if ((e.target as HTMLImageElement).src !== `https://images.hive.blog/u/${post.author}/avatar`) {
                            (e.target as HTMLImageElement).src = `https://images.hive.blog/u/${post.author}/avatar`;
                          }else{
                            (e.target as HTMLImageElement).src = `https://images.hive.blog/u/null/avatar`;
                          }
                        }}
                      />
                      {/* Show small images from body if they exist */}
                      {(() => {
                        const bodyImages = post.body?.match(/!\[[^\]]*\]\(([^)]+)\)/g)?.map(match => {
                          const urlMatch = match.match(/\(([^)]+)\)/);
                          return urlMatch ? urlMatch[1] : null;
                        }).filter(Boolean) || [];

                        if (bodyImages.length > 0) {
                          return (
                            <div className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 flex space-x-1">
                              {bodyImages.slice(0, 3).map((imgUrl, idx) => (
                                <img
                                  key={idx}
                                  src={imgUrl}
                                  alt={`body-image-${idx}`}
                                  className="w-6 h-6 sm:w-8 sm:h-8 object-cover rounded border-2 border-white shadow-sm cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Change the main image instead of opening new tab
                                    const mainImg = e.currentTarget.parentElement?.parentElement?.querySelector('img:not(.w-6):not(.w-8)');
                                    if (mainImg) {
                                      (mainImg as HTMLImageElement).src = imgUrl;
                                    }
                                  }}
                                />
                              ))}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  ) : (
                    <img
                      src={`https://images.hive.blog/u/${post.author}/avatar`}
                      alt={post.author}
                      className="w-20 h-20 sm:w-32 sm:h-32 rounded-lg cursor-pointer"
                      onClick={() => onPostClick?.(post)}
                    />
                  )}
                </div>

                {/* Title and Description */}
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-semibold text-base sm:text-lg mb-1 sm:mb-2 cursor-pointer hover:text-primary line-clamp-2"
                    onClick={() => onPostClick?.(post)}
                  >
                    {post.title}
                  </h3>
                  <p
                    className={`mb-2 sm:mb-3 line-clamp-2 sm:line-clamp-3 cursor-pointer hover:text-primary text-sm sm:text-base ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
                    onClick={() => onPostClick?.(post)}
                  >
                    {post.json_metadata?.description || getDescriptionFromBody(post) || 'No description available'}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center justify-between">
                    {/* Payout */}
                    <div className="relative group">
                      <span
                        className="font-semibold text-green-600 cursor-pointer hover:text-green-700 text-sm sm:text-base"
                        onClick={() => onPayoutClick?.(post.payout)}
                      >
                        ${post.payout.toFixed(2)}
                      </span>
                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-black text-white text-xs p-2 rounded shadow-lg whitespace-nowrap z-10">
                        <div>Pending payout amount: {breakdown.pending}</div>
                        <div>Breakdown: {breakdown.breakdown}</div>
                        <div>commentrewarder: {breakdown.commentRewarder}</div>
                        <div>Payout in {breakdown.payoutInDays} days</div>
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="flex items-center gap-3 sm:gap-4">
                      {/* Votes */}
                      <div
                        className={`flex items-center gap-1 hover:text-primary transition-colors cursor-pointer ${theme === 'dark' ? 'text-gray-400' : 'text-muted-foreground'}`}
                        onClick={() => onUpvoteClick?.(post)}
                      >
                        <ThumbsUp className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="text-xs sm:text-sm">{formatNumber(post.stats.total_votes)}</span>
                      </div>

                      {/* Comments */}
                      <div
                        className={`flex items-center gap-1 hover:text-blue-400 transition-colors cursor-pointer ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}
                        onClick={() => onCommentClick?.(post)}
                      >
                        <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="text-xs sm:text-sm">{formatNumber(post.children)}</span>
                      </div>

                      {/* Reblogs */}
                      <div
                        className={`flex items-center gap-1 hover:text-gray-400 transition-colors cursor-pointer ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                        onClick={() => onReblogClick?.(post)}
                      >
                        <Repeat2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="text-xs sm:text-sm">{formatNumber(post.reblogs)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading More Indicator */}
        {loadingMore && (
          <div className="flex justify-center items-center py-4">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className={`ml-2 ${theme === 'dark' ? 'text-gray-400' : 'text-muted-foreground'}`}>Loading more posts...</span>
          </div>
        )}

        {/* Intersection Observer Target */}
        {hasMore && !loadingMore && (
          <div ref={observerRef} className="h-10" />
        )}
        </div>
      </div>
    </div>
  );
};


