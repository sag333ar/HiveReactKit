/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  User,
  Users,
  MessageCircle,
  FileText,
  Reply,
  Camera,
  Pencil,
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
  ChevronLeft,
  ChevronRight,
  Award,
  Play,
  X as XIcon,
  TrendingUp,
  Shield,
  Gauge,
  Heart,
  UserPlus,
  UserMinus,
  VolumeX,
  Volume2,
} from "lucide-react";
import { Wallet } from "../Wallet";
import { ReportModal } from "../ReportModal";
import ActivityList from "../ActivityList";
import UserGrowth from "./UserGrowth";
import KERatioBadge from "./KERatioBadge";
import PollListItem from "./PollListItem";
import { TranslatedText } from "../TranslatedText";
import { useKitT } from "@/i18n";
import { PostActionButton } from "../actionButtons/PostActionButton";
import { userService } from "@/services/userService";
import ProfileSnapsTab from "./ProfileSnapsTab";
import { extractPostMedia, parseThreeSpeakRef, type PostMedia } from "../../utils/postMedia";
import { getHiveApiEndpoint } from "../../config/hiveEndpoint";
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

  /**
   * Controlled active tab. When provided, the component renders this tab
   * and reports user-driven tab changes via `onActiveTabChange`. Pair the
   * two to drive tab selection from a parent store (e.g. persist per user
   * across navigation). When omitted, the component manages tab state
   * internally with its own per-username cache.
   */
  activeTab?: TabType;
  /** Called whenever the user clicks a different tab. Fires whether or
   *  not `activeTab` is supplied. */
  onActiveTabChange?: (tab: TabType) => void;

  // Composer tokens (threaded to AddCommentInput via PostActionButton → CommentsModal)
  /** Ecency image hosting token — enables image and video thumbnail upload in comment composer */
  ecencyToken?: string;
  /** 3Speak API key — enables audio and video upload in comment composer */
  threeSpeakApiKey?: string;
  /** GIPHY API key — enables GIF search in comment composer */
  giphyApiKey?: string;
  /** HReplier API token — enables template picker in comment composer */
  templateToken?: string;
  /** Custom template API endpoint (defaults to https://hreplier-api.sagarkothari88.one/data/templates) */
  templateApiBaseUrl?: string;

  // Filter lists — posts/authors already reported by the consumer app
  /** List of reported posts to exclude from feed. Each entry has { author, permlink }. */
  reportedPosts?: { author: string; permlink: string }[];
  /** List of reported/ignored author usernames to exclude from feed. */
  reportedAuthors?: string[];

  // Social action callbacks
  onFollow?: (username: string) => void | Promise<void>;
  onUnfollow?: (username: string) => void | Promise<void>;
  onIgnoreAuthor?: (username: string) => void | Promise<void>;
  onReportUser?: (username: string, reason: string) => void | Promise<void>;
  /** Mute a user — broadcasts the `follow` custom_json with `what: ["ignore"]`.
   *  When wired alongside `onUnmute`, the 3-dot menu shows a Mute / Unmute
   *  toggle for non-self profiles. Return `false` to indicate cancellation
   *  (keychain denied) — the local state will not flip. */
  onMute?: (username: string) => void | boolean | Promise<void | boolean>;
  /** Unmute — same custom_json with `what: []` (clears the ignore). */
  onUnmute?: (username: string) => void | boolean | Promise<void | boolean>;

  // PostActionButton callbacks
  onUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onSubmitComment?: (parentAuthor: string, parentPermlink: string, body: string) => void | Promise<void>;
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onReblog?: (author: string, permlink: string) => void;
  onTip?: (author: string, permlink: string) => void;
  onReportPost?: (author: string, permlink: string, reason: string) => void | Promise<void>;
  /** Author-only — when the viewed profile is `currentUsername`,
   *  each post card on the Blogs / Posts / Comments / Replies tabs
   *  gets a red Delete entry in the kebab. Consumer owns the
   *  confirm dialog + `delete_comment` broadcast. */
  onDeletePost?: (author: string, permlink: string) => void;
  /** Author-only — same gating as `onDeletePost`. Payload mirrors
   *  HiveDetailPost.onEdit so the consumer can open an edit modal
   *  without re-fetching the post body. */
  onEditPost?: (data: {
    author: string;
    permlink: string;
    body: string;
    title: string;
    parent_author: string;
    parent_permlink: string;
    json_metadata: string;
  }) => void;

  /** Wallet tab — RC delegation update. `maxRc` is a raw RC integer string
   *  (e.g. "51000000000" for 51 b RC). Return `false` to indicate cancellation
   *  (keychain denied / user closed the prompt) — the row stays in edit mode. */
  onUpdateRcDelegation?: (delegatee: string, maxRc: string) => void | boolean | Promise<void | boolean>;
  /** Wallet tab — RC delegation removal (broadcasts max_rc=0 internally). */
  onDeleteRcDelegation?: (delegatee: string) => void | boolean | Promise<void | boolean>;
  /** Wallet tab — create a new HP delegation. `hp` is HP as a numeric string
   *  (e.g. "1000"). Wiring this prop exposes the "Delegate HP" button on the
   *  HP tab; consumers should only pass it for keychain / hiveauth auth
   *  methods (active key required), never for plain-posting-key sessions. */
  onCreateHpDelegation?: (delegatee: string, hp: string) => void | boolean | Promise<void | boolean>;
  /** Wallet tab — create a new RC delegation. `maxRc` is a raw RC integer
   *  string (e.g. "50000000000"). Wiring this prop exposes the "Delegate RC"
   *  button on the RC tab. Posting auth is sufficient. */
  onCreateRcDelegation?: (delegatee: string, maxRc: string) => void | boolean | Promise<void | boolean>;

  /** Wallet tab — transfer HIVE / HBD. Surfaced only when viewing one's own
   *  profile. Return `false` to indicate cancellation. */
  onTransfer?: (
    to: string,
    amount: string,
    currency: "HIVE" | "HBD",
    memo: string,
  ) => void | boolean | Promise<void | boolean>;
  /** Wallet tab — power up (stake HIVE → HP). */
  onPowerUp?: (
    to: string,
    amount: string,
  ) => void | boolean | Promise<void | boolean>;
  /** Wallet tab — power down (unstake HP → HIVE over 13 weeks). */
  onPowerDown?: (hp: string) => void | boolean | Promise<void | boolean>;
  /** Wallet tab — add to savings (transfer_to_savings). */
  onTransferToSavings?: (
    currency: "HIVE" | "HBD",
    amount: string,
    memo: string,
  ) => void | boolean | Promise<void | boolean>;
  /** Wallet tab — withdraw from savings (transfer_from_savings). */
  onTransferFromSavings?: (
    currency: "HIVE" | "HBD",
    amount: string,
    memo: string,
  ) => void | boolean | Promise<void | boolean>;
  /** Wallet tab — stop an in-progress power-down (withdraw_vesting with 0). */
  onStopPowerDown?: () => void | boolean | Promise<void | boolean>;
  /** Wallet tab — cancel a single pending savings withdrawal. */
  onCancelSavingsWithdrawal?: (
    requestId: number,
  ) => void | boolean | Promise<void | boolean>;
  /** Wallet tab — claim unclaimed reward balances via
   *  `claim_reward_balance`. The kit passes the three reward strings;
   *  consumers typically forward to aioha.claimRewards(). */
  onClaimRewards?: (rewards: {
    hive: string;
    hbd: string;
    vests: string;
  }) => void | boolean | Promise<void | boolean>;

  /**
   * Called when the user submits a poll vote from the inline voting UI on the
   * polls tab. `choiceNums` is an array of 1-based choice numbers selected
   * (one entry for single-choice polls, one or more for multi-choice).
   *
   * Return `false` (or a Promise resolving to `false`) to indicate the
   * operation was cancelled (e.g. keychain request denied) — the per-card
   * vote state will not be updated.
   *
   * When this callback is omitted, the polls tab still renders choices with
   * vote bars but is read-only.
   */
  onVotePoll?: (author: string, permlink: string, choiceNums: number[]) => void | boolean | Promise<void | boolean>;
  /** Forwarded to each snap card on the Snaps tab — opens the
   *  consumer's edit modal when the snap's author taps Edit. */
  onEditSnap?: (data: {
    author: string;
    permlink: string;
    body: string;
    title: string;
    parent_author: string;
    parent_permlink: string;
    json_metadata: string;
  }) => void;

  // Navigation callbacks
  onUserClick?: (username: string) => void;
  onPostClick?: (author: string, permlink: string, title: string) => void;
  onSnapClick?: (author: string, permlink: string) => void;
  onPollClick?: (author: string, permlink: string, question: string) => void;
  onActivityPermlink?: (author: string, permlink: string) => void;
  onActivitySelect?: (activity: any) => void;
  onShare?: (username: string) => void;
  onSharePost?: (author: string, permlink: string) => void;
  /** When provided, clicking the comment icon navigates to the post detail instead of opening the comments modal. */
  onCommentClick?: (author: string, permlink: string) => void;
  /** Snaps tab only: click on the comment icon (separate from count) —
   *  typical use: open an inline reply composer. Mirrors hSnaps. */
  onClickSnapCommentIcon?: (author: string, permlink: string) => void;
  /** Snaps tab only: click on the comment count number — typical use:
   *  navigate to the post detail. */
  onClickSnapCommentCount?: (author: string, permlink: string) => void;

  // Favourite callbacks
  onFavouriteList?: () => void | Promise<void>;
  onAddToFavourite?: (username: string) => void | Promise<void>;
  isFavourited?: boolean;
  favouriteCount?: number;

  /** Initial percent (1–100) for every upvote slider on the profile page —
   *  post upvotes, comment upvotes, and the upvote-on-publish slider in
   *  inline comment composers. Default 100. Typically wired to a user setting. */
  defaultVotePercent?: number;
  /** Slider precision (0.25, 0.5, or 1) for every upvote slider on this page.
   *  Default 0.25. */
  voteWeightStep?: number;
  /** Allow landscape videos in every embedded comment composer on this profile.
   *  Default false (portrait-only, matches hSnaps Moments contract). */
  allowLandscapeVideos?: boolean;

  /** Forwarded to every post card's vote slider and reply composer
   *  — when true, a blinking "Open Keychain App & Approve" hint is
   *  shown while a broadcast is in flight. Set when the logged-in
   *  user is on Keychain / HiveAuth / PeakVault. */
  awaitingWalletApproval?: boolean;

  /** Per-card right-side header action menu (Edit / Delete / Flag) for the
   *  Snaps tab. Forwarded into <SnapsFeedView/>. */
  renderSnapHeaderActions?: (post: Post) => React.ReactNode;

  /** Wire this on the consumer's own profile to surface an "Edit profile"
   *  affordance over the avatar. Only invoked when
   *  `currentUsername === username`. The consumer owns the modal /
   *  account_update2 broadcast. */
  onEditProfile?: () => void;
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
  isMuted: boolean;
  created?: string;
  lastActivity?: string;
  hivePower?: number;
  votingPower?: number;
}

type TabType = "blogs" | "posts" | "snaps" | "polls" | "comments" | "replies" | "activities" | "authorRewards" | "curationRewards" | "followers" | "following" | "wallet" | "votingPower" | "badges" | "witnessVotes" | "growth";


// ─── Utilities ───────────────────────────────────────────────────────────────

const formatTimeAgo = (dateString: string): string => {
  // Hive RPC returns UTC timestamps without a `Z` suffix; without it
  // the browser parses them as local time and the relative label
  // drifts by the user's timezone offset (e.g. "5h ago" on the post
  // detail page vs "8h ago" on the same post in the profile tab).
  // Normalise here so every tab — Blogs, Posts, Comments, Polls,
  // Snaps, Replies, Activities — agrees with HiveDetailPost.
  const iso = /Z|[+-]\d{2}:?\d{2}$/.test(dateString)
    ? dateString
    : `${dateString}Z`;
  const now = new Date();
  const date = new Date(iso);
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

// ─── Module-level cache (persists across mount/unmount) ──────────────────────
const profileStateCache: Record<string, { tab: TabType; scrollTop: number; tabScrollLeft: number }> = {};

// ─── Component ───────────────────────────────────────────────────────────────

const UserDetailProfile: React.FC<UserDetailProfileProps> = ({
  username,
  currentUsername,
  onBack,
  showBackButton = false,
  tabShown,
  ecencyToken,
  threeSpeakApiKey,
  giphyApiKey,
  templateToken,
  templateApiBaseUrl,
  reportedPosts = [],
  reportedAuthors = [],
  onFollow,
  onUnfollow,
  onIgnoreAuthor,
  onReportUser,
  onMute,
  onUnmute,
  onUpvote,
  onSubmitComment,
  onClickCommentUpvote,
  onReblog,
  onTip,
  onReportPost,
  onDeletePost,
  onEditPost,
  onUpdateRcDelegation,
  onDeleteRcDelegation,
  onCreateHpDelegation,
  onCreateRcDelegation,
  onTransfer,
  onPowerUp,
  onPowerDown,
  onTransferToSavings,
  onTransferFromSavings,
  onStopPowerDown,
  onCancelSavingsWithdrawal,
  onClaimRewards,
  onVotePoll,
  onEditSnap,
  onUserClick,
  onPostClick,
  onSnapClick,
  onPollClick,
  onActivityPermlink,
  onActivitySelect,
  onShare,
  onSharePost,
  onCommentClick,
  onClickSnapCommentIcon,
  onClickSnapCommentCount,
  onFavouriteList,
  onAddToFavourite,
  isFavourited = false,
  favouriteCount = 0,
  defaultVotePercent = 100,
  voteWeightStep = 0.25,
  allowLandscapeVideos = false,
  awaitingWalletApproval = false,
  renderSnapHeaderActions,
  onEditProfile,
  activeTab: controlledActiveTab,
  onActiveTabChange,
}) => {
  const t = useKitT();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Default to the first tab in tabShown (or "blogs" when tabShown is omitted)
  // so we never briefly render a tab the consumer didn't include.
  const initialTab: TabType = controlledActiveTab
    ?? (tabShown && tabShown.length > 0 ? tabShown[0] : "blogs");
  const [internalActiveTab, setInternalActiveTab] = useState<TabType>(initialTab);
  const isControlled = controlledActiveTab !== undefined;
  const activeTab: TabType = isControlled ? (controlledActiveTab as TabType) : internalActiveTab;
  // Centralised setter so every internal call site (cache restore, tab
  // clicks, follower/following deep-links) also notifies the parent when
  // controlled — and updates internal state when uncontrolled.
  const setActiveTab = useCallback((next: TabType) => {
    if (!isControlled) setInternalActiveTab(next);
    onActiveTabChange?.(next);
  }, [isControlled, onActiveTabChange]);
  const prevUsernameRef = useRef<string>("");
  const activeTabRef = useRef<TabType>(activeTab);
  activeTabRef.current = activeTab;
  const mainScrollRef = useRef<HTMLDivElement | null>(null);

  // Content states
  const [blogs, setBlogs] = useState<Post[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Post[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [authorRewards, setAuthorRewards] = useState<PendingAuthorRow[]>([]);
  const [authorRewardsTotals, setAuthorRewardsTotals] = useState<{ totalHbd: number; totalHpEq: number }>({ totalHbd: 0, totalHpEq: 0 });
  const [curationRewards, setCurationRewards] = useState<PendingCurationRow[]>([]);
  const [curationRewardsTotals, setCurationRewardsTotals] = useState<{ totalHp: number; totalHbd: number }>({ totalHp: 0, totalHbd: 0 });
  const [rewardsStillLoading, setRewardsStillLoading] = useState(false);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [following, setFollowing] = useState<Following[]>([]);
  const [badges, setBadges] = useState<string[]>([]);
  const [witnessVotes, setWitnessVotes] = useState<string[]>([]);
  const [votingPowerData, setVotingPowerData] = useState<{
    upvotePower: number; downvotePower: number; resourceCredits: number;
    maxMana: number; rewardBalance: number; recentClaims: number; feedPrice: number;
  } | null>(null);
  const [voteWeight, setVoteWeight] = useState(100);
  const [loadingContent, setLoadingContent] = useState(false);

  // Pagination states
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState<Record<TabType, boolean>>({
    blogs: true, posts: true, snaps: true, polls: false, comments: true, replies: true,
    activities: false, authorRewards: false, curationRewards: false, followers: true, following: true, wallet: false,
    votingPower: false, badges: false, witnessVotes: false, growth: false,
  });
  const PAGE_SIZE = 20;
  const FOLLOWER_PAGE_SIZE = 100;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // UI states
  const [actionLoading, setActionLoading] = useState(false);
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  const [showIgnoreConfirm, setShowIgnoreConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportPostTarget, setReportPostTarget] = useState<{ author: string; permlink: string } | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const tabScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateTabScrollArrows = useCallback(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    // Retry until tabScrollRef is available (tab bar may render after cover image)
    let retryTimer: ReturnType<typeof setTimeout>;
    const trySetup = () => {
      const el = tabScrollRef.current;
      if (!el) {
        retryTimer = setTimeout(trySetup, 100);
        return;
      }
      updateTabScrollArrows();
      el.addEventListener("scroll", updateTabScrollArrows);
      window.addEventListener("resize", updateTabScrollArrows);
      const ro = new ResizeObserver(updateTabScrollArrows);
      ro.observe(el);
      cleanupRef.current = () => {
        el.removeEventListener("scroll", updateTabScrollArrows);
        window.removeEventListener("resize", updateTabScrollArrows);
        ro.disconnect();
      };
    };
    const cleanupRef = { current: () => {} };
    trySetup();
    return () => {
      clearTimeout(retryTimer);
      cleanupRef.current();
    };
  }, [updateTabScrollArrows, tabShown, activeTab]);

  const scrollTabs = useCallback((direction: "left" | "right") => {
    const el = tabScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -150 : 150, behavior: "smooth" });
  }, []);
  const isMobile = useIsMobile();
  const targetUsername = username.replace(/^@/, "").trim();
  // Hive accounts are lowercase but route params / shared links sometimes
  // arrive with capital letters. Compare case-insensitively so the
  // "own profile" affordances (edit overlay etc.) don't silently disappear.
  const isOwnProfile =
    !!currentUsername && currentUsername.toLowerCase() === targetUsername.toLowerCase();

  // Build memoized sets for O(1) lookup when filtering feed content
  const reportedPostKeys = useMemo(
    () => new Set(reportedPosts.map((p) => `${p.author}/${p.permlink}`)),
    [reportedPosts]
  );
  const reportedAuthorSet = useMemo(
    () => new Set(reportedAuthors),
    [reportedAuthors]
  );
  const filterPost = useCallback(
    <T extends { author: string; permlink: string }>(items: T[]): T[] =>
      items.filter(
        (item) =>
          !reportedAuthorSet.has(item.author) &&
          !reportedPostKeys.has(`${item.author}/${item.permlink}`)
      ),
    [reportedPostKeys, reportedAuthorSet]
  );

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

        // Check if current user follows / has muted target. Both are
        // condenser_api.get_following calls — the third parameter is the
        // follow type. Run them in parallel to avoid stacking latency.
        let isFollowing = false;
        let isMuted = false;
        if (currentUsername && currentUsername !== targetUsername) {
          try {
            const [currentFollowing, currentMuted] = await Promise.all([
              userService.getFollowing(currentUsername),
              userService.getMuted(currentUsername),
            ]);
            isFollowing = currentFollowing.some((f) => f.following === targetUsername);
            isMuted = currentMuted.some((f) => f.following === targetUsername);
          } catch {
            // Silently fail — both flags stay false.
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
          isMuted,
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
    setPolls([]);
    setAuthorRewards([]);
    setAuthorRewardsTotals({ totalHbd: 0, totalHpEq: 0 });
    setCurationRewards([]);
    setCurationRewardsTotals({ totalHp: 0, totalHbd: 0 });
    setComments([]);
    setReplies([]);
    setFollowers([]);
    setFollowing([]);
    // Save previous profile's tab + scroll state
    if (prevUsernameRef.current && prevUsernameRef.current !== targetUsername) {
      profileStateCache[prevUsernameRef.current] = {
        tab: activeTab,
        scrollTop: mainScrollRef.current?.scrollTop || 0,
        tabScrollLeft: tabScrollRef.current?.scrollLeft || 0,
      };
    }
    prevUsernameRef.current = targetUsername;

    // Restore if visited before, otherwise default to first tab.
    // Validate the cached tab is still in tabShown — if the consumer changed
    // the visible tab list, an old cached tab could otherwise render content
    // for a tab that's no longer in the bar.
    const cached = profileStateCache[targetUsername];
    const firstTab = tabShown && tabShown.length > 0 ? tabShown[0] : "blogs";
    const cachedTabValid = cached?.tab && (
      !tabShown || tabShown.length === 0 || tabShown.includes(cached.tab)
    );
    // When the parent controls activeTab, it owns tab restoration — leave
    // the controlled value alone (calling setActiveTab here would call
    // onActiveTabChange and force the parent off its remembered tab).
    if (!isControlled) {
      setActiveTab(cachedTabValid ? (cached!.tab as TabType) : firstTab);
    }
    // Restore scroll positions after render
    requestAnimationFrame(() => {
      if (cached) {
        mainScrollRef.current?.scrollTo({ top: cached.scrollTop });
        tabScrollRef.current?.scrollTo({ left: cached.tabScrollLeft });
      } else {
        mainScrollRef.current?.scrollTo({ top: 0 });
        tabScrollRef.current?.scrollTo({ left: 0 });
      }
    });
    setHasMore({ blogs: true, posts: true, snaps: true, polls: false, comments: true, replies: true, activities: false, authorRewards: false, curationRewards: false, followers: true, following: true, wallet: false, votingPower: false, badges: false, witnessVotes: false, growth: false });
    setBadges([]);
    setWitnessVotes([]);
    setVotingPowerData(null);
    setVoteWeight(100);
  }, [targetUsername]);

  // Save state on unmount (e.g. navigating to HiveDetailPost)
  useEffect(() => {
    return () => {
      const user = prevUsernameRef.current;
      if (user) {
        profileStateCache[user] = {
          tab: activeTabRef.current,
          scrollTop: mainScrollRef.current?.scrollTop || 0,
          tabScrollLeft: tabScrollRef.current?.scrollLeft || 0,
        };
      }
    };
  }, []);

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
            const data = filterPost(await userService.getUserBlogs(targetUsername, PAGE_SIZE, undefined, undefined, signal));
            setBlogs(data);
            setHasMore((prev) => ({ ...prev, blogs: data.length >= PAGE_SIZE }));
            break;
          }
          case "posts": {
            const data = filterPost(await userService.getUserPosts(targetUsername, PAGE_SIZE, undefined, undefined, signal));
            setPosts(data);
            setHasMore((prev) => ({ ...prev, posts: data.length >= PAGE_SIZE }));
            break;
          }
          case "snaps": {
            // Snaps tab manages its own data plane via <ProfileSnapsTab/>;
            // skip the centralized fetch path entirely.
            break;
          }
          case "polls": {
            const data = filterPost(await userService.getUserPolls(targetUsername, signal));
            setPolls(data);
            setHasMore((prev) => ({ ...prev, polls: false }));
            break;
          }
          case "comments": {
            const data = filterPost(await userService.getUserComments(targetUsername, PAGE_SIZE, undefined, undefined, signal));
            setComments(data);
            setHasMore((prev) => ({ ...prev, comments: data.length >= PAGE_SIZE }));
            break;
          }
          case "replies": {
            const data = filterPost(await userService.getUserReplies(targetUsername, PAGE_SIZE, undefined, undefined, signal));
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
          case "votingPower": {
            const [accounts, , feedHistory] = await Promise.all([
              userService.getAccounts([targetUsername], signal),
              userService.getDynamicGlobalProperties(signal),
              userService.getFeedHistory(signal),
            ]);
            const account = accounts?.[0];
            if (account) {
              const HIVE_VOTING_MANA_REGENERATION_SECONDS = 5 * 60 * 60 * 24;
              const parseAsset = (v: any) => parseFloat(String(v).split(" ")[0]) || 0;

              // Effective vesting shares
              const effectiveVests =
                parseAsset(account.vesting_shares) +
                parseAsset(account.received_vesting_shares) -
                parseAsset(account.delegated_vesting_shares);
              const maxMana = effectiveVests * 1000000;

              // Upvote power — regenerate from voting_manabar
              const elapsedUp = Math.floor(Date.now() / 1000) - account.voting_manabar.last_update_time;
              let currentManaUp = parseFloat(String(account.voting_manabar.current_mana)) +
                (elapsedUp * maxMana) / HIVE_VOTING_MANA_REGENERATION_SECONDS;
              if (currentManaUp > maxMana) currentManaUp = maxMana;
              const upvotePower = maxMana > 0 ? (currentManaUp / maxMana) * 100 : 0;

              // Downvote power — regenerate from downvote_manabar
              const maxManaDown = maxMana / 4;
              const elapsedDown = Math.floor(Date.now() / 1000) - account.downvote_manabar.last_update_time;
              let currentManaDown = parseFloat(String(account.downvote_manabar.current_mana)) +
                (elapsedDown * maxManaDown) / HIVE_VOTING_MANA_REGENERATION_SECONDS;
              if (currentManaDown > maxManaDown) currentManaDown = maxManaDown;
              const downvotePower = maxManaDown > 0 ? (currentManaDown / maxManaDown) * 100 : 0;

              // Resource credits
              let resourceCredits = 0;
              try {
                const rcResp = await fetch(getHiveApiEndpoint(), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ jsonrpc: "2.0", method: "rc_api.find_rc_accounts", params: { accounts: [targetUsername] }, id: 1 }),
                  signal,
                });
                const rcData = await rcResp.json();
                const rcAccount = rcData?.result?.rc_accounts?.[0];
                if (rcAccount) {
                  const rcCurrent = parseFloat(rcAccount.rc_manabar.current_mana);
                  const rcMax = parseFloat(rcAccount.max_rc);
                  if (rcMax > 0) resourceCredits = (rcCurrent / rcMax) * 100;
                }
              } catch {
                // RC fetch failed — leave at 0
              }

              // Reward fund & price feed for vote value slider
              let rewardBalance = 0;
              let recentClaims = 0;
              let feedPrice = 0;
              try {
                const rfResp = await fetch(getHiveApiEndpoint(), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ jsonrpc: "2.0", method: "condenser_api.get_reward_fund", params: ["post"], id: 1 }),
                  signal,
                });
                const rfData = await rfResp.json();
                const rf = rfData?.result;
                if (rf) {
                  rewardBalance = parseAsset(rf.reward_balance);
                  recentClaims = parseFloat(rf.recent_claims) || 0;
                }
              } catch {
                // Reward fund fetch failed
              }
              if (feedHistory?.current_median_history) {
                const base = parseAsset(feedHistory.current_median_history.base);
                const quote = parseAsset(feedHistory.current_median_history.quote) || 1;
                feedPrice = base / quote;
              }

              const clampedUpvotePower = Math.min(upvotePower, 100);
              setVotingPowerData({
                upvotePower: clampedUpvotePower,
                downvotePower: Math.min(downvotePower, 100),
                resourceCredits: Math.min(resourceCredits, 100),
                maxMana,
                rewardBalance,
                recentClaims,
                feedPrice,
              });
              // Set slider to user's current voting power
              setVoteWeight(parseFloat(clampedUpvotePower.toFixed(2)));
            }
            break;
          }
          case "badges": {
            // Badges are followers whose username starts with "badge-"
            let allFollowers: Follower[] = [];
            let startFollower: string | null = null;
            let hasMoreFollowers = true;
            while (hasMoreFollowers) {
              const batch = await userService.getFollowers(targetUsername, startFollower, 1000, signal);
              allFollowers = [...allFollowers, ...batch];
              if (batch.length < 1000) {
                hasMoreFollowers = false;
              } else {
                startFollower = batch[batch.length - 1].follower;
              }
            }
            const badgeNames = allFollowers
              .map((f) => f.follower)
              .filter((name) => name.startsWith("badge-"));
            setBadges(badgeNames);
            break;
          }
          case "witnessVotes": {
            const accounts = await userService.getAccounts([targetUsername], signal);
            const account = accounts?.[0];
            if (account?.witness_votes) {
              setWitnessVotes(account.witness_votes);
            }
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

  // Filtered data for rendering — always reflects latest filter props
  const filteredBlogs = useMemo(() => filterPost(blogs), [blogs, filterPost]);
  const filteredPosts = useMemo(() => filterPost(posts), [posts, filterPost]);
  const filteredComments = useMemo(() => filterPost(comments), [comments, filterPost]);
  const filteredReplies = useMemo(() => filterPost(replies), [replies, filterPost]);
  const filteredPolls = useMemo(() => filterPost(polls), [polls, filterPost]);

  // ─── Load more (next page) ────────────────────────────────────────────

  /** Tabs the central loadMore() pipeline owns. Other tabs either don't
   *  paginate at all (rewards, badges, growth, …) or own their own
   *  pagination (snaps via <ProfileSnapsTab/>, wallet via the Wallet's
   *  own transactions scroll listener). Listing them explicitly here
   *  prevents a wrong-tab scroll from accidentally appending data to a
   *  different tab's state. */
  const PAGINATED_TABS: TabType[] = ["blogs", "posts", "comments", "replies", "followers", "following"];

  const loadMore = useCallback(async () => {
    if (!PAGINATED_TABS.includes(activeTab)) return;
    if (loadingMore || !hasMore[activeTab] || !targetUsername) return;
    setLoadingMore(true);

    try {
      switch (activeTab) {
        case "blogs": {
          const last = blogs[blogs.length - 1];
          if (!last) break;
          const data = await userService.getUserBlogs(targetUsername, PAGE_SIZE, last.author, last.permlink);
          const newItems = filterPost(data.length > 0 && data[0].permlink === last.permlink ? data.slice(1) : data);
          setBlogs((prev) => [...prev, ...newItems]);
          setHasMore((prev) => ({ ...prev, blogs: newItems.length >= PAGE_SIZE - 1 }));
          break;
        }
        case "posts": {
          const last = posts[posts.length - 1];
          if (!last) break;
          const data = await userService.getUserPosts(targetUsername, PAGE_SIZE, last.author, last.permlink);
          const newItems = filterPost(data.length > 0 && data[0].permlink === last.permlink ? data.slice(1) : data);
          setPosts((prev) => [...prev, ...newItems]);
          setHasMore((prev) => ({ ...prev, posts: newItems.length >= PAGE_SIZE - 1 }));
          break;
        }
        case "snaps": {
          // Load-more for the snaps tab is handled inside <ProfileSnapsTab/>.
          break;
        }
        case "comments": {
          // Mirror the Posts pattern exactly — same cursor semantics
          // (start_author = the user, start_permlink = last comment),
          // same trim-cursor-if-echoed dedupe. The previous Set-based
          // dedupe was over-aggressive and would drop legitimate items.
          const last = comments[comments.length - 1];
          if (!last) break;
          const data = await userService.getUserComments(targetUsername, PAGE_SIZE, last.author, last.permlink);
          const newItems = filterPost(data.length > 0 && data[0].permlink === last.permlink ? data.slice(1) : data);
          setComments((prev) => [...prev, ...newItems]);
          setHasMore((prev) => ({ ...prev, comments: newItems.length >= PAGE_SIZE - 1 }));
          break;
        }
        case "replies": {
          // Mirror the Comments cursor pattern exactly. Confirmed against
          // peakd: a profile for "sagar-test1" paginates with
          // start_author = "shaktimaaan", start_permlink = "h1lowxug" —
          // those are the LAST REPLY's own author and permlink, not the
          // parent post's. A previous attempt used `parent_author /
          // parent_permlink` here, which sent the wrong cursor and made
          // the node either echo the same page or return nothing.
          const last = replies[replies.length - 1];
          if (!last) break;
          const data = await userService.getUserReplies(targetUsername, PAGE_SIZE, last.author, last.permlink);
          const newItems = filterPost(data.length > 0 && data[0].permlink === last.permlink ? data.slice(1) : data);
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
  }, [activeTab, targetUsername, currentUsername, loadingMore, hasMore, blogs, posts, comments, replies, followers, following]);

  // ─── Infinite scroll — direct scroll listener on the nested scroll
  // container. We tried IntersectionObserver first, but it proved
  // unreliable inside the kit's nested scroll layout when the consumer
  // app wraps the profile in its own shell (HiveSuite). The Posts tab
  // happened to work because its rendered cards are tall enough that the
  // sentinel crossed the viewport boundary — Comments / Replies rows are
  // short, so the sentinel never made it into the viewport unless the
  // observer's `root` was pinned exactly to the right element. Scroll
  // events are guaranteed to fire on every scroll regardless of layout,
  // so this is the bulletproof approach.
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;

    // Bottom-edge threshold: when the user has scrolled to within this
    // many pixels of the end, fire `loadMore`. 600px gives the next page
    // a head start so the user rarely hits a hard stop while scrolling.
    const THRESHOLD = 600;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - THRESHOLD) {
          loadMore();
        }
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [loadMore]);

  // After a load-more completes, if the new page didn't make the content
  // any taller than the viewport (short rows / fast network), the user
  // never gets a chance to scroll and the listener above sits idle.
  // Manually peek the scroll position and fire again — bounded by
  // `hasMore` / `loadingMore` so it can't loop forever.
  useEffect(() => {
    if (loadingMore || !hasMore[activeTab]) return;
    const el = mainScrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 600) {
      loadMore();
    }
  }, [loadingMore, activeTab, hasMore, blogs.length, posts.length, comments.length, replies.length, followers.length, following.length, loadMore]);

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
      // Only update after successful broadcast (not on Keychain cancel/reject)
      setProfile((prev) => prev ? {
        ...prev,
        isFollowing: !wasFollowing,
        followersCount: wasFollowing ? Math.max(0, prev.followersCount - 1) : prev.followersCount + 1,
      } : prev);
      // Re-fetch actual counts after a short delay for blockchain propagation
      setTimeout(async () => {
        try {
          const bridgeProfile = await userService.getProfile(targetUsername);
          if (bridgeProfile?.result?.stats) {
            setProfile((prev) => prev ? {
              ...prev,
              followersCount: bridgeProfile.result.stats.followers ?? prev.followersCount,
              followingCount: bridgeProfile.result.stats.following ?? prev.followingCount,
            } : prev);
          }
        } catch { /* silently fail */ }
      }, 3000);
    } catch (err) {
      // Keychain cancelled/rejected or operation failed — don't update state
      console.error("Follow/Unfollow error:", err);
    } finally {
      setActionLoading(false);
    }
  }, [profile, targetUsername, onFollow, onUnfollow]);

  const handleMuteToggle = useCallback(async () => {
    if (!profile) return;
    setActionLoading(true);
    setShowActionDropdown(false);
    try {
      const wasMuted = profile.isMuted;
      const cb = wasMuted ? onUnmute : onMute;
      if (!cb) return;
      const result = await cb(targetUsername);
      if (result === false) return; // user cancelled — keep state
      setProfile((prev) => (prev ? { ...prev, isMuted: !wasMuted } : prev));
    } catch (err) {
      // Keychain cancelled/rejected or operation failed — don't update state.
      console.error("Mute/Unmute error:", err);
    } finally {
      setActionLoading(false);
    }
  }, [profile, targetUsername, onMute, onUnmute]);

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

  const handleReport = useCallback(async (reason: string) => {
    setActionLoading(true);
    try {
      if (onReportUser) {
        await onReportUser(targetUsername, reason);
      }
      setShowReportModal(false);
      setShowActionDropdown(false);
    } catch (err) {
      console.error("Error reporting user:", err);
    } finally {
      setActionLoading(false);
    }
  }, [targetUsername, onReportUser]);

  const handleShare = useCallback(() => {
    onShare?.(targetUsername);
  }, [targetUsername, onShare]);

  const handleFavouriteList = useCallback(async () => {
    if (onFavouriteList) {
      await onFavouriteList();
    }
  }, [onFavouriteList]);

  const handleAddToFavourite = useCallback(async () => {
    if (onAddToFavourite) {
      await onAddToFavourite(targetUsername);
    }
  }, [targetUsername, onAddToFavourite]);

  // ─── Render: Loading state ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dark h-full overflow-y-auto animate-pulse bg-[var(--hrk-bg-app)]">
        {/* Header skeleton */}
        <div className="sticky top-0 z-30 bg-[var(--hrk-bg-app)] border-b border-[var(--hrk-border-subtle)] px-4 py-3 flex items-center gap-3">
          {showBackButton && <div className="w-8 h-8 bg-[var(--hrk-bg-surface-raised)] rounded-full" />}
          <div className="w-9 h-9 bg-[var(--hrk-bg-surface-raised)] rounded-full" />
          <div className="flex-1 min-w-0">
            <div className="h-4 bg-[var(--hrk-bg-surface-raised)] rounded w-28 mb-1.5" />
            <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-36" />
          </div>
          <div className="w-8 h-8 bg-[var(--hrk-bg-surface-raised)] rounded-full" />
        </div>

        {/* Cover image skeleton */}
        <div className="relative">
          <div className="h-36 sm:h-44 bg-[var(--hrk-bg-surface)] w-full" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="h-4 bg-[var(--hrk-bg-surface-raised)] rounded w-48 mb-2" />
            <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-64 mb-3" />
            <div className="flex flex-wrap gap-3">
              <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-20" />
              <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-24" />
              <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-28" />
            </div>
          </div>
        </div>

        {/* Tab bar skeleton */}
        <div className="border-b border-[var(--hrk-border-subtle)] px-2 py-2 flex gap-1 overflow-x-auto">
          {[80, 64, 72, 96, 80, 64, 72].map((w, i) => (
            <div key={i} className="h-8 bg-[var(--hrk-bg-surface)] rounded-lg flex-shrink-0" style={{ width: w }} />
          ))}
        </div>

        {/* Content skeleton */}
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-[var(--hrk-bg-surface)] rounded-xl p-4 border border-[var(--hrk-border-subtle)]">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-[var(--hrk-bg-surface-raised)] rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-3.5 bg-[var(--hrk-bg-surface-raised)] rounded w-24 mb-2" />
                  <div className="h-4 bg-[var(--hrk-bg-surface-raised)] rounded w-4/5 mb-2" />
                  <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-full mb-1.5" />
                  <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-3/5 mb-3" />
                  <div className="flex gap-4">
                    <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-12" />
                    <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-12" />
                    <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-16" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="dark flex items-center justify-center min-h-[400px] bg-[var(--hrk-bg-app)]">
        <div className="text-center">
          <User className="h-14 w-14 text-[var(--hrk-text-tertiary)] mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white mb-1">{t("empty.userNotFound")}</h3>
          <p className="text-[var(--hrk-text-tertiary)]">{error || "This user does not exist"}</p>
          {showBackButton && onBack && (
            <button
              onClick={onBack}
              className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-[var(--hrk-border-default)] text-[var(--hrk-text-secondary)] hover:bg-[var(--hrk-bg-surface-raised)]"
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

  /**
   * Right-side media strip on each post card. Combines images, YouTube,
   * 3Speak, and X / Twitter status links into one carousel that fills
   * the card row's full height and is inset from the edges (`my-3 mr-3`
   * + rounded corners) for breathing room. Click on a tile opens it in
   * the lightbox below — except Twitter, which opens in a new tab.
   */
  const PostMediaTile: React.FC<{ media: PostMedia }> = ({ media }) => {
    if (media.kind === "image") {
      return (
        <img
          src={media.url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      );
    }
    if (media.kind === "youtube") {
      return (
        <>
          <img
            src={`https://i.ytimg.com/vi/${media.id}/hqdefault.jpg`}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-90"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white">
              <Play className="h-5 w-5 fill-current" />
            </span>
          </span>
          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            YouTube
          </span>
        </>
      );
    }
    if (media.kind === "threespeak") {
      return (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--hrk-bg-surface-sunken)]">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--hrk-brand)]/15 text-[var(--hrk-brand)]">
            <Play className="h-5 w-5 fill-current" />
          </span>
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">3Speak</span>
        </span>
      );
    }
    return (
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--hrk-bg-surface-sunken)] text-white">
        <span className="text-3xl font-semibold">𝕏</span>
        <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium">Tweet</span>
      </span>
    );
  };

  const PostMediaLightbox: React.FC<{ media: PostMedia; onClose: () => void }> = ({ media, onClose }) => {
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", onKey);
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        window.removeEventListener("keydown", onKey);
        document.body.style.overflow = prev;
      };
    }, [onClose]);
    return (
      <div
        className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4"
        role="dialog"
        aria-modal="true"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <div
          className="relative flex max-h-[85vh] w-full max-w-3xl items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute -top-10 right-0 z-10 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
            aria-label="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
          {media.kind === "image" && (
            <img src={media.url} alt="" className="max-h-[80vh] max-w-full rounded-lg object-contain" />
          )}
          {media.kind === "youtube" && (
            <div className="w-full overflow-hidden rounded-lg" style={{ aspectRatio: "16/9" }}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${media.id}?autoplay=1&rel=0&playsinline=1`}
                title="YouTube"
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          {media.kind === "threespeak" && (() => {
            const ref = parseThreeSpeakRef(media.url);
            const src = ref
              ? `https://play.3speak.tv/embed?v=${encodeURIComponent(`${ref.author}/${ref.permlink}`)}&mode=iframe&noscroll=1&autoplay=1`
              : media.url;
            return (
              <div className="w-full overflow-hidden rounded-lg" style={{ aspectRatio: "9/16", maxWidth: "380px" }}>
                <iframe
                  src={src}
                  title="3Speak"
                  className="h-full w-full border-0"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  const PostImageCarousel: React.FC<{ media: PostMedia[] }> = ({ media }) => {
    const [idx, setIdx] = useState(0);
    const [preview, setPreview] = useState<PostMedia | null>(null);
    if (media.length === 0) return null;
    const safeIdx = Math.min(idx, media.length - 1);
    const current = media[safeIdx];
    const onTileClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (current.kind === "twitter") {
        window.open(current.url, "_blank", "noopener,noreferrer");
        return;
      }
      setPreview(current);
    };
    return (
      <>
        {/* Mobile renders a fixed landscape thumbnail (28 × 20 ≈ 7:5);
            tablet+ stretches to fill the row height again. */}
        <div className="relative my-2 mr-2 h-20 w-28 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--hrk-bg-surface-raised)] sm:my-3 sm:mr-3 sm:h-auto sm:w-32 sm:self-stretch md:w-40 lg:w-48">
          <button
            onClick={onTileClick}
            className="absolute inset-0 block cursor-pointer"
            aria-label="Open media preview"
          >
            <PostMediaTile media={current} />
          </button>
          {media.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setIdx((prev) => (prev - 1 + media.length) % media.length); }}
                className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                title="Previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIdx((prev) => (prev + 1) % media.length); }}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                title="Next"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {safeIdx + 1}/{media.length}
              </span>
            </>
          )}
        </div>

        {preview && <PostMediaLightbox media={preview} onClose={() => setPreview(null)} />}
      </>
    );
  };

  const renderPostItem = (item: Post, type: "blog" | "post" | "comment" | "reply", onItemClick?: () => void) => {
    const postMedia = extractPostMedia(item);
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
      tooltipLines.push(`Hive Rewards Payout (${(hbdPercent / 200).toFixed(0)}%/${100 - (hbdPercent / 200)}%)`);
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

    const parseDollar = (v?: string) =>
      parseFloat((v ?? "").replace(/[^\d.]/g, "")) || 0;
    const pendingValue = parseDollar(item.pending_payout_value);
    const authorValue = parseDollar(item.author_payout_value);
    const curatorValue = parseDollar(item.curator_payout_value);
    const totalValue = item.payout && item.payout > 0
      ? item.payout
      : (pendingValue > 0 ? pendingValue : authorValue + curatorValue);
    const payoutDetails = {
      pendingValue,
      authorValue,
      curatorValue,
      totalValue,
      isPaidout: !!item.is_paidout,
      payoutAt: item.payout_at,
      percentHbd: item.percent_hbd ?? 10000,
      beneficiaries: (item.beneficiaries ?? []).map((b) => ({
        account: b.account,
        weight: b.weight,
      })),
    };

    return (
      <div
        key={`${item.author}/${item.permlink}`}
        className={`overflow-hidden rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] transition-colors hover:bg-[var(--hrk-bg-surface-raised)] ${onItemClick ? "cursor-pointer" : ""}`}
        onClick={onItemClick}
      >
        {/* Body row: text on the left, image strip on the right. The
            image column uses `self-stretch` so it always fills the
            full height of the text column — taller bodies push the
            image taller, never the other way around. */}
        <div className="flex items-stretch">
          <div className="min-w-0 flex-1 p-2.5 sm:p-4">
            {/* Header: avatar + author/time/community inline */}
            <div className="mb-1 flex items-center gap-2 sm:mb-1.5 sm:gap-3">
              <img
                src={`https://images.hive.blog/u/${item.author}/avatar`}
                alt={item.author}
                className="h-7 w-7 flex-shrink-0 rounded-full bg-[var(--hrk-bg-surface-raised)] sm:h-9 sm:w-9"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${item.author}&background=random&size=40`;
                }}
              />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0 sm:gap-x-2 sm:gap-y-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onUserClick?.(item.author); }}
                  className="text-[11px] font-medium text-white hover:text-blue-400 sm:text-sm"
                >
                  @{item.author}
                </button>
                <span className="text-[10px] text-[var(--hrk-text-tertiary)] sm:text-xs">{formatTimeAgo(item.created)}</span>
                {item.community_title && (
                  <span className="text-[10px] font-medium text-blue-400 sm:text-xs">#{item.community_title}</span>
                )}
              </div>
            </div>

            {item.title && (
              <button
                onClick={(e) => { e.stopPropagation(); onPostClick?.(item.author, item.permlink, item.title); }}
                className="mb-0.5 line-clamp-2 text-left text-[13px] font-semibold leading-snug text-white hover:text-blue-400 sm:mb-1 sm:text-base"
              >
                <TranslatedText text={item.title} />
              </button>
            )}

            {previewText && (
              <p className="line-clamp-2 text-[11px] leading-snug text-[var(--hrk-text-tertiary)] sm:line-clamp-3 sm:text-sm sm:leading-relaxed">
                <TranslatedText text={previewText.substring(0, 240)} />
              </p>
            )}
          </div>

          <PostImageCarousel media={postMedia} />
        </div>

        {/* Action bar — always visible */}
        <div className="border-t border-[var(--hrk-border-subtle)]/50 px-2.5 py-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
          <PostActionButton
            author={item.author}
            permlink={item.permlink}
            currentUser={currentUsername}
            hiveValue={payoutValue}
            hiveIconUrl="/images/hive_logo.png"
            payoutTooltip={payoutTooltip}
            payoutDetails={payoutDetails}
            initialVotes={item.active_votes || []}
            initialVoteCount={
              (item as { stats?: { total_votes?: number }; net_votes?: number }).stats?.total_votes
              ?? (item as { net_votes?: number }).net_votes
              ?? item.active_votes?.length
              ?? 0
            }
            initialCommentsCount={item.children || 0}
            postCreatedAt={item.created}
            onUpvote={onUpvote ? (percent) => onUpvote(item.author, item.permlink, percent) : undefined}
            onSubmitComment={onSubmitComment ? (pAuthor, pPermlink, body) => onSubmitComment(pAuthor, pPermlink, body) : undefined}
            onClickCommentUpvote={onClickCommentUpvote}
            onReblog={item.author !== currentUsername && onReblog ? () => onReblog(item.author, item.permlink) : undefined}
            onShare={onSharePost ? () => onSharePost(item.author, item.permlink) : undefined}
            onTip={item.author !== currentUsername && onTip ? () => onTip(item.author, item.permlink) : undefined}
            onReport={item.author !== currentUsername && onReportPost ? () => setReportPostTarget({ author: item.author, permlink: item.permlink }) : undefined}
            onDelete={item.author === currentUsername && onDeletePost ? () => onDeletePost(item.author, item.permlink) : undefined}
            onEdit={item.author === currentUsername && onEditPost ? () => onEditPost({
              author: item.author,
              permlink: item.permlink,
              body: item.body ?? '',
              title: item.title ?? '',
              parent_author: item.parent_author ?? '',
              parent_permlink: item.parent_permlink ?? '',
              json_metadata: typeof item.json_metadata === 'string'
                ? item.json_metadata
                : (item.json_metadata ? JSON.stringify(item.json_metadata) : ''),
            }) : undefined}
            disableCommentsModal={!!onCommentClick}
            onComments={onCommentClick ? () => onCommentClick(item.author, item.permlink) : undefined}
            ecencyToken={ecencyToken}
            threeSpeakApiKey={threeSpeakApiKey}
            giphyApiKey={giphyApiKey}
            templateToken={templateToken}
            templateApiBaseUrl={templateApiBaseUrl}
            defaultVotePercent={defaultVotePercent}
            voteWeightStep={voteWeightStep}
            allowLandscapeVideos={allowLandscapeVideos}
            awaitingWalletApproval={awaitingWalletApproval}
          />
        </div>
      </div>
    );
  };

  // ─── Render: User item (follower/following) ──────────────────────────────

  const renderUserItem = (name: string, index: number) => (
    <div
      key={`${name}-${index}`}
      className="border border-[var(--hrk-border-subtle)] rounded-lg p-4 bg-[var(--hrk-bg-surface)] hover:bg-[var(--hrk-bg-surface-raised)] transition-colors"
    >
      <div className="flex items-center gap-3">
        <img
          src={`https://images.hive.blog/u/${name}/avatar`}
          alt={name}
          className="w-10 h-10 rounded-full flex-shrink-0 bg-[var(--hrk-bg-surface-raised)]"
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
  /** Skeleton for the new card layout: text on the left, media strip
   *  on the right, action bar at the bottom. Mirrors the live card's
   *  mobile-first responsive sizing — landscape thumbnail on mobile
   *  (w-28 / h-20), self-stretch on tablet+. */
  const renderPostSkeleton = (count = 5) => (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)]">
          <div className="flex items-stretch">
            <div className="min-w-0 flex-1 space-y-1.5 p-2.5 sm:space-y-2 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="h-7 w-7 flex-shrink-0 rounded-full bg-[var(--hrk-bg-surface-raised)] sm:h-9 sm:w-9" />
                <div className="h-2.5 w-20 rounded bg-[var(--hrk-bg-surface-raised)] sm:h-3 sm:w-24" />
                <div className="h-2 w-10 rounded bg-[var(--hrk-bg-surface-raised)]/70 sm:w-12" />
              </div>
              <div className="h-3 w-5/6 rounded bg-[var(--hrk-bg-surface-raised)] sm:h-4" />
              <div className="h-2.5 w-full rounded bg-[var(--hrk-bg-surface-raised)]/70 sm:h-3" />
              <div className="h-2.5 w-4/6 rounded bg-[var(--hrk-bg-surface-raised)]/70 sm:h-3" />
            </div>
            <div className="my-2 mr-2 h-20 w-28 flex-shrink-0 rounded-lg bg-[var(--hrk-bg-surface-raised)]/70 sm:my-3 sm:mr-3 sm:h-auto sm:w-32 sm:self-stretch md:w-40 lg:w-48" />
          </div>
          <div className="flex gap-3 border-t border-[var(--hrk-border-subtle)]/50 px-2.5 py-2 sm:px-4">
            <div className="h-3 w-10 rounded bg-[var(--hrk-bg-surface-raised)]/70" />
            <div className="h-3 w-10 rounded bg-[var(--hrk-bg-surface-raised)]/70" />
            <div className="h-3 w-10 rounded bg-[var(--hrk-bg-surface-raised)]/70" />
            <div className="ml-auto h-3 w-12 rounded bg-[var(--hrk-bg-surface-raised)]/70" />
          </div>
        </div>
      ))}
    </div>
  );

  /** Follower/following user grid skeleton */
  const renderUserSkeleton = (count = 8) => (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 animate-pulse">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="border border-[var(--hrk-border-subtle)] rounded-lg p-4 bg-[var(--hrk-bg-surface)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--hrk-bg-surface-raised)] rounded-full flex-shrink-0" />
            <div className="h-4 bg-[var(--hrk-bg-surface-raised)] rounded w-28" />
          </div>
        </div>
      ))}
    </div>
  );

  /** Poll card skeleton */
  const renderPollSkeleton = (count = 3) => (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-[var(--hrk-bg-surface)] rounded-xl p-4 border border-[var(--hrk-border-subtle)]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[var(--hrk-bg-surface-raised)] rounded-full flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-3.5 bg-[var(--hrk-bg-surface-raised)] rounded w-24" />
                <div className="h-5 bg-[var(--hrk-bg-surface-raised)] rounded-full w-14" />
              </div>
              {/* Question */}
              <div className="h-4 bg-[var(--hrk-bg-surface-raised)] rounded w-4/5 mb-3" />
              {/* Poll options */}
              <div className="space-y-2 mb-3">
                <div className="h-8 bg-[var(--hrk-bg-surface-raised)] rounded-lg w-full" />
                <div className="h-8 bg-[var(--hrk-bg-surface-raised)] rounded-lg w-full" />
                <div className="h-8 bg-[var(--hrk-bg-surface-raised)] rounded-lg w-3/4" />
              </div>
              {/* Stats */}
              <div className="flex gap-4">
                <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-20" />
                <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-24" />
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
      <div className="bg-[var(--hrk-bg-surface)] rounded-xl p-4 border border-[var(--hrk-border-subtle)]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 bg-[var(--hrk-bg-surface-raised)] rounded" />
          <div className="h-4 bg-[var(--hrk-bg-surface-raised)] rounded w-44" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-[var(--hrk-bg-app)]/50 rounded-lg p-2.5">
              <div className="h-2.5 bg-[var(--hrk-bg-surface-raised)] rounded w-12 mb-2" />
              <div className="h-5 bg-[var(--hrk-bg-surface-raised)] rounded w-16" />
            </div>
          ))}
        </div>
      </div>
      {/* Row skeletons */}
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-[var(--hrk-bg-surface)] rounded-xl p-4 border border-[var(--hrk-border-subtle)]">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 bg-[var(--hrk-bg-surface-raised)] rounded-lg" />
            <div className="flex-1">
              <div className="h-4 bg-[var(--hrk-bg-surface-raised)] rounded w-3/4 mb-2" />
              <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-1/3 mb-3" />
              <div className="flex gap-4">
                <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-20" />
                <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-16" />
                <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-16" />
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
      case "badges":
      case "witnessVotes":
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
          <Award className="h-12 w-12 text-[var(--hrk-text-tertiary)] mx-auto mb-3" />
          <p className="text-[var(--hrk-text-tertiary)]">{t("empty.noPendingAuthor")}</p>
          <p className="text-[var(--hrk-text-tertiary)] text-xs mt-1">Rewards appear for posts/comments with pending payouts</p>
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
            <h3 className="text-sm font-semibold text-amber-300">{t("reward.pendingAuthor")}</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-black/30 rounded-lg p-2.5">
              <p className="text-[10px] text-[var(--hrk-text-tertiary)] uppercase tracking-wider">{t("reward.posts")}</p>
              <p className="text-lg font-bold text-white">{postCount}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2.5">
              <p className="text-[10px] text-[var(--hrk-text-tertiary)] uppercase tracking-wider">{t("reward.comments")}</p>
              <p className="text-lg font-bold text-white">{commentCount}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2.5">
              <p className="text-[10px] text-[var(--hrk-text-tertiary)] uppercase tracking-wider">{t("reward.totalHbd")}</p>
              <p className="text-lg font-bold text-amber-400">${formatNum(authorRewardsTotals.totalHbd)}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2.5">
              <p className="text-[10px] text-[var(--hrk-text-tertiary)] uppercase tracking-wider">{t("reward.totalHp")}</p>
              <p className="text-lg font-bold text-orange-400">{formatNum(authorRewardsTotals.totalHpEq)}</p>
            </div>
          </div>
        </div>

        {/* Reward rows */}
        {authorRewards.map((row, i) => (
          <div
            key={`${row.author}-${row.permlink}-${i}`}
            className="bg-[var(--hrk-bg-surface)] rounded-xl p-4 border border-[var(--hrk-border-subtle)] hover:border-[var(--hrk-border-default)] transition-colors cursor-pointer"
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
                    {row.isComment ? t("reward.comment") : t("reward.post")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-[var(--hrk-text-tertiary)]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Payout in {formatDuration(row.payoutMs)}
                  </span>
                  <span className="text-amber-400 font-medium">${formatNum(row.hbd)} HBD</span>
                  {row.hpEq !== null && <span className="text-orange-400 font-medium">{formatNum(row.hpEq)} HP</span>}
                  {row.beneficiaryCut > 0 && (
                    <span className="text-[var(--hrk-text-tertiary)]">
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
              <div key={i} className="bg-[var(--hrk-bg-surface)] rounded-xl p-4 border border-[var(--hrk-border-subtle)]">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-[var(--hrk-bg-surface-raised)] rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 bg-[var(--hrk-bg-surface-raised)] rounded w-3/4 mb-2" />
                    <div className="flex gap-4">
                      <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-20" />
                      <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-16" />
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
          <TrendingUp className="h-12 w-12 text-[var(--hrk-text-tertiary)] mx-auto mb-3" />
          <p className="text-[var(--hrk-text-tertiary)]">{t("empty.noPendingCuration")}</p>
          <p className="text-[var(--hrk-text-tertiary)] text-xs mt-1">{t("empty.curationHint")}</p>
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
            <h3 className="text-sm font-semibold text-blue-300">{t("reward.pendingCuration")}</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-black/30 rounded-lg p-2.5">
              <p className="text-[10px] text-[var(--hrk-text-tertiary)] uppercase tracking-wider">{t("reward.posts")}</p>
              <p className="text-lg font-bold text-white">{postCount}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2.5">
              <p className="text-[10px] text-[var(--hrk-text-tertiary)] uppercase tracking-wider">{t("reward.comments")}</p>
              <p className="text-lg font-bold text-white">{commentCount}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2.5">
              <p className="text-[10px] text-[var(--hrk-text-tertiary)] uppercase tracking-wider">{t("reward.totalHp")}</p>
              <p className="text-lg font-bold text-blue-400">{formatNum(curationRewardsTotals.totalHp)}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2.5">
              <p className="text-[10px] text-[var(--hrk-text-tertiary)] uppercase tracking-wider">{t("reward.totalHbd")}</p>
              <p className="text-lg font-bold text-purple-400">${formatNum(curationRewardsTotals.totalHbd)}</p>
            </div>
            {avgEfficiency !== null && (
              <div className="bg-black/30 rounded-lg p-2.5">
                <p className="text-[10px] text-[var(--hrk-text-tertiary)] uppercase tracking-wider">{t("reward.avgEfficiency")}</p>
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
            className="bg-[var(--hrk-bg-surface)] rounded-xl p-4 border border-[var(--hrk-border-subtle)] hover:border-[var(--hrk-border-default)] transition-colors cursor-pointer"
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
                    <p className="text-xs text-[var(--hrk-text-tertiary)] mt-0.5">by @{row.author}</p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${row.isComment ? "bg-blue-900/40 text-blue-300" : "bg-emerald-900/40 text-emerald-300"}`}>
                    {row.isComment ? t("reward.comment") : t("reward.post")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-[var(--hrk-text-tertiary)]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Payout in {formatDuration(row.payoutMs)}
                  </span>
                  <span className="text-blue-400 font-medium">{formatNum(row.hp)} HP</span>
                  <span className="text-purple-400 font-medium">${formatNum(row.hbd)} HBD</span>
                  <span className="text-[var(--hrk-text-tertiary)]">
                    Vote: {row.weightPct.toFixed(2)}%
                  </span>
                  {row.efficiency !== null && (
                    <span className={`font-medium ${row.efficiency >= 100 ? "text-emerald-400" : "text-amber-400"}`}>
                      Eff: {row.efficiency.toFixed(1)}%
                    </span>
                  )}
                  {row.votedAfterMs !== null && (
                    <span className="text-[var(--hrk-text-tertiary)]">
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
              <div key={i} className="bg-[var(--hrk-bg-surface)] rounded-xl p-4 border border-[var(--hrk-border-subtle)]">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-[var(--hrk-bg-surface-raised)] rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 bg-[var(--hrk-bg-surface-raised)] rounded w-3/4 mb-2" />
                    <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-1/3 mb-3" />
                    <div className="flex gap-4">
                      <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-20" />
                      <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-16" />
                      <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-14" />
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
    if (activeTab === "growth") {
      return <UserGrowth username={targetUsername} />;
    }

    if (activeTab === "wallet") {
      return (
        <div className="max-w-3xl mx-auto">
          <Wallet
            username={targetUsername}
            currentUsername={currentUsername}
            onUpdateRcDelegation={onUpdateRcDelegation}
            onDeleteRcDelegation={onDeleteRcDelegation}
            onCreateHpDelegation={onCreateHpDelegation}
            onCreateRcDelegation={onCreateRcDelegation}
            onTransfer={onTransfer}
            onPowerUp={onPowerUp}
            onPowerDown={onPowerDown}
            onTransferToSavings={onTransferToSavings}
            onTransferFromSavings={onTransferFromSavings}
            onStopPowerDown={onStopPowerDown}
            onCancelSavingsWithdrawal={onCancelSavingsWithdrawal}
            onClaimRewards={onClaimRewards}
          />
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

    // Voting Power tab
    if (activeTab === "votingPower") {
      if (loadingContent) {
        return (
          <div className="max-w-lg mx-auto space-y-6 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-[var(--hrk-bg-surface-raised)] rounded w-32" />
                <div className="h-4 bg-[var(--hrk-bg-surface-raised)] rounded-full w-full" />
              </div>
            ))}
            <div className="mt-4 p-4 bg-[var(--hrk-bg-surface)] rounded-xl border border-[var(--hrk-border-subtle)]">
              <div className="h-4 bg-[var(--hrk-bg-surface-raised)] rounded w-40 mb-3" />
              <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded-full w-full" />
            </div>
          </div>
        );
      }
      if (!votingPowerData) {
        return (
          <div className="text-center py-12">
            <Gauge className="h-12 w-12 text-[var(--hrk-text-tertiary)] mx-auto mb-3" />
            <p className="text-[var(--hrk-text-tertiary)]">{t("empty.votingPowerUnavailable")}</p>
          </div>
        );
      }

      // Vote value calculation
      const { maxMana, rewardBalance, recentClaims, feedPrice } = votingPowerData;

      // Slider represents mana level — default to user's current VP
      const sliderPower = voteWeight; // reusing voteWeight state as the mana slider value
      const REGEN_SECONDS = 5 * 60 * 60 * 24; // 432000s = 5 days

      // Calculate vote value at current slider power (full-weight 100% vote at this mana level)
      const rshares = maxMana * (sliderPower / 100) * 0.02;
      const hiveValue = recentClaims > 0 ? (rshares / recentClaims) * rewardBalance : 0;
      const hbdValue = hiveValue * feedPrice;

      // Recharge time from slider position to 100%
      const rechargeSeconds = ((100 - sliderPower) / 100) * REGEN_SECONDS;

      const formatRechargeTime = (totalSeconds: number): string => {
        if (totalSeconds <= 0) return t("common.fullyCharged");
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        if (days > 0) return `Full in ${days} day${days > 1 ? "s" : ""} ${hours} hour${hours !== 1 ? "s" : ""} ${minutes} minute${minutes !== 1 ? "s" : ""}`;
        if (hours > 0) return `Full in ${hours} hour${hours !== 1 ? "s" : ""} ${minutes} minute${minutes !== 1 ? "s" : ""}`;
        return `Full in ${minutes} minute${minutes !== 1 ? "s" : ""}`;
      };

      const formatVal = (n: number, d = 2) =>
        isNaN(n) ? "—" : n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

      const bars = [
        { label: t("vp.upvotePower"), value: votingPowerData.upvotePower, color: "var(--hrk-success)" },
        { label: t("vp.downvotePower"), value: votingPowerData.downvotePower, color: "var(--hrk-warning)" },
        { label: t("vp.resourceCredits"), value: votingPowerData.resourceCredits, color: "var(--hrk-info)" },
      ];
      return (
        <div className="max-w-lg mx-auto space-y-6">
          {/* Vote Value + Mana Slider (PeakD-style) */}
          <div className="p-5 rounded-xl bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)] flex flex-col items-center">
            {/* Vote value badge */}
            <div className="inline-flex flex-col items-center px-5 py-2.5 rounded-full bg-blue-600/20 border border-blue-500/40 mb-5">
              <span className="text-sm sm:text-base font-bold text-white tracking-wide">
                VOTE VALUE: <span className="text-blue-400">${formatVal(hbdValue)}</span>
                <span className="text-[var(--hrk-text-tertiary)] ml-1.5">({sliderPower.toFixed(2)}%)</span>
              </span>
              <span className="text-xs text-[var(--hrk-text-tertiary)] mt-1">
                <span className="text-white font-medium">{formatVal(hbdValue)} HBD</span>
                <span className="mx-1.5">·</span>
                <span className="text-[var(--hrk-text-secondary)]">~{formatVal(hiveValue, 3)} HIVE</span>
              </span>
            </div>

            {/* Mana slider */}
            <div className="w-full flex items-center gap-3">
              <span className="text-xs font-medium text-[var(--hrk-text-tertiary)] whitespace-nowrap">0%</span>
              <input
                type="range"
                min={0}
                max={100}
                step={0.01}
                value={sliderPower}
                onChange={(e) => setVoteWeight(Number(e.target.value))}
                className="flex-1 h-2.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:-mt-1 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white"
                style={{
                  background: `linear-gradient(to right, var(--hrk-info) 0%, var(--hrk-info) ${sliderPower}%, var(--hrk-border-default) ${sliderPower}%, var(--hrk-border-default) 100%)`,
                }}
              />
              <span className="text-xs font-medium text-[var(--hrk-text-tertiary)] whitespace-nowrap">100%</span>
            </div>

            {/* Recharge time */}
            <p className="mt-3 text-sm text-[var(--hrk-text-tertiary)]">
              {formatRechargeTime(rechargeSeconds)}
            </p>
          </div>

          {/* Progress bars */}
          {bars.map((bar) => (
            <div key={bar.label} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-[var(--hrk-text-secondary)]">{bar.label}</span>
                <span className="text-sm font-bold text-white">{bar.value.toFixed(2)}%</span>
              </div>
              <div className="w-full bg-[var(--hrk-bg-surface-raised)] rounded-full h-3">
                <div
                  className="h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(bar.value, 100)}%`, backgroundColor: bar.color }}
                />
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Badges tab
    if (activeTab === "badges") {
      if (loadingContent) return renderUserSkeleton();
      if (badges.length === 0) {
        return (
          <div className="text-center py-12">
            <Award className="h-12 w-12 text-[var(--hrk-text-tertiary)] mx-auto mb-3" />
            <p className="text-[var(--hrk-text-tertiary)]">{t("empty.noBadges")}</p>
          </div>
        );
      }
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {badges.map((name, i) => renderUserItem(name, i))}
        </div>
      );
    }

    // Witness Votes tab
    if (activeTab === "witnessVotes") {
      if (loadingContent) return renderUserSkeleton();
      if (witnessVotes.length === 0) {
        return (
          <div className="text-center py-12">
            <Shield className="h-12 w-12 text-[var(--hrk-text-tertiary)] mx-auto mb-3" />
            <p className="text-[var(--hrk-text-tertiary)]">{t("empty.noWitnessVotes")}</p>
          </div>
        );
      }
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {witnessVotes.map((name, i) => renderUserItem(name, i))}
        </div>
      );
    }

    // Snaps tab — keep the segmented control mounted while the content below
    // (skeleton / empty state / list) swaps on sub-type change. This prevents
    // the whole tab bar from flickering each time the user taps Ecency /
    // Threads / Liketu.
    if (activeTab === "snaps") {
      // Snaps tab uses the same <SnapsFeedView/> shell as the unified Snaps
      // page — 1-column on mobile (with a pill switcher), 4-column on
      // tablet+ (peak.snaps · ecency.waves · leothreads · liketu.moments).
      // Desktop renders each column with its own scrollbar, so the wrapper
      // gives it a fixed height to clip against. ProfileSnapsTab owns its
      // own data plane.
      return (
        <div className="h-[calc(100vh-260px)] min-h-[420px]">
          <ProfileSnapsTab
            // Remount on user change so the per-username pagination cache
            // hydrates correctly. Without this key the component is reused
            // across profiles and the cache-mirror effect can briefly
            // write the previous user's state into the new user's slot.
            key={targetUsername}
            username={targetUsername}
            currentUsername={currentUsername}
            reportedPosts={reportedPosts}
            reportedAuthors={reportedAuthors}
            onUpvote={onUpvote}
            onSubmitComment={onSubmitComment}
            onClickCommentUpvote={onClickCommentUpvote}
            onReblog={onReblog}
            onTip={onTip}
            onSharePost={onSharePost}
            onCommentClick={onCommentClick}
            onClickCommentIcon={onClickSnapCommentIcon}
            onClickCommentCount={onClickSnapCommentCount}
            onUserClick={onUserClick}
            onPostClick={onSnapClick
              ? (author, permlink) => onSnapClick(author, permlink)
              : onPostClick
                ? (author, permlink, title) => onPostClick(author, permlink, title ?? "")
                : undefined}
            onReportPost={onReportPost
              ? (author, permlink) => setReportPostTarget({ author, permlink })
              : undefined}
            onDeletePost={onDeletePost}
            onVotePoll={onVotePoll}
            onEditSnap={onEditSnap}
            ecencyToken={ecencyToken}
            threeSpeakApiKey={threeSpeakApiKey}
            giphyApiKey={giphyApiKey}
            templateToken={templateToken}
            templateApiBaseUrl={templateApiBaseUrl}
            defaultVotePercent={defaultVotePercent}
            voteWeightStep={voteWeightStep}
            allowLandscapeVideos={allowLandscapeVideos}
            awaitingWalletApproval={awaitingWalletApproval}
            renderHeaderActions={renderSnapHeaderActions}
          />
        </div>
      );
    }

    if (loadingContent) {
      return renderSkeletonForTab();
    }

    // Followers tab
    if (activeTab === "followers") {
      if (followers.length === 0) {
        return (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-[var(--hrk-text-tertiary)] mx-auto mb-3" />
            <p className="text-[var(--hrk-text-tertiary)]">{t("empty.noFollowers")}</p>
          </div>
        );
      }
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {followers.map((f, i) => renderUserItem(f.follower, i))}
        </div>
      );
    }

    // Following tab
    if (activeTab === "following") {
      if (following.length === 0) {
        return (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-[var(--hrk-text-tertiary)] mx-auto mb-3" />
            <p className="text-[var(--hrk-text-tertiary)]">{t("empty.notFollowing")}</p>
          </div>
        );
      }
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {following.map((f, i) => renderUserItem(f.following, i))}
        </div>
      );
    }

    // Polls tab
    if (activeTab === "polls") {
      if (filteredPolls.length === 0) {
        return (
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-[var(--hrk-text-tertiary)] mx-auto mb-3" />
            <p className="text-[var(--hrk-text-tertiary)]">{t("empty.noPolls")}</p>
          </div>
        );
      }
      return (
        <div className="space-y-3">
          {filteredPolls.map((poll) => (
            <PollListItem
              key={`${poll.author}/${poll.permlink}`}
              poll={poll}
              currentUsername={currentUsername}
              onVotePoll={onVotePoll}
              onPollClick={onPollClick}
              onUpvote={onUpvote}
              onSubmitComment={onSubmitComment}
              onClickCommentUpvote={onClickCommentUpvote}
              onReblog={onReblog}
              onTip={onTip}
              onSharePost={onSharePost}
              onCommentClick={onCommentClick}
              onRequestReportPost={onReportPost ? (a, p) => setReportPostTarget({ author: a, permlink: p }) : undefined}
              onUserClick={onUserClick}
              ecencyToken={ecencyToken}
              threeSpeakApiKey={threeSpeakApiKey}
              giphyApiKey={giphyApiKey}
              templateToken={templateToken}
              templateApiBaseUrl={templateApiBaseUrl}
              defaultVotePercent={defaultVotePercent}
              voteWeightStep={voteWeightStep}
              allowLandscapeVideos={allowLandscapeVideos}
            />
          ))}
        </div>
      );
    }

    // Content tabs (blogs, posts, comments, replies) — explicit allowlist
    // so we cannot accidentally render post cards on a tab that has its
    // own branch above (authorRewards, votingPower, badges, etc.). The
    // earlier `Record<string, ...>` typing let `contentMap[activeTab]`
    // silently return `undefined` for unknown tabs, which usually became
    // `null` but could leak through layout edges on remount transitions.
    const CONTENT_TABS: TabType[] = ["blogs", "posts", "comments", "replies"];
    if (!CONTENT_TABS.includes(activeTab)) return null;

    const contentMap: Record<"blogs" | "posts" | "comments" | "replies", { data: Post[]; type: "blog" | "post" | "comment" | "reply"; icon: any }> = {
      blogs: { data: filteredBlogs, type: "blog", icon: FileText },
      posts: { data: filteredPosts, type: "post", icon: FileText },
      comments: { data: filteredComments, type: "comment", icon: MessageCircle },
      replies: { data: filteredReplies, type: "reply", icon: Reply },
    };

    const current = contentMap[activeTab as "blogs" | "posts" | "comments" | "replies"];
    if (!current) return null;

    if (current.data.length === 0) {
      const EmptyIcon = current.icon;
      const emptyKey =
        activeTab === "blogs" ? "empty.noBlogs"
          : activeTab === "posts" ? "empty.noPosts"
          : activeTab === "comments" ? "empty.noComments"
          : activeTab === "replies" ? "empty.noReplies"
          : "empty.noPosts";
      return (
        <div className="text-center py-12">
          <EmptyIcon className="h-12 w-12 text-[var(--hrk-text-tertiary)] mx-auto mb-3" />
          <p className="text-[var(--hrk-text-tertiary)]">{t(emptyKey as any)}</p>
        </div>
      );
    }

    // The snaps tab has its own dedicated branch earlier in renderTabContent,
    // so only blogs/posts/comments/replies reach this handler.
    const getItemClickHandler = (item: Post) => {
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
    { id: "blogs", label: t("tab.blogs"), icon: FileText },
    { id: "posts", label: t("tab.posts"), icon: FileText },
    { id: "snaps", label: t("tab.snaps"), icon: Camera },
    { id: "polls", label: t("tab.polls"), icon: BarChart3 },
    { id: "comments", label: t("tab.comments"), icon: MessageCircle },
    { id: "replies", label: t("tab.replies"), icon: Reply },
    { id: "activities", label: t("tab.activities"), icon: Activity },
    { id: "authorRewards", label: t("tab.authorRewards"), icon: Award },
    { id: "curationRewards", label: t("tab.curationRewards"), icon: TrendingUp },
    { id: "growth", label: t("tab.growth"), icon: TrendingUp },
    { id: "followers", label: t("tab.followers"), icon: Users },
    { id: "following", label: t("tab.following"), icon: Users },
    { id: "wallet", label: t("tab.wallet"), icon: WalletIcon },
    { id: "votingPower", label: t("tab.votingPower"), icon: Gauge },
    { id: "badges", label: t("tab.badges"), icon: Award },
    { id: "witnessVotes", label: t("tab.witnessVotes"), icon: Shield },
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
    <div className="dark flex flex-col h-full bg-[var(--hrk-bg-app)]">
      <div ref={mainScrollRef} className="flex flex-col overflow-y-auto h-full scrollbar-hide">

        {/* ── Compact Header: Avatar + Name + Stats + Actions ── */}
        <div className="sticky top-0 z-30 h-[56px] bg-[var(--hrk-bg-surface)]/95 backdrop-blur-sm border-b border-[var(--hrk-border-subtle)] flex items-center">
          <div className="px-4 py-2 flex items-center gap-2 w-full">
            {/* Back */}
            {showBackButton && onBack && (
              <button
                onClick={onBack}
                className="p-1.5 hover:bg-[var(--hrk-bg-surface-raised)] rounded-lg transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-[var(--hrk-text-secondary)]" />
              </button>
            )}

            {/* Avatar */}
            <img
              src={
                profile.profileImage ||
                `https://images.hive.blog/u/${targetUsername}/avatar`
              }
              alt={targetUsername}
              className="w-8 h-8 rounded-full flex-shrink-0 bg-[var(--hrk-bg-surface-raised)] object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://images.hive.blog/u/${targetUsername}/avatar`;
              }}
            />

            {/* Name inline */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-white truncate">
                  {`@${targetUsername}`}
                </h1>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {onFavouriteList && (
                <button
                  onClick={handleFavouriteList}
                  className="p-2 bg-black/40 hover:bg-black/60 rounded-full transition-colors relative"
                  title="Favourite list"
                >
                  <Heart className={`h-4 w-4 ${isFavourited ? 'text-red-500' : 'text-white'}`} fill={isFavourited ? 'currentColor' : 'none'} />
                  {favouriteCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                      {favouriteCount > 99 ? '99+' : favouriteCount}
                    </span>
                  )}
                </button>
              )}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowActionDropdown((prev) => !prev)}
                  className="p-2 bg-black/40 hover:bg-black/60 rounded-full transition-colors"
                  title="More actions"
                >
                  <MoreVertical className="h-4 w-4 text-white" />
                </button>
                {showActionDropdown && (
                  <div
                    className="absolute right-0 mt-1 w-48 rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] shadow-xl z-[100]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {showActions && (onFollow || onUnfollow) && (
                      <button
                        onClick={() => {
                          setShowActionDropdown(false);
                          handleFollowToggle();
                        }}
                        disabled={actionLoading}
                        className="w-full px-4 py-2.5 text-left text-sm text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-surface-raised)] disabled:opacity-50"
                      >
                        <span className="flex items-center gap-2">
                          {profile.isFollowing ? <UserMinus className="h-4 w-4 text-red-400" /> : <UserPlus className="h-4 w-4 text-green-400" />}
                          {profile.isFollowing ? t("action.unfollow") : t("action.follow")}
                        </span>
                      </button>
                    )}
                    {showActions && (onMute || onUnmute) && (
                      <button
                        onClick={() => {
                          setShowActionDropdown(false);
                          handleMuteToggle();
                        }}
                        disabled={actionLoading || (profile.isMuted ? !onUnmute : !onMute)}
                        className="w-full px-4 py-2.5 text-left text-sm text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-surface-raised)] disabled:opacity-50"
                      >
                        <span className="flex items-center gap-2">
                          {profile.isMuted ? <Volume2 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4 text-red-400" />}
                          {profile.isMuted ? t("action.unmute") : t("action.mute")}
                        </span>
                      </button>
                    )}
                    {showActions && onIgnoreAuthor && (
                      <button
                        onClick={() => {
                          setShowActionDropdown(false);
                          setShowIgnoreConfirm(true);
                        }}
                        disabled={actionLoading}
                        className="w-full px-4 py-2.5 text-left text-sm text-[var(--hrk-text-primary)] hover:bg-gray-700disabled:opacity-50"
                      >
                        <span className="flex items-center gap-2">
                          <Ban className="h-4 w-4 text-red-400" /> {t("action.ignoreAuthor")}
                        </span>
                      </button>
                    )}
                    {showActions && onReportUser && (
                      <button
                        onClick={() => {
                          setShowActionDropdown(false);
                          setShowReportModal(true);
                        }}
                        disabled={actionLoading}
                        className="w-full px-4 py-2.5 text-left text-sm text-[var(--hrk-text-primary)] hover:bg-gray-700disabled:opacity-50 last:rounded-b-lg"
                      >
                        <span className="flex items-center gap-2">
                          <Flag className="h-4 w-4 text-orange-400" /> {t("action.reportUser")}
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowActionDropdown(false);
                        handleShare();
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-surface-raised)] first:rounded-t-lg"
                    >
                      <span className="flex items-center gap-2">
                        <Share2 className="h-4 w-4 text-blue-400" /> {t("action.shareProfile")}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cover image with profile details overlaid */}
        <div className="relative">
          {/* Cover image */}
          {profile.coverImage ? (
            <div
              className={`w-full bg-cover bg-center sm:h-52 md:h-60 ${(profile.about?.length ?? 0) > 50 ? "h-52" : "h-44"}`}
              style={{ backgroundImage: `url(${profile.coverImage})` }}
            />
          ) : (
            <div className={`w-full bg-gradient-to-r from-blue-600 to-purple-700 sm:h-52 md:h-60 ${(profile.about?.length ?? 0) > 50 ? "h-52" : "h-44"}`} />
          )}
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />

          {/* Favourite button on cover */}
          {onAddToFavourite && (
            <button
              onClick={handleAddToFavourite}
              className="absolute top-3 right-3 p-2 bg-black/40 hover:bg-black/60 rounded-full transition-colors z-10"
              title={isFavourited ? "Remove from favourites" : "Add to favourites"}
            >
              <Heart className={`h-5 w-5 ${isFavourited ? 'text-red-500' : 'text-white'}`} fill={isFavourited ? 'currentColor' : 'none'} />
            </button>
          )}

          {/* Profile details overlaid on cover */}
          <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-4">
            <div className="flex items-end gap-3 sm:gap-4">
              {/* Avatar — wrapped in a button for the owner so they
                  can edit their profile. A persistent red pencil badge
                  on the bottom-right corner makes the affordance
                  discoverable on touch devices (no hover); the
                  full-overlay dim is the bonus desktop hover state. */}
              {isOwnProfile && onEditProfile ? (
                <button
                  type="button"
                  onClick={onEditProfile}
                  aria-label="Edit profile"
                  className="group relative flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-white/60"
                >
                  <img
                    src={profile.profileImage || `https://images.hive.blog/u/${targetUsername}/avatar`}
                    alt={targetUsername}
                    className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full border-3 sm:border-4 border-gray-900 bg-[var(--hrk-bg-surface-raised)] object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://images.hive.blog/u/${targetUsername}/avatar`;
                    }}
                  />
                  <span
                    className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition-all duration-150 group-hover:bg-black/55 group-hover:opacity-100 group-focus:bg-black/55 group-focus:opacity-100"
                  >
                    <Pencil className="h-5 w-5 sm:h-6 sm:w-6" />
                  </span>
                  <span
                    className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-900 bg-[var(--hrk-brand)] text-white shadow-md sm:h-7 sm:w-7"
                    aria-hidden
                  >
                    <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </span>
                </button>
              ) : (
                <img
                  src={profile.profileImage || `https://images.hive.blog/u/${targetUsername}/avatar`}
                  alt={targetUsername}
                  className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full border-3 sm:border-4 border-gray-900 bg-[var(--hrk-bg-surface-raised)] object-cover flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://images.hive.blog/u/${targetUsername}/avatar`;
                  }}
                />
              )}
              {/* Name + details */}
              <div className="flex-1 min-w-0 pb-0.5">
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-white truncate drop-shadow-md">
                  {profile.name || targetUsername}
                  <span className="text-xs sm:text-sm text-[var(--hrk-text-secondary)] drop-shadow-md"> (@{targetUsername})</span>
                </h2>
                {profile.about && (
                  <p className="text-[var(--hrk-text-primary)] text-xs sm:text-sm leading-relaxed mt-1 line-clamp-2 drop-shadow-md">
                    {profile.about}
                  </p>
                )}
                {profile.location && (
                  <span className="flex items-center gap-1 text-[var(--hrk-text-secondary)] text-xs mt-1 drop-shadow-md whitespace-nowrap">
                    <MapPin className="h-3 w-3 text-rose-400 flex-shrink-0" /> {profile.location.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()}
                  </span>
                )}
              </div>
            </div>
            {/* Meta info row */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] sm:text-xs text-[var(--hrk-text-primary)]">
              {profile.website && (
                <a
                  href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-300 hover:underline drop-shadow-md"
                >
                  <Globe className="h-3 w-3 text-blue-400" /> {profile.website}
                </a>
              )}
              {profile.created && (
                <span className="flex items-center gap-1 drop-shadow-md">
                  <Calendar className="h-3 w-3 text-green-400" /> {formatDate(profile.created)}
                </span>
              )}
              {profile.lastActivity && (
                <span className="flex items-center gap-1 drop-shadow-md">
                  <Clock className="h-3 w-3 text-amber-400" /> {formatTimeAgo(profile.lastActivity)}
                </span>
              )}
              {profile.votingPower !== undefined && (
                <span className="flex items-center gap-1 drop-shadow-md">
                  <Zap className="h-3 w-3 text-yellow-400" /> VP {profile.votingPower.toFixed(1)}%
                </span>
              )}
              {profile.hivePower !== undefined && (
                <span className="flex items-center gap-1 drop-shadow-md">
                  <Zap className="h-3 w-3 text-orange-400" /> HP {profile.hivePower.toFixed(0)}
                </span>
              )}
              <KERatioBadge username={targetUsername} hideWhileLoading />
            </div>
            {/* Followers / Following / Posts */}
            <div className="flex items-center gap-4 mt-2 text-[11px] sm:text-xs text-[var(--hrk-text-primary)]">
              <button onClick={() => setActiveTab("followers")} className="hover:text-[var(--hrk-text-primary)] transition-colors drop-shadow-md">
                <span className="font-semibold">{profile.followersCount.toLocaleString()}</span> {t("meta.followers")}
              </button>
              <button onClick={() => setActiveTab("following")} className="hover:text-[var(--hrk-text-primary)] transition-colors drop-shadow-md">
                <span className="font-semibold">{profile.followingCount.toLocaleString()}</span> {t("meta.following")}
              </button>
              <span className="drop-shadow-md">
                <span className="font-semibold">{profile.postsCount.toLocaleString()}</span> {t("meta.posts")}
              </span>
            </div>
          </div>
        </div>

        {/* ── Tab bar — sticks below header on scroll ── */}
        <div className="sticky top-[56px] z-20 bg-[var(--hrk-bg-surface)] border-b border-[var(--hrk-border-subtle)] relative flex items-center">
          <button
            onClick={() => scrollTabs("left")}
            className={`absolute left-0 z-10 h-full px-2 bg-[var(--hrk-bg-surface-raised)] hover:bg-[var(--hrk-bg-hover)] flex items-center shadow-md transition-all ${canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <ChevronLeft className="h-4 w-4 text-white" />
          </button>
          <div ref={tabScrollRef} className="flex overflow-x-auto scrollbar-hide px-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? "text-blue-400 border-blue-400"
                      : "text-[var(--hrk-text-tertiary)] border-transparent hover:text-[var(--hrk-text-secondary)] hover:border-[var(--hrk-border-default)]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => scrollTabs("right")}
            className={`absolute right-0 z-10 h-full px-2 bg-[var(--hrk-bg-surface-raised)] hover:bg-[var(--hrk-bg-hover)] flex items-center shadow-md transition-all ${canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <ChevronRight className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* ── Tab content ── */}
        {/* `key={activeTab}` force-remounts the entire content subtree on
            tab change. Without it React would reuse DOM nodes when the
            child types happen to overlap (e.g. both Posts and Author
            Rewards render in a `space-y-3` div) and a stale card could
            briefly remain visible while the new tab's data was loading.
            Force-remount also resets internal state (scroll, focus,
            in-flight image loads) inside leaf components on tab change. */}
        <div className="p-4 flex-1" key={activeTab}>
          {renderTabContent()}

          {/* Infinite scroll sentinel — min-h prevents scroll jump during loading */}
          {activeTab !== "wallet" && hasMore[activeTab] && (
            <div ref={sentinelRef} className="min-h-[60px] py-2">
              {loadingMore ? (
                <div className="animate-pulse space-y-3">
                  {(activeTab === "followers" || activeTab === "following") ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {[1, 2].map(i => (
                        <div key={i} className="border border-[var(--hrk-border-subtle)] rounded-lg p-4 bg-[var(--hrk-bg-surface)]">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[var(--hrk-bg-surface-raised)] rounded-full" />
                            <div className="h-4 bg-[var(--hrk-bg-surface-raised)] rounded w-28" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-[var(--hrk-bg-surface)] rounded-xl p-4 border border-[var(--hrk-border-subtle)]">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 bg-[var(--hrk-bg-surface-raised)] rounded-full flex-shrink-0" />
                        <div className="flex-1">
                          <div className="h-3.5 bg-[var(--hrk-bg-surface-raised)] rounded w-24 mb-2" />
                          <div className="h-4 bg-[var(--hrk-bg-surface-raised)] rounded w-3/4 mb-2" />
                          <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-1/2" />
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
        </div>

        {/* ── Ignore Confirmation Modal ── */}
        {showIgnoreConfirm && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4"
            onClick={() => setShowIgnoreConfirm(false)}
          >
            <div
              className="bg-[var(--hrk-bg-surface)] rounded-xl shadow-xl max-w-sm w-full border border-[var(--hrk-border-subtle)] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-2">
                {t("modal.ignoreAuthorTitle")}
              </h3>
              <p className="text-sm text-[var(--hrk-text-secondary)] mb-6">
                {t("modal.ignoreAuthorBody", { username: targetUsername })}
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowIgnoreConfirm(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--hrk-border-default)] text-[var(--hrk-text-secondary)] hover:bg-[var(--hrk-bg-surface-raised)] disabled:opacity-50"
                >
                  {t("action.cancel")}
                </button>
                <button
                  onClick={handleIgnore}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? t("action.processing") : t("action.confirmIgnore")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Report User Modal ── */}
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          onReport={handleReport}
          reportType="user"
          targetUsername={targetUsername}
        />

        {/* ── Report Post Modal ── */}
        <ReportModal
          isOpen={!!reportPostTarget}
          onClose={() => setReportPostTarget(null)}
          onReport={async (reason) => {
            if (reportPostTarget && onReportPost) {
              await onReportPost(reportPostTarget.author, reportPostTarget.permlink, reason);
              const match = (p: { author: string; permlink: string }) =>
                p.author === reportPostTarget.author && p.permlink === reportPostTarget.permlink;
              setBlogs((prev) => prev.filter((p) => !match(p)));
              setPosts((prev) => prev.filter((p) => !match(p)));
              setComments((prev) => prev.filter((p) => !match(p)));
              setReplies((prev) => prev.filter((p) => !match(p)));
              setPolls((prev) => prev.filter((p) => !match(p)));
            }
            setReportPostTarget(null);
          }}
          reportType="post"
          targetUsername={reportPostTarget?.author || ""}
          targetPermlink={reportPostTarget?.permlink}
        />

      </div>{/* end scroll container */}
    </div>
  );
};

export default UserDetailProfile;
