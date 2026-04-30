/**
 * SnapsFeedList — vertical list of <SnapsFeedCard/> with skeleton, empty,
 * and "Load more" states. Used by <SnapsFeedView/> for each column.
 */
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

const SnapsFeedList = ({
  posts,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  emptyMessage = 'Nothing to show.',
  ...cardProps
}: SnapsFeedListProps) => {
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

      {hasMore && onLoadMore && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-md border border-[#3a424a] bg-[#262b30] px-4 py-2 text-sm text-[#e7e7f1] hover:bg-[#2f353d] disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </>
            ) : (
              'Load more'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default SnapsFeedList;
