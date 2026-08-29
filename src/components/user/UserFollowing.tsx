/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo } from "react";
import { Loader2, RefreshCw, Search, X } from "lucide-react";
import { Following } from "@/types/user";
import { userService } from "@/services/userService";

interface UserFollowingProps {
  username: string;
  onSelectUser?: (username: string) => void;
}

const UserFollowing = ({
  username,
  onSelectUser,
}: UserFollowingProps) => {
  const [following, setFollowing] = useState<Following[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFollowing = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await userService.getFollowing(username);
      setFollowing(response);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load following list"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowing();
    setSearchQuery("");
  }, [username]);

  const filteredFollowing = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return following;
    return following.filter((user) => user.following.toLowerCase().includes(q));
  }, [following, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading following list...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Failed to load following list
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button onClick={fetchFollowing} className="m-2 inline-flex items-center justify-center rounded-md border border-input text-gray-400 cursor-pointer bg-background p-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (following.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500 dark:text-gray-400">
          This user is not following anyone.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Local Search Input — matching hivesuite game search style */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search following by username…"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 pl-9 pr-9 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Search following"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {filteredFollowing.length === 0 ? (
        <div className="text-center py-12">
          <Search className="h-10 w-10 text-gray-400 mx-auto mb-3 opacity-60" />
          <p className="text-gray-700 dark:text-gray-300 font-medium">No results found</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            No following matching “{searchQuery}”
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFollowing.map((user, index) => (
            <div
              key={`${user.following}-${index}`}
              onClick={() => onSelectUser && onSelectUser(user.following)}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                         rounded-xl p-4 hover:bg-gray-300 dark:hover:bg-gray-700
                         transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <img
                  src={userService.userAvatar(user.following)}
                  alt={user.following}
                  className="w-12 h-12 rounded-full object-cover"
                  onError={(e) => {
                    (
                      e.target as HTMLImageElement
                    ).src = `https://ui-avatars.com/api/?name=${user.following}&background=random`;
                  }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    @{user.following}
                  </h3>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserFollowing;
