import React, { useState, useEffect } from "react";
import {
  FileText,
  MessageCircle,
  Reply,
  Search,
  RefreshCw,
  ExternalLink,
  Clock,
  TrendingUp,
  Eye,
  MessageSquare,
  ChevronDown,
  Heart,
  ThumbsUp,
} from "lucide-react";
import { activityService } from "@/services/activityService";
import { userService } from "@/services/userService";
import { UserChannelItem, ActivityDisplayItem } from "@/types/activity";
import { DefaultRenderer } from "@hiveio/content-renderer";

interface UserChannelProps {
  username: string;
  className?: string;
}

const UserChannel: React.FC<UserChannelProps> = ({
  username,
  className,
}) => {
  const [posts, setPosts] = useState<UserChannelItem[]>([]);
  const [comments, setComments] = useState<UserChannelItem[]>([]);
  const [replies, setReplies] = useState<UserChannelItem[]>([]);
  const [activities, setActivities] = useState<UserChannelItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<
    UserChannelItem[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [limit, setLimit] = useState(20);
  const [activeTab, setActiveTab] = useState("all");
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(
    new Set()
  );
  const [dataLoaded, setDataLoaded] = useState(false);

  const loadAllActivities = async () => {
    if (!username || dataLoaded) return;

    setLoading(true);
    setError(null);

    try {
      // Load all three types in parallel
      const [postsData, commentsData, repliesData] = await Promise.all([
        activityService.getUserPosts(username, limit),
        activityService.getUserComments(username, limit),
        activityService.getUserReplies(username, limit),
      ]);

      setPosts(postsData);
      setComments(commentsData);
      setReplies(repliesData);
      setDataLoaded(true);
    } catch (err) {
      setError("Failed to load activity history");
      console.error("Error loading activities:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllActivities();
  }, [username]);

  useEffect(() => {
    if (!dataLoaded) return;

    let data: UserChannelItem[] = [];

    switch (activeTab) {
      case "posts":
        data = posts;
        break;
      case "comments":
        data = comments;
        break;
      case "replies":
        data = replies;
        break;
      default:
        // Combine all activities for "all" tab
        data = [...posts, ...comments, ...replies].sort((a, b) =>
          new Date(b.created).getTime() - new Date(a.created).getTime()
        );
        break;
    }

    setActivities(data);
    setFilteredActivities(data);
  }, [activeTab, posts, comments, replies, dataLoaded]);

  useEffect(() => {
    let filtered = activities;

    // Filter by search term
    if (searchTerm) {
      filtered = activityService.searchActivities(activities, searchTerm);
    }

    setFilteredActivities(filtered);
  }, [activities, searchTerm]);

  const formatPayout = (payoutValue: string): string => {
    if (!payoutValue || payoutValue === "0.000 HIVE") return "0 HIVE";
    return payoutValue;
  };

  const getActivityType = (activity: UserChannelItem): string => {
    if (activity.parent_author === "") {
      return "Post";
    } else if (activity.depth === 1) {
      return "Comment";
    } else {
      return "Reply";
    }
  };

  // Hive content renderer instance (memoized per render)
  const hiveRenderer = new DefaultRenderer({
    baseUrl: "https://hive.blog/",
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
    ipfsPrefix: "https://ipfs.io/ipfs/",
  });

  const toggleExpanded = (activityId: string) => {
    const newExpanded = new Set(expandedActivities);
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId);
    } else {
      newExpanded.add(activityId);
    }
    setExpandedActivities(newExpanded);
  };

  const renderActivityCard = (activity: UserChannelItem) => {
    const activityId = `${activity.author}-${activity.permlink}`;
    const isExpanded = expandedActivities.has(activityId);
    const shouldTruncate = activity.body.length > 100;

    return (
      <div
        key={activityId}
        className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 sm:p-4 space-y-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors relative"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    activity.parent_author === ""
                      ? "bg-blue-900 text-blue-300"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {getActivityType(activity)}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  in #{activity.category}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <img
                  src={userService.userAvatar(activity.author)}
                  alt={`${activity.author} avatar`}
                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = userService.userAvatar(
                      activity.author
                    );
                  }}
                />
                <h3 className="font-medium text-base sm:text-lg leading-tight text-gray-900 dark:text-white break-words">
                  {activity.title || "Untitled"}
                </h3>
              </div>

              <div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-gray-500 dark:text-gray-400 comment-content overflow-hidden">
                <div
                  className="break-words overflow-wrap-anywhere"
                  dangerouslySetInnerHTML={{
                    __html: hiveRenderer.render(
                      shouldTruncate && !isExpanded
                        ? activity.body.substring(0, 50) + "....."
                        : activity.body
                    ),
                  }}
                />
                {shouldTruncate && (
                  <button
                    onClick={() => toggleExpanded(activityId)}
                    className="mt-2 text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center gap-1"
                  >
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                    {isExpanded ? "Show less" : "Show more"}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">
                    {activityService.getRelativeTime(activity.created)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3 flex-shrink-0" />
                  <span>{activity.net_votes} votes</span>
                </div>
                <div className="flex items-center gap-1">
                  <Reply className="h-3 w-3 flex-shrink-0" />
                  <span>{activity.children} replies</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>💰</span>
                  <span>{formatPayout(activity.total_payout_value)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() =>
            window.open(
              `https://peakd.com/@${activity.author}/${activity.permlink}`,
              "_blank"
            )
          }
          className="absolute top-3 right-3 flex-shrink-0 p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const summary = activityService.getActivitySummary(activities);

  if (loading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm ${className}`}
      >
        <div className="p-6">
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading activity history for
            </p>
            <img
              src={userService.userAvatar(username)}
              alt={`${username} avatar`}
              className="w-6 h-6 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  userService.userAvatar(username);
              }}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">@{username}</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
              <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* User Header */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <img
            src={userService.userAvatar(username)}
            alt={`${username} avatar`}
            className="w-16 h-16 rounded-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                userService.userAvatar(username);
            }}
          />
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              @{username}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Activity History
            </p>
            {/* Stats */}
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <FileText className="w-4 h-4" />
                <span>
                  {summary.totalActivities} Total Activities
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex md:grid md:grid-cols-4 overflow-x-auto md:overflow-visible w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-shrink-0 md:flex-shrink px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "all"
                ? "bg-blue-600 dark:bg-blue-500 text-white"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex-shrink-0 md:flex-shrink px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "posts"
                ? "bg-blue-600 dark:bg-blue-500 text-white"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            Posts
          </button>
          <button
            onClick={() => setActiveTab("comments")}
            className={`flex-shrink-0 md:flex-shrink px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "comments"
                ? "bg-blue-600 dark:bg-blue-500 text-white"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            Comments
          </button>
          <button
            onClick={() => setActiveTab("replies")}
            className={`flex-shrink-0 md:flex-shrink px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "replies"
                ? "bg-blue-600 dark:bg-blue-500 text-white"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            Replies
          </button>
        </div>

        <div className="mt-6">

        {/* Filters */}
        <div className="flex flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            onClick={() => {
              setDataLoaded(false);
              loadAllActivities();
            }}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-4 border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900 rounded-md">
            <p className="text-red-600 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Activity List */}
        <div className="space-y-4">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No activities found
            </div>
          ) : (
            filteredActivities.map(renderActivityCard)
          )}
        </div>

        {filteredActivities.length > 0 && (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredActivities.length} of {activities.length}{" "}
            activities
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default UserChannel;
