import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { communityService } from "../../services/communityService";
import { CommunitySubscriber } from "../../types/community";

interface CommunityMembersProps {
  communityId: string;
  onSelectCommunityMember?: (username: string) => void;
}

const CommunityMembers = ({ communityId, onSelectCommunityMember }: CommunityMembersProps) => {
  const [members, setMembers] = useState<CommunitySubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [last, setLast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 100;

  const fetchMembers = useCallback(
    async (refresh = false) => {
      if (loadingMore && !refresh) return;
      try {
        if (refresh) {
          setLoading(true);
          setError(null);
          setMembers([]);
          setLast(null);
          setHasMore(true);
        } else {
          setLoadingMore(true);
        }
        const newMembers = await communityService.getCommunitySubscribers(
          communityId,
          pageSize,
          refresh ? undefined : last || undefined
        );
        if (newMembers.length === 0) {
          setHasMore(false);
        } else {
          setMembers((prev) => {
            if (refresh) return newMembers;

            // Avoid duplicates
            const existingUsernames = new Set(prev.map((m) => m.username));
            const filtered = newMembers.filter(
              (m) => !existingUsernames.has(m.username)
            );
            return [...prev, ...filtered];
          });

          if (newMembers.length > 0) {
            setLast(newMembers[newMembers.length - 1].username);
          }

          setHasMore(newMembers.length === pageSize);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load members");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [communityId, loadingMore, last]
  );

  useEffect(() => {
    fetchMembers(true);
  }, [communityId]);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 200 &&
        !loadingMore &&
        !loading &&
        hasMore
      ) {
        fetchMembers();
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [fetchMembers, loadingMore, loading, hasMore]);

  if (loading && members.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-[#9ca3b0]">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading members...
        </div>
      </div>
    );
  }

  if (error && members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-[#f0f0f8] mb-2">
            Failed to load members
          </h3>
          <p className="text-[#9ca3b0] mb-4">{error}</p>
          <button onClick={() => fetchMembers(true)} className="m-2 inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-[#9ca3b0]">
          No community members found
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {members.map((member, index) => (
          <div
            key={`${member.username}-${index}`}
            className="bg-[#262b30] border border-[#3a424a] rounded-xl p-4 hover:bg-[#2f353d] dark:hover:bg-[#2f353d] transition-colors cursor-pointer"
            onClick={() => onSelectCommunityMember?.(member.username)}
          >
            <div className="flex items-center gap-3">
              <img
                src={communityService.userOwnerThumb(member.username)}
                alt={member.username}
                className="w-12 h-12 rounded-full object-cover"
                onError={(e) => {
                  (
                    e.target as HTMLImageElement
                  ).src = `https://ui-avatars.com/api/?name=${member.username}&background=random`;
                }}
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[#f0f0f8] truncate">
                  @{member.username}
                </h3>
                {member.role && (
                  <p className="text-sm text-[#9ca3b0] capitalize truncate">
                    {member.role}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-4">
          {loadingMore ? (
            <div className="flex items-center gap-2 text-[#9ca3b0]">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading more members...
            </div>
          ) : (
            <button onClick={() => fetchMembers()} className="m-2 inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
            >
              Load More Members
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CommunityMembers;
