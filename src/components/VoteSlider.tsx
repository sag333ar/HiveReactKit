import { useEffect, useState } from "react";
import { ThumbsUp, X, Loader2, Heart } from "lucide-react";

type CurationType = 'post' | 'snap' | 'comment';

interface CurationStatus {
  maxWeight: number;
  alreadySubmitted: boolean;
}

const CURATION_RANGE: Record<CurationType, { min: number; max: number; default: number }> = {
  post:    { min: 1, max: 15, default: 8 },
  snap:    { min: 1, max: 6,  default: 3 },
  comment: { min: 1, max: 3,  default: 2 },
};

const CURATION_SLIDER_CLASS =
  "w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--hrk-bg-surface-raised)] " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--hrk-brand)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white " +
  "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--hrk-brand)] [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-progress]:bg-[var(--hrk-brand)] [&::-moz-range-progress]:rounded-lg";

export function VoteSlider({
  author,
  permlink,
  defaultValue = 100,
  step = 1,
  onUpvote,
  onCancel,
  awaitingWalletApproval = false,
  walletApprovalLabel = 'Open Keychain App & Approve',
  curationEligible = false,
  curationType,
  onCurationRequest,
  onFetchCurationStatus,
}: {
  author: string;
  permlink: string;
  defaultValue?: number;
  /** Slider precision. Use 0.25, 0.5, or 1 (default 1). */
  step?: number;
  onUpvote: (percent: number) => Promise<void> | void; // allow async
  onCancel: () => void;
  /** Set true when the logged-in user is on a wallet provider
   *  (Keychain, HiveAuth, PeakVault). While the broadcast is in
   *  flight the slider surfaces a blinking "Open Keychain App &
   *  Approve" hint so the user knows to switch apps to authorize. */
  awaitingWalletApproval?: boolean;
  /** Override for the wallet-approval hint text. */
  walletApprovalLabel?: string;
  /** Shows the curator-only "Request curation" toggle below the vote
   *  slider. Callers resolve this from `isCurator && !!onCurationRequest
   *  && <not already curated> && <content published via HiveSuite>`
   *  before rendering — this component has no opinion on eligibility,
   *  it just renders the toggle when told to (pending a fresh
   *  already-submitted check — see `onFetchCurationStatus`). */
  curationEligible?: boolean;
  /** Required when `curationEligible` — sizes the curation-weight
   *  slider's built-in default range before the server limit resolves. */
  curationType?: CurationType;
  /** Fired with the chosen curation weight immediately after a
   *  successful vote, only when the curator switched the toggle on.
   *  Voting and curation are deliberately one action — a curator can no
   *  longer request curation without also spending their own vote. */
  onCurationRequest?: (weight: number) => void | Promise<void>;
  /** Looks up the server-configured max curation weight for
   *  `curationType`, plus whether this content was already submitted for
   *  curation by any curator. Called once, as soon as the slider opens
   *  (if `curationEligible`) — the toggle only renders once this
   *  resolves, and stays hidden entirely when `alreadySubmitted` is
   *  true, so a curator never sees an option that would just silently
   *  fail as a duplicate. */
  onFetchCurationStatus?: (author: string, permlink: string, type: CurationType) => Promise<CurationStatus>;
}) {
  // Slider's lower bound matches the configured step — 0.25 → 0.25%,
  // 0.5 → 0.5%, 1 → 1%. Was hardcoded to 1, which trapped fractional-
  // step users above 1% once they dragged up past it.
  const minPercent = step;
  const [percent, setPercent] = useState(Math.max(defaultValue, minPercent));
  const [loading, setLoading] = useState(false);
  const stops = [minPercent, ...Array.from({ length: 10 }, (_, i) => (i + 1) * 10)];
  const decimals = step >= 1 ? 0 : step >= 0.5 ? 1 : 2;

  const canRequestCuration = curationEligible && !!curationType && !!onCurationRequest;
  const range = curationType ? CURATION_RANGE[curationType] : CURATION_RANGE.post;
  const [requestCuration, setRequestCuration] = useState(false);
  const [curationWeight, setCurationWeight] = useState(range.default);
  const [curationMax, setCurationMax] = useState(range.max);
  // Checked once up front (not on toggle-flip) so an already-submitted
  // piece of content never shows the toggle in the first place.
  const [statusChecked, setStatusChecked] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    if (!canRequestCuration) return;
    if (!onFetchCurationStatus || !curationType) {
      setStatusChecked(true);
      return;
    }
    let cancelled = false;
    onFetchCurationStatus(author, permlink, curationType)
      .then((status) => {
        if (cancelled) return;
        setAlreadySubmitted(!!status.alreadySubmitted);
        if (Number.isFinite(status.maxWeight) && status.maxWeight > 0) {
          setCurationMax(status.maxWeight);
          setCurationWeight((w) => Math.min(w, status.maxWeight));
        }
      })
      .catch(() => { /* keep the built-in default range, assume not yet submitted */ })
      .finally(() => { if (!cancelled) setStatusChecked(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRequestCuration]);

  const showCurationToggle = canRequestCuration && statusChecked && !alreadySubmitted;

  const handleVoteClick = async () => {
    if (percent === 0 || loading) return;
    setLoading(true);
    try {
      await onUpvote(percent); // wait until API resolves
      // Curation only ever follows a real vote — never on its own — so a
      // curator can't request curation without spending their own power.
      if (requestCuration && onCurationRequest) {
        await onCurationRequest(curationWeight);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 sm:items-center">
      <div className="bg-[var(--hrk-bg-surface-raised)] border border-[var(--hrk-border-default)] rounded-t-[16px] sm:rounded-[16px] w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-[var(--hrk-shadow-lg)] flex flex-col">
        {/* Header */}
        <h2 className="text-center text-base sm:text-lg font-semibold text-[var(--hrk-text-primary)] mb-2">
          Vote for @{author}
        </h2>

        {/* Wallet-approval hint — only visible while the broadcast
            is in flight on a wallet provider. */}
        {loading && awaitingWalletApproval && (
          <p className="mb-4 text-center text-xs sm:text-sm font-medium text-amber-400 animate-pulse">
            {walletApprovalLabel}
          </p>
        )}
        {!(loading && awaitingWalletApproval) && <div className="mb-4" />}

        {/* Slider Section */}
        <div className="relative w-full flex flex-col items-center mb-6">
          {/* Floating bubble with percent */}
          <div
            className="absolute -top-8 left-0"
            style={{ left: `${percent}%`, transform: "translateX(-50%)" }}
          >
            <div className="bg-[var(--hrk-brand)] text-white text-xs sm:text-sm px-2 py-1 rounded-lg shadow">
              {percent.toFixed(decimals)}%
            </div>
            <div className="mx-auto w-2 h-2 bg-[var(--hrk-brand)] rotate-45 -mt-1"></div>
          </div>

          {/* Slider — left side filled with blue */}
          <input
            type="range"
            min={minPercent}
            max={100}
            step={step}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600 [&::-webkit-slider-runnable-track]:rounded-lg [&::-webkit-slider-runnable-track]:h-2 [&::-moz-range-track]:rounded-lg [&::-moz-range-track]:h-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--hrk-brand)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:-mt-1.5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--hrk-brand)] [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-progress]:bg-[var(--hrk-brand)] [&::-moz-range-progress]:rounded-lg"
            style={{
              background: `linear-gradient(to right, var(--hrk-info) ${percent}%, var(--hrk-border-default) ${percent}%)`,
            }}
          />

          {/* Stop Labels */}
          <div className="flex justify-between w-full mt-3 ml-2 text-[10px] sm:text-xs text-[var(--hrk-text-tertiary)]">
            {stops.map((stop) => (
              <button
                type="button"
                key={stop}
                onClick={() => setPercent(stop)}
                className={`focus:outline-none px-1 rounded transition
        ${
          percent === stop
            ? "text-blue-600 font-bold"
            : "hover:text-blue-700 hover:bg-[var(--hrk-bg-surface-raised)]"
        }`}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {stop}
              </button>
            ))}
          </div>
        </div>

        {/* Curation toggle — curators only, and only once a fresh check
            confirms this content hasn't already been submitted by any
            curator. Requesting curation is folded into the same "Vote"
            action below rather than a separate button, so a curator
            can't request curation without also spending their own vote. */}
        {showCurationToggle && (
          <div className="mb-4 rounded-xl border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] p-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--hrk-text-primary)]">
                <Heart className="w-4 h-4 text-[var(--hrk-brand)]" />
                Request curation
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={requestCuration}
                onClick={() => setRequestCuration((v) => !v)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  requestCuration ? 'bg-[var(--hrk-brand)]' : 'bg-[var(--hrk-bg-surface-raised)]'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    requestCuration ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </label>

            {requestCuration && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs uppercase tracking-wide text-[var(--hrk-text-tertiary)]">
                    Curation weight
                  </span>
                  <span className="text-sm font-semibold text-[var(--hrk-brand)] tabular-nums">
                    {curationWeight}%
                  </span>
                </div>
                <input
                  type="range"
                  min={range.min}
                  max={curationMax}
                  step={1}
                  value={curationWeight}
                  onChange={(e) => setCurationWeight(Number(e.target.value))}
                  className={CURATION_SLIDER_CLASS}
                />
                <div className="flex justify-between text-[10px] text-[var(--hrk-text-tertiary)] mt-1">
                  <span>{range.min}%</span>
                  <span>{curationMax}%</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleVoteClick}
            disabled={percent === 0 || loading}
            className={`flex-1 flex items-center justify-center rounded-full font-semibold transition
              text-sm sm:text-base px-3 py-2 sm:px-4 sm:py-3 shadow
              ${
                percent === 0 || loading
                  ? "bg-[var(--hrk-bg-surface-raised)] text-[var(--hrk-text-tertiary)] cursor-not-allowed"
                  : "bg-[var(--hrk-brand)] hover:bg-[var(--hrk-brand-hover)] text-white"
              }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-1 animate-spin" />
                Voting...
              </>
            ) : (
              <>
                <ThumbsUp className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
                {requestCuration ? 'Vote & Request Curation' : 'Vote'}
              </>
            )}
          </button>
          <button
            onClick={onCancel}
            disabled={loading} // prevent cancel during vote
            className="flex-1 flex items-center justify-center rounded-full font-semibold text-sm sm:text-base px-3 py-2 sm:px-4 sm:py-3 shadow
              bg-[var(--hrk-bg-surface-raised)] hover:bg-[var(--hrk-bg-hover)] text-white
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
