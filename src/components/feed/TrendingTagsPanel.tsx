/**
 * TrendingTagsPanel — list of trending-tag buttons shared by the Snaps
 * page's desktop right rail and the mobile tags bottom sheet.
 *
 * Purely presentational: the host app owns fetching the tag list (see
 * `SnapsFeedView`'s `trendingTags`/`trendingTagsLoading` props) and what
 * "select a tag" means (usually: make that tag the single active feed).
 */
import { Hash } from 'lucide-react';

export interface SnapsTrendingTag {
  tag: string;
  /** Optional post/author count shown as a small trailing badge. */
  count?: number;
}

export interface TrendingTagsPanelProps {
  tags: SnapsTrendingTag[];
  loading?: boolean;
  /** Currently-selected tag (selection.kind === 'tag'), or null/undefined
   *  when a named feed is active instead — highlights the matching row. */
  activeTag?: string | null;
  onSelectTag: (tag: string) => void;
  className?: string;
  /** Cap how many tags are rendered (defaults to all provided). */
  limit?: number;
}

export function TrendingTagsPanel({
  tags,
  loading,
  activeTag,
  onSelectTag,
  className = '',
  limit,
}: TrendingTagsPanelProps) {
  const visible = typeof limit === 'number' ? tags.slice(0, limit) : tags;

  if (loading && visible.length === 0) {
    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-full animate-pulse rounded-lg bg-[var(--hrk-bg-hover)]" />
        ))}
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <p className={`text-xs italic text-[var(--hrk-text-tertiary)] ${className}`}>
        No trending tags right now.
      </p>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {visible.map((t) => {
        const isActive = activeTag === t.tag;
        return (
          <button
            key={t.tag}
            type="button"
            onClick={() => onSelectTag(t.tag)}
            aria-pressed={isActive}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
              isActive
                ? 'bg-[var(--hrk-brand)] text-white'
                : 'text-[var(--hrk-text-secondary)] hover:bg-[var(--hrk-bg-hover)] hover:text-[var(--hrk-text-primary)]'
            }`}
          >
            <Hash className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white' : 'text-[var(--hrk-text-tertiary)]'}`} />
            <span className="truncate">{t.tag}</span>
            {typeof t.count === 'number' && (
              <span
                className={`ml-auto shrink-0 text-[10px] tabular-nums ${
                  isActive ? 'text-white/80' : 'text-[var(--hrk-text-tertiary)]'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default TrendingTagsPanel;
