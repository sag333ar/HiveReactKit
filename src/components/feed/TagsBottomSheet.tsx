/**
 * TagsBottomSheet — mobile entry point for picking a trending tag as the
 * single active Snaps feed.
 *
 * Design rationale (mobile UX for "5 feed types + N trending tags, but
 * only one shown at a time"): rather than cramming N extra tag pills
 * into the already-scrollable feed switcher row, the row gets ONE more
 * entry ("Tags" — or the active tag's own chip once one is selected)
 * that opens this sheet. It reuses the exact same `<TrendingTagsPanel/>`
 * list the desktop right rail shows, so behavior stays consistent
 * between breakpoints — only the container chrome differs.
 */
import { X } from 'lucide-react';
import { TrendingTagsPanel, type SnapsTrendingTag } from './TrendingTagsPanel';

export interface TagsBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tags: SnapsTrendingTag[];
  loading?: boolean;
  activeTag?: string | null;
  onSelectTag: (tag: string) => void;
}

export function TagsBottomSheet({
  isOpen,
  onClose,
  tags,
  loading,
  activeTag,
  onSelectTag,
}: TagsBottomSheetProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--hrk-text-primary)]">Trending tags</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--hrk-text-tertiary)] hover:bg-[var(--hrk-bg-hover)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <TrendingTagsPanel
          tags={tags}
          loading={loading}
          activeTag={activeTag}
          onSelectTag={(tag) => {
            onSelectTag(tag);
            onClose();
          }}
        />
      </div>
    </div>
  );
}

export default TagsBottomSheet;
