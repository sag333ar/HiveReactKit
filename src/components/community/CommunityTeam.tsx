/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { communityService } from "../../services/communityService";
import { CommunityDetailsResponse } from "../../types/community";

interface CommunityTeamProps {
  communityId: string;
  onSelectTeamMember?: (username: string) => void;
}

const CommunityTeam = ({
  communityId,
  onSelectTeamMember,
}: CommunityTeamProps) => {
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
        err instanceof Error ? err.message : "Failed to load team details"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [communityId]);

  const team = details?.result?.team || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading team members...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Failed to load team details
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button onClick={fetchDetails} className="m-2 inline-flex items-center justify-center rounded-md border border-input text-gray-400 cursor-pointer bg-background p-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (team.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500 dark:text-gray-400">
          No team members found
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {team.map((member, index) => {
          const username = member[0];
          const role = member.length > 1 ? member[1] : "";

          return (
            <div
              key={`${username}-${index}`}
              onClick={() => onSelectTeamMember && onSelectTeamMember(username)} // ✅ navigate on click
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                         rounded-xl p-4 hover:bg-gray-300 dark:hover:bg-gray-700 
                         transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <img
                  src={communityService.userOwnerThumb(username)}
                  alt={username}
                  className="w-12 h-12 rounded-full object-cover"
                  onError={(e) => {
                    (
                      e.target as HTMLImageElement
                    ).src = `https://ui-avatars.com/api/?name=${username}&background=random`;
                  }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    @{username}
                  </h3>
                  {role && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize truncate">
                      {role}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CommunityTeam;