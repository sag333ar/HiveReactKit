/**
 * SnapsFeedSidebarNav — desktop left-rail vertical list of named Snaps
 * feed types (Snaps/Waves/Threads/Moments/Hangs/Following).
 *
 * Replaces the old top pill-switcher's job on desktop only — mobile
 * keeps the horizontal pill row or the dropdown sheet. Still exactly
 * one *body* active at a time; `activeFeed` is null when a trending tag
 * or the mixed timeline is showing, so no radio row highlights.
 *
 * When the host opts into mixed sources (`mixSources`), the mixable
 * rows (typically Snaps / Waves / Moments) render a checkbox instead of
 * radio-selecting a single feed. Toggling a checkbox updates the mix;
 * clicking Threads / Hangs / Following still selects that one feed.
 */
import type { FeedSegmentOption } from './FeedSegmentControl';

export interface SnapsSidebarMixSource {
  id: string;
  checked: boolean;
}

export interface SnapsFeedSidebarNavProps {
  options: FeedSegmentOption[];
  activeFeed: string | null;
  onSelect: (id: string) => void;
  className?: string;
  /** Mixable feed ids + their current checked state. Omit for radio-only. */
  mixSources?: SnapsSidebarMixSource[];
  /** True when the mixed timeline (not a single named feed) is showing. */
  mixActive?: boolean;
  /** Toggle one mix source. Host + parent guard against an empty mix. */
  onMixToggle?: (id: string, checked: boolean) => void;
  /** Activate the mixed timeline, optionally ensuring this source is on. */
  onMixActivate?: (id: string) => void;
}

export function SnapsFeedSidebarNav({
  options,
  activeFeed,
  onSelect,
  className = '',
  mixSources,
  mixActive = false,
  onMixToggle,
  onMixActivate,
}: SnapsFeedSidebarNavProps) {
  const mixById = new Map((mixSources ?? []).map((s) => [s.id, s]));

  return (
    <nav className={`flex flex-col gap-1 ${className}`} aria-label="Feed">
      {options.map((opt) => {
        const mixEntry = mixById.get(opt.id);
        const isMixable = !!mixEntry;
        const isActive = isMixable ? mixActive && mixEntry.checked : activeFeed === opt.id;

        if (isMixable) {
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
                <span className="truncate">{opt.label}</span>
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
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default SnapsFeedSidebarNav;
