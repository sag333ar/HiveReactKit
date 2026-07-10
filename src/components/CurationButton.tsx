import { useState } from 'react';
import { Heart, X } from 'lucide-react';

type CurationType = 'post' | 'snap' | 'comment';

interface CurationStatus {
  maxWeight: number;
  alreadySubmitted: boolean;
}

interface CurationButtonProps {
  author: string;
  permlink: string;
  type: CurationType;
  onCurationRequest: (author: string, permlink: string, weight: number) => void | Promise<void>;
  /** Looks up the max slider weight for this content type, plus whether
   *  it's already been submitted for curation by any curator. Checked
   *  fresh every time the modal opens. */
  onFetchCurationStatus?: (author: string, permlink: string, type: CurationType) => Promise<CurationStatus>;
}

const TYPE_RANGE: Record<CurationType, { min: number; max: number; default: number }> = {
  post:    { min: 1, max: 15, default: 8 },
  snap:    { min: 1, max: 6,  default: 3 },
  comment: { min: 1, max: 3,  default: 2 },
};

const TYPE_LABEL: Record<CurationType, string> = {
  post: 'post',
  snap: 'snap',
  comment: 'comment',
};

const SLIDER_CLASS =
  "w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--hrk-bg-surface)] disabled:opacity-50 " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--hrk-brand)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md " +
  "[&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--hrk-brand)] [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-progress]:bg-[var(--hrk-brand)] [&::-moz-range-progress]:rounded-lg";

/**
 * Fallback curation entry point — for curators who already spent their
 * own vote on this content (before the curation feature existed, or
 * simply voted before deciding to curate). The vote slider's "Request
 * curation" toggle can't help there since it never reopens once you've
 * voted, so this is a separate, vote-free trigger.
 *
 * Only ever rendered by the caller when: `isCurator && onCurationRequest
 * && isHiveSuiteContent(...) && !hasCurationVoterVoted(...) &&
 * hasUserVoted(votes, currentUser)` — i.e. exactly the case the merged
 * vote-slider flow can't cover.
 */
export function CurationButton({ author, permlink, type, onCurationRequest, onFetchCurationStatus }: CurationButtonProps) {
  const range = TYPE_RANGE[type];
  const [open, setOpen] = useState(false);
  const [max, setMax] = useState(range.max);
  const [weight, setWeight] = useState(range.default);
  const [statusChecked, setStatusChecked] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function openModal() {
    setOpen(true);
    if (!onFetchCurationStatus) {
      setStatusChecked(true);
      return;
    }
    setStatusChecked(false);
    onFetchCurationStatus(author, permlink, type)
      .then((status) => {
        setAlreadySubmitted(!!status.alreadySubmitted);
        if (Number.isFinite(status.maxWeight) && status.maxWeight > 0) {
          setMax(status.maxWeight);
          setWeight((w) => Math.min(w, status.maxWeight));
        }
      })
      .catch(() => { /* assume not yet submitted, keep the built-in default range */ })
      .finally(() => setStatusChecked(true));
  }

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

  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !submitting) setOpen(false);
  };

  if (done) {
    return (
      <button className="flex items-center gap-1 text-[var(--hrk-brand)] p-0.5" title="Curated">
        <Heart className="w-4 h-4 fill-current" />
      </button>
    );
  }

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); openModal(); }}
        className="flex items-center gap-1 text-gray-400 hover:text-[var(--hrk-brand)] transition-colors p-0.5"
        title="Curate — request an upvote"
      >
        <Heart className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-3 sm:px-4 h-screen"
          onClick={onOverlayClick}
        >
          <div
            className="relative bg-[var(--hrk-bg-surface-sunken)] rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden border border-[var(--hrk-border-default)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface-sunken)]/80 px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex items-center gap-2 min-w-0">
                <Heart className="h-4 w-4 shrink-0 text-[var(--hrk-brand)]" />
                <h2 className="truncate text-base sm:text-lg font-semibold text-white">
                  Curate this {TYPE_LABEL[type]}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--hrk-text-tertiary)] transition-colors hover:bg-[var(--hrk-bg-hover)] hover:text-[var(--hrk-text-primary)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            {!statusChecked ? (
              <div className="flex justify-center items-center py-10">
                <span className="w-6 h-6 border-2 border-[var(--hrk-brand)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : alreadySubmitted ? (
              <div className="px-5 py-8 text-center text-sm text-[var(--hrk-text-tertiary)]">
                This {TYPE_LABEL[type]} has already been submitted for curation.
              </div>
            ) : (
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm text-[var(--hrk-text-tertiary)]">
                  You've already voted on this {TYPE_LABEL[type]} — suggest a curation weight to the curators watching this feed.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-[var(--hrk-text-tertiary)]">
                    Your request
                  </span>
                  <span className="text-xl font-semibold text-[var(--hrk-brand)] tabular-nums">
                    {weight}%
                  </span>
                </div>
                <input
                  type="range"
                  min={range.min}
                  max={max}
                  step={1}
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className={SLIDER_CLASS}
                  disabled={submitting}
                />
                <div className="flex justify-between text-[11px] text-[var(--hrk-text-tertiary)]">
                  <span>{range.min}%</span>
                  <span>{max}%</span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-[var(--hrk-border-default)] px-5 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded-lg text-[var(--hrk-text-tertiary)] hover:bg-[var(--hrk-bg-hover)] hover:text-[var(--hrk-text-primary)] transition-colors disabled:opacity-50"
              >
                {statusChecked && alreadySubmitted ? 'Close' : 'Cancel'}
              </button>
              {!(statusChecked && alreadySubmitted) && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !statusChecked}
                  className="px-4 py-2 text-sm font-medium bg-[var(--hrk-brand)] hover:bg-[var(--hrk-brand-hover)] disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {submitting ? 'Submitting…' : 'Curate'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
