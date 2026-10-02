/**
 * FeedPickerBottomSheet — mobile entry point for picking one of the named
 * feeds (or jumping into the trending-tags sheet) when there are too many
 * options for a horizontal pill row to stay usable.
 *
 * Modeled closely on `TagsBottomSheet` (same open/close/backdrop/animation
 * pattern, same visual chrome) so the two sheets feel like one family.
 * Rows mirror `SnapsFeedSidebarNav`'s active-row styling (solid brand
 * background + white text) since that's the closest existing "list of
 * feed options" treatment in the kit.
 *
 * When the host opts into mixed sources (`mixSources`), mixable rows
 * render a checkbox (same behavior as the desktop sidebar) so mixing
 * Snaps / Waves / Moments is not desktop-only. Radio rows (Threads /
 * Hangs / Following / Tags) still close the sheet on select.
 */
import { Check, X } from 'lucide-react';
import type { FeedSegmentOption } from './FeedSegmentControl';

export interface SnapsSheetMixSource {
  id: string;
  checked: boolean;
}

export interface FeedPickerBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  options: FeedSegmentOption[];
  value: string;
  onSelect: (id: string) => void;
  mixSources?: SnapsSheetMixSource[];
  mixActive?: boolean;
  onMixToggle?: (id: string, checked: boolean) => void;
  onMixActivate?: (id: string) => void;
}

export function FeedPickerBottomSheet({
  isOpen,
  onClose,
  options,
  value,
  onSelect,
  mixSources,
  mixActive = false,
  onMixToggle,
  onMixActivate,
}: FeedPickerBottomSheetProps) {
  if (!isOpen) return null;

  const mixById = new Map((mixSources ?? []).map((s) => [s.id, s]));

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
          <h3 className="text-sm font-semibold text-[var(--hrk-text-primary)]">Choose a feed</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--hrk-text-tertiary)] hover:bg-[var(--hrk-bg-hover)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-1">
          {options.map((opt) => {
            const mixEntry = mixById.get(opt.id);
            const isMixable = !!mixEntry;

            if (isMixable) {
              const isActive = mixActive && mixEntry.checked;
              return (
                <div
                  key={opt.id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--hrk-bg-hover)] text-[var(--hrk-text-primary)]'
                      : 'text-[var(--hrk-text-secondary)] hover:bg-[var(--hrk-bg-hover)] hover:text-[var(--hrk-text-primary)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onMixActivate?.(opt.id)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    {opt.avatarUrl ? (
                      <img src={opt.avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                    ) : opt.icon ? (
                      <span className="shrink-0 flex items-center">{opt.icon}</span>
                    ) : null}
                    <span className="truncate flex-1">{opt.label}</span>
                  </button>
                  <input
                    type="checkbox"
                    checked={mixEntry.checked}
                    onChange={(e) => onMixToggle?.(opt.id, e.target.checked)}
                    aria-label={`Include ${opt.label} in mixed feed`}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--hrk-brand)]"
                  />
                </div>
              );
            }

            const isActive = value === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelect(opt.id)}
                aria-current={isActive ? 'true' : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--hrk-brand)] text-white'
                    : 'text-[var(--hrk-text-secondary)] hover:bg-[var(--hrk-bg-hover)] hover:text-[var(--hrk-text-primary)]'
                }`}
              >
                {opt.avatarUrl ? (
                  <img src={opt.avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                ) : opt.icon ? (
                  <span className="shrink-0 flex items-center">{opt.icon}</span>
                ) : null}
                <span className="truncate flex-1">{opt.label}</span>
                {isActive && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default FeedPickerBottomSheet;
