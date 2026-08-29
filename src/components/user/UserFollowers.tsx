/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo } from "react";
import { Loader2, RefreshCw, Search, X } from "lucide-react";
import { Follower } from "@/types/user";
import { userService } from "@/services/userService";

interface UserFollowersProps {
  username: string;
  onSelectUser?: (username: string) => void;
}

const UserFollowers = ({
  username,
  onSelectUser,
}: UserFollowersProps) => {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFollowers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await userService.getFollowers(username);
      setFollowers(response);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load followers"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowers();
    setSearchQuery("");
  }, [username]);

  const filteredFollowers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return followers;
    return followers.filter((f) => f.follower.toLowerCase().includes(q));
  }, [followers, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading followers...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Failed to load followers
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button onClick={fetchFollowers} className="m-2 inline-flex items-center justify-center rounded-md border border-input text-gray-400 cursor-pointer bg-background p-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (followers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500 dark:text-gray-400">
          This user has no followers.
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
          placeholder="Search followers by username…"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 pl-9 pr-9 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Search followers"
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

      {filteredFollowers.length === 0 ? (
        <div className="text-center py-12">
          <Search className="h-10 w-10 text-gray-400 mx-auto mb-3 opacity-60" />
          <p className="text-gray-700 dark:text-gray-300 font-medium">No results found</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            No followers matching “{searchQuery}”
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFollowers.map((follower, index) => (
            <div
              key={`${follower.follower}-${index}`}
              onClick={() => onSelectUser && onSelectUser(follower.follower)}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                         rounded-xl p-4 hover:bg-gray-300 dark:hover:bg-gray-700
                         transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <img
                  src={userService.userAvatar(follower.follower)}
                  alt={follower.follower}
                  className="w-12 h-12 rounded-full object-cover"
                  onError={(e) => {
                    (
                      e.target as HTMLImageElement
                    ).src = `https://ui-avatars.com/api/?name=${follower.follower}&background=random`;
                  }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    @{follower.follower}
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

export default UserFollowers;
