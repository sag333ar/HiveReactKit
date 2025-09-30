import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ThreeSpeakVideo } from "@/types/video";
import { User } from "@/types/user";
import { apiService } from "@/services/apiService";
import { formatThumbnailUrl } from "@/utils/thumbnail";
import {
  Video,
  Hourglass,
  RefreshCw,
  MoreVertical,
  Play,
  Info,
  Upload,
  ArrowLeft,
  Ban
} from "lucide-react";

enum VideoListType {
  PUBLISH_NOW = "publishNow",
  MY_VIDEOS = "myVideos",
  ENCODING = "encoding",
}

interface UserAccountProps {
  currentUser: User | null;
  onTabChanged?: (tabIndex: number) => void;
  onPublish?: (username: string, permlink: string) => void;
  onViewMyVideo?: (username: string, permlink: string) => void;
  onMoreOptions?: (videoId: string) => void;
  onTapBackButton?: () => void;
  shouldShowMoreOptionsButton?: boolean;
  shouldShowBackButton?: boolean;
  shouldShowPublishButton?: boolean;
}

const UserAccount = ({
  currentUser,
  onTabChanged,
  onPublish,
  onViewMyVideo,
  onMoreOptions,
  onTapBackButton,
  shouldShowBackButton = true,
  shouldShowPublishButton = false,
  shouldShowMoreOptionsButton = false,
}: UserAccountProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [allVideos, setAllVideos] = useState<ThreeSpeakVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter videos based on status
  const encodingVideos = allVideos.filter((v) =>
    [
      "encoding",
      "uploaded",
      "encoding_queued",
      "encoding_preparing",
      "ipfs_pinning",
      "ipfs_pinning_failed",
      "encoding_failed",
      "encoding_ipfs"
    ].includes(v.status || "")
  );

  const publishNowVideos = allVideos.filter((v) => v.status === "publish_manual");

  const myVideos = allVideos.filter((v) => v.status === "published");

  useEffect(() => {
    if (currentUser?.token) {
      fetchVideos();
    }
  }, [currentUser]);

  const fetchVideos = async () => {
    if (!currentUser?.token) {
      setErrorMessage("No authentication token provided");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const videos = await apiService.getMyVideos(currentUser.token);
      setAllVideos(videos);
    } catch (error) {
      console.error("Error fetching videos:", error);
      setErrorMessage(
        `Failed to load videos: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (tabIndex: number) => {
    setActiveTab(tabIndex);
    onTabChanged?.(tabIndex);
  };

  const handleVideoClick = (video: ThreeSpeakVideo) => {
    if (video.owner && video.permlink) {
      navigate(`/video/${video.owner}/${video.permlink}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "published":
        return "bg-green-500";
      case "encoding":
      case "encoding_queued":
        return "bg-orange-500";
      case "uploaded":
        return "bg-blue-500";
      case "publish_manual":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  const restrictedStatuses = [
    "ipfs_pinning",
    "ipfs_pinning_failed",
    "encoding",
    "encoding_failed",
    "encoding_ipfs",
  ];

  const buildVideoList = (videos: ThreeSpeakVideo[], listType: VideoListType) => {
    if (videos.length === 0) {
      let emptyMessage = "";
      switch (listType) {
        case VideoListType.PUBLISH_NOW:
          emptyMessage = "No videos ready to publish.";
          break;
        case VideoListType.MY_VIDEOS:
          emptyMessage = "No published videos found.";
          break;
        case VideoListType.ENCODING:
          emptyMessage = "No videos currently encoding.";
          break;
      }

      return (
        <div className="flex flex-col items-center justify-center py-16">
          <Video className="w-16 h-16 text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-center">
            {emptyMessage}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3 w-full">
        {videos.map((video, index) => {
          const thumbnailUrl = video.thumbnail || "";
          const title = video.title || "No Title";
          const permlink = video.permlink || "";
          const username = video.owner || currentUser?.username || "";
          const videoId = video.id || "";

          const isRestricted = restrictedStatuses.includes(video.status || "");

          return (
            <div
              key={`${videoId}-${index}`}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                {/* Thumbnail */}
                <div className="relative flex-shrink-0">
                  <img
                    src={
                      formatThumbnailUrl(thumbnailUrl) ||
                      `https://images.hive.blog/u/${currentUser?.username}/avatar`
                    }
                    alt={title}
                    className="w-24 h-16 rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://images.hive.blog/u/${currentUser?.username}/avatar`;
                    }}
                  />
                  {/* Play button overlay */}
                  {!restrictedStatuses.includes(video.status || "") ? (
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity cursor-pointer rounded-lg"
                      onClick={() => handleVideoClick(video)}
                    >
                      <Play className="w-6 h-6 text-white" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                      <Ban className="w-6 h-6 text-red-500" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-semibold text-gray-900 dark:text-white text-sm cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                    onClick={() => handleVideoClick(video)}
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                    By {username}
                  </p>
                  {video.status && (
                    <div className="mt-2">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-semibold text-white ${getStatusColor(
                          video.status
                        )}`}
                      >
                        {video.status.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {isRestricted ? (
                  <div className="flex-shrink-0 pl-2">
                    <Ban className="w-5 h-5 text-red-500" />
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-2">
                    {listType === VideoListType.PUBLISH_NOW &&
                      shouldShowPublishButton && (
                        <button
                          onClick={() => onPublish?.(username, permlink)}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded-md transition-colors"
                        >
                          Publish
                        </button>
                      )}

                    {listType === VideoListType.MY_VIDEOS && (
                      <button
                        onClick={() =>
                          onViewMyVideo
                            ? onViewMyVideo(username, permlink)
                            : handleVideoClick(video)
                        }
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded-md transition-colors"
                      >
                        View
                      </button>
                    )}

                    {shouldShowMoreOptionsButton && (
                      <button
                        onClick={() => onMoreOptions?.(videoId)}
                        className="p-1 h-6 w-6 rounded-md hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-600 dark:text-gray-400">
          Please login to view your account
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      {shouldShowBackButton && (
        <button
          onClick={onTapBackButton}
          className="flex items-center justify-center mr-4 my-2 px-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
      )}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {/* User Profile */}
            <div className="flex items-center gap-3">
              <img
                src={`https://images.hive.blog/u/${currentUser.username}/avatar`}
                alt={currentUser.username}
                className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${currentUser.username}&background=random&size=64`;
                }}
              />
              <div>
                <h1 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
                  {currentUser.username}
                </h1>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={fetchVideos}
              className="p-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex overflow-x-auto scrollbar-hide">
            <button
              onClick={() => handleTabChange(0)}
              className={`flex items-center gap-2 px-4 md:px-6 py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === 0
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Publish Now</span>
              <span className="sm:hidden">Publish</span>
              {publishNowVideos.length > 0 && (
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full">
                  {publishNowVideos.length}
                </span>
              )}
            </button>

            <button
              onClick={() => handleTabChange(1)}
              className={`flex items-center gap-2 px-4 md:px-6 py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === 1
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
            >
              <Video className="w-4 h-4" />
              <span className="hidden sm:inline">My Videos</span>
              <span className="sm:hidden">Videos</span>
              {myVideos.length > 0 && (
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full">
                  {myVideos.length}
                </span>
              )}
            </button>

            <button
              onClick={() => handleTabChange(2)}
              className={`flex items-center gap-2 px-4 md:px-6 py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === 2
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
            >
              <Hourglass className="w-4 h-4" />
              <span className="hidden sm:inline">Encoding</span>
              <span className="sm:hidden">Encoding</span>
              {encodingVideos.length > 0 && (
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full">
                  {encodingVideos.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="py-4 md:py-6 w-full">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : errorMessage ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
              <Info className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Failed to load videos
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {errorMessage}
            </p>
            <button
              onClick={fetchVideos}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 0 &&
              buildVideoList(publishNowVideos, VideoListType.PUBLISH_NOW)}
            {activeTab === 1 &&
              buildVideoList(myVideos, VideoListType.MY_VIDEOS)}
            {activeTab === 2 &&
              buildVideoList(encodingVideos, VideoListType.ENCODING)}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserAccount;
