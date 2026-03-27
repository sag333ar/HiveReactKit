import { useEffect, useState, useMemo, useCallback } from 'react';
import { apiService } from '@/services/apiService';
import { userService } from '@/services/userService';
import { Post } from '@/types/post';
import {
  AlertCircle,
  ArrowLeft,
  Tag,
  Clock,
} from 'lucide-react';
import { PostActionButton } from './actionButtons/PostActionButton';
import { DefaultRenderer } from '@hiveio/content-renderer';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProfileData {
  username: string;
  name?: string;
  profileImage?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  reputation: number;
}

export interface HiveDetailPostProps {
  author: string;
  permlink: string;
  currentUser?: string;

  // PostActionButton callbacks
  onUpvote?: (percent: number) => void | Promise<void>;
  onSubmitComment?: (parentAuthor: string, parentPermlink: string, body: string) => void | Promise<void>;
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onReblog?: () => void;
  onShare?: () => void;
  onTip?: () => void;
  onReport?: () => void;

  // Composer tokens
  ecencyToken?: string;
  threeSpeakApiKey?: string;
  giphyApiKey?: string;
  templateToken?: string;
  templateApiBaseUrl?: string;

  // Navigation
  onBack?: () => void;
  onUserClick?: (username: string) => void;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

const formatReputation = (rep: number): string => {
  if (rep === 0) return '25';
  const neg = rep < 0;
  let val = neg ? -rep : rep;
  let out = Math.log10(val);
  out = Math.max(out - 9, 0);
  out = (neg ? -1 : 1) * out;
  out = out * 9 + 25;
  return Math.round(out).toString();
};

const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
};

// ─── Component ───────────────────────────────────────────────────────────────

export function HiveDetailPost({
  author,
  permlink,
  currentUser,
  onUpvote,
  onSubmitComment,
  onClickCommentUpvote,
  onReblog,
  onShare,
  onTip,
  onReport,
  ecencyToken,
  threeSpeakApiKey,
  giphyApiKey,
  templateToken,
  templateApiBaseUrl,
  onBack,
  onUserClick,
}: HiveDetailPostProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hive content renderer using @hiveio/content-renderer
  const hiveRenderer = useMemo(() => new DefaultRenderer({
    baseUrl: 'https://hreplier.sagarkothari88.one/',
    breaks: true,
    skipSanitization: false,
    allowInsecureScriptTags: false,
    addNofollowToLinks: true,
    addTargetBlankToLinks: true,
    doNotShowImages: false,
    assetsWidth: 640,
    assetsHeight: 480,
    imageProxyFn: (url: string) => url,
    usertagUrlFn: (account: string) => `https://hreplier.sagarkothari88.one/#/@${account}`,
    hashtagUrlFn: (hashtag: string) => `https://peakd.com/created/${hashtag}`,
    isLinkSafeFn: () => true,
    addExternalCssClassToMatchingLinksFn: () => false,
    ipfsPrefix: 'https://ipfs.io/ipfs/',
  }), []);

  const renderedBody = useMemo(() => {
    if (!post?.body) return '';
    try {
      let html = hiveRenderer.render(post.body);
      // Wrap <img> tags that have a non-empty alt attribute in <figure>/<figcaption>
      html = html.replace(
        /<img\s([^>]*?)alt="([^"]+)"([^>]*?)\/?\s*>/gi,
        (_match, before, alt, after) => {
          const imgTag = `<img ${before}alt="${alt}"${after}>`;
          return `<figure class="hive-img-figure">${imgTag}<figcaption>${alt}</figcaption></figure>`;
        }
      );
      return html;
    } catch {
      return '';
    }
  }, [post?.body, hiveRenderer]);

  const fetchPostContent = useCallback(async () => {
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
  }, [author, permlink]);

  // Fetch post content
  useEffect(() => {
    fetchPostContent();
  }, [fetchPostContent]);

  // Fetch author profile (lightweight — only what the header needs)
  useEffect(() => {
    const fetchProfile = async () => {
      if (!author) return;
      try {
        const profileResponse = await userService.getProfile(author);
        const user = profileResponse?.result;
        if (!user) return;

        setProfile({
          username: user.name,
          name: user.metadata?.profile?.name,
          profileImage: user.metadata?.profile?.profile_image,
          followersCount: user.stats?.followers || 0,
          followingCount: user.stats?.following || 0,
          postsCount: user.post_count || 0,
          reputation: user.reputation || 0,
        });
      } catch {
        // Silently fail — header still works with author name
      }
    };

    fetchProfile();
  }, [author]);

  // Payout display — same logic as UserDetailProfile
  const payoutValue = useMemo(() => {
    if (!post) return '';
    const raw = post.payout
      ? post.payout.toFixed(3)
      : post.pending_payout_value
        ? post.pending_payout_value.replace(/[^\d.]/g, '')
        : '0.000';
    return `$${raw}`;
  }, [post]);

  const payoutTooltip = useMemo(() => {
    if (!post) return '';
    const lines: string[] = [];

    const rawPayout = post.payout
      ? post.payout.toFixed(3)
      : post.pending_payout_value
        ? post.pending_payout_value.replace(/[^\d.]/g, '')
        : '0.000';

    // Payout mode
    const hbdPercent = post.percent_hbd ?? 10000;
    if (hbdPercent === 0) {
      lines.push('Hive Rewards Payout 100% Powered Up');
    } else {
      lines.push(`Hive Rewards Payout (${(hbdPercent / 200).toFixed(0)}%/${100 - hbdPercent / 200}%)`);
    }

    if (post.is_paidout) {
      const authorVal = post.author_payout_value ? post.author_payout_value.replace(/[^\d.]/g, '') : '';
      lines.push('Past payouts:');
      lines.push(`${rawPayout} Hive Rewards${authorVal ? ` (Author ${authorVal})` : ''}`);
    } else {
      // Time remaining
      if (post.payout_at) {
        const diffMs = new Date(post.payout_at).getTime() - Date.now();
        if (diffMs > 0) {
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          const diffDays = Math.floor(diffHours / 24);
          const remainHours = diffHours % 24;
          const timeStr = diffDays > 0
            ? `in ${diffDays} day${diffDays > 1 ? 's' : ''}${remainHours > 0 ? ` ${remainHours} hour${remainHours > 1 ? 's' : ''}` : ''}`
            : `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
          lines.push(`Payout will occur: ${timeStr}`);
        }
      }
      if (hbdPercent === 0) {
        lines.push(`${rawPayout} Hive Rewards (100% Powered Up)`);
      } else {
        lines.push(`${rawPayout} Hive Rewards (${(hbdPercent / 200).toFixed(0)}%/${100 - hbdPercent / 200}%)`);
      }
    }

    // Beneficiaries
    if (post.beneficiaries?.length > 0) {
      lines.push('Beneficiaries:');
      post.beneficiaries.forEach((b) => {
        lines.push(`${b.account}: ${(b.weight / 100).toFixed(0)}%`);
      });
    }

    return lines.join('\n');
  }, [post]);

  // ─── Skeleton loading state ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dark flex flex-col h-full bg-gray-900 animate-pulse">
        {/* Header skeleton */}
        <div className="sticky top-0 z-30 h-[56px] bg-gray-800 border-b border-gray-700 flex items-center">
          <div className="px-4 py-2 flex items-center gap-2 w-full">
            {onBack && <div className="w-8 h-8 bg-gray-700 rounded-lg flex-shrink-0" />}
            <div className="w-8 h-8 bg-gray-700 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-4 bg-gray-700 rounded w-28 mb-1.5" />
              <div className="h-3 bg-gray-700 rounded w-44" />
            </div>
          </div>
        </div>

        {/* Content skeleton */}
        <div className="flex-1 overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6">
            {/* Title skeleton */}
            <div className="h-7 bg-gray-700 rounded w-4/5 mb-2" />
            <div className="h-7 bg-gray-700 rounded w-3/5 mb-3" />

            {/* Meta skeleton */}
            <div className="flex items-center gap-2 mb-4">
              <div className="h-3.5 bg-gray-700 rounded w-32" />
              <div className="h-3.5 bg-gray-700 rounded w-24" />
            </div>

            {/* Action bar skeleton */}
            <div className="py-2.5 border-y border-gray-700/50 mb-5 flex items-center gap-3">
              <div className="h-4 w-4 bg-gray-700 rounded" />
              <div className="h-3.5 bg-gray-700 rounded w-8" />
              <div className="h-4 w-4 bg-gray-700 rounded" />
              <div className="h-3.5 bg-gray-700 rounded w-8" />
              <div className="h-4 w-4 bg-gray-700 rounded" />
              <div className="h-4 w-4 bg-gray-700 rounded" />
              <div className="h-4 w-4 bg-gray-700 rounded" />
              <div className="h-4 w-4 bg-gray-700 rounded" />
              <div className="flex-1" />
              <div className="h-3.5 bg-gray-700 rounded w-16" />
            </div>

            {/* Body skeleton — mimics article content */}
            <div className="space-y-4">
              {/* Paragraph 1 */}
              <div className="space-y-2">
                <div className="h-4 bg-gray-700/60 rounded w-full" />
                <div className="h-4 bg-gray-700/60 rounded w-full" />
                <div className="h-4 bg-gray-700/60 rounded w-4/5" />
              </div>

              {/* Image placeholder */}
              <div className="h-48 sm:h-64 bg-gray-800 rounded-xl border border-gray-700" />

              {/* Paragraph 2 */}
              <div className="space-y-2">
                <div className="h-4 bg-gray-700/60 rounded w-full" />
                <div className="h-4 bg-gray-700/60 rounded w-full" />
                <div className="h-4 bg-gray-700/60 rounded w-3/5" />
              </div>

              {/* Heading */}
              <div className="h-6 bg-gray-700 rounded w-2/5 mt-2" />

              {/* Paragraph 3 */}
              <div className="space-y-2">
                <div className="h-4 bg-gray-700/60 rounded w-full" />
                <div className="h-4 bg-gray-700/60 rounded w-full" />
                <div className="h-4 bg-gray-700/60 rounded w-full" />
                <div className="h-4 bg-gray-700/60 rounded w-2/3" />
              </div>

              {/* Image placeholder */}
              <div className="h-48 sm:h-64 bg-gray-800 rounded-xl border border-gray-700" />

              {/* Paragraph 4 */}
              <div className="space-y-2">
                <div className="h-4 bg-gray-700/60 rounded w-full" />
                <div className="h-4 bg-gray-700/60 rounded w-3/4" />
              </div>
            </div>

            {/* Tags skeleton */}
            <div className="border-t border-gray-700/50 pt-4 mt-6">
              <div className="flex items-center gap-2">
                <div className="h-5 bg-gray-700 rounded-full w-14" />
                <div className="h-5 bg-gray-700 rounded-full w-16" />
                <div className="h-5 bg-gray-700 rounded-full w-12" />
                <div className="h-5 bg-gray-700 rounded-full w-18" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────────

  if (error || !post) {
    return (
      <div className="dark flex justify-center items-center min-h-screen bg-gray-900 p-8">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">Failed to load post</h3>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button
            onClick={fetchPostContent}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="dark flex flex-col h-full bg-gray-900">
      <div className="flex flex-col overflow-y-auto h-full">

        {/* ── Compact Header: Back + Avatar + Name + Stats (same pattern as UserDetailProfile) ── */}
        <div className="sticky top-0 z-30 h-[56px] bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 flex items-center">
          <div className="px-4 py-2 flex items-center gap-2 w-full">
            {/* Back */}
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-gray-300" />
              </button>
            )}

            {/* Avatar */}
            <img
              src={profile?.profileImage || `https://images.hive.blog/u/${post.author}/avatar`}
              alt={post.author}
              className="w-8 h-8 rounded-full flex-shrink-0 bg-gray-700 cursor-pointer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://images.hive.blog/u/${post.author}/avatar`;
              }}
              onClick={() => onUserClick?.(post.author)}
            />

            {/* Name + Stats inline */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onUserClick?.(post.author)}
                  className="text-sm font-semibold text-white truncate hover:text-blue-400 transition-colors"
                >
                  @{post.author}
                </button>
                {profile && profile.reputation > 0 && (
                  <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {formatReputation(profile.reputation)}
                  </span>
                )}
              </div>
              {profile && (
                <div className="flex items-center gap-3 text-[11px] text-gray-400">
                  <span>
                    <span className="font-semibold text-gray-200">{profile.followersCount.toLocaleString()}</span> Followers
                  </span>
                  <span>
                    <span className="font-semibold text-gray-200">{profile.followingCount.toLocaleString()}</span> Following
                  </span>
                  <span>
                    <span className="font-semibold text-gray-200">{profile.postsCount.toLocaleString()}</span> Posts
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Single-column scrollable content ── */}
        <div className="flex-1">
          <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6">

            {/* Post title + meta */}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-tight mb-2">
              {post.title}
            </h1>
            <div className="text-xs text-gray-400 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDate(post.created)}
              </span>
              {post.community_title && (
                <span>
                  in <span className="text-blue-400">{post.community_title}</span>
                </span>
              )}
            </div>

            {/* Action bar */}
            <div className="py-2.5 border-y border-gray-700/50 mb-4">
              <PostActionButton
                author={post.author}
                permlink={post.permlink}
                currentUser={currentUser}
                hiveValue={payoutValue}
                hiveIconUrl="/images/hive_logo.png"
                payoutTooltip={payoutTooltip}
                initialVotes={post.active_votes || []}
                initialCommentsCount={post.children || 0}
                onUpvote={onUpvote}
                onSubmitComment={onSubmitComment}
                onClickCommentUpvote={onClickCommentUpvote}
                onReblog={onReblog}
                onShare={onShare}
                onTip={onTip}
                onReport={onReport}
                ecencyToken={ecencyToken}
                threeSpeakApiKey={threeSpeakApiKey}
                giphyApiKey={giphyApiKey}
                templateToken={templateToken}
                templateApiBaseUrl={templateApiBaseUrl}
              />
            </div>

            {/* Rendered body — full width */}
            <div className="pb-6">
              {renderedBody ? (
                <div
                  className="hive-post-body"
                  dangerouslySetInnerHTML={{ __html: renderedBody }}
                />
              ) : (
                <p className="text-gray-400 text-sm italic">No content available.</p>
              )}
            </div>

            {/* Tags */}
            {post.json_metadata?.tags && post.json_metadata.tags.length > 0 && (
              <div className="border-t border-gray-700/50 pt-4 pb-4">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                  <Tag className="w-3.5 h-3.5" /> Tags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {post.json_metadata.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2.5 py-0.5 bg-blue-900/50 text-blue-300 text-[11px] rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom action bar (repeat for long posts) */}
            <div className="py-2.5 border-t border-gray-700/50">
              <PostActionButton
                author={post.author}
                permlink={post.permlink}
                currentUser={currentUser}
                hiveValue={payoutValue}
                hiveIconUrl="/images/hive_logo.png"
                payoutTooltip={payoutTooltip}
                initialVotes={post.active_votes || []}
                initialCommentsCount={post.children || 0}
                onUpvote={onUpvote}
                onSubmitComment={onSubmitComment}
                onClickCommentUpvote={onClickCommentUpvote}
                onReblog={onReblog}
                onShare={onShare}
                onTip={onTip}
                onReport={onReport}
                ecencyToken={ecencyToken}
                threeSpeakApiKey={threeSpeakApiKey}
                giphyApiKey={giphyApiKey}
                templateToken={templateToken}
                templateApiBaseUrl={templateApiBaseUrl}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default HiveDetailPost;
