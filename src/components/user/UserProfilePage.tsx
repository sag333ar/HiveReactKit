/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Heart,
  Rss,
  Share2,
  MoreVertical,
  Users,
  Calendar,
} from "lucide-react";
import UserInfo from "./UserInfo";
import UserFollowers from "./UserFollowers";
import UserFollowing from "./UserFollowing";
import { ApiVideoFeedType } from "@/types/video";
import FavouriteWidget from "../common/FavouriteWidget";
import { userService } from "@/services/userService";
import VideoFeed from "../VideoFeed";
import { UserProfileResponse } from "@/types/user";

interface UserProfilePageProps {
  username: string;
  onVideoClick: (video: any) => void;
  onAuthorClick: (author: string) => void;
  onBack: () => void;
  onClickUserInfoTab?: () => void;
  onClickFollowersTab?: () => void;
  onClickFollowingTab?: () => void;
  onBookmarkToggle?: (username: string, isBookmarked: boolean) => void;
  onRss?: (username: string) => void;
  onShare?: (username: string) => void;
  onMoreMenu?: (username: string) => void;
  showMoreMenu?: boolean;
}

const UserProfilePage = ({
  username,
  onVideoClick,
  onAuthorClick,
  onBack,
  onClickUserInfoTab,
  onClickFollowersTab,
  onClickFollowingTab,
  onBookmarkToggle,
  onRss,
  onShare,
  onMoreMenu,
  showMoreMenu = false,
}: UserProfilePageProps) => {
  const [activeTab, setActiveTab] = useState("videos");
  const [userDetails, setUserDetails] =
    useState<UserProfileResponse | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        setLoading(true);
        const details = await userService.getProfile(username);
        setUserDetails(details);
      } catch (error) {
        console.error("Failed to fetch user details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserDetails();
  }, [username]);

  const handleShare = () => {
    if (onShare) {
      onShare(username);
    } else {
      const url = `https://3speak.tv/user/${username}`;
      if (navigator.share) {
        navigator.share({
          title: userDetails?.result?.name || username,
          url,
        });
      } else {
        navigator.clipboard.writeText(url);
      }
    }
  };

  const handleRssFeed = () => {
    if (onRss) {
      onRss(username);
    } else {
      window.open(`https://3speak.tv/rss/${username}.xml`, "_blank");
    }
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
  };

  const handleUserClick = (user: string) => {
    onAuthorClick(user);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-6"></div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
              </div>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-20"
                ></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const user = userDetails?.result;
  const profile = user?.metadata?.profile;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center justify-center mr-4 px-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </button>

      {/* User Header */}
      <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {/* Cover Image */}
        <img
          src={profile.cover_image || userService.userAvatar(username)}
          alt="Cover"
          className="w-full h-48 object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = userService.userAvatar(username);
          }}
        />


        <div className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <img
              src={profile?.profile_image}
              alt={profile?.name}
              className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-800 -mt-16"
              onError={(e) => {
                (e.target as HTMLImageElement).src = userService.userAvatar(username);
              }}
            />
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {profile?.name || username}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {profile?.about || "No description available"}
              </p>
              {/* Stats */}
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Users className="w-4 h-4" />
                  <span>
                    {(user?.stats?.followers || 0).toLocaleString()} Followers
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Users className="w-4 h-4" />
                  <span>
                    {(user?.stats?.following || 0).toLocaleString()} Following
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Joined{" "}
                    {user?.created
                      ? new Date(user.created).getFullYear()
                      : "Unknown"}
                  </span>
                </div>
              </div>
            </div>
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* <button
                onClick={handleBookmark}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium ${isBookmarked
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
                  }`}
              >
                <Heart
                  className={`w-4 h-4 mr-2 ${isBookmarked ? "fill-current text-white" : ""
                    }`}
                />
                {isBookmarked ? "Followed" : "Follow"}
              </button> */}
              <FavouriteWidget
                id={username}
                toastType="user"
                onAdd={(id, action) => { if (onBookmarkToggle) onBookmarkToggle(id, true); else console.log("Added:", id, action) }}
                onRemove={(id, action) => { if (onBookmarkToggle) onBookmarkToggle(id, false); else console.log("Removed:", id, action) }}
              />
              <button
                onClick={handleRssFeed}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
              >
                <Rss className="w-4 h-4" />
              </button>

              <button
                onClick={handleShare}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
              >
                <Share2 className="w-4 h-4" />
              </button>

              {showMoreMenu && (
                <button
                  onClick={() => { if (onMoreMenu) onMoreMenu(username); }}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="grid grid-cols-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {[
            { key: "videos", label: "Videos" },
            { key: "about", label: "User Info", callback: onClickUserInfoTab },
            { key: "followers", label: "Followers", callback: onClickFollowersTab },
            { key: "following", label: "Following", callback: onClickFollowingTab },
          ].map((tab, idx) => (
            <button
              key={tab.key}
              onClick={() => { if (tab.callback) tab.callback(); else setActiveTab(tab.key); }}
              className={`px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${activeTab === tab.key
                ? "bg-blue-600 dark:bg-blue-500 text-white"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {activeTab === "videos" && (
            <VideoFeed
              feedType={ApiVideoFeedType.USER}
              username={username}
              onVideoClick={onVideoClick}
              onAuthorClick={onAuthorClick}
            />
          )}
          {activeTab === "about" && <UserInfo username={username} />}
          {activeTab === "followers" && (
            <UserFollowers username={username} onSelectUser={handleUserClick} />
          )}
          {activeTab === "following" && (
            <UserFollowing username={username} onSelectUser={handleUserClick} />
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
