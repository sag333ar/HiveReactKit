/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  ArrowLeft,
  User,
  Users,
  MessageCircle,
  FileText,
  Reply,
  Camera,
  BarChart3,
  Activity,
  Wallet as WalletIcon,
  MoreVertical,
  MapPin,
  Globe,
  Calendar,
  Clock,
  Zap,
  Share2,
  Flag,
  Ban,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Award,
  TrendingUp,
} from "lucide-react";
import { Wallet } from "../Wallet";
import ActivityList from "../ActivityList";
import { PostActionButton } from "../actionButtons/PostActionButton";
import { userService } from "@/services/userService";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Post } from "@/types/post";
import type { Follower, Following } from "@/types/user";
import type { Poll } from "@/types/poll";
import type { PendingAuthorRow, PendingCurationRow } from "@/types/reward";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserDetailProfileProps {
  username: string;
  currentUsername?: string;
  onBack?: () => void;
  showBackButton?: boolean;

  /**
   * Controls which tabs are shown and their order.
   * Only tabs listed here will be visible, in the order provided.
   * The first tab becomes the default active tab.
   * If omitted, all tabs are shown in default order.
   * Example: `["followers", "following", "blogs", "wallet"]` — only these 4 tabs, in this order.
   */
  tabShown?: TabType[];

  // Social action callbacks
  onFollow?: (username: string) => void | Promise<void>;
  onUnfollow?: (username: string) => void | Promise<void>;
  onIgnoreAuthor?: (username: string) => void | Promise<void>;
  onReportUser?: (username: string, reason: string) => void | Promise<void>;

  // PostActionButton callbacks
  onUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onSubmitComment?: (parentAuthor: string, parentPermlink: string, body: string) => void | Promise<void>;
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onReblog?: (author: string, permlink: string) => void;
  onTip?: (author: string, permlink: string) => void;
  onReportPost?: (author: string, permlink: string) => void;

  // Navigation callbacks
  onUserClick?: (username: string) => void;
  onPostClick?: (author: string, permlink: string, title: string) => void;
  onSnapClick?: (author: string, permlink: string) => void;
  onPollClick?: (author: string, permlink: string, question: string) => void;
  onActivityPermlink?: (author: string, permlink: string) => void;
  onActivitySelect?: (activity: any) => void;
  onShare?: (username: string) => void;
}

interface ProfileData {
  username: string;
  name?: string;
  about?: string;
  location?: string;
  website?: string;
  profileImage?: string;
  coverImage?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  reputation: number;
  isFollowing: boolean;
  created?: string;
  lastActivity?: string;
  hivePower?: number;
  votingPower?: number;
}

type TabType = "blogs" | "posts" | "snaps" | "polls" | "comments" | "replies" | "activities" | "authorRewards" | "curationRewards" | "followers" | "following" | "wallet";

const REPORT_REASONS = [
  "Spam",
  "Harassment",
  "Hate Speech",
  "Violence",
  "IP Violation",
  "Self-harm",
  "Doxxing",
  "Minor Safety",
  "Other",
];

// ─── Utilities ───────────────────────────────────────────────────────────────

const formatTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

const formatReputation = (rep: number): string => {
  if (rep === 0) return "25";
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
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

/** Strip HTML, markdown images, markdown links, bare URLs, and leftover brackets to get plain text only */
const extractPlainText = (body: string): string => {
  let text = body;
  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, "");
  // Remove markdown images ![alt](url)
  text = text.replace(/!\[.*?\]\([^\s)]+\)/g, "");
  // Replace markdown links [text](url) with just text
  text = text.replace(/\[([^\]]*)\]\([^\s)]+\)/g, "$1");
  // Remove bare URLs
  text = text.replace(/https?:\/\/[^\s)>\]]+/g, "");
  // Remove leftover image alt-text markers like [ihdd] or (url)
  text = text.replace(/\[.*?\]/g, "");
  text = text.replace(/\(https?:\/\/[^\s)]*\)/g, "");
  // Remove markdown formatting characters
  text = text.replace(/[*_~`#>|]/g, "");
  // Remove horizontal rules (---, ___, ***)
  text = text.replace(/^[-_*]{3,}\s*$/gm, "");
  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
};

// ─── Component ───────────────────────────────────────────────────────────────

const UserDetailProfile: React.FC<UserDetailProfileProps> = ({
  username,
  currentUsername,
  onBack,
  showBackButton = false,
  tabShown,
  onFollow,
  onUnfollow,
  onIgnoreAuthor,
  onReportUser,
  onUpvote,
  onSubmitComment,
  onClickCommentUpvote,
  onReblog,
  onTip,
  onReportPost,
  onUserClick,
  onPostClick,
  onSnapClick,
  onPollClick,
  onActivityPermlink,
  onActivitySelect,
  onShare,
}) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("blogs"); // will be corrected in useEffect

  // Content states
  const [blogs, setBlogs] = useState<Post[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Post[]>([]);
  const [snaps, setSnaps] = useState<Post[]>([]);
  const [snapsNextStartId, setSnapsNextStartId] = useState<number | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [authorRewards, setAuthorRewards] = useState<PendingAuthorRow[]>([]);
  const [authorRewardsTotals, setAuthorRewardsTotals] = useState<{ totalHbd: number; totalHpEq: number }>({ totalHbd: 0, totalHpEq: 0 });
  const [curationRewards, setCurationRewards] = useState<PendingCurationRow[]>([]);
  const [curationRewardsTotals, setCurationRewardsTotals] = useState<{ totalHp: number; totalHbd: number }>({ totalHp: 0, totalHbd: 0 });
  const [rewardsStillLoading, setRewardsStillLoading] = useState(false);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [following, setFollowing] = useState<Following[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);

  // Pagination states
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState<Record<TabType, boolean>>({
    blogs: true, posts: true, snaps: true, polls: false, comments: true, replies: true,
    activities: false, authorRewards: false, curationRewards: false, followers: true, following: true, wallet: false,
  });
  const PAGE_SIZE = 20;
  const FOLLOWER_PAGE_SIZE = 100;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // UI states
  const [actionLoading, setActionLoading] = useState(false);
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  const [showIgnoreConfirm, setShowIgnoreConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();
  const targetUsername = username.replace(/^@/, "").trim();

  // ─── Close dropdown on outside click ─────────────────────────────────────

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowActionDropdown(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // ─── Fetch profile data ──────────────────────────────────────────────────

  useEffect(() => {
    const fetchProfile = async () => {
      if (!targetUsername) return;
      setLoading(true);
      setError(null);

      try {
        const [profileResponse, accounts, globalProps] = await Promise.all([
          userService.getProfile(targetUsername),
          userService.getAccounts([targetUsername]),
          userService.getDynamicGlobalProperties(),
        ]);

        const user = profileResponse?.result;
        const account = accounts?.[0];
        if (!user) {
          setError("User not found");
          return;
        }

        // Calculate Hive Power
        let hivePower: number | undefined;
        if (globalProps && account?.vesting_shares) {
          const vestingShares = parseFloat(account.vesting_shares.split(" ")[0]);
          const totalVestingShares = parseFloat(globalProps.total_vesting_shares.split(" ")[0]);
          const totalVestingFundHive = parseFloat(globalProps.total_vesting_fund_hive.split(" ")[0]);
          hivePower = (vestingShares / totalVestingShares) * totalVestingFundHive;
        }

        // Calculate voting power
        let votingPower: number | undefined;
        if (account?.voting_power) {
          votingPower = (account.voting_power / 10000) * 100;
        }

        // Check if current user follows target
        let isFollowing = false;
        if (currentUsername && currentUsername !== targetUsername) {
          try {
            const currentFollowing = await userService.getFollowing(currentUsername);
            isFollowing = currentFollowing.some((f) => f.following === targetUsername);
          } catch {
            // Silently fail - isFollowing stays false
          }
        }

        // Parse posting_json_metadata for fallback profile fields
        let postingProfile: any = null;
        if (account?.posting_json_metadata) {
          try {
            const parsed = JSON.parse(account.posting_json_metadata);
            postingProfile = parsed?.profile;
          } catch {
            // Invalid JSON — ignore
          }
        }

        // Also try json_metadata as another fallback
        let jsonProfile: any = null;
        if (account?.json_metadata) {
          try {
            const parsed = JSON.parse(account.json_metadata);
            jsonProfile = parsed?.profile;
          } catch {
            // Invalid JSON — ignore
          }
        }

        // Priority: posting_json_metadata > json_metadata > bridge.get_profile
        const bridgeProfile = user.metadata?.profile;

        const profileData: ProfileData = {
          username: user.name,
          name: postingProfile?.name || jsonProfile?.name || bridgeProfile?.name,
          about: postingProfile?.about || jsonProfile?.about || bridgeProfile?.about,
          location: postingProfile?.location || jsonProfile?.location || bridgeProfile?.location,
          website: postingProfile?.website || jsonProfile?.website || bridgeProfile?.website,
          profileImage: postingProfile?.profile_image || jsonProfile?.profile_image || bridgeProfile?.profile_image,
          coverImage: postingProfile?.cover_image || jsonProfile?.cover_image || bridgeProfile?.cover_image,
          followersCount: user.stats?.followers || 0,
          followingCount: user.stats?.following || 0,
          postsCount: user.post_count || 0,
          reputation: user.reputation || 0,
          isFollowing,
          created: user.created,
          lastActivity: account?.last_post,
          hivePower,
          votingPower,
        };

        setProfile(profileData);
      } catch (err) {
        console.error("Error fetching user profile:", err);
        setError("Failed to load user profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [targetUsername, currentUsername]);

  // ─── Reset state on username change ──────────────────────────────────────

  useEffect(() => {
    setBlogs([]);
    setPosts([]);
    setSnaps([]);
    setSnapsNextStartId(null);
    setPolls([]);
    setAuthorRewards([]);
    setAuthorRewardsTotals({ totalHbd: 0, totalHpEq: 0 });
    setCurationRewards([]);
    setCurationRewardsTotals({ totalHp: 0, totalHbd: 0 });
    setComments([]);
    setReplies([]);
    setFollowers([]);
    setFollowing([]);
    // First tab in tabShown is the default; if no tabShown, default to "blogs"
    const firstTab = tabShown && tabShown.length > 0 ? tabShown[0] : "blogs";
    setActiveTab(firstTab);
    setHasMore({ blogs: true, posts: true, snaps: true, polls: false, comments: true, replies: true, activities: false, authorRewards: false, curationRewards: false, followers: true, following: true, wallet: false });
  }, [targetUsername]);

  // ─── Fetch content based on active tab (initial page) ───────────────────

  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    const fetchTabContent = async () => {
      if (!targetUsername) return;
      setLoadingContent(true);
      setRewardsStillLoading(false);

      // Clear stale reward data when switching to reward tabs
      if (activeTab === "authorRewards") {
        setAuthorRewards([]);
        setAuthorRewardsTotals({ totalHbd: 0, totalHpEq: 0 });
      }
      if (activeTab === "curationRewards") {
        setCurationRewards([]);
        setCurationRewardsTotals({ totalHp: 0, totalHbd: 0 });
      }

      try {
        switch (activeTab) {
          case "blogs": {
            const data = await userService.getUserBlogs(targetUsername, PAGE_SIZE, undefined, undefined, signal);
            setBlogs(data);
            setHasMore((prev) => ({ ...prev, blogs: data.length >= PAGE_SIZE }));
            break;
          }
          case "posts": {
            const data = await userService.getUserPosts(targetUsername, PAGE_SIZE, undefined, undefined, signal);
            setPosts(data);
            setHasMore((prev) => ({ ...prev, posts: data.length >= PAGE_SIZE }));
            break;
          }
          case "snaps": {
            const { snaps: data, nextStartId } = await userService.getUserSnaps(targetUsername, undefined, currentUsername, signal);
            setSnaps(data);
            setSnapsNextStartId(nextStartId);
            setHasMore((prev) => ({ ...prev, snaps: nextStartId !== null }));
            break;
          }
          case "polls": {
            const data = await userService.getUserPolls(targetUsername, signal);
            setPolls(data);
            setHasMore((prev) => ({ ...prev, polls: false }));
            break;
          }
          case "comments": {
            const data = await userService.getUserComments(targetUsername, PAGE_SIZE, undefined, undefined, signal);
            setComments(data);
            setHasMore((prev) => ({ ...prev, comments: data.length >= PAGE_SIZE }));
            break;
          }
          case "replies": {
            const data = await userService.getUserReplies(targetUsername, PAGE_SIZE, undefined, undefined, signal);
            setReplies(data);
            setHasMore((prev) => ({ ...prev, replies: data.length >= PAGE_SIZE }));
            break;
          }
          case "followers": {
            const data = await userService.getFollowers(targetUsername, null, FOLLOWER_PAGE_SIZE, signal);
            setFollowers(data);
            setHasMore((prev) => ({ ...prev, followers: data.length >= FOLLOWER_PAGE_SIZE }));
            break;
          }
          case "following": {
            const data = await userService.getFollowing(targetUsername, null, FOLLOWER_PAGE_SIZE, signal);
            setFollowing(data);
            setHasMore((prev) => ({ ...prev, following: data.length >= FOLLOWER_PAGE_SIZE }));
            break;
          }
          case "authorRewards": {
            setRewardsStillLoading(true);
            const data = await userService.getPendingAuthorRewards(
              targetUsername,
              (rows, totalHbd, totalHpEq) => {
                if (signal.aborted) return;
                setAuthorRewards([...rows]);
                setAuthorRewardsTotals({ totalHbd, totalHpEq });
                setLoadingContent(false);
              },
              signal
            );
            setAuthorRewards(data.rows);
            setAuthorRewardsTotals({ totalHbd: data.totalHbd, totalHpEq: data.totalHpEq });
            setRewardsStillLoading(false);
            break;
          }
          case "curationRewards": {
            setRewardsStillLoading(true);
            const data = await userService.getPendingCurationRewards(
              targetUsername,
              (rows, totalHp, totalHbd) => {
                if (signal.aborted) return;
                setCurationRewards([...rows]);
                setCurationRewardsTotals({ totalHp, totalHbd });
                setLoadingContent(false);
              },
              signal
            );
            setCurationRewards(data.rows);
            setCurationRewardsTotals({ totalHp: data.totalHp, totalHbd: data.totalHbd });
            setRewardsStillLoading(false);
            break;
          }
        }
      } catch (err: any) {
        // AbortError is expected when switching tabs — silently ignore
        if (err?.name === 'AbortError') return;
        console.error(`Error fetching ${activeTab}:`, err);
      } finally {
        if (!signal.aborted) setLoadingContent(false);
      }
    };

    fetchTabContent();

    return () => {
      abortController.abort();
    };
  }, [targetUsername, activeTab]);

  // ─── Load more (next page) ────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore[activeTab] || !targetUsername) return;
    setLoadingMore(true);

    try {
      switch (activeTab) {
        case "blogs": {
          const last = blogs[blogs.length - 1];
          if (!last) break;
          const data = await userService.getUserBlogs(targetUsername, PAGE_SIZE, last.author, last.permlink);
          // First item is the same as last cursor, skip it
          const newItems = data.length > 0 && data[0].permlink === last.permlink ? data.slice(1) : data;
          setBlogs((prev) => [...prev, ...newItems]);
          setHasMore((prev) => ({ ...prev, blogs: newItems.length >= PAGE_SIZE - 1 }));
          break;
        }
        case "posts": {
          const last = posts[posts.length - 1];
          if (!last) break;
          const data = await userService.getUserPosts(targetUsername, PAGE_SIZE, last.author, last.permlink);
          const newItems = data.length > 0 && data[0].permlink === last.permlink ? data.slice(1) : data;
          setPosts((prev) => [...prev, ...newItems]);
          setHasMore((prev) => ({ ...prev, posts: newItems.length >= PAGE_SIZE - 1 }));
          break;
        }
        case "snaps": {
          if (!snapsNextStartId) break;
          const { snaps: newSnaps, nextStartId } = await userService.getUserSnaps(targetUsername, snapsNextStartId, currentUsername);
          setSnaps((prev) => [...prev, ...newSnaps]);
          setSnapsNextStartId(nextStartId);
          setHasMore((prev) => ({ ...prev, snaps: nextStartId !== null }));
          break;
        }
        case "comments": {
          const last = comments[comments.length - 1];
          if (!last) break;
          const data = await userService.getUserComments(targetUsername, PAGE_SIZE, last.author, last.permlink);
          const newItems = data.length > 0 && data[0].permlink === last.permlink ? data.slice(1) : data;
          setComments((prev) => [...prev, ...newItems]);
          setHasMore((prev) => ({ ...prev, comments: newItems.length >= PAGE_SIZE - 1 }));
          break;
        }
        case "replies": {
          const last = replies[replies.length - 1];
          if (!last) break;
          const data = await userService.getUserReplies(targetUsername, PAGE_SIZE, last.author, last.permlink);
          const newItems = data.length > 0 && data[0].permlink === last.permlink ? data.slice(1) : data;
          setReplies((prev) => [...prev, ...newItems]);
          setHasMore((prev) => ({ ...prev, replies: newItems.length >= PAGE_SIZE - 1 }));
          break;
        }
        case "followers": {
          const last = followers[followers.length - 1];
          if (!last) break;
          const data = await userService.getFollowers(targetUsername, last.follower, FOLLOWER_PAGE_SIZE);
          // First item matches cursor, skip it
          const newItems = data.length > 0 && data[0].follower === last.follower ? data.slice(1) : data;
          setFollowers((prev) => [...prev, ...newItems]);
          setHasMore((prev) => ({ ...prev, followers: newItems.length >= FOLLOWER_PAGE_SIZE - 1 }));
          break;
        }
        case "following": {
          const last = following[following.length - 1];
          if (!last) break;
          const data = await userService.getFollowing(targetUsername, last.following, FOLLOWER_PAGE_SIZE);
          const newItems = data.length > 0 && data[0].following === last.following ? data.slice(1) : data;
          setFollowing((prev) => [...prev, ...newItems]);
          setHasMore((prev) => ({ ...prev, following: newItems.length >= FOLLOWER_PAGE_SIZE - 1 }));
          break;
        }
      }
    } catch (err) {
      console.error(`Error loading more ${activeTab}:`, err);
    } finally {
      setLoadingMore(false);
    }
  }, [activeTab, targetUsername, currentUsername, loadingMore, hasMore, blogs, posts, snaps, snapsNextStartId, comments, replies, followers, following]);

  // ─── IntersectionObserver for infinite scroll ─────────────────────────

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // ─── Action handlers ─────────────────────────────────────────────────────

  const handleFollowToggle = useCallback(async () => {
    if (!profile) return;
    setActionLoading(true);
    setShowActionDropdown(false);

    try {
      const wasFollowing = profile.isFollowing;
      if (wasFollowing && onUnfollow) {
        await onUnfollow(targetUsername);
      } else if (!wasFollowing && onFollow) {
        await onFollow(targetUsername);
      }
      // Optimistic update
      setProfile((prev) => (prev ? { ...prev, isFollowing: !wasFollowing } : prev));
    } catch (err) {
      console.error("Follow/Unfollow error:", err);
    } finally {
      setActionLoading(false);
    }
  }, [profile, targetUsername, onFollow, onUnfollow]);

  const handleIgnore = useCallback(async () => {
    setActionLoading(true);
    try {
      if (onIgnoreAuthor) {
        await onIgnoreAuthor(targetUsername);
      }
      setShowIgnoreConfirm(false);
      setShowActionDropdown(false);
    } catch (err) {
      console.error("Error ignoring user:", err);
    } finally {
      setActionLoading(false);
    }
  }, [targetUsername, onIgnoreAuthor]);

  const handleReport = useCallback(async () => {
    if (!selectedReportReason) return;
    setActionLoading(true);
    try {
      if (onReportUser) {
        await onReportUser(targetUsername, selectedReportReason);
      }
      setShowReportModal(false);
      setSelectedReportReason(null);
      setShowActionDropdown(false);
    } catch (err) {
      console.error("Error reporting user:", err);
    } finally {
      setActionLoading(false);
    }
  }, [targetUsername, selectedReportReason, onReportUser]);

  const handleShare = useCallback(() => {
    if (onShare) {
      onShare(targetUsername);
    } else {
      const url = `https://peakd.com/@${targetUsername}`;
      if (navigator.share) {
        navigator.share({ title: profile?.name || targetUsername, url });
      } else {
        navigator.clipboard.writeText(url);
      }
    }
  }, [targetUsername, profile, onShare]);

  // ─── Render: Loading state ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-400">Loading user profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <User className="h-14 w-14 text-gray-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white mb-1">User Not Found</h3>
          <p className="text-gray-400">{error || "This user does not exist"}</p>
          {showBackButton && onBack && (
            <button
              onClick={onBack}
              className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Render: Post/Comment item ───────────────────────────────────────────

  const PostImageCarousel: React.FC<{ images: string[] }> = ({ images }) => {
    const [idx, setIdx] = useState(0);
    const [preview, setPreview] = useState(false);
    if (images.length === 0) return null;
    return (
      <>
        <div className="relative w-16 flex-shrink-0 mt-1.5">
          {/* Thumbnail — click to preview */}
          <button
            onClick={(e) => { e.stopPropagation(); setPreview(true); }}
            className="block w-16 h-16 rounded-lg overflow-hidden border border-gray-600 hover:border-blue-500 transition-colors cursor-pointer"
          >
            <img
              src={images[idx]}
              alt=""
              className="w-full h-full object-cover bg-gray-700"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </button>
          {/* Navigation arrows */}
          {images.length > 1 && (
            <div className="flex items-center justify-between mt-1">
              <button
                onClick={(e) => { e.stopPropagation(); setIdx((prev) => (prev - 1 + images.length) % images.length); }}
                className="p-0.5 text-gray-400 hover:text-white transition-colors"
                title="Previous"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-[10px] text-gray-500">{idx + 1}/{images.length}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setIdx((prev) => (prev + 1) % images.length); }}
                className="p-0.5 text-gray-400 hover:text-white transition-colors"
                title="Next"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Fullscreen lightbox preview */}
        {preview && (
          <div
            className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreview(false)}
          >
            <div
              className="relative max-w-3xl max-h-[85vh] w-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={images[idx]}
                alt=""
                className="max-w-full max-h-[80vh] rounded-lg object-contain"
              />
              {/* Close hint */}
              <button
                onClick={() => setPreview(false)}
                className="absolute top-2 right-2 text-white/70 hover:text-white bg-black/50 rounded-full p-1.5 transition-colors"
                title="Close"
              >
                <span className="text-lg leading-none">&times;</span>
              </button>
              {/* Prev / Next in lightbox */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIdx((prev) => (prev - 1 + images.length) % images.length); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIdx((prev) => (prev + 1) % images.length); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
                    {idx + 1} / {images.length}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </>
    );
  };

  const renderPostItem = (item: Post, type: "blog" | "post" | "comment" | "reply", onItemClick?: () => void) => {
    const postImages = item.json_metadata?.image?.length ? item.json_metadata.image : [];
    const previewText = item.json_metadata?.description || (item.body ? extractPlainText(item.body) : "");

    // Extract numeric payout value
    const rawPayout = item.payout
      ? item.payout.toFixed(3)
      : item.pending_payout_value
        ? item.pending_payout_value.replace(/[^\d.]/g, "")
        : "0.000";
    const payoutValue = rawPayout;

    // Build payout tooltip matching Hive standard format
    const tooltipLines: string[] = [];

    // Payout mode line (100% Power Up vs 50%/50%)
    const hbdPercent = item.percent_hbd ?? 10000;
    if (hbdPercent === 0) {
      tooltipLines.push("Hive Rewards Payout 100% Powered Up");
    } else {
      tooltipLines.push(`Hive Rewards Payout (${(hbdPercent / 200).toFixed(0)}%/${100 - (hbdPercent / 200)  }%)`);
    }

    if (item.is_paidout) {
      // Past payout
      const authorVal = item.author_payout_value ? item.author_payout_value.replace(/[^\d.]/g, "") : "";
      tooltipLines.push("Past payouts:");
      tooltipLines.push(`${rawPayout} Hive Rewards${authorVal ? ` (Author ${authorVal})` : ""}`);
    } else {
      // Pending payout with time remaining
      if (item.payout_at) {
        const payoutDate = new Date(item.payout_at);
        const now = new Date();
        const diffMs = payoutDate.getTime() - now.getTime();
        if (diffMs > 0) {
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          const diffDays = Math.floor(diffHours / 24);
          const remainHours = diffHours % 24;
          const timeStr = diffDays > 0
            ? `in ${diffDays} day${diffDays > 1 ? "s" : ""}${remainHours > 0 ? ` ${remainHours} hour${remainHours > 1 ? "s" : ""}` : ""}`
            : `in ${diffHours} hour${diffHours > 1 ? "s" : ""}`;
          tooltipLines.push(`Payout will occur: ${timeStr}`);
        }
      }
      if (hbdPercent === 0) {
        tooltipLines.push(`${rawPayout} Hive Rewards (100% Powered Up)`);
      } else {
        tooltipLines.push(`${rawPayout} Hive Rewards (${(hbdPercent / 200).toFixed(0)}%/${100 - (hbdPercent / 200)}%)`);
      }
    }

    // Beneficiaries
    if (item.beneficiaries?.length > 0) {
      tooltipLines.push("Beneficiaries:");
      item.beneficiaries.forEach((b) => {
        tooltipLines.push(`${b.account}: ${(b.weight / 100).toFixed(0)}%`);
      });
    }

    const payoutTooltip = tooltipLines.join("\n");

    return (
      <div
        key={`${item.author}/${item.permlink}`}
        className={`border border-gray-700 rounded-lg p-4 bg-gray-800 hover:bg-gray-700 transition-colors ${onItemClick ? "cursor-pointer" : ""}`}
        onClick={onItemClick}
      >
        {/* Top row: Avatar/images + content side by side */}
        <div className="flex items-start gap-3">
          {/* Left column: Avatar + image carousel below it */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16">
            <img
              src={`https://images.hive.blog/u/${item.author}/avatar`}
              alt={item.author}
              className="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${item.author}&background=random&size=40`;
              }}
            />
            <PostImageCarousel images={postImages} />
          </div>

          {/* Right column: text content */}
          <div className="flex-1 min-w-0">
            {/* Author & time */}
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => onUserClick?.(item.author)}
                className="font-medium text-white hover:text-blue-400 text-sm"
              >
                @{item.author}
              </button>
              <span className="text-xs text-gray-500">
                {formatTimeAgo(item.created)}
              </span>
            </div>

            {/* Title */}
            {item.title && (
              <button
                onClick={() => onPostClick?.(item.author, item.permlink, item.title)}
                className="text-left text-base font-semibold text-white mb-1 line-clamp-2 hover:text-blue-400"
              >
                {item.title}
              </button>
            )}

            {/* Body preview */}
            {previewText && (
              <p className="text-gray-400 text-sm line-clamp-2">
                {previewText.substring(0, 200)}
              </p>
            )}

            {/* Desktop: action bar inline below body */}
            <div className="hidden sm:block mt-2" onClick={(e) => e.stopPropagation()}>
              <PostActionButton
                author={item.author}
                permlink={item.permlink}
                currentUser={currentUsername}
                hiveValue={payoutValue}
                hiveIconUrl="/images/hive_logo.png"
                payoutTooltip={payoutTooltip}
                initialVotes={item.active_votes || []}
                initialCommentsCount={item.children || 0}
                onUpvote={onUpvote ? (percent) => onUpvote(item.author, item.permlink, percent) : undefined}
                onSubmitComment={onSubmitComment ? (pAuthor, pPermlink, body) => onSubmitComment(pAuthor, pPermlink, body) : undefined}
                onClickCommentUpvote={onClickCommentUpvote}
                onReblog={onReblog ? () => onReblog(item.author, item.permlink) : undefined}
                onShare={() => {
                  const url = `https://peakd.com/@${item.author}/${item.permlink}`;
                  if (navigator.share) {
                    navigator.share({ title: item.title || `Post by @${item.author}`, url });
                  } else {
                    navigator.clipboard?.writeText(url);
                  }
                }}
                onTip={onTip ? () => onTip(item.author, item.permlink) : undefined}
                onReport={onReportPost ? () => onReportPost(item.author, item.permlink) : undefined}
              />
            </div>

            {/* Community tag */}
            {item.community_title && (
              <span className="inline-block mt-1 text-xs text-blue-400 font-medium">
                #{item.community_title}
              </span>
            )}
          </div>
        </div>

        {/* Mobile: full-width action bar below everything */}
        <div className="sm:hidden mt-3 pt-2 border-t border-gray-700/50" onClick={(e) => e.stopPropagation()}>
          <PostActionButton
            author={item.author}
            permlink={item.permlink}
            currentUser={currentUsername}
            hiveValue={payoutValue}
            hiveIconUrl="/images/hive_logo.png"
            payoutTooltip={payoutTooltip}
            onUpvote={onUpvote ? (percent) => onUpvote(item.author, item.permlink, percent) : undefined}
            onSubmitComment={onSubmitComment ? (pAuthor, pPermlink, body) => onSubmitComment(pAuthor, pPermlink, body) : undefined}
            onClickCommentUpvote={onClickCommentUpvote}
            onReblog={onReblog ? () => onReblog(item.author, item.permlink) : undefined}
            onShare={() => {
              const url = `https://peakd.com/@${item.author}/${item.permlink}`;
              if (navigator.share) {
                navigator.share({ title: item.title || `Post by @${item.author}`, url });
              } else {
                navigator.clipboard?.writeText(url);
              }
            }}
            onTip={onTip ? () => onTip(item.author, item.permlink) : undefined}
            onReport={onReportPost ? () => onReportPost(item.author, item.permlink) : undefined}
          />
        </div>
      </div>
    );
  };

  // ─── Render: Poll item ─────────────────────────────────────────────────

  const renderPollItem = (poll: Poll) => {
    const totalVotes = poll.poll_stats?.total_voting_accounts_num || 0;
    const isActive = poll.status === "Active";
    const endDate = new Date(poll.end_time);
    const now = new Date();
    const isExpired = endDate < now;
    const previewText = poll.post_body ? extractPlainText(poll.post_body) : "";
    const choiceCount = poll.poll_choices?.length || 0;

    return (
      <div
        key={`${poll.author}/${poll.permlink}`}
        className="border border-gray-700 rounded-lg bg-gray-800 hover:bg-gray-700/50 transition-colors cursor-pointer"
        onClick={() => onPollClick?.(poll.author, poll.permlink, poll.question)}
      >
        <div className="p-4">
          {/* Header: author + status */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <img
                src={`https://images.hive.blog/u/${poll.author}/avatar`}
                alt={poll.author}
                className="w-8 h-8 rounded-full bg-gray-700"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${poll.author}&background=random&size=32`; }}
              />
              <div>
                <button
                  onClick={(e) => { e.stopPropagation(); onUserClick?.(poll.author); }}
                  className="text-sm font-medium text-white hover:text-blue-400"
                >
                  @{poll.author}
                </button>
                <p className="text-[10px] text-gray-500">{formatTimeAgo(poll.created)}</p>
              </div>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isActive && !isExpired ? "bg-green-500/20 text-green-400" : "bg-gray-600/30 text-gray-400"}`}>
              {isActive && !isExpired ? "Active" : "Ended"}
            </span>
          </div>

          {/* Question */}
          <h3 className="text-sm font-semibold text-white mb-1">{poll.question}</h3>

          {/* Body preview */}
          {previewText && (
            <p className="text-gray-400 text-xs line-clamp-2 mb-2">{previewText.substring(0, 150)}</p>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span>{totalVotes} voter{totalVotes !== 1 ? "s" : ""}</span>
            <span>{choiceCount} option{choiceCount !== 1 ? "s" : ""}</span>
            {poll.poll_stats?.total_hive_hp != null && poll.poll_stats.total_hive_hp > 0 && (
              <span>{(poll.poll_stats.total_hive_hp / 1000).toFixed(1)}k HP</span>
            )}
            {poll.end_time && (
              <span>{isActive && !isExpired ? `Ends ${formatTimeAgo(poll.end_time)}` : "Ended"}</span>
            )}
          </div>
        </div>

        {/* PostActionButton */}
        <div className="px-4 pb-3 pt-1 border-t border-gray-700/50" onClick={(e) => e.stopPropagation()}>
          <PostActionButton
            author={poll.author}
            permlink={poll.permlink}
            currentUser={currentUsername}
            hiveIconUrl="/images/hive_logo.png"
            initialVotes={[]}
            initialCommentsCount={0}
            onUpvote={onUpvote ? (percent) => onUpvote(poll.author, poll.permlink, percent) : undefined}
            onSubmitComment={onSubmitComment ? (pAuthor, pPermlink, body) => onSubmitComment(pAuthor, pPermlink, body) : undefined}
            onClickCommentUpvote={onClickCommentUpvote}
            onReblog={onReblog ? () => onReblog(poll.author, poll.permlink) : undefined}
            onShare={() => {
              const url = `https://peakd.com/@${poll.author}/${poll.permlink}`;
              if (navigator.share) {
                navigator.share({ title: poll.question, url });
              } else {
                navigator.clipboard?.writeText(url);
              }
            }}
            onTip={onTip ? () => onTip(poll.author, poll.permlink) : undefined}
            onReport={onReportPost ? () => onReportPost(poll.author, poll.permlink) : undefined}
          />
        </div>
      </div>
    );
  };

  // ─── Render: User item (follower/following) ──────────────────────────────

  const renderUserItem = (name: string, index: number) => (
    <div
      key={`${name}-${index}`}
      className="border border-gray-700 rounded-lg p-4 bg-gray-800 hover:bg-gray-700 transition-colors"
    >
      <div className="flex items-center gap-3">
        <img
          src={`https://images.hive.blog/u/${name}/avatar`}
          alt={name}
          className="w-10 h-10 rounded-full flex-shrink-0 bg-gray-700"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${name}&background=random&size=40`;
          }}
        />
        <button
          onClick={() => onUserClick?.(name)}
          className="font-medium text-white hover:text-blue-400"
        >
          @{name}
        </button>
      </div>
    </div>
  );

  // ─── Render: Skeleton Loaders ─────────────────────────────────────────────

  /** Post/blog/snap/comment/reply card skeleton */
  const renderPostSkeleton = (count = 5) => (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex gap-3">
            {/* Avatar */}
            <div className="w-10 h-10 bg-gray-700 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
              {/* Author + time */}
              <div className="flex items-center gap-2 mb-2">
                <div className="h-3.5 bg-gray-700 rounded w-24" />
                <div className="h-3 bg-gray-700 rounded w-16" />
              </div>
              {/* Title */}
              <div className="h-4 bg-gray-700 rounded w-4/5 mb-2" />
              {/* Body preview */}
              <div className="h-3 bg-gray-700 rounded w-full mb-1.5" />
              <div className="h-3 bg-gray-700 rounded w-3/5 mb-3" />
              {/* Image placeholder (sometimes) */}
              {i % 2 === 0 && (
                <div className="h-32 bg-gray-700 rounded-lg w-20 mb-3" />
              )}
              {/* Action bar */}
              <div className="flex gap-4 mt-2">
                <div className="h-3 bg-gray-700 rounded w-12" />
                <div className="h-3 bg-gray-700 rounded w-12" />
                <div className="h-3 bg-gray-700 rounded w-12" />
                <div className="h-3 bg-gray-700 rounded w-16" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  /** Follower/following user grid skeleton */
  const renderUserSkeleton = (count = 8) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="border border-gray-700 rounded-lg p-4 bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex-shrink-0" />
            <div className="h-4 bg-gray-700 rounded w-28" />
          </div>
        </div>
      ))}
    </div>
  );

  /** Poll card skeleton */
  const renderPollSkeleton = (count = 3) => (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-3.5 bg-gray-700 rounded w-24" />
                <div className="h-5 bg-gray-700 rounded-full w-14" />
              </div>
              {/* Question */}
              <div className="h-4 bg-gray-700 rounded w-4/5 mb-3" />
              {/* Poll options */}
              <div className="space-y-2 mb-3">
                <div className="h-8 bg-gray-700 rounded-lg w-full" />
                <div className="h-8 bg-gray-700 rounded-lg w-full" />
                <div className="h-8 bg-gray-700 rounded-lg w-3/4" />
              </div>
              {/* Stats */}
              <div className="flex gap-4">
                <div className="h-3 bg-gray-700 rounded w-20" />
                <div className="h-3 bg-gray-700 rounded w-24" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  /** Reward tab skeleton (author & curation) */
  const renderRewardSkeleton = () => (
    <div className="space-y-3 animate-pulse">
      {/* Summary card skeleton */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 bg-gray-700 rounded" />
          <div className="h-4 bg-gray-700 rounded w-44" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-900/50 rounded-lg p-2.5">
              <div className="h-2.5 bg-gray-700 rounded w-12 mb-2" />
              <div className="h-5 bg-gray-700 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
      {/* Row skeletons */}
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 bg-gray-700 rounded-lg" />
            <div className="flex-1">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-700 rounded w-1/3 mb-3" />
              <div className="flex gap-4">
                <div className="h-3 bg-gray-700 rounded w-20" />
                <div className="h-3 bg-gray-700 rounded w-16" />
                <div className="h-3 bg-gray-700 rounded w-16" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  /** Returns the right skeleton for the current tab */
  const renderSkeletonForTab = () => {
    switch (activeTab) {
      case "blogs":
      case "posts":
      case "snaps":
      case "comments":
      case "replies":
        return renderPostSkeleton();
      case "followers":
      case "following":
        return renderUserSkeleton();
      case "polls":
        return renderPollSkeleton();
      case "authorRewards":
      case "curationRewards":
        return renderRewardSkeleton();
      default:
        return renderPostSkeleton();
    }
  };

  // ─── Render: Duration formatter ─────────────────────────────────────────

  const formatDuration = (ms: number): string => {
    if (!ms || !isFinite(ms) || ms <= 0) return "—";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days >= 1) return `${days}d ${hours % 24}h`;
    if (hours >= 1) return `${hours}h ${minutes % 60}m`;
    return `${Math.max(1, minutes)}m`;
  };

  const formatNum = (num: number | null | undefined, digits: number = 3): string => {
    if (num === null || num === undefined || isNaN(num)) return "—";
    return Number(num).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
  };

  // ─── Render: Author Rewards Tab ─────────────────────────────────────────

  const renderAuthorRewardsTab = () => {
    if (loadingContent && authorRewards.length === 0) return renderRewardSkeleton();

    if (authorRewards.length === 0 && !rewardsStillLoading) {
      return (
        <div className="text-center py-12">
          <Award className="h-12 w-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400">No pending author rewards</p>
          <p className="text-gray-500 text-xs mt-1">Rewards appear for posts/comments with pending payouts</p>
        </div>
      );
    }

    const postCount = authorRewards.filter(r => !r.isComment).length;
    const commentCount = authorRewards.length - postCount;

    return (
      <div className="space-y-3">
        {/* Summary card */}
        <div className="bg-gradient-to-r from-amber-900/30 to-orange-900/30 rounded-xl p-4 border border-amber-700/40">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-300">Pending Author Rewards</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-black/30 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Posts</p>
              <p className="text-lg font-bold text-white">{postCount}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Comments</p>
              <p className="text-lg font-bold text-white">{commentCount}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total HBD</p>
              <p className="text-lg font-bold text-amber-400">${formatNum(authorRewardsTotals.totalHbd)}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total HP</p>
              <p className="text-lg font-bold text-orange-400">{formatNum(authorRewardsTotals.totalHpEq)}</p>
            </div>
          </div>
        </div>

        {/* Reward rows */}
        {authorRewards.map((row, i) => (
          <div
            key={`${row.author}-${row.permlink}-${i}`}
            className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
            onClick={() => onPostClick?.(row.author, row.permlink, row.title)}
          >
            <div className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${row.isComment ? "bg-blue-900/40 text-blue-400" : "bg-emerald-900/40 text-emerald-400"}`}>
                {row.isComment ? <MessageCircle className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-medium text-white truncate">
                    {row.title || `${row.author}/${row.permlink}`}
                  </h4>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${row.isComment ? "bg-blue-900/40 text-blue-300" : "bg-emerald-900/40 text-emerald-300"}`}>
                    {row.isComment ? "Comment" : "Post"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Payout in {formatDuration(row.payoutMs)}
                  </span>
                  <span className="text-amber-400 font-medium">${formatNum(row.hbd)} HBD</span>
                  {row.hpEq !== null && <span className="text-orange-400 font-medium">{formatNum(row.hpEq)} HP</span>}
                  {row.beneficiaryCut > 0 && (
                    <span className="text-gray-500">
                      Beneficiary: {(row.beneficiaryCut * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Loading more skeleton */}
        {rewardsStillLoading && (
          <div className="animate-pulse space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-gray-700 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
                    <div className="flex gap-4">
                      <div className="h-3 bg-gray-700 rounded w-20" />
                      <div className="h-3 bg-gray-700 rounded w-16" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── Render: Curation Rewards Tab ───────────────────────────────────────

  const renderCurationRewardsTab = () => {
    if (loadingContent && curationRewards.length === 0) return renderRewardSkeleton();

    if (curationRewards.length === 0 && !rewardsStillLoading) {
      return (
        <div className="text-center py-12">
          <TrendingUp className="h-12 w-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400">No pending curation rewards</p>
          <p className="text-gray-500 text-xs mt-1">Rewards appear for posts you voted on with pending payouts</p>
        </div>
      );
    }

    const postCount = curationRewards.filter(r => !r.isComment).length;
    const commentCount = curationRewards.length - postCount;
    const effRows = curationRewards.filter(r => r.efficiency !== null);
    const avgEfficiency = effRows.length > 0
      ? effRows.reduce((sum, r) => sum + (r.efficiency || 0), 0) / effRows.length
      : null;

    return (
      <div className="space-y-3">
        {/* Summary card */}
        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-4 border border-blue-700/40">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-blue-300">Pending Curation Rewards</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-black/30 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Posts</p>
              <p className="text-lg font-bold text-white">{postCount}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Comments</p>
              <p className="text-lg font-bold text-white">{commentCount}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total HP</p>
              <p className="text-lg font-bold text-blue-400">{formatNum(curationRewardsTotals.totalHp)}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total HBD</p>
              <p className="text-lg font-bold text-purple-400">${formatNum(curationRewardsTotals.totalHbd)}</p>
            </div>
            {avgEfficiency !== null && (
              <div className="bg-black/30 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Avg Efficiency</p>
                <p className={`text-lg font-bold ${avgEfficiency >= 100 ? "text-emerald-400" : "text-amber-400"}`}>
                  {avgEfficiency.toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Reward rows */}
        {curationRewards.map((row, i) => (
          <div
            key={`${row.author}-${row.permlink}-${i}`}
            className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
            onClick={() => onPostClick?.(row.author, row.permlink, row.title)}
          >
            <div className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${row.isComment ? "bg-blue-900/40 text-blue-400" : "bg-emerald-900/40 text-emerald-400"}`}>
                {row.isComment ? <MessageCircle className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium text-white truncate">
                      {row.title || `${row.author}/${row.permlink}`}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">by @{row.author}</p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${row.isComment ? "bg-blue-900/40 text-blue-300" : "bg-emerald-900/40 text-emerald-300"}`}>
                    {row.isComment ? "Comment" : "Post"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Payout in {formatDuration(row.payoutMs)}
                  </span>
                  <span className="text-blue-400 font-medium">{formatNum(row.hp)} HP</span>
                  <span className="text-purple-400 font-medium">${formatNum(row.hbd)} HBD</span>
                  <span className="text-gray-500">
                    Vote: {row.weightPct.toFixed(0)}%
                  </span>
                  {row.efficiency !== null && (
                    <span className={`font-medium ${row.efficiency >= 100 ? "text-emerald-400" : "text-amber-400"}`}>
                      Eff: {row.efficiency.toFixed(1)}%
                    </span>
                  )}
                  {row.votedAfterMs !== null && (
                    <span className="text-gray-500">
                      Voted after {formatDuration(row.votedAfterMs)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Loading more skeleton */}
        {rewardsStillLoading && (
          <div className="animate-pulse space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-gray-700 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-700 rounded w-1/3 mb-3" />
                    <div className="flex gap-4">
                      <div className="h-3 bg-gray-700 rounded w-20" />
                      <div className="h-3 bg-gray-700 rounded w-16" />
                      <div className="h-3 bg-gray-700 rounded w-14" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── Render: Tab content ─────────────────────────────────────────────────

  const renderTabContent = () => {
    if (activeTab === "wallet") {
      return (
        <div className="max-w-lg mx-auto">
          <Wallet username={targetUsername} />
        </div>
      );
    }

    if (activeTab === "activities") {
      return (
        <ActivityList
          username={targetUsername}
          onClickPermlink={onActivityPermlink}
          onSelectActivity={onActivitySelect}
        />
      );
    }

    if (activeTab === "authorRewards") {
      return renderAuthorRewardsTab();
    }

    if (activeTab === "curationRewards") {
      return renderCurationRewardsTab();
    }

    if (loadingContent) {
      return renderSkeletonForTab();
    }

    // Followers tab
    if (activeTab === "followers") {
      if (followers.length === 0) {
        return (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">No followers found</p>
          </div>
        );
      }
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {followers.map((f, i) => renderUserItem(f.follower, i))}
        </div>
      );
    }

    // Following tab
    if (activeTab === "following") {
      if (following.length === 0) {
        return (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">Not following anyone</p>
          </div>
        );
      }
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {following.map((f, i) => renderUserItem(f.following, i))}
        </div>
      );
    }

    // Polls tab
    if (activeTab === "polls") {
      if (polls.length === 0) {
        return (
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">No polls found</p>
          </div>
        );
      }
      return (
        <div className="space-y-3">
          {polls.map((poll) => renderPollItem(poll))}
        </div>
      );
    }

    // Content tabs (blogs, posts, snaps, comments, replies)
    const contentMap: Record<string, { data: Post[]; type: "blog" | "post" | "comment" | "reply"; icon: any }> = {
      blogs: { data: blogs, type: "blog", icon: FileText },
      posts: { data: posts, type: "post", icon: FileText },
      snaps: { data: snaps, type: "post", icon: Camera },
      comments: { data: comments, type: "comment", icon: MessageCircle },
      replies: { data: replies, type: "reply", icon: Reply },
    };

    const current = contentMap[activeTab];
    if (!current) return null;

    if (current.data.length === 0) {
      const EmptyIcon = current.icon;
      return (
        <div className="text-center py-12">
          <EmptyIcon className="h-12 w-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400">No {activeTab} found</p>
        </div>
      );
    }

    const getItemClickHandler = (item: Post) => {
      if (activeTab === "snaps" && onSnapClick) return () => onSnapClick(item.author, item.permlink);
      if ((activeTab === "blogs" || activeTab === "posts") && onPostClick) return () => onPostClick(item.author, item.permlink, item.title);
      return undefined;
    };

    return (
      <div className="space-y-3">
        {current.data.map((item) => renderPostItem(item, current.type, getItemClickHandler(item)))}
      </div>
    );
  };

  // ─── Render: Tabs ────────────────────────────────────────────────────────

  const allTabs: { id: TabType; label: string; icon: any }[] = [
    { id: "blogs", label: "Blogs", icon: FileText },
    { id: "posts", label: "Posts", icon: FileText },
    { id: "snaps", label: "Snaps", icon: Camera },
    { id: "polls", label: "Polls", icon: BarChart3 },
    { id: "comments", label: "Comments", icon: MessageCircle },
    { id: "replies", label: "Replies", icon: Reply },
    { id: "activities", label: "Activities", icon: Activity },
    { id: "authorRewards", label: "Author Rewards", icon: Award },
    { id: "curationRewards", label: "Curation Rewards", icon: TrendingUp },
    { id: "followers", label: "Followers", icon: Users },
    { id: "following", label: "Following", icon: Users },
    { id: "wallet", label: "Wallet", icon: WalletIcon },
  ];

  // If tabShown is provided, only show those tabs in that exact order.
  // If not provided, show all tabs in default order.
  const tabs = tabShown && tabShown.length > 0
    ? tabShown
        .map((id) => allTabs.find((t) => t.id === id))
        .filter((t): t is { id: TabType; label: string; icon: any } => t !== undefined)
    : allTabs;

  const showActions = currentUsername && currentUsername !== targetUsername;

  // ─── Main render ─────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex flex-col overflow-y-auto h-full">

      {/* ── Compact Header: Avatar + Name + Stats + Actions ── */}
      <div className="sticky top-0 z-30 h-[56px] bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 flex items-center">
        <div className="px-4 py-2 flex items-center gap-2 w-full">
          {/* Back */}
          {showBackButton && onBack && (
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5 text-gray-300" />
            </button>
          )}

          {/* Avatar */}
          <img
            src={
              profile.profileImage ||
              `https://images.hive.blog/u/${targetUsername}/avatar`
            }
            alt={targetUsername}
            className="w-8 h-8 rounded-full flex-shrink-0 bg-gray-700"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://images.hive.blog/u/${targetUsername}/avatar`;
            }}
          />

          {/* Name + Stats inline */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-white truncate">
                {`@${targetUsername}`}
              </h1>
              {profile.reputation > 0 && (
                <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  {formatReputation(profile.reputation)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-400">
              <button onClick={() => setActiveTab("followers")} className="hover:text-white transition-colors">
                <span className="font-semibold text-gray-200">{profile.followersCount.toLocaleString()}</span> Followers
              </button>
              <button onClick={() => setActiveTab("following")} className="hover:text-white transition-colors">
                <span className="font-semibold text-gray-200">{profile.followingCount.toLocaleString()}</span> Following
              </button>
              <span>
                <span className="font-semibold text-gray-200">{profile.postsCount.toLocaleString()}</span> Posts
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleShare}
              className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
              title="Share profile"
            >
              <Share2 className="h-4 w-4 text-gray-400" />
            </button>
            {showActions && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowActionDropdown((prev) => !prev)}
                  className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                  title="More actions"
                >
                  <MoreVertical className="h-4 w-4 text-gray-400" />
                </button>
                {showActionDropdown && (
                  <div
                    className="absolute right-0 mt-1 w-48 rounded-lg border border-gray-700 bg-gray-800 shadow-xl z-[100]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(onFollow || onUnfollow) && (
                      <button
                        onClick={() => {
                          setShowActionDropdown(false);
                          handleFollowToggle();
                        }}
                        disabled={actionLoading}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-200 hover:bg-gray-700 disabled:opacity-50 first:rounded-t-lg"
                      >
                        {profile.isFollowing ? "Unfollow" : "Follow"}
                      </button>
                    )}
                    {onIgnoreAuthor && (
                      <button
                        onClick={() => {
                          setShowActionDropdown(false);
                          setShowIgnoreConfirm(true);
                        }}
                        disabled={actionLoading}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-900/20 disabled:opacity-50"
                      >
                        <span className="flex items-center gap-2">
                          <Ban className="h-4 w-4" /> Ignore Author
                        </span>
                      </button>
                    )}
                    {onReportUser && (
                      <button
                        onClick={() => {
                          setShowActionDropdown(false);
                          setShowReportModal(true);
                        }}
                        disabled={actionLoading}
                        className="w-full px-4 py-2.5 text-left text-sm text-orange-400 hover:bg-orange-900/20 disabled:opacity-50 last:rounded-b-lg"
                      >
                        <span className="flex items-center gap-2">
                          <Flag className="h-4 w-4" /> Report User
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

        {/* Cover image with profile details overlay */}
        <div className="relative">
          {/* Cover image — compact height */}
          {profile.coverImage ? (
            <div
              className="w-full h-24 sm:h-32 bg-cover bg-center"
              style={{ backgroundImage: `url(${profile.coverImage})` }}
            />
          ) : (
            <div className="w-full h-24 sm:h-32 bg-gradient-to-r from-blue-600 to-purple-700" />
          )}
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-gray-900/80" />

          {/* Profile details overlaid on cover */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-6">
            <h2 className="text-sm font-semibold text-white truncate">
              {profile.name || `@${targetUsername}`}
            </h2>
            {profile.about && (
              <p className="text-gray-300 text-xs leading-relaxed mt-1 line-clamp-2">
                {profile.about}
              </p>
            )}
            {/* Meta info row */}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-gray-300">
              {profile.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-rose-400" /> {profile.location}
                </span>
              )}
              {profile.website && (
                <a
                  href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:underline"
                >
                  <Globe className="h-3 w-3 text-blue-400" /> {profile.website}
                </a>
              )}
              {profile.created && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-green-400" /> {formatDate(profile.created)}
                </span>
              )}
              {profile.lastActivity && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-amber-400" /> {formatTimeAgo(profile.lastActivity)}
                </span>
              )}
              {profile.votingPower !== undefined && (
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-yellow-400" /> VP {profile.votingPower.toFixed(1)}%
                </span>
              )}
              {profile.hivePower !== undefined && (
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-orange-400" /> HP {profile.hivePower.toFixed(0)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Tab bar — sticks below header on scroll ── */}
        <div className="sticky top-[56px] z-20 bg-gray-800 border-b border-gray-700">
          <div className="flex overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? "text-blue-400 border-blue-400"
                      : "text-gray-400 border-transparent hover:text-gray-300 hover:border-gray-600"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="p-4 flex-1">
          {renderTabContent()}

          {/* Infinite scroll sentinel — min-h prevents scroll jump during loading */}
          {activeTab !== "wallet" && hasMore[activeTab] && (
            <div ref={sentinelRef} className="min-h-[60px] py-2">
              {loadingMore ? (
                <div className="animate-pulse space-y-3">
                  {(activeTab === "followers" || activeTab === "following") ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[1, 2].map(i => (
                        <div key={i} className="border border-gray-700 rounded-lg p-4 bg-gray-800">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-700 rounded-full" />
                            <div className="h-4 bg-gray-700 rounded w-28" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 bg-gray-700 rounded-full flex-shrink-0" />
                        <div className="flex-1">
                          <div className="h-3.5 bg-gray-700 rounded w-24 mb-2" />
                          <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
                          <div className="h-3 bg-gray-700 rounded w-1/2" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-1" />
              )}
            </div>
          )}

          {/* End of list indicator */}
          {activeTab !== "wallet" && !hasMore[activeTab] && !loadingContent && (
            <div className="text-center py-4 text-xs text-gray-600">
              No more {activeTab} to load
            </div>
          )}
        </div>

      {/* ── Ignore Confirmation Modal ── */}
      {showIgnoreConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4"
          onClick={() => setShowIgnoreConfirm(false)}
        >
          <div
            className="bg-gray-800 rounded-xl shadow-xl max-w-sm w-full border border-gray-700 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-2">
              Ignore Author
            </h3>
            <p className="text-sm text-gray-300 mb-6">
              Are you sure you want to ignore{" "}
              <span className="text-red-400 font-medium">@{targetUsername}</span>?
              Their content will be hidden from your feed.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowIgnoreConfirm(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleIgnore}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? "Processing..." : "Confirm Ignore"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Report Modal ── */}
      {showReportModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4"
          onClick={() => {
            setShowReportModal(false);
            setSelectedReportReason(null);
          }}
        >
          <div
            className="bg-gray-800 rounded-xl shadow-xl max-w-sm w-full border border-gray-700 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-1">
              Report @{targetUsername}
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Select a reason for reporting this user:
            </p>
            <div className="space-y-2 mb-6">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setSelectedReportReason(reason)}
                  className={`w-full px-4 py-2.5 text-left text-sm rounded-lg border transition-colors ${
                    selectedReportReason === reason
                      ? "border-blue-500 bg-blue-900/20 text-blue-300"
                      : "border-gray-700 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setSelectedReportReason(null);
                }}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                disabled={actionLoading || !selectedReportReason}
                className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
              >
                {actionLoading ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>{/* end scroll container */}
    </div>
  );
};

export default UserDetailProfile;
