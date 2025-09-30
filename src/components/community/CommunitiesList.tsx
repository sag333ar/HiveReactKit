/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Loader2, RefreshCw } from "lucide-react";

import { communityService } from "../../services/communityService";
import { CommunityItem } from "../../types/community";

interface CommunitiesListProps {
  onSelectCommunity: (communityId: string) => void;
}

const CommunitiesList = ({ onSelectCommunity }: CommunitiesListProps) => {
  const [communities, setCommunities] = useState<CommunityItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastCommunityName, setLastCommunityName] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const loadCommunities = useCallback(
    async (initial = false) => {
      if (!initial && (isLoadingMore || !hasMore)) return;
      try {
        if (initial) {
          setIsLoading(true);
          setError(null);
          setCommunities([]);
          setLastCommunityName(null);
          setHasMore(true);
        } else {
          setIsLoadingMore(true);
        }

        const query = searchQuery.trim();
        const result = await communityService.getListOfCommunities(
          query.length >= 3 ? query : undefined,
          pageSize,
          initial ? undefined : lastCommunityName || undefined
        );

        setCommunities((prev) => (initial ? result : [...prev, ...result]));

        if (
          result.length < pageSize ||
          (result.length > 0 &&
            result[result.length - 1].name === lastCommunityName)
        ) {
          setHasMore(false);
        } else if (result.length > 0) {
          setLastCommunityName(result[result.length - 1].name || null);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load communities"
        );
        setHasMore(false);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [searchQuery, isLoadingMore, hasMore, lastCommunityName]
  );

  useEffect(() => {
    const timeoutId = setTimeout(
      () => {
        loadCommunities(true);
      },
      searchQuery.length >= 3 || searchQuery.length === 0 ? 0 : 500
    );
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Ensure the search input retains focus across re-renders/state changes
  useEffect(() => {
    searchInputRef.current?.focus();
  }, [searchQuery, isLoading, error]);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 200 &&
        !isLoadingMore &&
        !isLoading &&
        hasMore
      ) {
        loadCommunities();
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadCommunities, isLoadingMore, isLoading, hasMore]);

  const handleRefresh = () => {
    loadCommunities(true);
  };

  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 animate-pulse"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );

  // Loading state
  if (isLoading && communities.length === 0) {
    return (
      <div className="space-y-6">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search communities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            ref={searchInputRef}
            autoFocus
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                       rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  // Error state
  if (error && communities.length === 0) {
    return (
      <div className="space-y-6">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search communities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            ref={searchInputRef}
            autoFocus
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                       rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Failed to load communities
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
            <button onClick={handleRefresh} className="m-2 inline-flex items-center justify-center rounded-md border border-input text-gray-400 cursor-pointer bg-background p-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main communities list
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Communities
        </h2>
      </div>

      {/* Search Bar */}
      <div className="relative flex justify-between items-center">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search communities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          ref={searchInputRef}
          autoFocus
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                     rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleRefresh}
          className="m-2 inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

      </div>

      {/* Communities List */}
      {communities.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No communities found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery
                ? "Try adjusting your search terms"
                : "Check back later for new communities"}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {communities.map((community) => (
            <div
              key={community.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                         rounded-xl p-4 hover:bg-gray-300 dark:hover:bg-gray-700 
                         transition-colors cursor-pointer"
              onClick={() => onSelectCommunity(community.name || "")}
            >
              <div className="flex items-center gap-4">
                <img
                  src={communityService.communityIcon(community.name || "")}
                  alt={community.title}
                  className="w-12 h-12 rounded-full object-cover"
                  onError={(e) => {
                    (
                      e.target as HTMLImageElement
                    ).src = `https://ui-avatars.com/api/?name=${community.title}&background=random`;
                  }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {community.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                    {community.about}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {(community.subscribers || 0).toLocaleString()} members
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              {isLoadingMore ? (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading more communities...
                </div>
              ) : (
                <button onClick={() => loadCommunities()} className="m-2 inline-flex items-center justify-center rounded-md border border-input text-gray-400 cursor-pointer bg-background p-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
                >
                  Load More Communities
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommunitiesList;