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
  <div className="overflow-hidden rounded-xl border border-[#3a424a] bg-[#262b30] animate-pulse">
    <div className="flex items-center gap-3 px-4 pt-4 pb-2">
      <div className="h-9 w-9 shrink-0 rounded-full bg-[#2f353d]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-1/3 rounded bg-[#3a424a]" />
        <div className="h-2.5 w-1/4 rounded bg-[#2f353d]" />
      </div>
    </div>
    <div className="space-y-2 px-4 pb-3">
      <div className="h-3.5 w-3/4 rounded bg-[#3a424a]" />
      <div className="h-3 w-full rounded bg-[#3a424a]/70" />
      <div className="h-32 w-full rounded-lg bg-[#2f353d]/70" />
      <div className="h-3 w-4/5 rounded bg-[#3a424a]/70" />
    </div>
    <div className="flex gap-3 border-t border-[#3a424a]/60 px-4 py-2.5">
      <div className="h-3 w-10 rounded bg-[#2f353d]" />
      <div className="h-3 w-10 rounded bg-[#2f353d]" />
      <div className="h-3 w-10 rounded bg-[#2f353d]" />
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

  // Callback ref: attach the IntersectionObserver the moment the
  // sentinel mounts in the DOM, and tear it down when it unmounts.
  // This is more robust than `useEffect(..., [])` because the sentinel
  // is conditionally rendered — when the list starts in a loading
  // state the sentinel doesn't exist yet, so a one-time effect would
  // miss attaching the observer entirely.
  const observerRef = useRef<IntersectionObserver | null>(null);
  const setSentinel = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!node) return;
    const root = findScrollAncestor(node);
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (loadingMoreRef.current) return;
        if (!hasMoreRef.current) return;
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
        <p className="text-sm text-[#9ca3b0]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <SnapsFeedCard
          key={`${post.author}/${post.permlink}`}
          post={post}
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
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-[#9ca3b0]">
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
