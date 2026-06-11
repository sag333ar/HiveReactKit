/**
 * Segment control (pill switcher) for picking one of N feeds.
 *
 * Themed to match hivesuite tokens (#262b30 / #3a424a / #e31337). Used by
 * <SnapsFeedView/> in tablet (2-col) layouts where each column lets the
 * user toggle between two feeds.
 *
 * Active tab: logo + label text.
 * Inactive tabs: logo only (no label text) to save horizontal space when
 * there are 6 feeds in a single row.
 */
export interface FeedSegmentOption {
  id: string;
  label: string;
  avatarUrl?: string;
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
            {opt.avatarUrl && (
              <img
                src={opt.avatarUrl}
                alt=""
                className={`shrink-0 rounded-full object-cover ${
                  isActive ? 'h-4 w-4 md:h-5 md:w-5' : 'h-5 w-5 md:h-5 md:w-5'
                }`}
              />
            )}
            {/* Show label text only for the active tab */}
            {isActive && opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default FeedSegmentControl;
