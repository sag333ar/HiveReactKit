import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { apiService } from '@/services/apiService';
import { userService } from '@/services/userService';
import { Post } from '@/types/post';
import { Poll } from '@/types/poll';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Tag,
  Clock,
  BarChart2,
  CheckCircle2,
  Circle,
  Send,
} from 'lucide-react';
import { PostActionButton } from './actionButtons/PostActionButton';
import { createHiveRenderer } from '@snapie/renderer';
import InlineCommentSection from './inlineComments/InlineCommentSection';

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

  // Comment-level action callbacks (receive author/permlink of the specific comment)
  onShareComment?: (author: string, permlink: string) => void;
  onTipComment?: (author: string, permlink: string) => void;
  onReportComment?: (author: string, permlink: string) => void;

  /**
   * Called when the user submits a poll vote.
   * @param author - post author
   * @param permlink - post permlink
   * @param choiceNums - 1-based choice numbers selected by the user
   */
  onVotePoll?: (author: string, permlink: string, choiceNums: number[]) => void | Promise<void>;

  // Composer tokens
  ecencyToken?: string;
  threeSpeakApiKey?: string;
  giphyApiKey?: string;
  templateToken?: string;
  templateApiBaseUrl?: string;

  // Content moderation
  /** Array of usernames whose comments should be hidden from the current user's view. */
  reportedAuthors?: string[];
  /** Array of {author, permlink} posts/comments to hide from the current user's view. */
  reportedPosts?: { author: string; permlink: string }[];

  // Theming
  /** URL to a Hive logo icon shown next to the payout value. Defaults to "/images/hive_logo.png". */
  hiveIconUrl?: string;
  /** Background color for the component. Pass a single color string for a solid background, or an array of colors for a gradient (e.g. `["#0f172a", "#1e293b"]` or `["#1a1a2e", "#16213e", "#0f3460"]`). Defaults to gray-900. */
  backgroundColor?: string | string[];

  // Navigation
  onBack?: () => void;
  onUserClick?: (username: string) => void;
  /** Called when user clicks "View parent post" — navigate to the parent post. */
  onNavigateToPost?: (author: string, permlink: string) => void;
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
  onShareComment,
  onTipComment,
  onReportComment,
  ecencyToken,
  threeSpeakApiKey,
  giphyApiKey,
  templateToken,
  templateApiBaseUrl,
  reportedAuthors,
  reportedPosts,
  hiveIconUrl = '/images/hive_logo.png',
  backgroundColor,
  onBack,
  onUserClick,
  onNavigateToPost,
  onVotePoll,
}: HiveDetailPostProps) {
  // Compute background style from prop
  const bgStyle = useMemo<React.CSSProperties>(() => {
    if (!backgroundColor) return {};
    if (Array.isArray(backgroundColor)) {
      if (backgroundColor.length === 0) return {};
      if (backgroundColor.length === 1) return { background: backgroundColor[0] };
      return { background: `linear-gradient(to bottom, ${backgroundColor.join(', ')})` };
    }
    return { background: backgroundColor };
  }, [backgroundColor]);

  // Slightly darkened variant for the sticky header
  const headerBgStyle = useMemo<React.CSSProperties>(() => {
    if (!backgroundColor) return {};
    if (Array.isArray(backgroundColor)) {
      // Use the first color with opacity for the header
      return { backgroundColor: backgroundColor[0], opacity: 0.97 };
    }
    return { backgroundColor };
  }, [backgroundColor]);

  const [post, setPost] = useState<Post | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [pollLoading, setPollLoading] = useState(false);
  const commentsSectionRef = useRef<HTMLDivElement>(null);
  const [selectedChoices, setSelectedChoices] = useState<number[]>([]);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [votedChoices, setVotedChoices] = useState<number[]>([]);

  // Hive content renderer using @snapie/renderer (supports YouTube, 3Speak, IPFS, X.com)
  const renderMarkdown = useMemo(() => {
    try {
      return createHiveRenderer({
        baseUrl: 'https://hreplier.sagarkothari88.one/',
        ipfsGateway: 'https://ipfs.3speak.tv',
        assetsWidth: 640,
        assetsHeight: 480,
        usertagUrlFn: (user: string) => `https://hreplier.sagarkothari88.one/#/@${user}`,
        hashtagUrlFn: (tag: string) => `https://peakd.com/created/${tag}`,
        convertHiveUrls: true,
      });
    } catch {
      return null;
    }
  }, []);

  const renderedBody = useMemo(() => {
    if (!post?.body || !renderMarkdown) return '';
    try {
      let html = renderMarkdown(post.body);

      // Upgrade 3Speak embed URLs to play.3speak.tv with portrait-friendly params
      // (matches hive-snaps ThreeSpeakPlayer: play.3speak.tv/embed?v=...&mode=iframe&noscroll=1)
      html = html.replace(
        /https:\/\/3speak\.tv\/embed\?v=([^"&\s]+)/gi,
        (_m: string, v: string) =>
          `https://play.3speak.tv/embed?v=${v}&mode=iframe&noscroll=1`,
      );

      // Wrap 3Speak video iframes in .threeSpeakWrapper for portrait (9:16) aspect ratio
      html = html.replace(
        /(<iframe\s[^>]*src="https:\/\/play\.3speak\.tv\/embed[^"]*"[^>]*><\/iframe>)/gi,
        '<div class="threeSpeakWrapper">$1</div>',
      );

      // Wrap 3Speak audio iframes in .audioWrapper — crop to just the player controls
      html = html.replace(
        /<iframe\s[^>]*src="(https:\/\/audio\.3speak\.tv\/play\?[^"]*)"[^>]*>(?:<\/iframe>)?/gi,
        (_m: string, url: string) => {
          // Ensure mode=minimal and iframe=1 are present
          let cleanUrl = url;
          if (!cleanUrl.includes('mode=minimal')) cleanUrl += '&mode=minimal';
          if (!cleanUrl.includes('iframe=1')) cleanUrl += '&iframe=1';
          return `<div class="audioWrapper"><iframe src="${cleanUrl}" scrolling="no" frameborder="0" allow="autoplay"></iframe></div>`;
        },
      );

      // Wrap <img> tags that have a non-empty alt attribute in <figure>/<figcaption>
      html = html.replace(
        /<img\s([^>]*?)alt="([^"]+)"([^>]*?)\/?\s*>/gi,
        (_match: string, before: string, alt: string, after: string) => {
          const imgTag = `<img ${before}alt="${alt}"${after}>`;
          return `<figure class="hive-img-figure">${imgTag}<figcaption>${alt}</figcaption></figure>`;
        }
      );
      return html;
    } catch {
      return '';
    }
  }, [post?.body, renderMarkdown]);

  // Parse json_metadata — condenser_api returns it as a raw JSON string; bridge returns an object.
  // Cast via unknown so the runtime string check works despite the Post type saying object.
  const parsedMetadata = useMemo(() => {
    const raw = post?.json_metadata as unknown;
    if (!raw) return {} as Record<string, any>;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) as Record<string, any>; } catch { return {} as Record<string, any>; }
    }
    return raw as Record<string, any>;
  }, [post?.json_metadata]);

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

  // Fetch poll data when post has content_type === 'poll'
  useEffect(() => {
    if (!post || parsedMetadata?.content_type !== 'poll') return;
    setPollLoading(true);
    userService.getPollDetail(post.author, post.permlink)
      .then((data) => setPoll(data))
      .catch(() => setPoll(null))
      .finally(() => setPollLoading(false));
  }, [post?.author, post?.permlink, parsedMetadata?.content_type]);

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

  // Helper: parse numeric value from a Hive value string like "1.234 HBD"
  // Also handles dhive Asset objects which stringify to e.g. "0.247 HBD"
  const parseHiveValue = (val?: unknown): number => {
    if (!val) return 0;
    const str = typeof val === 'string' ? val : String(val);
    const num = parseFloat(str.replace(/[^\d.]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  // Payout display — compute total from all payout fields
  const payoutValue = useMemo(() => {
    if (!post) return '';

    // 1. bridge API sets `payout` as a number
    if (post.payout && post.payout > 0) return `${post.payout.toFixed(3)}`;

    // 2. For pending posts, use pending_payout_value
    const pending = parseHiveValue(post.pending_payout_value);
    if (pending > 0) return `${pending.toFixed(3)}`;

    // 3. condenser_api returns total_payout_value for paid-out posts
    const totalPay = parseHiveValue((post as any).total_payout_value);
    if (totalPay > 0) return `${totalPay.toFixed(3)}`;

    // 4. Sum author + curator payouts
    const authorPay = parseHiveValue(post.author_payout_value);
    const curatorPay = parseHiveValue(post.curator_payout_value);
    const total = authorPay + curatorPay;
    if (total > 0) return `${total.toFixed(3)}`;

    return '0.000';
  }, [post]);

  const payoutTooltip = useMemo(() => {
    if (!post) return '';
    const lines: string[] = [];

    const pending = parseHiveValue(post.pending_payout_value);
    const authorPay = parseHiveValue(post.author_payout_value);
    const curatorPay = parseHiveValue(post.curator_payout_value);
    const total = post.payout && post.payout > 0 ? post.payout : (pending > 0 ? pending : authorPay + curatorPay);

    // Payout mode
    const hbdPercent = post.percent_hbd ?? 10000;
    if (hbdPercent === 0) {
      lines.push('Hive Rewards Payout 100% Powered Up');
    } else {
      lines.push(`Hive Rewards Payout (${(hbdPercent / 200).toFixed(0)}%/${100 - hbdPercent / 200}%)`);
    }

    if (post.is_paidout) {
      lines.push('Past payouts:');
      if (authorPay > 0) lines.push(`Author: $${authorPay.toFixed(3)}`);
      if (curatorPay > 0) lines.push(`Curator: $${curatorPay.toFixed(3)}`);
      lines.push(`Total: $${total.toFixed(3)}`);
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
      lines.push(`Pending: $${pending.toFixed(3)}`);
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
      <div className="dark flex flex-col h-full bg-gray-900 animate-pulse" style={bgStyle}>
        {/* Header skeleton */}
        <div className="sticky top-0 z-30 h-[56px] bg-gray-800 border-b border-gray-700 flex items-center" style={headerBgStyle}>
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
      <div className="dark flex justify-center items-center min-h-screen bg-gray-900 p-8" style={bgStyle}>
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
    <div className="dark flex flex-col h-full bg-gray-900" style={bgStyle}>
      <div className="flex flex-col overflow-y-auto h-full">

        {/* ── Compact Header: Back + Avatar + Name + Stats (same pattern as UserDetailProfile) ── */}
        <div className="sticky top-0 z-30 h-[56px] bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 flex items-center" style={headerBgStyle}>
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

            {/* View Parent — shown when this post is a reply (depth > 0) */}
            {post.depth > 0 && post.parent_author && post.parent_permlink && (
              <button
                onClick={() => onNavigateToPost?.(post.parent_author!, post.parent_permlink!)}
                className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-700/60 transition-colors text-sm text-blue-400 hover:text-blue-300"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>View parent post</span>
                <span className="text-gray-500 text-xs truncate max-w-[250px]">
                  @{post.parent_author}/{post.parent_permlink}
                </span>
              </button>
            )}

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

            {/* ── Poll Widget ── */}
            {parsedMetadata?.content_type === 'poll' && (() => {
              const maxChoices: number = poll?.max_choices_voted ?? parsedMetadata?.max_choices_voted ?? 1;
              const isMulti = maxChoices > 1;
              const endTs = poll?.end_time
                ? new Date(poll.end_time).getTime()
                : (parsedMetadata?.end_time ?? 0) * 1000;
              const pollEnded = endTs > 0 && Date.now() > endTs;
              const hasVoted = votedChoices.length > 0;
              // Check if currentUser already voted (from API data).
              // poll_voters may have .choices[] (multi) or .choice_num (single) — handle both.
              const apiVoter = currentUser
                ? poll?.poll_voters?.find(v => v.name === currentUser)
                : undefined;
              const apiVotedChoices: number[] = apiVoter?.choices?.length
                ? apiVoter.choices
                : apiVoter?.choice_num != null
                  ? [apiVoter.choice_num]
                  : [];
              const alreadyVoted = hasVoted || apiVotedChoices.length > 0;
              const allowVoteChanges = poll?.allow_vote_changes ?? parsedMetadata?.allow_vote_changes ?? false;
              const displayVoted = hasVoted ? votedChoices : apiVotedChoices;
              // Show vote UI for: logged-in user + active poll + callback provided + (not yet voted OR vote changes allowed)
              const showVoteUI = !!currentUser && !pollEnded && !!onVotePoll && (!alreadyVoted || allowVoteChanges);
              // Track whether user is changing their vote (already voted + allowed to change)
              const isChangingVote = alreadyVoted && allowVoteChanges && !hasVoted;
              const choices = poll?.poll_choices ?? (parsedMetadata?.choices ?? []).map((text: string, i: number) => ({ choice_num: i + 1, choice_text: text, votes: null }));
              const totalVotes = choices.reduce((sum: number, c: any) => sum + (c.votes?.total_votes ?? 0), 0);

              // When changing vote: use submit button flow (even for single choice)
              const needsSubmitButton = isMulti || isChangingVote;

              const handleChoiceClick = async (choiceNum: number) => {
                if (!showVoteUI || isSubmittingVote) return;
                if (!needsSubmitButton) {
                  // Single choice, first vote — vote immediately
                  setIsSubmittingVote(true);
                  try {
                    await onVotePoll?.(post!.author, post!.permlink, [choiceNum]);
                    setVotedChoices([choiceNum]);
                  } finally {
                    setIsSubmittingVote(false);
                  }
                } else {
                  // Multi choice or changing vote — toggle selection
                  setSelectedChoices(prev => {
                    if (prev.includes(choiceNum)) return prev.filter(n => n !== choiceNum);
                    if (prev.length >= maxChoices) return prev; // cap at max
                    return [...prev, choiceNum];
                  });
                }
              };

              const handleSubmit = async () => {
                if (!showVoteUI || isSubmittingVote || selectedChoices.length === 0) return;
                setIsSubmittingVote(true);
                try {
                  await onVotePoll?.(post!.author, post!.permlink, selectedChoices);
                  setVotedChoices(selectedChoices);
                  setSelectedChoices([]);
                } finally {
                  setIsSubmittingVote(false);
                }
              };

              return (
                <div className="mb-6 rounded-xl border border-gray-700 bg-gray-800/60 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                    <BarChart2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Poll</span>
                    <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium ${pollEnded ? 'bg-gray-700 text-gray-400' : 'bg-green-900/50 text-green-400'}`}>
                      {pollEnded ? 'Ended' : `Ends in ${Math.ceil((endTs - Date.now()) / (1000 * 60 * 60 * 24))}d`}
                    </span>
                  </div>

                  {/* Question */}
                  <p className="px-4 pb-3 text-sm font-semibold text-white">
                    {poll?.question ?? parsedMetadata?.question}
                  </p>

                  {/* Selection hint */}
                  {showVoteUI && needsSubmitButton && (
                    <p className="px-4 pb-2 text-[11px] text-gray-400">
                      {isChangingVote ? 'Change your vote — ' : ''}Select up to {maxChoices} option{maxChoices > 1 ? 's' : ''}
                      {selectedChoices.length > 0 && (
                        <span className="ml-1 text-blue-400">· {selectedChoices.length} selected</span>
                      )}
                    </p>
                  )}

                  {/* Choices */}
                  <div className="px-4 pb-4 space-y-2">
                    {pollLoading ? (
                      [1, 2, 3].map(i => (
                        <div key={i} className="h-9 bg-gray-700/50 rounded-lg animate-pulse" />
                      ))
                    ) : choices.map((choice: { choice_num: number; choice_text: string; votes?: { total_votes: number } | null }) => {
                      const votes = choice.votes?.total_votes ?? 0;
                      const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                      const isVoted = displayVoted.includes(choice.choice_num);
                      const isSelected = selectedChoices.includes(choice.choice_num);
                      const isMaxed = needsSubmitButton && selectedChoices.length >= maxChoices && !isSelected;
                      const isClickable = showVoteUI && !isMaxed;

                      let borderColor = 'border-gray-700';
                      let iconEl = <Circle className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />;
                      let fillColor = 'bg-blue-600/20';

                      if (isSelected) {
                        // Currently selected (new selection)
                        borderColor = 'border-blue-500/60';
                        iconEl = <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
                      } else if (isVoted && !isChangingVote) {
                        // Previously voted and not in change mode — solid green
                        borderColor = 'border-green-600/60';
                        iconEl = <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />;
                        fillColor = 'bg-green-600/20';
                      } else if (isVoted && isChangingVote) {
                        // Previously voted but in change mode — dimmed green (old vote)
                        borderColor = 'border-green-800/40';
                        iconEl = <CheckCircle2 className="w-3.5 h-3.5 text-green-700 flex-shrink-0" />;
                        fillColor = 'bg-green-900/10';
                      }

                      return (
                        <div
                          key={choice.choice_num}
                          className={`relative rounded-lg overflow-hidden border ${borderColor} bg-gray-900/50 transition-colors ${isClickable ? 'cursor-pointer hover:border-blue-500/40' : isMaxed ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={() => handleChoiceClick(choice.choice_num)}
                        >
                          {pct > 0 && (
                            <div
                              className={`absolute inset-y-0 left-0 ${fillColor} transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                            />
                          )}
                          <div className="relative flex items-center justify-between px-3 py-2.5 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {iconEl}
                              <span className={`text-sm truncate ${isSelected ? 'text-blue-300 font-medium' : isVoted && !isChangingVote ? 'text-green-300 font-medium' : isVoted && isChangingVote ? 'text-green-700' : 'text-gray-200'}`}>
                                {choice.choice_text}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 text-[11px] text-gray-400">
                              <span>{pct}%</span>
                              <span className="text-gray-600">·</span>
                              <span>{votes} vote{votes !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Submit / Change vote button */}
                  {showVoteUI && needsSubmitButton && (
                    <div className="px-4 pb-4">
                      <button
                        onClick={handleSubmit}
                        disabled={selectedChoices.length === 0 || isSubmittingVote}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors w-full justify-center font-medium"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {isSubmittingVote ? 'Submitting…' : isChangingVote ? 'Change Vote' : `Submit Vote${selectedChoices.length > 1 ? 's' : ''}`}
                      </button>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="px-4 pb-3 text-[11px] text-gray-500 border-t border-gray-700/50 pt-2 flex items-center gap-2">
                    <span>{poll?.poll_stats?.total_voting_accounts_num ?? 0} voter{(poll?.poll_stats?.total_voting_accounts_num ?? 0) !== 1 ? 's' : ''} total</span>
                    {alreadyVoted && (
                      <span className="text-green-500 ml-auto">
                        ✓ Voted{allowVoteChanges ? ' · Vote changes allowed' : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Tags */}
            {parsedMetadata?.tags && parsedMetadata.tags.length > 0 && (
              <div className="border-t border-gray-700/50 pt-4 pb-4">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                  <Tag className="w-3.5 h-3.5" /> Tags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {parsedMetadata.tags.map((tag: string, index: number) => (
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
                hiveIconUrl={hiveIconUrl}
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
                disableCommentsModal
                onComments={() => commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
              />
            </div>

            {/* Inline comments section */}
            <div ref={commentsSectionRef}>
              <InlineCommentSection
                author={post.author}
                permlink={post.permlink}
                currentUser={currentUser}
                onSubmitComment={onSubmitComment}
                onClickCommentUpvote={onClickCommentUpvote}
                ecencyToken={ecencyToken}
                threeSpeakApiKey={threeSpeakApiKey}
                giphyApiKey={giphyApiKey}
                templateToken={templateToken}
                templateApiBaseUrl={templateApiBaseUrl}
                reportedAuthors={reportedAuthors}
                reportedPosts={reportedPosts}
                hiveIconUrl={hiveIconUrl}
                onShareComment={onShareComment}
                onTipComment={onTipComment}
                onReportComment={onReportComment}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default HiveDetailPost;
