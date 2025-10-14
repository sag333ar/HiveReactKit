import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FileText,
  MessageCircle,
  RefreshCw,
  Clock,
  TrendingUp,
  Eye,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  Search,
} from "lucide-react";
import { activityListService } from "@/services/activityListService";
import {
  ActivityListItem,
  DirectionFilter,
  GeneralFilter,
  RewardFilter
} from "@/types/activityList";

interface ActivityListProps {
  username: string;
  directionFilter?: DirectionFilter;
  generalFilter?: GeneralFilter;
  rewardFilter?: RewardFilter;
  searchTerm?: string;
  limit?: number;
  className?: string;
}

const ActivityList: React.FC<ActivityListProps> = ({
  username,
  directionFilter = 'all',
  generalFilter = 'all',
  rewardFilter = 'all',
  searchTerm = '',
  limit = 100,
  className,
}) => {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const [localDirectionFilter, setLocalDirectionFilter] = useState(directionFilter);
  const [localGeneralFilter, setLocalGeneralFilter] = useState(generalFilter);
  const [localRewardFilter, setLocalRewardFilter] = useState(rewardFilter);
  const [localLimit, setLocalLimit] = useState(limit);
  const [activities, setActivities] = useState<ActivityListItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver>();
  const lastActivityRef = useRef<HTMLDivElement>(null);

  const loadActivities = async (loadMore = false) => {
    if (!username) return;

    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setHasMore(true);
    }
    setError(null);

    try {
      // Fetch account history
      const historyItems = await activityListService.getAccountHistory(username, -1, limit);

      // Convert to activity list items
      const activityItems = activityListService.convertToActivityListItems(historyItems, username);

      // Sort by timestamp (most recent first)
      activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (loadMore) {
        setActivities(prev => [...prev, ...activityItems]);
      } else {
        setActivities(activityItems);
      }

      // Check if we have more data
      if (activityItems.length < limit) {
        setHasMore(false);
      }
    } catch (err) {
      setError("Failed to load activity history");
      console.error("Error loading activities:", err);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [username, localLimit]);

  // Infinite scroll callback
  const loadMoreActivities = useCallback(() => {
    if (hasMore && !loading && !loadingMore) {
      loadActivities(true);
    }
  }, [hasMore, loading, loadingMore, activities.length]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMoreActivities();
        }
      },
      { threshold: 0.1 }
    );

    if (lastActivityRef.current) {
      observerRef.current.observe(lastActivityRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMoreActivities, hasMore, loading, loadingMore]);

  useEffect(() => {
    let filtered = activities;

    // Filter by direction - exclude 'others' types when direction is 'all'
    if (localDirectionFilter !== 'all') {
      filtered = filtered.filter(activity => activity.direction === localDirectionFilter);
    } else {
      // When direction is 'all', exclude custom_json and comment_options (others)
      filtered = filtered.filter(activity => activity.type !== 'custom_json' && activity.type !== 'comment_options');
    }

    // Filter by general type
    if (localGeneralFilter !== 'all') {
      if (localGeneralFilter === 'votes') {
        filtered = filtered.filter(activity => activity.type === 'vote' || activity.type === 'effective_comment_vote');
      } else if (localGeneralFilter === 'comments') {
        filtered = filtered.filter(activity => activity.type === 'comment');
      } else if (localGeneralFilter === 'replies') {
        filtered = filtered.filter(activity => activity.type === 'comment' && activity.direction === 'in');
      } else if (localGeneralFilter === 'others') {
        // When filtering for 'others', include custom_json and comment_options regardless of direction filter
        filtered = activities.filter(activity => activity.type === 'custom_json' || activity.type === 'comment_options');
      }
    }

    // Filter by reward type
    if (localRewardFilter !== 'all') {
      if (localRewardFilter === 'author') {
        filtered = filtered.filter(activity => activity.type === 'effective_comment_vote' && activity.direction === 'in');
      } else if (localRewardFilter === 'curation') {
        filtered = filtered.filter(activity => activity.type === 'effective_comment_vote' && activity.direction === 'out');
      } else if (localRewardFilter === 'benefactor') {
        filtered = filtered.filter(activity => activity.type === 'comment_options');
      }
    }

    // Apply search
    if (localSearchTerm) {
      filtered = filtered.filter(activity =>
        activity.description.toLowerCase().includes(localSearchTerm.toLowerCase()) ||
        activity.author?.toLowerCase().includes(localSearchTerm.toLowerCase()) ||
        activity.permlink?.toLowerCase().includes(localSearchTerm.toLowerCase())
      );
    }

    setFilteredActivities(filtered);
  }, [activities, localDirectionFilter, localGeneralFilter, localRewardFilter, localSearchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getActivityIcon = (activity: ActivityListItem) => {
    switch (activity.type) {
      case 'vote':
      case 'effective_comment_vote':
        return <TrendingUp className="h-4 w-4" />;
      case 'comment':
        return <MessageCircle className="h-4 w-4" />;
      case 'custom_json':
        return <FileText className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  const getDirectionIcon = (direction: 'in' | 'out') => {
    return direction === 'in' ? (
      <ArrowDown className="h-3 w-3 text-green-500" />
    ) : (
      <ArrowUp className="h-3 w-3 text-blue-500" />
    );
  };

  const toggleExpanded = (activityId: string) => {
    const newExpanded = new Set(expandedActivities);
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId);
    } else {
      newExpanded.add(activityId);
    }
    setExpandedActivities(newExpanded);
  };

  const renderActivityCard = (activity: ActivityListItem) => {
    const activityId = activity.id;
    const isExpanded = expandedActivities.has(activityId);

    return (
      <div
        key={activityId}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Avatar/Icon */}
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
              {getActivityIcon(activity)}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    activity.direction === 'in'
                      ? "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300"
                      : "bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300"
                  }`}
                >
                  {activity.direction === 'in' ? 'Incoming' : 'Outgoing'}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {activity.type.replace('_', ' ').toUpperCase()}
                </span>
                {getDirectionIcon(activity.direction)}
              </div>

              {/* Dropdown Menu */}
              <div className="relative" ref={openDropdown === activityId ? dropdownRef : null}>
                <button
                  onClick={() => setOpenDropdown(openDropdown === activityId ? null : activityId)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
                {openDropdown === activityId && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                    <button
                      onClick={() => {
                        toggleExpanded(activityId);
                        setOpenDropdown(null);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      {isExpanded ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-2">
              <p className="text-gray-900 dark:text-white break-words">
                {activity.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {activityListService.getRelativeTime(activity.timestamp)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span>Block #{activity.block}</span>
              </div>
              {activity.weight && (
                <div className="flex items-center gap-1">
                  <span>{activity.weight}%</span>
                </div>
              )}
              {activity.payout && (
                <div className="flex items-center gap-1">
                  <span>💰 {activity.payout}</span>
                </div>
              )}
            </div>

            {isExpanded && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Transaction Details</h4>
                <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(activity.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Navigation Bar with Filters Loading */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Search Loading */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="w-full h-10 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
              </div>
            </div>

            {/* Filters Loading */}
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-24 h-10 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
              ))}
            </div>
          </div>

          {/* Stats Loading */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20" />
            ))}
          </div>
        </div>

        {/* Activity List Loading */}
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-3 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Failed to load activities
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button onClick={() => loadActivities()} className="inline-flex items-center justify-center rounded-md border border-input text-gray-400 cursor-pointer bg-background p-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Bar with Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search activities..."
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {/* Direction Filter */}
            <select
              value={localDirectionFilter}
              onChange={(e) => setLocalDirectionFilter(e.target.value as DirectionFilter)}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Directions</option>
              <option value="in">Incoming</option>
              <option value="out">Outgoing</option>
            </select>

            {/* General Filter */}
            <select
              value={localGeneralFilter}
              onChange={(e) => setLocalGeneralFilter(e.target.value as GeneralFilter)}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Types</option>
              <option value="votes">Votes</option>
              <option value="comments">Comments</option>
              <option value="replies">Replies</option>
              <option value="others">Others</option>
            </select>

            {/* Reward Filter */}
            <select
              value={localRewardFilter}
              onChange={(e) => setLocalRewardFilter(e.target.value as RewardFilter)}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Rewards</option>
              <option value="author">Author</option>
              <option value="curation">Curation</option>
              <option value="benefactor">Benefactor</option>
            </select>

            {/* Refresh */}
            <button
              onClick={() => loadActivities()}
              disabled={loading || loadingMore}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Total: <span className="font-semibold text-gray-900 dark:text-white">{activities.length}</span>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Filtered: <span className="font-semibold text-gray-900 dark:text-white">{filteredActivities.length}</span>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Incoming: <span className="font-semibold text-green-600 dark:text-green-400">
              {activities.filter(a => a.direction === 'in').length}
            </span>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Outgoing: <span className="font-semibold text-blue-600 dark:text-blue-400">
              {activities.filter(a => a.direction === 'out').length}
            </span>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="space-y-4">
        {filteredActivities.length === 0 ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <p className="text-gray-500 dark:text-gray-400">
              {activities.length === 0
                ? "No activities found for this user."
                : "No activities match the current filters."
              }
            </p>
          </div>
        ) : (
          <>
            {filteredActivities.map((activity, index) => (
                <div
                  key={`${activity.id}-${index}`}
                  ref={index === filteredActivities.length - 1 ? lastActivityRef : null}
                  className="flex items-center justify-between py-3 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                      {getActivityIcon(activity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      {activity.type === 'custom_json' || activity.type === 'comment_options' ? (
                        <div>
                          <p className="text-sm text-gray-900 dark:text-white break-words font-medium">
                            {activity.description}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {activityListService.getRelativeTime(activity.timestamp)}
                          </p>
                          <div className="border border-gray-200 dark:border-gray-600 rounded p-2 bg-gray-50 dark:bg-gray-700/50 mt-1">
                            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 font-mono break-words">
                              {activity.type === 'custom_json' && (
                                <>
                                  <div><span className="font-medium">id:</span> {activity.details.id}</div>
                                  <div className="break-all"><span className="font-medium">json:</span> {JSON.stringify(activity.details.json).replace(/\\\"/g, '"').replace(/^"|"$/g, '')}</div>
                                  <div><span className="font-medium">required_auths:</span> {JSON.stringify(activity.details.required_auths)}</div>
                                  <div><span className="font-medium">required_posting_auths:</span> {JSON.stringify(activity.details.required_posting_auths)}</div>
                                </>
                              )}
                              {activity.type === 'comment_options' && (
                                <>
                                  <div><span className="font-medium">author:</span> {activity.details.author}</div>
                                  <div><span className="font-medium">permlink:</span> {activity.details.permlink}</div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-900 dark:text-white break-words">
                          {activity.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 flex-shrink-0 ml-4">
                    {activity.type !== 'custom_json' && activity.type !== 'comment_options' && (
                      <>
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                          {activityListService.getRelativeTime(activity.timestamp)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
            ))}

            {loadingMore && (
              <div className="flex justify-center py-4">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            )}

            {!hasMore && activities.length > 0 && (
              <div className="text-center text-sm text-gray-400 py-4">
                No more activities to load
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ActivityList;
