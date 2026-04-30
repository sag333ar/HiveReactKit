/**
 * Segment control (pill switcher) for picking one of N feeds.
 *
 * Themed to match hivesuite tokens (#262b30 / #3a424a / #e31337). Used by
 * <SnapsFeedView/> in tablet (2-col) layouts where each column lets the
 * user toggle between two feeds.
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
      className={`inline-flex rounded-lg border border-[#3a424a] bg-[#262b30] p-0.5 ${className}`}
      role="tablist"
      aria-label="Feed"
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors md:gap-2 md:px-3 md:py-1.5 md:text-sm ${
            value === opt.id
              ? 'bg-[#e31337] text-white'
              : 'text-[#9ca3b0] hover:text-[#f0f0f8]'
          }`}
        >
          {opt.avatarUrl && (
            <img
              src={opt.avatarUrl}
              alt=""
              className="h-4 w-4 shrink-0 rounded-full object-cover md:h-5 md:w-5"
            />
          )}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default FeedSegmentControl;
