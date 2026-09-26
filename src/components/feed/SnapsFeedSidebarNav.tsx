/**
 * SnapsFeedSidebarNav — desktop left-rail vertical list of the 5 named
 * Snaps feed types (Snaps/Waves/Threads/Moments/Hangs).
 *
 * Replaces the old top pill-switcher's job on desktop only — mobile
 * keeps the horizontal pill row (`<FeedSegmentControl/>`). Still exactly
 * one feed active at a time; `activeFeed` is null when a trending tag is
 * the active selection instead, so no row highlights (mutual exclusion
 * is visible in the UI itself).
 */
import type { FeedSegmentOption } from './FeedSegmentControl';

export interface SnapsFeedSidebarNavProps {
  options: FeedSegmentOption[];
  activeFeed: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

export function SnapsFeedSidebarNav({
  options,
  activeFeed,
  onSelect,
  className = '',
}: SnapsFeedSidebarNavProps) {
  return (
    <nav className={`flex flex-col gap-1 ${className}`} aria-label="Feed">
      {options.map((opt) => {
        const isActive = activeFeed === opt.id;
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
            {opt.avatarUrl && (
              <img src={opt.avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
            )}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default SnapsFeedSidebarNav;
