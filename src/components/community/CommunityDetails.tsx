/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { Users, Calendar, Loader2 } from "lucide-react";
import { communityService } from "../../services/communityService";
import {
  CommunityDetailsResult,
  CommunityPost,
  CommunitySubscriber,
  CommunityActivity,
} from "../../types/community";

interface CommunityDetailsProps {
  communityId: string;
}

const CommunityDetails = ({ communityId }: CommunityDetailsProps) => {
  const [activeTab, setActiveTab] = useState("posts");
  const [communityDetails, setCommunityDetails] =
    useState<CommunityDetailsResult | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [subscribers, setSubscribers] = useState<CommunitySubscriber[]>([]);
  const [activities, setActivities] = useState<CommunityActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
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
    if (activeTab === "posts" && communityDetails) {
      fetchPosts();
    } else if (activeTab === "subscribers" && communityDetails) {
      fetchSubscribers();
    } else if (activeTab === "activities" && communityDetails) {
      fetchActivities();
    }
  }, [activeTab, communityDetails]);

  const fetchPosts = async () => {
    try {
      setLoadingPosts(true);
      const postsData = await communityService.getRankedPosts(
        communityId,
        "created",
        20
      );
      setPosts(postsData);
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    } finally {
      setLoadingPosts(false);
    }
  };

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
          Loading community details...
        </div>
      </div>
    );
  }

  if (error || !communityDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Failed to load community details
        </h3>
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Community Header */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {communityDetails.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {communityDetails.about}
            </p>
            {/* Stats */}
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Users className="w-4 h-4" />
                <span>
                  {communityDetails.subscribers.toLocaleString()} members
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>Created {formatDate(communityDetails.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="grid grid-cols-4 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setActiveTab("posts")}
            className={`px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "posts"
                ? "bg-blue-600 dark:bg-blue-500 text-white"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            Posts
          </button>
          <button
            onClick={() => setActiveTab("about")}
            className={`px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "about"
                ? "bg-blue-600 dark:bg-blue-500 text-white"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            About
          </button>
          <button
            onClick={() => setActiveTab("subscribers")}
            className={`px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "subscribers"
                ? "bg-blue-600 dark:bg-blue-500 text-white"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            Subscribers
          </button>
          <button
            onClick={() => setActiveTab("activities")}
            className={`px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "activities"
                ? "bg-blue-600 dark:bg-blue-500 text-white"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            Activities
          </button>
        </div>

        <div className="mt-6">
          {/* Posts Tab */}
          {activeTab === "posts" && (
            <div className="space-y-4">
              {loadingPosts ? (
                <div className="flex items-center justify-center min-h-[200px]">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : posts.length > 0 ? (
                posts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                      {post.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                      By {post.author} • {formatDate(post.created)}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-3">
                      {removeHtmlTags(post.body).substring(0, 200)}...
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                      <span>{post.children} comments</span>
                      <span>${post.payout.toFixed(2)}</span>
                      <span>{post.stats?.total_votes || 0} votes</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No posts found
                </div>
              )}
            </div>
          )}

          {/* About Tab */}
          {activeTab === "about" && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
              {/* About Section */}
              {communityDetails.about && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    About
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {removeHtmlTags(communityDetails.about)}
                  </p>
                </div>
              )}

              {/* Description Section */}
              {communityDetails.description && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Information
                  </h3>
                  <div className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {removeHtmlTags(communityDetails.description)}
                  </div>
                </div>
              )}

              {/* Rules Section */}
              {communityDetails.flag_text && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Community Rules
                  </h3>
                  <div className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {removeHtmlTags(communityDetails.flag_text)}
                  </div>
                </div>
              )}

              {/* Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Total Authors
                  </h4>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {communityDetails.num_authors.toLocaleString()}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Subscribers
                  </h4>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {communityDetails.subscribers.toLocaleString()}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Created
                  </h4>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatDate(communityDetails.created_at)}
                  </p>
                </div>

                {communityDetails.lang && (
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Language
                    </h4>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {communityDetails.lang.toUpperCase()}
                    </p>
                  </div>
                )}

                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Pending Posts
                  </h4>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {communityDetails.num_pending.toLocaleString()}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Type
                  </h4>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {communityDetails.is_nsfw ? "NSFW" : "Safe"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Subscribers Tab */}
          {activeTab === "subscribers" && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
              {loadingSubscribers ? (
                <div className="flex items-center justify-center min-h-[200px]">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : subscribers.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Subscribers ({subscribers.length})
                  </h3>
                  {subscribers.map((subscriber) => (
                    <div
                      key={subscriber.username}
                      className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
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
                        <p className="font-medium text-gray-900 dark:text-white">
                          @{subscriber.username}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Role: {subscriber.role} • Subscribed{" "}
                          {formatDate(subscriber.subscribedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No subscribers found
                </div>
              )}
            </div>
          )}

          {/* Activities Tab */}
          {activeTab === "activities" && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
              {loadingActivities ? (
                <div className="flex items-center justify-center min-h-[200px]">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : activities.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Recent Activities ({activities.length})
                  </h3>
                  {activities.map((activity) => {
                    const username = activity.msg.split(" ")[0].substring(1); // Extract username from msg like "@username ..."
                    return (
                      <div
                        key={activity.id}
                        className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
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
                          <p className="text-gray-900 dark:text-white mb-1">
                            {activity.msg}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(activity.date)}
                            {activity.score && ` • Score: ${activity.score}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
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

export default CommunityDetails;
