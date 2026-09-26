/**
 * Segment control (pill switcher) for picking one of N feeds.
 *
 * Themed to match hivesuite tokens (#262b30 / #3a424a / #e31337). Used by
 * <SnapsFeedView/> as the single mechanism for choosing which one feed is
 * mounted, at every viewport width (mobile through desktop).
 *
 * Active tab: logo + label text.
 * Inactive tabs: logo only (no label text) to save horizontal space when
 * there are several feeds in a single row.
 */
import type { ReactNode } from 'react';

export interface FeedSegmentOption {
  id: string;
  label: string;
  avatarUrl?: string;
  /**
   * Icon rendered in place of an avatar image for options that aren't
   * backed by a Hive account avatar (e.g. a "Tags" entry point). Unlike
   * the avatar-image tabs, both the icon and its label stay visible
   * whether or not the option is active, since there's no image to fall
   * back to when inactive.
   */
  icon?: ReactNode;
}

export interface FeedSegmentControlProps {
  options: FeedSegmentOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

export function FeedSegmentControl({
  options,
  value,
  onChange,
  className = '',
}: FeedSegmentControlProps) {
  return (
    <div
      className={`inline-flex rounded-lg border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] p-0.5 ${className}`}
      role="tablist"
      aria-label="Feed"
    >
      {options.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => onChange(opt.id)}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              isActive
                ? 'bg-[var(--hrk-brand)] text-white md:gap-2 md:px-3 md:py-1.5 md:text-sm'
                : 'text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-text-primary)]'
            }`}
          >
            {opt.avatarUrl ? (
              <img
                src={opt.avatarUrl}
                alt=""
                className={`shrink-0 rounded-full object-cover ${
                  isActive ? 'h-4 w-4 md:h-5 md:w-5' : 'h-5 w-5 md:h-5 md:w-5'
                }`}
              />
            ) : opt.icon ? (
              <span className="shrink-0 flex items-center">{opt.icon}</span>
            ) : null}
            {/* Avatar-backed tabs show label text only when active (to
                save horizontal space); icon-only options (no avatar)
                always show their label since there's no image to fall
                back to when inactive. */}
            {(isActive || (!opt.avatarUrl && !!opt.icon)) && opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default FeedSegmentControl;
