import { useState, useEffect, useCallback, useRef } from "react";
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

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  const fetchMembers = useCallback(
    async (refresh = false) => {
      if (loadingRef.current && !refresh) return;
      loadingRef.current = true;
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
        // Use bridge.list_subscribers (the full subscriber roster).
        // The earlier call to `getCommunitySubscribers` hit
        // bridge.list_community_roles, which only returns the ~300-400
        // people who have an assigned role (admin / mod / guest) and
        // missed the bulk of the membership.
        const newMembers = await communityService.getCommunitySubscribersList(
          communityId,
          pageSize,
          refresh ? undefined : last || undefined,
        );
        if (newMembers.length === 0) {
          setHasMore(false);
        } else {
          // Drop the duplicate first row some nodes return when the
          // `last` cursor matches the final subscriber from the
          // previous page.
          const fresh = !refresh && last && newMembers[0]?.username === last
            ? newMembers.slice(1)
            : newMembers;
          setMembers((prev) => {
            if (refresh) return fresh;
            const existingUsernames = new Set(prev.map((m) => m.username));
            return [...prev, ...fresh.filter((m) => !existingUsernames.has(m.username))];
          });
          const nextCursor = fresh[fresh.length - 1]?.username;
          if (!nextCursor || nextCursor === last) {
            setHasMore(false);
          } else {
            setLast(nextCursor);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load members");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [communityId, last],
  );

  useEffect(() => {
    fetchMembers(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  // Scroll-driven pagination: bind to the sentinel and to the
  // nearest scrollable ancestor so the auto-load works whether the
  // page scrolls inside `window` or inside a tab/panel container.
  useEffect(() => {
    if (!hasMore || loading) return;
    const node = sentinelRef.current;
    if (!node) return;

    const findScrollableAncestor = (start: HTMLElement | null): HTMLElement | null => {
      let el: HTMLElement | null = start?.parentElement || null;
      while (el && el !== document.body && el !== document.documentElement) {
        const { overflowY } = window.getComputedStyle(el);
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    };

    const root = findScrollableAncestor(node);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingRef.current) {
          fetchMembers();
        }
      },
      { root, rootMargin: '400px 0px' },
    );
    observer.observe(node);

    const checkNearBottom = () => {
      if (loadingRef.current) return;
      const scroller = root ?? document.scrollingElement ?? document.documentElement;
      const scrollTop = root ? (root as HTMLElement).scrollTop : window.scrollY;
      const viewport = root ? (root as HTMLElement).clientHeight : window.innerHeight;
      const total = scroller.scrollHeight;
      if (total - (scrollTop + viewport) < 400) {
        fetchMembers();
      }
    };
    const scrollTarget: EventTarget = root ?? window;
    scrollTarget.addEventListener('scroll', checkNearBottom, { passive: true } as AddEventListenerOptions);

    return () => {
      observer.disconnect();
      scrollTarget.removeEventListener('scroll', checkNearBottom);
    };
  }, [fetchMembers, hasMore, loading]);

  if (loading && members.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-[var(--hrk-text-tertiary)]">
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
          <h3 className="text-lg font-semibold text-[var(--hrk-text-primary)] mb-2">
            Failed to load members
          </h3>
          <p className="text-[var(--hrk-text-tertiary)] mb-4">{error}</p>
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
        <p className="text-[var(--hrk-text-tertiary)]">
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
            className="bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)] rounded-xl p-4 transition-colors duration-150 ease-out hover:bg-[var(--hrk-bg-surface-raised)] hover:border-[var(--hrk-border-default)] cursor-pointer"
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
                <h3 className="font-semibold text-[var(--hrk-text-primary)] truncate">
                  @{member.username}
                </h3>
                {member.role && (
                  <p className="text-sm text-[var(--hrk-text-tertiary)] capitalize truncate">
                    {member.role}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      )}

      {hasMore && loadingMore && (
        <div className="flex justify-center pt-2 text-[var(--hrk-text-tertiary)]">
          <span className="inline-flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading more members...
          </span>
        </div>
      )}
    </div>
  );
};

export default CommunityMembers;
