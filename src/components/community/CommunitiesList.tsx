/* eslint-disable react-hooks/exhaustive-deps */
/**
 * Hive communities directory — searchable, infinite-scrolling list backed
 * by `bridge.list_communities`.
 *
 * Theme: kit tokens (`--hrk-*`). Pass `theme="light"` for the legacy light
 *        variant; both variants share the same component structure.
 *
 * Search behaviour:
 *  - 350ms debounce on every keystroke (was: instant fire on ≥3 chars,
 *    which caused a flood of in-flight requests as the user typed).
 *  - Stale-response guard via a request-id counter. Only the latest fetch
 *    is allowed to write to state, so fast typing can't let an earlier
 *    response overwrite a later one.
 *  - Search query is sent when length ≥3 (bridge API constraint); shorter
 *    queries fall back to the unfiltered list.
 *  - Pagination state resets cleanly when the query changes.
 *
 * Scrolling: the list scrolls inside its own container (the parent decides
 * the height via `flex-1 overflow-hidden`); no global window-scroll
 * listener, so this drops cleanly into a dashboard layout.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Loader2, RefreshCw, Users2, X, Users } from "lucide-react";

import { communityService } from "../../services/communityService";
import { CommunityItem } from "../../types/community";
import { HiveLink } from "../common/HiveLink";

interface CommunitiesListProps {
  onSelectCommunity: (communityId: string) => void;
  /** When provided, each community row renders as a real <a href> so
   *  the browser offers "open in new tab" / Cmd-click. A plain left
   *  click is still intercepted and routed through `onSelectCommunity`. */
  getCommunityUrl?: (communityId: string) => string;
  /** Visual variant. Default `"dark"` — uses kit tokens. */
  theme?: "light" | "dark";
  /** When `true`, the component restores its last cached state (the
   *  loaded community list, the search query, the pagination cursor,
   *  and the scroll position) on mount — used for Back-navigation so
   *  tapping a community and then coming back lands the user on the
   *  same scroll offset. When omitted/false, the list starts fresh. */
  shouldRestoreScroll?: boolean;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;

// Module-level cache so navigating into a community detail and back
// rehydrates the directory without a fresh API roundtrip. Resets only
// when the user hits the Refresh button.
interface CommunitiesListCache {
  items: CommunityItem[];
  debouncedQuery: string;
  searchInput: string;
  hasMore: boolean;
  lastName: string | null;
  scrollTop: number;
}
let communitiesListCache: CommunitiesListCache | null = null;

/** Compact member-count formatter: 1234 → "1.2k", 12345 → "12.3k". */
function formatCount(n: number): string {
  if (!n || n < 1000) return String(n ?? 0);
  if (n < 1_000_000) {
    const k = n / 1000;
    return k >= 10 ? `${k.toFixed(0)}k` : `${k.toFixed(1)}k`;
  }
  const m = n / 1_000_000;
  return m >= 10 ? `${m.toFixed(0)}M` : `${m.toFixed(1)}M`;
}

const CommunitiesList = ({
  onSelectCommunity,
  getCommunityUrl,
  theme = "dark",
  shouldRestoreScroll = false,
}: CommunitiesListProps) => {
  const isDark = theme === "dark";

  // Hydrate from the module-level cache when the consumer signals a
  // Back-navigation (`shouldRestoreScroll`). For a forward visit we
  // start with an empty list so the user sees fresh data.
  const hydrated = shouldRestoreScroll ? communitiesListCache : null;

  const [communities, setCommunities] = useState<CommunityItem[]>(
    () => hydrated?.items ?? [],
  );
  const [searchInput, setSearchInput] = useState(() => hydrated?.searchInput ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(
    () => hydrated?.debouncedQuery ?? "",
  );
  const [isLoading, setIsLoading] = useState(() => !hydrated);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [hasMore, setHasMore] = useState(() => hydrated?.hasMore ?? true);
  const [error, setError] = useState<string | null>(null);

  const lastNameRef = useRef<string | null>(hydrated?.lastName ?? null);
  // Monotonically-increasing fetch id; the latest one wins. Earlier
  // responses that race in later are dropped on arrival.
  const fetchIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  // Skip the first auto-fetch when we hydrated from cache.
  const skipNextAutoFetchRef = useRef(!!hydrated);
  const pendingScrollRef = useRef<number | null>(hydrated?.scrollTop ?? null);

  // ── Debounce the input field ─────────────────────────────────────────
  // We debounce ALL keystrokes uniformly (350ms). Previously ≥3-char
  // queries fired instantly per keystroke, causing 8+ parallel requests
  // for a single word and the resulting flicker.
  useEffect(() => {
    if (searchInput === debouncedQuery) return;
    setIsDebouncing(true);
    const t = setTimeout(() => {
      setDebouncedQuery(searchInput);
      setIsDebouncing(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput, debouncedQuery]);

  // ── Fetch a page ─────────────────────────────────────────────────────
  const loadCommunities = useCallback(
    async (initial = false) => {
      if (!initial && (isLoadingMore || !hasMore)) return;

      const myFetchId = ++fetchIdRef.current;

      if (initial) {
        setIsLoading(true);
        setError(null);
        setCommunities([]);
        lastNameRef.current = null;
        setHasMore(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const q = debouncedQuery.trim();
        const apiQuery = q.length >= MIN_QUERY_LENGTH ? q : undefined;
        const result = await communityService.getListOfCommunities(
          apiQuery,
          PAGE_SIZE,
          initial ? undefined : lastNameRef.current || undefined,
        );

        // Stale-response guard: drop everything that arrives after a
        // newer fetch has been issued (e.g. user typed faster than the
        // network responded).
        if (myFetchId !== fetchIdRef.current) return;

        setCommunities((prev) => (initial ? result : [...prev, ...result]));

        const last = result[result.length - 1]?.name ?? null;
        if (
          result.length < PAGE_SIZE ||
          (last !== null && last === lastNameRef.current)
        ) {
          setHasMore(false);
        } else if (last) {
          lastNameRef.current = last;
        }
      } catch (err) {
        if (myFetchId !== fetchIdRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load communities");
        setHasMore(false);
      } finally {
        if (myFetchId === fetchIdRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [debouncedQuery, isLoadingMore, hasMore],
  );

  // ── Re-fetch from page 1 whenever the debounced query settles ─────────
  // Skipped on the first mount when we hydrated from the cache —
  // otherwise we'd throw away the restored list and immediately refetch.
  useEffect(() => {
    if (skipNextAutoFetchRef.current) {
      skipNextAutoFetchRef.current = false;
      return;
    }
    void loadCommunities(true);
  }, [debouncedQuery]);

  // Mirror state to the module-level cache on every change, so the
  // next Back-navigation has the latest list to rehydrate.
  useEffect(() => {
    communitiesListCache = {
      items: communities,
      debouncedQuery,
      searchInput,
      hasMore,
      lastName: lastNameRef.current,
      scrollTop: communitiesListCache?.scrollTop ?? 0,
    };
  }, [communities, debouncedQuery, searchInput, hasMore]);

  // Track scrollTop so the cache stays current. rAF-throttled so
  // scrolling stays smooth.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    let scheduled = false;
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        if (communitiesListCache) {
          communitiesListCache.scrollTop = node.scrollTop;
        }
      });
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => { node.removeEventListener("scroll", onScroll); };
  }, []);

  // Restore the cached scroll once items have rendered. rAF retry
  // loop because items lay out asynchronously (avatars + images load
  // a beat after the initial paint), so setting scrollTop too early
  // gets clamped to the smaller scrollHeight.
  useEffect(() => {
    const target = pendingScrollRef.current;
    if (target == null || communities.length === 0) return;
    if (target === 0) {
      const node = scrollRef.current;
      if (node) node.scrollTop = 0;
      pendingScrollRef.current = null;
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 120;
    const tryRestore = () => {
      if (cancelled) return;
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTop = target;
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll >= target || attempts >= MAX_ATTEMPTS) {
        pendingScrollRef.current = null;
        return;
      }
      attempts += 1;
      requestAnimationFrame(tryRestore);
    };
    requestAnimationFrame(tryRestore);
    return () => { cancelled = true; };
  }, [communities.length === 0 ? 0 : 1]);

  // ── Container-scoped infinite scroll ────────────────────────────────
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 200;
      if (nearBottom && !isLoadingMore && !isLoading && hasMore) {
        void loadCommunities();
      }
    },
    [loadCommunities, isLoadingMore, isLoading, hasMore],
  );

  const handleRefresh = () => {
    setSearchInput("");
    setDebouncedQuery("");
    // Reset the cached scroll position so the next mount lands at the
    // top even if a previous session had scrolled deep into the list.
    if (communitiesListCache) communitiesListCache.scrollTop = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    void loadCommunities(true);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    searchInputRef.current?.focus();
  };

  // ── Theme classes ────────────────────────────────────────────────────
  const cls = {
    root: isDark ? "bg-[var(--hrk-bg-app)]" : "bg-white",
    card: isDark
      ? "bg-[var(--hrk-bg-surface)] border-[var(--hrk-border-subtle)] hover:bg-[var(--hrk-bg-surface-raised)] hover:border-[var(--hrk-border-default)]"
      : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300",
    cardSkeleton: isDark
      ? "bg-[var(--hrk-bg-surface)] border-[var(--hrk-border-subtle)]"
      : "bg-white border-gray-200",
    skeletonBar: isDark ? "bg-[var(--hrk-bg-hover)]" : "bg-gray-200",
    input: isDark
      ? "bg-[var(--hrk-bg-surface)] border-[var(--hrk-border-default)] text-[var(--hrk-text-primary)] placeholder-[var(--hrk-text-tertiary)] focus:border-[var(--hrk-border-focus)] focus:ring-[var(--hrk-brand)]/30"
      : "bg-white border-gray-200 text-gray-900 placeholder-gray-500 focus:ring-blue-500/30",
    muted: isDark ? "text-[var(--hrk-text-tertiary)]" : "text-gray-500",
    secondary: isDark ? "text-[var(--hrk-text-secondary)]" : "text-gray-600",
    primary: isDark ? "text-[var(--hrk-text-primary)]" : "text-gray-900",
    iconBtn: isDark
      ? "border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] text-[var(--hrk-text-secondary)] hover:bg-[var(--hrk-bg-hover)] hover:text-[var(--hrk-text-primary)]"
      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900",
    counterPill: isDark
      ? "bg-[var(--hrk-bg-hover)] text-[var(--hrk-text-secondary)]"
      : "bg-gray-100 text-gray-700",
    emptyDisc: isDark
      ? "bg-[var(--hrk-bg-hover)] text-[var(--hrk-text-tertiary)]"
      : "bg-gray-100 text-gray-500",
  };

  // ── Sub-renders ──────────────────────────────────────────────────────
  const showSearchSpinner = isDebouncing || (isLoading && !!debouncedQuery);

  const SearchBar = (
    <div className="flex shrink-0 items-center gap-2">
      <div className="relative flex-1">
        {showSearchSpinner ? (
          <Loader2
            className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin ${cls.muted}`}
            aria-hidden
          />
        ) : (
          <Search
            className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${cls.muted}`}
            aria-hidden
          />
        )}
        <input
          ref={searchInputRef}
          type="text"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search communities…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search communities"
          className={`w-full rounded-[10px] border pl-9 pr-9 py-2 text-sm transition-colors focus:outline-none focus:ring-2 ${cls.input}`}
        />
        {searchInput && (
          <button
            type="button"
            onClick={handleClearSearch}
            aria-label="Clear search"
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 ${cls.muted} hover:text-[var(--hrk-text-primary)]`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <button
        onClick={handleRefresh}
        title="Refresh"
        aria-label="Refresh communities"
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition-colors ${cls.iconBtn}`}
      >
        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );

  const SearchHint = searchInput.length > 0 && searchInput.length < MIN_QUERY_LENGTH && (
    <p className={`text-xs ${cls.muted}`}>
      Type at least {MIN_QUERY_LENGTH} characters to search.
    </p>
  );

  const Skeleton = (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`rounded-[14px] border p-4 ${cls.cardSkeleton}`}>
          <div className="flex items-center gap-3.5">
            <div className={`h-11 w-11 rounded-full ${cls.skeletonBar} animate-pulse`} />
            <div className="flex-1 space-y-2">
              <div className={`h-3.5 w-2/5 rounded ${cls.skeletonBar} animate-pulse`} />
              <div className={`h-3 w-3/4 rounded ${cls.skeletonBar} animate-pulse opacity-70`} />
            </div>
            <div className={`h-5 w-14 rounded-full ${cls.skeletonBar} animate-pulse`} />
          </div>
        </div>
      ))}
    </div>
  );

  const isInitialEmpty = !isLoading && !error && communities.length === 0;

  return (
    <div
      className={`flex h-full min-h-0 flex-col gap-2.5 ${cls.root}`}
      aria-busy={isLoading || isDebouncing || undefined}
    >
      {SearchBar}
      {SearchHint}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5"
      >
        {isLoading && communities.length === 0 ? (
          Skeleton
        ) : error && communities.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${cls.emptyDisc}`}>
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${cls.primary}`}>
                Couldn't load communities
              </h3>
              <p className={`mt-1 text-xs ${cls.muted}`}>{error}</p>
            </div>
            <button
              onClick={handleRefresh}
              className={`inline-flex items-center gap-2 rounded-[10px] border px-3 py-1.5 text-xs font-medium transition-colors ${cls.iconBtn}`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : isInitialEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${cls.emptyDisc}`}>
              <Users2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${cls.primary}`}>
                {debouncedQuery ? "No communities match" : "No communities yet"}
              </h3>
              <p className={`mt-1 text-xs ${cls.muted}`}>
                {debouncedQuery
                  ? `Nothing found for "${debouncedQuery}". Try a different term.`
                  : "Check back later for new communities."}
              </p>
            </div>
            {debouncedQuery && (
              <button
                onClick={handleClearSearch}
                className={`inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-xs font-medium transition-colors ${cls.iconBtn}`}
              >
                <X className="h-3.5 w-3.5" />
                Clear search
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-2 pb-3" role="list" aria-label="Communities">
            {communities.map((community) => {
              const name = community.name || "";
              const title = community.title || name;
              const members = community.subscribers || 0;
              return (
                <li key={community.id ?? name}>
                  <HiveLink
                    href={getCommunityUrl?.(name)}
                    onActivate={() => onSelectCommunity(name)}
                    stopPropagation={false}
                    className={`group block w-full rounded-[14px] border p-3.5 text-left transition-colors ${cls.card}`}
                  >
                    <div className="flex items-center gap-3.5">
                      <img
                        src={communityService.communityIcon(name)}
                        alt=""
                        loading="lazy"
                        className="h-11 w-11 shrink-0 rounded-full bg-[var(--hrk-bg-hover)] object-cover ring-1 ring-[var(--hrk-border-subtle)]"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=random`;
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className={`truncate text-[15px] font-semibold tracking-tight ${cls.primary}`}>
                            {title}
                          </h3>
                          <span className={`shrink-0 text-[11px] ${cls.muted}`}>
                            @{name.replace(/^hive-/, "hive-")}
                          </span>
                        </div>
                        {community.about ? (
                          <p className={`mt-0.5 line-clamp-1 text-[13px] leading-relaxed ${cls.secondary}`}>
                            {community.about}
                          </p>
                        ) : (
                          <p className={`mt-0.5 text-[13px] italic ${cls.muted}`}>
                            No description
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${cls.counterPill}`}
                        title={`${members.toLocaleString()} members`}
                      >
                        <Users className="h-3 w-3" />
                        {formatCount(members)}
                      </span>
                    </div>
                  </HiveLink>
                </li>
              );
            })}

            {hasMore && (
              <li className="flex justify-center py-2">
                {isLoadingMore ? (
                  <div className={`flex items-center gap-2 text-xs ${cls.muted}`}>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading more…
                  </div>
                ) : (
                  <button
                    onClick={() => void loadCommunities()}
                    className={`inline-flex items-center justify-center rounded-[10px] border px-4 py-1.5 text-xs font-medium transition-colors ${cls.iconBtn}`}
                  >
                    Load more
                  </button>
                )}
              </li>
            )}
            {!hasMore && communities.length > 0 && (
              <li className={`pt-2 text-center text-[11px] ${cls.muted}`}>
                You've reached the end.
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CommunitiesList;
