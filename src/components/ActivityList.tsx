/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo } from "react";
import { Loader2, RefreshCw, Search, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { ActivityItem, ActivityFilters } from "@/types/activity";
import { activityService } from "@/services/activityService";

interface ActivityListProps {
  username: string;
}

const ActivityList = ({ username }: ActivityListProps) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ActivityFilters>({
    direction: 'all',
    general: {
      votes: true,
      comments: true,
      replies: true,
      showOthers: true,
    },
    rewards: {
      authorRewards: true,
      curationRewards: true,
      benefactorRewards: true,
    },
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      const historyItems = await activityService.getAccountHistory(username);
      const parsedActivities = activityService.parseActivityItems(historyItems, username);
      setActivities(parsedActivities);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load activities"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [username]);

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      // Direction filter
      if (filters.direction !== 'all' && activity.direction !== filters.direction) {
        return false;
      }

      // General filters
      if (activity.type === 'vote' && !filters.general.votes) return false;
      if (activity.type === 'comment' && !filters.general.comments) return false;
      if (activity.type === 'reply' && !filters.general.replies) return false;
      if (activity.type === 'other' && !filters.general.showOthers) return false;

      // Rewards filters
      if (activity.type === 'author_reward' && !filters.rewards.authorRewards) return false;
      if (activity.type === 'curation_reward' && !filters.rewards.curationRewards) return false;
      if (activity.type === 'benefactor_reward' && !filters.rewards.benefactorRewards) return false;

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const descriptionMatch = activity.description.toLowerCase().includes(searchLower);
        const authorMatch = activity.author?.toLowerCase().includes(searchLower) || false;
        const permlinkMatch = activity.permlink?.toLowerCase().includes(searchLower) || false;
        if (!descriptionMatch && !authorMatch && !permlinkMatch) {
          return false;
        }
      }

      return true;
    });
  }, [activities, filters]);

  const updateFilter = (key: keyof ActivityFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateGeneralFilter = (key: keyof ActivityFilters['general'], value: boolean) => {
    setFilters(prev => ({
      ...prev,
      general: {
        ...prev.general,
        [key]: value,
      },
    }));
  };

  const updateRewardsFilter = (key: keyof ActivityFilters['rewards'], value: boolean) => {
    setFilters(prev => ({
      ...prev,
      rewards: {
        ...prev.rewards,
        [key]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading activities...
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
          <button onClick={fetchActivities} className="m-2 inline-flex items-center justify-center rounded-md border border-input text-gray-400 cursor-pointer bg-background p-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showFilters && (
          <div className="space-y-4">
            {/* Direction Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Direction
              </label>
              <div className="flex gap-2">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'in', label: 'In' },
                  { value: 'out', label: 'Out' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => updateFilter('direction', option.value)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      filters.direction === option.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* General Filters */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                General
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'votes', label: 'Votes' },
                  { key: 'comments', label: 'Comments' },
                  { key: 'replies', label: 'Replies' },
                  { key: 'showOthers', label: 'Show Others' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.general[item.key as keyof ActivityFilters['general']]}
                      onChange={(e) => updateGeneralFilter(item.key as keyof ActivityFilters['general'], e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Rewards Filters */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rewards
              </label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { key: 'authorRewards', label: 'Author Rewards' },
                  { key: 'curationRewards', label: 'Curation Rewards' },
                  { key: 'benefactorRewards', label: 'Benefactor Rewards' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.rewards[item.key as keyof ActivityFilters['rewards']]}
                      onChange={(e) => updateRewardsFilter(item.key as keyof ActivityFilters['rewards'], e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Contains
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search activities..."
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Activities List */}
      <div className="space-y-4">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              {activities.length === 0 ? 'No activities found.' : 'No activities match the current filters.'}
            </p>
          </div>
        ) : (
          filteredActivities.map((activity) => (
            <div
              key={activity.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-gray-900 dark:text-white font-medium">
                    {activity.description}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {activityService.formatTimeAgo(activity.timestamp)}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    activity.direction === 'in'
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                  }`}>
                    {activity.direction.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActivityList;
