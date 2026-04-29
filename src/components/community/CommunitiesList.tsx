/* eslint-disable react-hooks/exhaustive-deps */
/**
 * Hive communities directory — searchable, infinite-scrolling list backed
 * by `bridge.list_communities`.
 *
 * Theme: hivesuite dark tokens (#212529 / #262b30 / #2f353d / #3a424a /
 *        #e31337). Pass `theme="light"` for the legacy light variant.
 *
 * Scrolling: the list scrolls inside its own container (the parent decides
 * the height via `flex-1 overflow-hidden`); we no longer attach a global
 * window-scroll listener, so the component is safe to drop into a
 * dashboard layout where the page itself doesn't scroll.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Loader2, RefreshCw, Users2 } from "lucide-react";

import { communityService } from "../../services/communityService";
import { CommunityItem } from "../../types/community";

interface CommunitiesListProps {
  onSelectCommunity: (communityId: string) => void;
  /** Visual variant. Default `"dark"` — uses hivesuite Hive-red tokens. */
  theme?: "light" | "dark";
}

const CommunitiesList = ({
  onSelectCommunity,
  theme = "dark",
}: CommunitiesListProps) => {
  const isDark = theme === "dark";

  const [communities, setCommunities] = useState<CommunityItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastCommunityName, setLastCommunityName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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
          initial ? undefined : lastCommunityName || undefined,
        );

        setCommunities((prev) => (initial ? result : [...prev, ...result]));

        if (
          result.length < pageSize ||
          (result.length > 0 && result[result.length - 1].name === lastCommunityName)
        ) {
          setHasMore(false);
        } else if (result.length > 0) {
          setLastCommunityName(result[result.length - 1].name || null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load communities");
        setHasMore(false);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [searchQuery, isLoadingMore, hasMore, lastCommunityName],
  );

  useEffect(() => {
    const timeoutId = setTimeout(
      () => {
        loadCommunities(true);
      },
      searchQuery.length >= 3 || searchQuery.length === 0 ? 0 : 500,
    );
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Container-scoped infinite scroll — fires when the user nears the
  // bottom of THIS list's scroll container, not the window. Works inside
  // dashboards where the page itself is `overflow-hidden`.
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 200;
      if (nearBottom && !isLoadingMore && !isLoading && hasMore) {
        loadCommunities();
      }
    },
    [loadCommunities, isLoadingMore, isLoading, hasMore],
  );

  const handleRefresh = () => loadCommunities(true);

  // ── Theme tokens ──────────────────────────────────────────────────────
  const surface = isDark ? "bg-[#212529]" : "bg-white";
  const card = isDark
    ? "bg-[#262b30] border-[#3a424a] hover:bg-[#2f353d]"
    : "bg-white border-gray-200 hover:bg-gray-100";
  const cardSkeleton = isDark
    ? "bg-[#262b30] border-[#3a424a]"
    : "bg-white border-gray-200";
  const skeletonInner = isDark ? "bg-[#2f353d]" : "bg-gray-200";
  const inputCls = isDark
    ? "bg-[#262b30] border-[#3a424a] text-[#f0f0f8] placeholder-[#9ca3b0] focus:ring-[#e31337]"
    : "bg-white border-gray-200 text-gray-900 placeholder-gray-500 focus:ring-blue-500";
  const muted = isDark ? "text-[#9ca3b0]" : "text-gray-500";
  const textPrimary = isDark ? "text-[#f0f0f8]" : "text-gray-900";
  const buttonCls = isDark
    ? "border-[#3a424a] bg-[#262b30] text-[#e7e7f1] hover:bg-[#2f353d] hover:text-[#f0f0f8]"
    : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-900";

  // ── Sub-renders ───────────────────────────────────────────────────────
  const SearchBar = (
    <div className="relative flex shrink-0 items-center gap-2">
      <div className="relative flex-1">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${muted}`} />
        <input
          type="text"
          placeholder="Search communities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          ref={searchInputRef}
          className={`w-full rounded-lg border pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-1 ${inputCls}`}
        />
      </div>
      <button
        onClick={handleRefresh}
        title="Refresh"
        aria-label="Refresh"
        className={`inline-flex items-center justify-center rounded-md border p-2 text-sm font-medium transition-colors ${buttonCls}`}
      >
        <RefreshCw className="h-4 w-4" />
      </button>
    </div>
  );

  const Skeleton = (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`rounded-xl border p-4 animate-pulse ${cardSkeleton}`}>
          <div className="flex items-center gap-4">
            <div className={`h-12 w-12 rounded-full ${skeletonInner}`} />
            <div className="flex-1 space-y-2">
              <div className={`h-4 rounded w-3/4 ${skeletonInner}`} />
              <div className={`h-3 rounded w-1/2 ${skeletonInner}`} />
            </div>
            <div className={`h-3 w-16 rounded ${skeletonInner}`} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className={`flex h-full min-h-0 flex-col gap-3 ${surface}`}>
      {SearchBar}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {isLoading && communities.length === 0 ? (
          Skeleton
        ) : error && communities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className={`text-base font-semibold ${textPrimary} mb-2`}>
              Failed to load communities
            </h3>
            <p className={`${muted} mb-4 text-sm`}>{error}</p>
            <button
              onClick={handleRefresh}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${buttonCls}`}
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        ) : communities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users2 className={`h-10 w-10 mb-3 ${muted}`} />
            <h3 className={`text-base font-semibold ${textPrimary} mb-2`}>
              No communities found
            </h3>
            <p className={muted}>
              {searchQuery
                ? "Try adjusting your search terms"
                : "Check back later for new communities"}
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-2">
            {communities.map((community) => (
              <button
                key={community.id}
                type="button"
                onClick={() => onSelectCommunity(community.name || "")}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${card}`}
              >
                <div className="flex items-center gap-4">
                  <img
                    src={communityService.communityIcon(community.name || "")}
                    alt={community.title}
                    className="h-12 w-12 rounded-full object-cover bg-[#2f353d]"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${community.title}&background=random`;
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold truncate ${textPrimary}`}>
                      {community.title}
                    </h3>
                    {community.about && (
                      <p className={`text-sm line-clamp-2 ${muted}`}>
                        {community.about}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs ${muted}`}>
                      {(community.subscribers || 0).toLocaleString()} members
                    </p>
                  </div>
                </div>
              </button>
            ))}

            {hasMore && (
              <div className="flex justify-center pt-2">
                {isLoadingMore ? (
                  <div className={`flex items-center gap-2 ${muted}`}>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading more communities...
                  </div>
                ) : (
                  <button
                    onClick={() => loadCommunities()}
                    className={`inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors ${buttonCls}`}
                  >
                    Load more
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunitiesList;
