/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Rss,
  Share2,
  MoreVertical,
  Users,
  Calendar,
} from "lucide-react";
import VideoFeed from "../VideoFeed";
import CommunityAbout from "./CommunityAbout";
import CommunityTeam from "./CommunityTeam";
import CommunityMembers from "./CommunityMembers";
import { ApiVideoFeedType } from "../../types/video";
import { communityService } from "../../services/communityService";
import { CommunityDetailsResponse } from "../../types/community";
import { useNavigate } from "react-router-dom";
import Favourite from "../common/FavouriteWidget";

interface CommunityDetailProps {
  communityId: string;
  onVideoClick: (video: any) => void;
  onAuthorClick: (author: string) => void;
  onBack: () => void;
  onclickAboutTab?: () => void;
  onclickTeamTab?: () => void;
  onclickMemberTab?: () => void;
  onShare?: () => void;
  onFavourite?: () => void;
  onRss?: () => void;
  onMoreVertical?: () => void;
  showMoreVertical?: boolean;
}

const CommunityDetail = ({
  communityId,
  onVideoClick,
  onAuthorClick,
  onBack,
  onclickAboutTab,
  onclickTeamTab,
  onclickMemberTab,
  onShare,
  onFavourite,
  onRss,
  onMoreVertical,
  showMoreVertical = true,
}: CommunityDetailProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("videos");
  const [communityDetails, setCommunityDetails] =
    useState<CommunityDetailsResponse | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCommunityDetails = async () => {
      try {
        setLoading(true);
        const details = await communityService.getCommunityDetails(communityId);
        setCommunityDetails(details);
      } catch (error) {
        console.error("Failed to fetch community details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCommunityDetails();
  }, [communityId]);

  const handleShare = () => {
    const url = `https://3speak.tv/user/${communityId}`;
    if (navigator.share) {
      navigator.share({
        title: communityDetails?.result?.title || communityId,
        url,
      });
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  const handleRssFeed = () => {
    window.open(`https://3speak.tv/rss/${communityId}.xml`, "_blank");
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
  };

  const handleMemberClick = (username: string) => {
    navigate(`/user/${username}`);
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

  const community = communityDetails?.result;

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

      {/* Community Header */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <img
            src={communityService.userOwnerThumb(communityId)}
            alt={community?.title || communityId}
            className="w-16 h-16 rounded-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://images.hive.blog/u/${community?.title || communityId
                }/avatar`;
            }}
          />
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {community?.title || communityId}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {community?.about || "Community description"}
            </p>
            {/* Stats */}
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Users className="w-4 h-4" />
                <span>
                  {(community?.subscribers || 0).toLocaleString()} members
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>
                  Created{" "}
                  {community?.created_at
                    ? new Date(community.created_at).getFullYear()
                    : "Unknown"}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Favourite
              id={communityId}
              toastType="community"
              onAdd={(id, action) => console.log("Added:", id, action)}
              onRemove={(id, action) => console.log("Removed:", id, action)}
              onFavourite={onFavourite}
            />
            <button
              onClick={onRss || handleRssFeed}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
            >
              <Rss className="w-4 h-4" />
            </button>
            <button
              onClick={onShare || handleShare}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
            >
              <Share2 className="w-4 h-4" />
            </button>
            {showMoreVertical && (
              <button
                onClick={onMoreVertical || (() => {})}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="grid grid-cols-4 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setActiveTab("videos")}
            className={`px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${activeTab === "videos"
              ? "bg-blue-600 dark:bg-blue-500 text-white"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
              }`}
          >
            Videos
          </button>
          <button
            onClick={() => onclickAboutTab ? onclickAboutTab() : setActiveTab("about")}
            className={`px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${activeTab === "about"
              ? "bg-blue-600 dark:bg-blue-500 text-white"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
              }`}
          >
            About
          </button>
          <button
            onClick={() => onclickTeamTab ? onclickTeamTab() : setActiveTab("team")}
            className={`px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${activeTab === "team"
              ? "bg-blue-600 dark:bg-blue-500 text-white"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
              }`}
          >
            Team
          </button>
          <button
            onClick={() => onclickMemberTab ? onclickMemberTab() : setActiveTab("members")}
            className={`px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${activeTab === "members"
              ? "bg-blue-600 dark:bg-blue-500 text-white"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
              }`}
          >
            Members
          </button>
        </div>

        <div className="mt-6">
          {activeTab === "videos" && (
            <VideoFeed
              feedType={ApiVideoFeedType.COMMUNITY}
              communityId={communityId}
              onVideoClick={onVideoClick}
              onAuthorClick={onAuthorClick}
            />
          )}

          {activeTab === "about" && !onclickAboutTab && (
            <CommunityAbout communityId={communityId} />
          )}

          {activeTab === "team" && !onclickTeamTab && (
            <CommunityTeam
              communityId={communityId}
              onSelectTeamMember={handleMemberClick}
            />
          )}

          {activeTab === "members" && !onclickMemberTab && (
            <CommunityMembers
              communityId={communityId}
              onSelectCommunityMember={handleMemberClick}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunityDetail;
