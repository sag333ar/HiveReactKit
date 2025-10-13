import React, { useState, useEffect } from "react";
import {
  FileText,
  MessageCircle,
  Reply,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Clock,
  TrendingUp,
  Users,
  Eye,
  Heart,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import { activityService } from "@/services/activityService";
import { userService } from "@/services/userService";
import { ActivityHistoryItem, ActivityDisplayItem } from "@/types/activity";
import { DefaultRenderer } from "@hiveio/content-renderer";

interface ActivityHistoryProps {
  username: string;
  className?: string;
}

const ActivityHistory: React.FC<ActivityHistoryProps> = ({
  username,
  className,
}) => {
  const [activities, setActivities] = useState<ActivityHistoryItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<
    ActivityHistoryItem[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"posts" | "comments" | "replies">(
    "posts"
  );
  const [limit, setLimit] = useState(20);
  const [activeTab, setActiveTab] = useState("all");
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(
    new Set()
  );

  const loadActivities = async () => {
    if (!username) return;

    setLoading(true);
    setError(null);

    try {
      let data: ActivityHistoryItem[] = [];

      switch (activeTab) {
        case "posts":
          data = await activityService.getUserPosts(username, limit);
          break;
        case "comments":
          data = await activityService.getUserComments(username, limit);
          break;
        case "replies":
          data = await activityService.getUserReplies(username, limit);
          break;
        default:
          data = await activityService.getAllUserActivity(
            username,
            Math.floor(limit / 3)
          );
          break;
      }

      setActivities(data);
      setFilteredActivities(data);
    } catch (err) {
      setError("Failed to load activity history");
      console.error("Error loading activities:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [username, activeTab, limit]);

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

  const getActivityIcon = (activity: ActivityHistoryItem) => {
    if (activity.parent_author === "") {
      return <FileText className="h-4 w-4" />;
    } else if (activity.depth === 1) {
      return <MessageCircle className="h-4 w-4" />;
    } else {
      return <Reply className="h-4 w-4" />;
    }
  };

  const getActivityType = (activity: ActivityHistoryItem): string => {
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

  const renderActivityCard = (activity: ActivityHistoryItem) => {
    const activityId = `${activity.author}-${activity.permlink}`;
    const isExpanded = expandedActivities.has(activityId);
    const shouldTruncate = activity.body.length > 100;

    return (
      <div
        key={activityId}
        className="border border-gray-600 rounded-lg p-4 space-y-3 hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-1">{getActivityIcon(activity)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    activity.parent_author === ""
                      ? "bg-blue-900 text-blue-300"
                      : "bg-gray-700 text-gray-300"
                  }`}
                >
                  {getActivityType(activity)}
                </span>
                <span className="text-sm text-gray-400">
                  in #{activity.category}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <img
                  src={userService.userAvatar(activity.author)}
                  alt={`${activity.author} avatar`}
                  className="w-6 h-6 rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = userService.userAvatar(
                      activity.author
                    );
                  }}
                />
                <h3 className="font-medium text-lg leading-tight text-white">
                  {activity.title || "Untitled"}
                </h3>
              </div>

              <div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-gray-400 comment-content">
                <div
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

              <div className="flex items-center gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {activityService.getRelativeTime(activity.created)}
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {activity.net_votes} votes
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {activity.children} replies
                </div>
                <div className="flex items-center gap-1">
                  <span>💰</span>
                  {formatPayout(activity.total_payout_value)}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => window.open(activity.url, "_blank")}
            className="flex-shrink-0 p-2 hover:bg-gray-600 rounded-md transition-colors text-gray-400 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  const summary = activityService.getActivitySummary(activities);

  if (loading) {
    return (
      <div
        className={`bg-gray-800 border border-gray-700 rounded-lg shadow-sm ${className}`}
      >
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-5 w-5 text-gray-300" />
            <h3 className="text-lg font-semibold text-white">
              Activity History
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-400">
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
            <p className="text-sm text-gray-400">@{username}</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-gray-700 rounded animate-pulse w-1/2" />
              <div className="h-20 bg-gray-700 rounded animate-pulse w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-gray-800 border border-gray-700 rounded-lg shadow-sm ${className}`}
    >
      <div className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-5 w-5 text-gray-300" />
          <h3 className="text-lg font-semibold text-white">Activity History</h3>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-400">Activity history for</p>
          <img
            src={userService.userAvatar(username)}
            alt={`${username} avatar`}
            className="w-6 h-6 rounded-full"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                userService.userAvatar(username);
            }}
          />
          <p className="text-sm text-gray-400">@{username}</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {summary.totalActivities}
            </div>
            <div className="text-sm text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {summary.postsCount}
            </div>
            <div className="text-sm text-gray-400">Posts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {summary.commentsCount}
            </div>
            <div className="text-sm text-gray-400">Comments</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {summary.totalVotes}
            </div>
            <div className="text-sm text-gray-400">Votes</div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "all"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:text-gray-300"
            }`}
          >
            <Eye className="h-4 w-4" />
            All
          </button>
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "posts"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:text-gray-300"
            }`}
          >
            <FileText className="h-4 w-4" />
            Posts
          </button>
          <button
            onClick={() => setActiveTab("comments")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "comments"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:text-gray-300"
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            Comments
          </button>
          <button
            onClick={() => setActiveTab("replies")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "replies"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:text-gray-300"
            }`}
          >
            <Reply className="h-4 w-4" />
            Replies
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={limit.toString()}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className="w-full sm:w-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          <button
            onClick={loadActivities}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-4 border border-red-700 bg-red-900 rounded-md">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Activity List */}
        <div className="space-y-4">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No activities found
            </div>
          ) : (
            filteredActivities.map(renderActivityCard)
          )}
        </div>

        {filteredActivities.length > 0 && (
          <div className="text-center text-sm text-gray-400">
            Showing {filteredActivities.length} of {activities.length}{" "}
            activities
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityHistory;
