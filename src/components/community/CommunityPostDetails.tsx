/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { Users, Calendar, Loader2 } from "lucide-react";
import { communityService } from "../../services/communityService";
import {
  CommunityDetailsResult,
  CommunitySubscriber,
  CommunityActivity,
} from "../../types/community";
import { Post } from "../../types/post";
import PostFeedList from "../PostFeedList";

interface CommunityPostDetailsProps {
  communityId: string;
  onAuthorClick?: (author: string, avatar: string) => void;
  onPostClick?: (post: Post) => void;
  onCommunityClick?: (communityTitle: string) => void;
  onPayoutClick?: (payout: number) => void;
  onUpvoteClick?: (post: Post) => void;
  onCommentClick?: (post: Post) => void;
  onReblogClick?: (post: Post) => void;
  theme?: "light" | "dark";
}

const CommunityPostDetails = ({
  communityId,
  onAuthorClick,
  onPostClick,
  onCommunityClick,
  onPayoutClick,
  onUpvoteClick,
  onCommentClick,
  onReblogClick,
  theme = "dark",
}: CommunityPostDetailsProps) => {
  const [activeTab, setActiveTab] = useState("posts");
  const [communityDetails, setCommunityDetails] =
    useState<CommunityDetailsResult | null>(null);
  const [subscribers, setSubscribers] = useState<CommunitySubscriber[]>([]);
  const [activities, setActivities] = useState<CommunityActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchCommunityDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const details = await communityService.getCommunityDetails(communityId);
        setCommunityDetails(details.result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch community details"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCommunityDetails();
  }, [communityId]);

  useEffect(() => {
    if (activeTab === "subscribers" && communityDetails) {
      fetchSubscribers();
    } else if (activeTab === "activities" && communityDetails) {
      fetchActivities();
    }
  }, [activeTab, communityDetails]);

  const fetchSubscribers = async () => {
    try {
      setLoadingSubscribers(true);
      const subscribersData =
        await communityService.getCommunitySubscribersList(communityId, 100);
      setSubscribers(subscribersData);
    } catch (err) {
      console.error("Failed to fetch subscribers:", err);
    } finally {
      setLoadingSubscribers(false);
    }
  };

  const fetchActivities = async () => {
    try {
      setLoadingActivities(true);
      const activitiesData = await communityService.getCommunityActivities(
        communityId,
        100
      );
      setActivities(activitiesData);
    } catch (err) {
      console.error("Failed to fetch activities:", err);
    } finally {
      setLoadingActivities(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInSeconds = Math.floor(diffInMs / 1000);
      const diffInMinutes = Math.floor(diffInSeconds / 60);
      const diffInHours = Math.floor(diffInMinutes / 60);
      const diffInDays = Math.floor(diffInHours / 24);
      const diffInMonths = Math.floor(diffInDays / 30);
      const diffInYears = Math.floor(diffInDays / 365);

      if (diffInYears > 0) {
        return `${diffInYears} year${diffInYears > 1 ? "s" : ""} ago`;
      } else if (diffInMonths > 0) {
        return `${diffInMonths} month${diffInMonths > 1 ? "s" : ""} ago`;
      } else if (diffInDays > 0) {
        return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
      } else if (diffInHours > 0) {
        return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
      } else if (diffInMinutes > 0) {
        return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`;
      } else {
        return "just now";
      }
    } catch {
      return dateString;
    }
  };

  const removeHtmlTags = (str: string) => {
    return str.replace(/<[^>]*>/g, "");
  };

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center min-h-[400px] ${
          theme === "dark" ? "bg-slate-950" : "bg-white"
        }`}
      >
        <div
          className={`flex items-center gap-2 ${
            theme === "dark" ? "text-gray-400" : "text-gray-500"
          }`}
        >
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading community details...
        </div>
      </div>
    );
  }

  if (error || !communityDetails) {
    return (
      <div
        className={`flex flex-col items-center justify-center min-h-[400px] space-y-4 ${
          theme === "dark" ? "bg-slate-950" : "bg-white"
        }`}
      >
        <h3
          className={`text-lg font-semibold ${
            theme === "dark" ? "text-white" : "text-gray-900"
          }`}
        >
          Failed to load community details
        </h3>
        <p
          className={`${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
        >
          {error}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`space-y-6 ${theme === "dark" ? "bg-slate-950" : "bg-white"}`}
    >
      {/* Community Header */}
      <div
        className={`${
          theme === "dark"
            ? "bg-slate-900 border-gray-800"
            : "bg-white border-gray-200"
        } border rounded-xl p-6`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <img
            src={communityService.userOwnerThumb(communityId)}
            alt={communityDetails.title}
            className="w-16 h-16 rounded-full object-cover"
            onError={(e) => {
              (
                e.target as HTMLImageElement
              ).src = `https://images.hive.blog/u/${communityDetails.title}/avatar`;
            }}
          />
          <div className="flex-1">
            <h1
              className={`text-2xl font-bold mb-2 ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            >
              {communityDetails.title}
            </h1>
            <p
              className={`${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              } mb-4`}
            >
              {communityDetails.about}
            </p>
            {/* Stats */}
            <div className="flex flex-wrap gap-6 text-sm">
              <div
                className={`flex items-center gap-2 ${
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>
                  {communityDetails.subscribers.toLocaleString()} members
                </span>
              </div>
              <div
                className={`flex items-center gap-2 ${
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>
                  Created {formatTimeAgo(communityDetails.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div
          className={`flex md:grid md:grid-cols-4 overflow-x-auto md:overflow-visible w-full ${
            theme === "dark"
              ? "bg-slate-900 border-gray-800"
              : "bg-white border-gray-200"
          } border rounded-lg`}
        >
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex-shrink-0 md:flex-shrink px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "posts"
                ? `${
                    theme === "dark"
                      ? "bg-blue-500 text-white"
                      : "bg-blue-600 text-white"
                  }`
                : `${
                    theme === "dark"
                      ? "text-gray-300 hover:bg-gray-700"
                      : "text-gray-500 hover:bg-gray-300"
                  }`
            }`}
          >
            Posts
          </button>
          <button
            onClick={() => setActiveTab("about")}
            className={`flex-shrink-0 md:flex-shrink px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "about"
                ? `${
                    theme === "dark"
                      ? "bg-blue-500 text-white"
                      : "bg-blue-600 text-white"
                  }`
                : `${
                    theme === "dark"
                      ? "text-gray-300 hover:bg-gray-700"
                      : "text-gray-700 hover:bg-gray-300"
                  }`
            }`}
          >
            About
          </button>
          <button
            onClick={() => setActiveTab("subscribers")}
            className={`flex-shrink-0 md:flex-shrink px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "subscribers"
                ? `${
                    theme === "dark"
                      ? "bg-blue-500 text-white"
                      : "bg-blue-600 text-white"
                  }`
                : `${
                    theme === "dark"
                      ? "text-gray-300 hover:bg-gray-700"
                      : "text-gray-700 hover:bg-gray-300"
                  }`
            }`}
          >
            Subscribers
          </button>
          <button
            onClick={() => setActiveTab("activities")}
            className={`flex-shrink-0 md:flex-shrink px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "activities"
                ? `${
                    theme === "dark"
                      ? "bg-blue-500 text-white"
                      : "bg-blue-600 text-white"
                  }`
                : `${
                    theme === "dark"
                      ? "text-gray-300 hover:bg-gray-700"
                      : "text-gray-700 hover:bg-gray-300"
                  }`
            }`}
          >
            Activities
          </button>
        </div>

        <div className="mt-6">
          {/* Posts Tab */}
          {activeTab === "posts" && (
            <PostFeedList
              tag={communityId}
              sort="created"
              limit={20}
              showSortDropdown={false}
              onAuthorClick={onAuthorClick}
              onPostClick={onPostClick}
              onCommunityClick={onCommunityClick}
              onPayoutClick={onPayoutClick}
              onUpvoteClick={onUpvoteClick}
              onCommentClick={onCommentClick}
              onReblogClick={onReblogClick}
              theme={theme}
            />
          )}

          {/* About Tab */}
          {activeTab === "about" && (
            <div
              className={`${
                theme === "dark"
                  ? "bg-slate-900 border-gray-800"
                  : "bg-white border-gray-200"
              } border rounded-xl p-6`}
            >
              {/* About Section */}
              {communityDetails.about && (
                <div className="mb-6">
                  <h3
                    className={`text-lg font-semibold mb-3 ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    About
                  </h3>
                  <p
                    className={`${
                      theme === "dark" ? "text-gray-300" : "text-gray-600"
                    } leading-relaxed`}
                  >
                    {removeHtmlTags(communityDetails.about)}
                  </p>
                </div>
              )}

              {/* Description Section */}
              {communityDetails.description && (
                <div className="mb-6">
                  <h3
                    className={`text-lg font-semibold mb-3 ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Information
                  </h3>
                  <div
                    className={`${
                      theme === "dark" ? "text-gray-300" : "text-gray-600"
                    } leading-relaxed whitespace-pre-wrap`}
                  >
                    {removeHtmlTags(communityDetails.description)}
                  </div>
                </div>
              )}

              {/* Rules Section */}
              {communityDetails.flag_text && (
                <div className="mb-6">
                  <h3
                    className={`text-lg font-semibold mb-3 ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Community Rules
                  </h3>
                  <div
                    className={`${
                      theme === "dark" ? "text-gray-300" : "text-gray-600"
                    } leading-relaxed whitespace-pre-wrap`}
                  >
                    {removeHtmlTags(communityDetails.flag_text)}
                  </div>
                </div>
              )}

              {/* Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div
                  className={`${
                    theme === "dark" ? "bg-slate-800" : "bg-gray-50"
                  } p-4 rounded-lg`}
                >
                  <h4
                    className={`text-sm font-medium mb-1 ${
                      theme === "dark" ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Total Authors
                  </h4>
                  <p
                    className={`text-2xl font-bold ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {communityDetails.num_authors.toLocaleString()}
                  </p>
                </div>

                <div
                  className={`${
                    theme === "dark" ? "bg-slate-800" : "bg-gray-50"
                  } p-4 rounded-lg`}
                >
                  <h4
                    className={`text-sm font-medium mb-1 ${
                      theme === "dark" ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Subscribers
                  </h4>
                  <p
                    className={`text-2xl font-bold ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {communityDetails.subscribers.toLocaleString()}
                  </p>
                </div>

                <div
                  className={`${
                    theme === "dark" ? "bg-slate-800" : "bg-gray-50"
                  } p-4 rounded-lg`}
                >
                  <h4
                    className={`text-sm font-medium mb-1 ${
                      theme === "dark" ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Created
                  </h4>
                  <p
                    className={`text-lg font-semibold ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {formatTimeAgo(communityDetails.created_at)}
                  </p>
                </div>

                {communityDetails.lang && (
                  <div
                    className={`${
                      theme === "dark" ? "bg-slate-800" : "bg-gray-50"
                    } p-4 rounded-lg`}
                  >
                    <h4
                      className={`text-sm font-medium mb-1 ${
                        theme === "dark" ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Language
                    </h4>
                    <p
                      className={`text-lg font-semibold ${
                        theme === "dark" ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {communityDetails.lang.toUpperCase()}
                    </p>
                  </div>
                )}

                <div
                  className={`${
                    theme === "dark" ? "bg-slate-800" : "bg-gray-50"
                  } p-4 rounded-lg`}
                >
                  <h4
                    className={`text-sm font-medium mb-1 ${
                      theme === "dark" ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Pending Posts
                  </h4>
                  <p
                    className={`text-lg font-semibold ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {communityDetails.num_pending.toLocaleString()}
                  </p>
                </div>

                <div
                  className={`${
                    theme === "dark" ? "bg-slate-800" : "bg-gray-50"
                  } p-4 rounded-lg`}
                >
                  <h4
                    className={`text-sm font-medium mb-1 ${
                      theme === "dark" ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Type
                  </h4>
                  <p
                    className={`text-lg font-semibold ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {communityDetails.is_nsfw ? "NSFW" : "Safe"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Subscribers Tab */}
          {activeTab === "subscribers" && (
            <div
              className={`${
                theme === "dark"
                  ? "bg-slate-900 border-gray-800"
                  : "bg-white border-gray-200"
              } border rounded-xl p-6`}
            >
              {loadingSubscribers ? (
                <div className="flex items-center justify-center min-h-[200px]">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : subscribers.length > 0 ? (
                <div className="space-y-4">
                  <h3
                    className={`text-lg font-semibold mb-4 ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Subscribers ({subscribers.length})
                  </h3>
                  {subscribers.map((subscriber) => (
                    <div
                      key={subscriber.username}
                      className={`${
                        theme === "dark" ? "bg-slate-800" : "bg-gray-50"
                      } flex items-center gap-4 p-4 rounded-lg`}
                    >
                      <img
                        src={communityService.userOwnerThumb(
                          subscriber.username
                        )}
                        alt={subscriber.username}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={(e) => {
                          (
                            e.target as HTMLImageElement
                          ).src = `https://images.hive.blog/u/${subscriber.username}/avatar`;
                        }}
                      />
                      <div className="flex-1">
                        <p
                          className={`font-medium ${
                            theme === "dark" ? "text-white" : "text-gray-900"
                          }`}
                        >
                          @{subscriber.username}
                        </p>
                        <p
                          className={`text-sm ${
                            theme === "dark" ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          Role: {subscriber.role} • Subscribed{" "}
                          {formatTimeAgo(subscriber.subscribedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className={`text-center py-8 ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  No subscribers found
                </div>
              )}
            </div>
          )}

          {/* Activities Tab */}
          {activeTab === "activities" && (
            <div
              className={`${
                theme === "dark"
                  ? "bg-slate-900 border-gray-800"
                  : "bg-white border-gray-200"
              } border rounded-xl p-6`}
            >
              {loadingActivities ? (
                <div className="flex items-center justify-center min-h-[200px]">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : activities.length > 0 ? (
                <div className="space-y-4">
                  <h3
                    className={`text-lg font-semibold mb-4 ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Recent Activities ({activities.length})
                  </h3>
                  {activities.map((activity) => {
                    const username = activity.msg.split(" ")[0].substring(1); // Extract username from msg like "@username ..."
                    return (
                      <div
                        key={activity.id}
                        className={`${
                          theme === "dark" ? "bg-slate-800" : "bg-gray-50"
                        } flex items-center gap-4 p-4 rounded-lg`}
                      >
                        <img
                          src={communityService.userOwnerThumb(username)}
                          alt={username}
                          className="w-10 h-10 rounded-full object-cover"
                          onError={(e) => {
                            (
                              e.target as HTMLImageElement
                            ).src = `https://images.hive.blog/u/${username}/avatar`;
                          }}
                        />
                        <div className="flex-1">
                          <p
                            className={`mb-1 ${
                              theme === "dark" ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {activity.msg}
                          </p>
                          <p
                            className={`text-sm ${
                              theme === "dark"
                                ? "text-gray-400"
                                : "text-gray-500"
                            }`}
                          >
                            {formatTimeAgo(activity.date)}
                            {activity.score && ` • Score: ${activity.score}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  className={`text-center py-8 ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  No activities found
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunityPostDetails;
