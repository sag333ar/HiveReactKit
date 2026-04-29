/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { communityService } from "../../services/communityService";
import { CommunityDetailsResponse } from "../../types/community";

interface CommunityAboutProps {
  communityId: string;
}

const CommunityAbout = ({ communityId }: CommunityAboutProps) => {
  const [details, setDetails] = useState<CommunityDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await communityService.getCommunityDetails(communityId);
      setDetails(response);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load community details"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [communityId]);

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
        <div className="flex items-center gap-2 text-[#9ca3b0]">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading community details...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-[#f0f0f8] mb-2">
            Failed to load community details
          </h3>
          <p className="text-[#9ca3b0] mb-4">{error}</p>
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
        <p className="text-[#9ca3b0]">
          No community details available
        </p>
      </div>
    );
  }

  const community = details.result;

  return (
    <div className="space-y-6">
      <div className="bg-[#262b30] border border-[#3a424a] rounded-xl p-6">
        {/* About Section */}
        {community.about && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-[#f0f0f8] mb-3">
              About
            </h3>
            <p className="text-[#9ca3b0] text-[#e7e7f1] leading-relaxed">
              {removeHtmlTags(community.about)}
            </p>
          </div>
        )}

        {/* Description Section */}
        {community.description && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-[#f0f0f8] mb-3">
              Information
            </h3>
            <div className="text-[#9ca3b0] text-[#e7e7f1] leading-relaxed whitespace-pre-wrap">
              {removeHtmlTags(community.description)}
            </div>
          </div>
        )}

        {/* Rules Section */}
        {community.flag_text && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-[#f0f0f8] mb-3">
              Community Rules
            </h3>
            <div className="text-[#9ca3b0] text-[#e7e7f1] leading-relaxed whitespace-pre-wrap">
              {removeHtmlTags(community.flag_text)}
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-[#9ca3b0] mb-1">
              Total Authors
            </h4>
            <p className="text-2xl font-bold text-[#f0f0f8]">
              {community.num_authors?.toLocaleString() || "0"}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-[#9ca3b0] mb-1">
              Subscribers
            </h4>
            <p className="text-2xl font-bold text-[#f0f0f8]">
              {community.subscribers?.toLocaleString() || "0"}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-[#9ca3b0] mb-1">
              Created
            </h4>
            <p className="text-lg font-semibold text-[#f0f0f8]">
              {community.created_at
                ? formatDate(community.created_at)
                : "Unknown"}
            </p>
          </div>

          {community.lang && (
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-[#9ca3b0] mb-1">
                Language
              </h4>
              <p className="text-lg font-semibold text-[#f0f0f8]">
                {community.lang.toUpperCase()}
              </p>
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-[#9ca3b0] mb-1">
              Pending Posts
            </h4>
            <p className="text-lg font-semibold text-[#f0f0f8]">
              {community.num_pending?.toLocaleString() || "0"}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-[#9ca3b0] mb-1">
              Type
            </h4>
            <p className="text-lg font-semibold text-[#f0f0f8]">
              {community.is_nsfw ? "NSFW" : "Safe"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityAbout;