/**
 * SnapsFeedList — vertical list of <SnapsFeedCard/> with skeleton, empty,
 * and end-of-list states. Uses an IntersectionObserver sentinel for
 * infinite scroll: when the sentinel scrolls into view, `onLoadMore` is
 * triggered. The closest scrolling ancestor is auto-detected so the list
 * works whether the page itself scrolls or a parent container does.
 */
import { useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import type { Post } from '@/types/post';
import SnapsFeedCard from './SnapsFeedCard';
import type { SnapsFeedCardProps } from './SnapsFeedCard';

export interface SnapsFeedListProps
  extends Omit<SnapsFeedCardProps, 'post'> {
  posts: Post[];
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  emptyMessage?: string;
}

const Skeleton = () => (
  <div className="overflow-hidden rounded-xl border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] animate-pulse">
    <div className="flex items-center gap-3 px-4 pt-4 pb-2">
      <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--hrk-bg-hover)]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-1/3 rounded bg-[var(--hrk-border-default)]" />
        <div className="h-2.5 w-1/4 rounded bg-[var(--hrk-bg-hover)]" />
      </div>
    </div>
    <div className="space-y-2 px-4 pb-3">
      <div className="h-3.5 w-3/4 rounded bg-[var(--hrk-border-default)]" />
      <div className="h-3 w-full rounded bg-[var(--hrk-border-default)]/70" />
      <div className="h-32 w-full rounded-lg bg-[var(--hrk-bg-hover)]/70" />
      <div className="h-3 w-4/5 rounded bg-[var(--hrk-border-default)]/70" />
    </div>
    <div className="flex gap-3 border-t border-[var(--hrk-border-default)]/60 px-4 py-2.5">
      <div className="h-3 w-10 rounded bg-[var(--hrk-bg-hover)]" />
      <div className="h-3 w-10 rounded bg-[var(--hrk-bg-hover)]" />
      <div className="h-3 w-10 rounded bg-[var(--hrk-bg-hover)]" />
    </div>
  </div>
);

/**
 * Walks up from `el` looking for the nearest ancestor that scrolls
 * vertically. Returns the document/viewport (`null`) if none is found —
 * which is the right value to pass as `root` to IntersectionObserver.
 */
function findScrollAncestor(el: HTMLElement | null): Element | null {
  let cur: HTMLElement | null = el?.parentElement ?? null;
  while (cur && cur !== document.body && cur !== document.documentElement) {
    const style = window.getComputedStyle(cur);
    const overflowY = style.overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return cur;
    }
    cur = cur.parentElement;
  }
  return null;
}

const SnapsFeedList = ({
  posts,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  emptyMessage = 'Nothing to show.',
  ...cardProps
}: SnapsFeedListProps) => {
  // Hold the latest values in refs so the IntersectionObserver callback
  // doesn't need to be recreated on every render (which would re-trigger
  // an immediate `onLoadMore` call each time the sentinel re-mounts and
  // is already visible).
  const onLoadMoreRef = useRef(onLoadMore);
  const loadingMoreRef = useRef(!!loadingMore);
  const hasMoreRef = useRef(!!hasMore);
  onLoadMoreRef.current = onLoadMore;
  loadingMoreRef.current = !!loadingMore;
  hasMoreRef.current = !!hasMore;

  // Cooldown guard against a self-sustaining auto-pagination loop.
  // `loadingMoreRef` only covers the window while a fetch is actually
  // in flight — the instant it resolves (often well under 100ms on a
  // fast/local API), the sentinel can still be sitting inside the
  // 400px margin because the freshly-appended cards' images/embeds
  // haven't finished laying out yet, so the observer fires again
  // immediately.
  const lastLoadAtRef = useRef(0);
  const LOAD_COOLDOWN_MS = 400;

  // Second, stronger guard: after the very first automatic page (which
  // is expected — it's what lets a short initial feed fill the screen
  // before the user has scrolled at all), every SUBSEQUENT auto-load
  // requires a genuine `scroll` event to have fired on the intersection
  // root since the last one. Measured empirically on this exact
  // sentinel: without this, navigating straight to a feed and never
  // touching the scrollbar could still blow through dozens of pages
  // (hundreds of posts, dozens of iframes/videos) in a couple of
  // seconds — the cooldown above slows that down but doesn't stop it,
  // because the sentinel can apparently keep re-reporting as
  // intersecting across many cooldown windows in a row (root sizing /
  // layout-thrash edge cases). Tying further pages to an actual scroll
  // event decouples "how many pages load" from network speed / layout
  // timing entirely, and ties it to what the user actually did.
  const hasAutoLoadedOnceRef = useRef(false);
  const scrolledSinceLastLoadRef = useRef(false);

  // Callback ref: attach the IntersectionObserver the moment the
  // sentinel mounts in the DOM, and tear it down when it unmounts.
  // This is more robust than `useEffect(..., [])` because the sentinel
  // is conditionally rendered — when the list starts in a loading
  // state the sentinel doesn't exist yet, so a one-time effect would
  // miss attaching the observer entirely.
  const observerRef = useRef<IntersectionObserver | null>(null);
  const scrollCleanupRef = useRef<(() => void) | null>(null);
  const setSentinel = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (scrollCleanupRef.current) {
      scrollCleanupRef.current();
      scrollCleanupRef.current = null;
    }
    if (!node) return;
    const root = findScrollAncestor(node);
    // Fresh sentinel instance (new mount, e.g. switching feeds) — reset
    // both gates so the new list gets its one "free" fill-the-screen
    // auto-load.
    hasAutoLoadedOnceRef.current = false;
    scrolledSinceLastLoadRef.current = false;
    const scrollTarget: EventTarget = root ?? window;
    const onUserScroll = () => { scrolledSinceLastLoadRef.current = true; };
    scrollTarget.addEventListener('scroll', onUserScroll, { passive: true } as AddEventListenerOptions);
    scrollCleanupRef.current = () => scrollTarget.removeEventListener('scroll', onUserScroll);
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (loadingMoreRef.current) return;
        if (!hasMoreRef.current) return;
        if (hasAutoLoadedOnceRef.current && !scrolledSinceLastLoadRef.current) return;
        const now = Date.now();
        if (now - lastLoadAtRef.current < LOAD_COOLDOWN_MS) return;
        lastLoadAtRef.current = now;
        hasAutoLoadedOnceRef.current = true;
        scrolledSinceLastLoadRef.current = false;
        onLoadMoreRef.current?.();
      },
      // 400 px head-start triggers the next page well before the user
      // hits the very bottom — keeps long scrolls feeling continuous.
      { root, rootMargin: '400px 0px', threshold: 0 },
    );
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  if (loading && posts.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} />)}
      </div>
    );
  }

  if (!loading && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-[var(--hrk-text-tertiary)]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <SnapsFeedCard
          key={`${post.author}/${post.permlink}`}
          post={post}
          contextPosts={cardProps.contextPosts || posts}
          {...cardProps}
        />
      ))}

      {/* Sentinel + spinner. The empty <div> is what the
          IntersectionObserver watches; the spinner only appears while
          the next page is being fetched so the user gets feedback.
          Only render the sentinel while there's more to load — once
          hasMore flips to false the observer disconnects via the
          callback ref. */}
      {hasMore && <div ref={setSentinel} aria-hidden="true" className="h-1" />}
      {hasMore && loadingMore && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-[var(--hrk-text-tertiary)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      )}
      {!hasMore && posts.length > 0 && (
        <div className="py-4 text-center text-xs text-[#6b7280]">No more posts</div>
      )}
    </div>
  );
};

export default SnapsFeedList;
