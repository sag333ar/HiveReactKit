import { useState } from 'react';
import { Heart } from 'lucide-react';

interface CurationButtonProps {
  author: string;
  permlink: string;
  type: 'post' | 'snap' | 'comment';
  onCurationRequest: (author: string, permlink: string, weight: number) => void | Promise<void>;
}

const TYPE_RANGE = {
  post:    { min: 1, max: 15, default: 8 },
  snap:    { min: 1, max: 6,  default: 3 },
  comment: { min: 1, max: 3,  default: 2 },
};

export function CurationButton({ author, permlink, type, onCurationRequest }: CurationButtonProps) {
  const range = TYPE_RANGE[type];
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState(range.default);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onCurationRequest(author, permlink, weight);
      setDone(true);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <button className="flex items-center gap-1 text-pink-400 p-0.5" title="Curated">
        <Heart className="w-4 h-4 fill-current" />
      </button>
    );
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex items-center gap-1 text-gray-400 hover:text-pink-400 transition-colors p-0.5"
        title="Curate — request an upvote"
      >
        <Heart className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[var(--hrk-bg-card)] border border-[var(--hrk-border-default)] rounded-lg p-3 shadow-xl z-50 w-48"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs text-[var(--hrk-text-muted)] mb-2">
            Your request:{' '}
            <span className="font-semibold text-[var(--hrk-text-primary)]">{weight}%</span>
            <span className="text-[10px] ml-1">({range.min}–{range.max}%)</span>
          </div>
          <input
            type="range"
            min={range.min}
            max={range.max}
            step={1}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="w-full accent-pink-500 mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 text-xs bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white rounded-md py-1.5 transition-colors"
            >
              {submitting ? '…' : 'Curate'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-[var(--hrk-text-muted)] hover:text-[var(--hrk-text-primary)] transition-colors px-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
