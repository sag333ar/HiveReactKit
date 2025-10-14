


/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from "react";
import { Loader2, RefreshCw, MapPin, MoreVertical, UserPlus, UserMinus } from "lucide-react";
import { Follower, Account } from "@/types/user";
import { userService } from "@/services/userService";

// Component for HP cell with async calculation
const HPCell = ({ vestingShares }: { vestingShares: string }) => {
  const [hpValue, setHpValue] = useState<string>('...');

  useEffect(() => {
    const calculateHP = async () => {
      try {
        const hiveValue = await userService.convertVestingSharesToHive(vestingShares);
        setHpValue(hiveValue);
      } catch (error) {
        console.error('Error calculating HP:', error);
        // Fallback to simple calculation
        const vestingAmount = parseFloat(vestingShares.split(' ')[0]);
        setHpValue((vestingAmount / 1000000).toFixed(3));
      }
    };

    calculateHP();
  }, [vestingShares]);

  return (
    <span className="text-sm font-medium text-gray-900 dark:text-white">
      {hpValue} HP
    </span>
  );
};

interface FollowersListProps {
  username: string;
  onClickAuthor?: (username: string) => void;
  onClickAddRemoveFromLists?: (username: string) => void;
  onClickFollow?: (username: string) => void;
}

const FollowersList = ({
  username,
  onClickAuthor,
  onClickAddRemoveFromLists,
  onClickFollow,
}: FollowersListProps) => {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [voteValues, setVoteValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchFollowersData = async () => {
    try {
      setLoading(true);
      setError(null);

      // First get followers list
      const followersResponse = await userService.getFollowers(username);
      setFollowers(followersResponse);

      // Then get detailed account info for all followers
      if (followersResponse.length > 0) {
        const usernames = followersResponse.map(f => f.follower);
        const accountsResponse = await userService.getAccounts(usernames);
        setAccounts(accountsResponse);

        // Get voting power and vote values for each follower
        const votingPowersData: Record<string, { upvotepower: string; downvote: string }> = {};
        const voteValuesData: Record<string, string> = {};
        for (const follower of followersResponse) {
          try {
            const voteValue = await userService.getVoteValue(follower.follower);
            voteValuesData[follower.follower] = voteValue;
          } catch (err) {
            console.warn(`Failed to get voting data for ${follower.follower}:`, err);
            votingPowersData[follower.follower] = { upvotepower: '0', downvote: '0' };
            voteValuesData[follower.follower] = '0.00';
          }
        }
        setVoteValues(voteValuesData);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load followers data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowersData();
  }, [username]);

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



  const getProfileData = (username: string) => {
    const account = accounts.find(acc => acc.name === username);
    if (!account) return null;

    try {
      const metadata = JSON.parse(account.posting_json_metadata);
      return metadata?.profile || {};
    } catch {
      return {};
    }
  };

  const formatDate = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInMonths = Math.floor(diffInDays / 30);

    // If more than 1 month ago, show formatted date
    if (diffInMonths >= 1) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }

    // Otherwise, show relative time
    const diffInSeconds = Math.floor(diffInMs / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInWeeks = Math.floor(diffInDays / 7);
    const diffInYears = Math.floor(diffInDays / 365);

    if (diffInYears > 0) {
      return `${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
    } else if (diffInWeeks > 0) {
      return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
    } else if (diffInDays > 0) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } else if (diffInHours > 0) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else if (diffInMinutes > 0) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

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
          <button onClick={fetchFollowersData} className="m-2 inline-flex items-center justify-center rounded-md border border-input text-gray-400 cursor-pointer bg-background p-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
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
    <div className="space-y-6">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Avatar</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Username</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Last Post</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">HP</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Vote Value</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Manage</th>
            </tr>
          </thead>
          <tbody>
            {followers.map((follower, index) => {
              const account = accounts.find(acc => acc.name === follower.follower);
              const profile = getProfileData(follower.follower);

              return (
                <tr key={`${follower.follower}-${index}`} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  {/* Avatar Column */}
                  <td className="py-4 px-4">
                    <img
                      src={profile?.profile_image || userService.userAvatar(follower.follower)}
                      alt={follower.follower}
                      className="w-12 h-12 rounded-full object-cover cursor-pointer"
                      onClick={() => onClickAuthor && onClickAuthor(follower.follower)}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${follower.follower}&background=random`;
                      }}
                    />
                  </td>

                  {/* Username Column */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                        onClick={() => onClickAuthor && onClickAuthor(follower.follower)}
                      >
                        @{follower.follower}
                      </span>
                      {profile?.location && (
                        <div className="relative group">
                          <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            {profile.location}
                          </div>
                        </div>
                      )}
                    </div>
                    {profile?.about && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate max-w-xs">
                        {profile.about}
                      </p>
                    )}
                  </td>

                  {/* Last Post Column */}
                  <td className="py-4 px-4">
                    {account?.last_post && account.last_post !== '1970-01-01T00:00:00' ? (
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(account.last_root_post)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-gray-500">Never</span>
                    )}
                  </td>

                  {/* HP Column */}
                  <td className="py-4 px-4">
                    {account ? (
                      <HPCell vestingShares={account.vesting_shares} />
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                    )}
                  </td>

                  {/* Vote Value Column */}
                  <td className="py-4 px-4">
                    {voteValues[follower.follower] ? (
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        ${voteValues[follower.follower]}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                    )}
                  </td>

                  {/* Manage Column */}
                  <td className="py-4 px-4">
                    <div className="relative" ref={openDropdown === follower.follower ? dropdownRef : null}>
                      <button
                        onClick={() => setOpenDropdown(openDropdown === follower.follower ? null : follower.follower)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </button>
                      {/* Dropdown menu */}
                      {openDropdown === follower.follower && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                          <button
                            onClick={() => {
                              onClickAddRemoveFromLists && onClickAddRemoveFromLists(follower.follower);
                              setOpenDropdown(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <UserPlus className="w-4 h-4" />
                            Add/remove from lists
                          </button>
                          <button
                            onClick={() => {
                              onClickFollow && onClickFollow(follower.follower);
                              setOpenDropdown(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <UserMinus className="w-4 h-4" />
                            Follow
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {followers.map((follower, index) => {
          const account = accounts.find(acc => acc.name === follower.follower);
          const profile = getProfileData(follower.follower);

          return (
            <div key={`${follower.follower}-${index}`} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <img
                  src={profile?.profile_image || userService.userAvatar(follower.follower)}
                  alt={follower.follower}
                  className="w-10 h-10 rounded-full object-cover cursor-pointer flex-shrink-0"
                  onClick={() => onClickAuthor && onClickAuthor(follower.follower)}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${follower.follower}&background=random`;
                  }}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 text-sm"
                        onClick={() => onClickAuthor && onClickAuthor(follower.follower)}
                      >
                        @{follower.follower}
                      </span>
                      {profile?.location && (
                        <div className="relative group">
                          <MapPin className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            {profile.location}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Last Post at top right */}
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {account?.last_post && account.last_post !== '1970-01-01T00:00:00' ? (
                        formatDate(account.last_root_post)
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">Never</span>
                      )}
                    </div>
                  </div>

                  {/* HP and Manage Row */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-4">
                      {account && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          <HPCell vestingShares={account.vesting_shares} />
                        </div>
                      )}
                    </div>

                    <div className="relative" ref={openDropdown === follower.follower ? dropdownRef : null}>
                      <button
                        onClick={() => setOpenDropdown(openDropdown === follower.follower ? null : follower.follower)}
                        className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <MoreVertical className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                      </button>
                      {/* Dropdown menu */}
                      {openDropdown === follower.follower && (
                        <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                          <button
                            onClick={() => {
                              onClickAddRemoveFromLists && onClickAddRemoveFromLists(follower.follower);
                              setOpenDropdown(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <UserPlus className="w-3 h-3" />
                            Add/remove from lists
                          </button>
                          <button
                            onClick={() => {
                              onClickFollow && onClickFollow(follower.follower);
                              setOpenDropdown(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <UserMinus className="w-3 h-3" />
                            Follow
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FollowersList;
