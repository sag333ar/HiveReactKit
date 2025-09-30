/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { UserProfileResponse } from "@/types/user";
import { userService } from "@/services/userService";

interface UserInfoProps {
  username: string;
}

const UserInfo = ({ username }: UserInfoProps) => {
  const [details, setDetails] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await userService.getProfile(username);
      setDetails(response);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load user details"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [username]);

  const formatDate = (dateString: string) => {
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

  const removeHtmlTags = (str: string) => {
    return str.replace(/<[^>]*>/g, "");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading user details...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Failed to load user details
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchDetails}
            className="m-2 inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!details?.result) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500 dark:text-gray-400">
          No user details available
        </p>
      </div>
    );
  }

  const user = details.result;
  const profile = user.metadata?.profile;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        {/* About Section */}
        {profile?.about && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              About
            </h3>
            <div className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {removeHtmlTags(profile.about)}
            </div>
          </div>
        )}

        {/* Other Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Location
            </h4>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {profile?.location || "Not specified"}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Website
            </h4>
            <a href={profile?.website} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold text-blue-500 hover:underline">
              {profile?.website || "Not specified"}
            </a>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Joined
            </h4>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {user.created ? formatDate(user.created) : "Unknown"}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Followers
            </h4>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {user.stats?.followers?.toLocaleString() || "0"}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Following
            </h4>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {user.stats?.following?.toLocaleString() || "0"}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Post Count
            </h4>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {user.post_count?.toLocaleString() || "0"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserInfo;
