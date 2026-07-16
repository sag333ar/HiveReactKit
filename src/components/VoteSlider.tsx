import { useEffect, useState } from "react";
import { ThumbsUp, X, Loader2, Heart } from "lucide-react";
import { calculateKERatio } from "@/services/userService";

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

// Mirrors hive-inbox's `config.curationChecks.maxKE` (default 3, env
// `CURATION_MAX_KE`) — an author whose lifetime rewards run this many times
// their own staked HP gets silently rejected server-side anyway, so the
// toggle is hidden up front rather than letting a curator spend a vote on
// a request that can never go through.
const MAX_AUTHOR_KE = 1.75;

const CURATION_SLIDER_CLASS =
  "w-full h-2 rounded-lg appearance-none cursor-pointer " +
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
  alreadyVoted = false,
  curatorOwnVoteWeight = 0,
  curationEligible = false,
  curationBotAlreadyVoted = false,
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
  /** True when the current user already voted on this content. Skips
   *  the vote-percent slider and "Vote" button entirely — there's
   *  nothing left to vote on — and shows only the curation-request
   *  section (when `curationEligible`), so a curator who already spent
   *  their own vote before deciding to curate still has a path in. */
  alreadyVoted?: boolean;
  /** The vote weight (0–100) the user already cast, when `alreadyVoted`.
   *  Reported alongside the curation request since there's no live
   *  slider value to capture in this mode. */
  curatorOwnVoteWeight?: number;
  /** Shows the curator-only curation-request UI. Callers resolve this
   *  from `isCurator && !!onCurationRequest && <not already curated> &&
   *  <content published via HiveSuite>` before rendering — this
   *  component has no opinion on eligibility, it just renders the
   *  option when told to (pending a fresh already-submitted check —
   *  see `onFetchCurationStatus` — and the author's KE ratio, checked
   *  internally against `MAX_AUTHOR_KE`). */
  curationEligible?: boolean;
  /** True when the curation bot (`sagarkothari88`) has already voted on
   *  this content. Unlike the other eligibility gates (checks 1-5 in
   *  `isCurationEligible`, postVotes.ts), this one is shown to the
   *  curator rather than silently hiding the option — the toggle/button
   *  is replaced with an explanatory message so it's clear why there's
   *  nothing to request. Caller computes this synchronously from
   *  `hasCurationVoterVoted(votes)` — no RPC needed. */
  curationBotAlreadyVoted?: boolean;
  /** Required when `curationEligible` — sizes the curation-weight
   *  slider's built-in default range before the server limit resolves. */
  curationType?: CurationType;
  /** Fired with the chosen curation weight and the curator's own vote
   *  weight. When not `alreadyVoted`, fired immediately after a
   *  successful vote, only when the curator switched the toggle on —
   *  voting and curation are deliberately one action, so a curator can't
   *  request curation without also spending their own vote. When
   *  `alreadyVoted`, it's the only action available, fired with
   *  `curatorOwnVoteWeight` as the already-cast vote weight. Either way
   *  the own-vote weight is forwarded so it can be recorded and reviewed
   *  (e.g. a curator voting 0.25% on their own while requesting 15% from
   *  the curation account is a visible red flag). */
  onCurationRequest?: (weight: number, ownVoteWeight: number) => void | Promise<void>;
  /** Looks up the server-configured max curation weight for
   *  `curationType`, plus whether this content was already submitted for
   *  curation by any curator. Called once, as soon as the slider opens
   *  (if `curationEligible`) — the curation UI only renders once this
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
  // Check 8 (see `isCurationEligible` in postVotes.ts for checks 1-6):
  // has this content already been submitted for curation by another
  // curator? Checked once up front (not on toggle-flip) so an
  // already-submitted piece of content never shows the toggle in the
  // first place. Runs independently/in parallel with check 7 below —
  // order between the two doesn't matter, only that both resolve before
  // the toggle can show.
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

  // Check 7: author's KE ratio (lifetime rewards ÷ own staked HP) — checked
  // once up front, same as check 8 above. A transient RPC failure fails
  // open (assume eligible) rather than blocking a legitimate request. To
  // disable this check entirely, replace the body of this effect with
  // just `setKeChecked(true);`.
  const [keChecked, setKeChecked] = useState(false);
  const [authorKEOk, setAuthorKEOk] = useState(true);

  useEffect(() => {
    if (!canRequestCuration) return;
    let cancelled = false;
    calculateKERatio(author)
      .then((result) => { if (!cancelled) setAuthorKEOk(result.ke <= MAX_AUTHOR_KE); })
      .catch(() => { /* RPC failure — fail open, assume eligible */ })
      .finally(() => { if (!cancelled) setKeChecked(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRequestCuration]);

  const eligibilityChecked = statusChecked && keChecked;
  // Normal flow: curation is an optional toggle alongside the vote.
  const showCurationToggle = !alreadyVoted && canRequestCuration && !curationBotAlreadyVoted && eligibilityChecked && !alreadySubmitted && authorKEOk;
  // Already-voted flow: curation (if eligible) is the ONLY action, so it's
  // always shown once resolved — no toggle needed.
  const showCurationOnly = alreadyVoted && canRequestCuration;
  // Native <input type="range"> maps [min, max] to [0%, 100%] of the
  // track — so the fill position must account for `range.min` too, not
  // just `curationWeight` itself, or it visibly lags/overshoots the thumb.
  const curationFillPct = curationMax > range.min
    ? ((curationWeight - range.min) / (curationMax - range.min)) * 100
    : 0;

  const handleVoteClick = async () => {
    if (percent === 0 || loading) return;
    setLoading(true);
    try {
      await onUpvote(percent); // wait until API resolves
      // Curation only ever follows a real vote — never on its own — so a
      // curator can't request curation without spending their own power.
      if (requestCuration && onCurationRequest) {
        await onCurationRequest(curationWeight, percent);
      }
    } finally {
      setLoading(false);
    }
  };

  // Already-voted flow — no vote to cast, just the curation request.
  // `onCurationRequest` always resolves (its app-level implementation
  // swallows its own errors — curation rejections are silent by design),
  // so unconditionally closing afterward matches how the normal flow's
  // curation toggle already behaves.
  const handleCurationOnlySubmit = async () => {
    if (!onCurationRequest || loading) return;
    setLoading(true);
    try {
      await onCurationRequest(curationWeight, curatorOwnVoteWeight);
    } finally {
      setLoading(false);
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 sm:items-center">
      <div className="bg-[var(--hrk-bg-surface-raised)] border border-[var(--hrk-border-default)] rounded-t-[16px] sm:rounded-[16px] w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-[var(--hrk-shadow-lg)] flex flex-col">
        {/* Header */}
        <h2 className="text-center text-base sm:text-lg font-semibold text-[var(--hrk-text-primary)] mb-2">
          {alreadyVoted ? <>Request curation for @{author}</> : <>Vote for @{author}</>}
        </h2>

        {!alreadyVoted && (
          <>
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

              {/* Slider — left side filled with the app's theme color */}
              <input
                type="range"
                min={minPercent}
                max={100}
                step={step}
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[var(--hrk-brand)] [&::-webkit-slider-runnable-track]:rounded-lg [&::-webkit-slider-runnable-track]:h-2 [&::-moz-range-track]:rounded-lg [&::-moz-range-track]:h-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--hrk-brand)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:-mt-1.5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--hrk-brand)] [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-progress]:bg-[var(--hrk-brand)] [&::-moz-range-progress]:rounded-lg"
                style={{
                  background: `linear-gradient(to right, var(--hrk-brand) ${percent}%, var(--hrk-border-default) ${percent}%)`,
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
            ? "text-[var(--hrk-brand)] font-bold"
            : "hover:text-[var(--hrk-brand-hover)] hover:bg-[var(--hrk-bg-surface-raised)]"
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
          </>
        )}

        {/* Curation bot already voted — nothing left to request. Shown
            synchronously (no RPC needed), so it takes priority over the
            KE-ratio/already-submitted checks below, which need a moment
            to resolve. */}
        {!alreadyVoted && canRequestCuration && curationBotAlreadyVoted && (
          <div className="mb-4 rounded-xl border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] p-3 text-sm text-[var(--hrk-text-tertiary)]">
            Content already upvoted by curators.
          </div>
        )}

        {/* Author's KE ratio is too high — tell the curator plainly why
            there's no toggle here rather than leaving them wondering. */}
        {!alreadyVoted && canRequestCuration && !curationBotAlreadyVoted && eligibilityChecked && !alreadySubmitted && !authorKEOk && (
          <div className="mb-4 rounded-xl border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] p-3 text-sm text-[var(--hrk-text-tertiary)]">
            @{author}'s KE ratio is over {MAX_AUTHOR_KE.toFixed(2)}, so curation requests aren't available right now. We may reconsider this author for curation in the future.
          </div>
        )}

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
                  style={{
                    background: `linear-gradient(to right, var(--hrk-brand) ${curationFillPct}%, var(--hrk-border-default) ${curationFillPct}%)`,
                  }}
                />
                <div className="flex justify-between text-[10px] text-[var(--hrk-text-tertiary)] mt-1">
                  <span>{range.min}%</span>
                  <span>{curationMax}%</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Already-voted flow — curation is the only action available. */}
        {showCurationOnly && (
          curationBotAlreadyVoted ? (
            <div className="mb-4 rounded-xl border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] p-4 text-center text-sm text-[var(--hrk-text-tertiary)]">
              Content already upvoted by curators.
            </div>
          ) : !eligibilityChecked ? (
            <div className="flex justify-center items-center py-6 mb-4">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--hrk-brand)]" />
            </div>
          ) : alreadySubmitted ? (
            <div className="mb-4 rounded-xl border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] p-4 text-center text-sm text-[var(--hrk-text-tertiary)]">
              This {curationType} has already been submitted for curation.
            </div>
          ) : !authorKEOk ? (
            <div className="mb-4 rounded-xl border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] p-4 text-center text-sm text-[var(--hrk-text-tertiary)]">
              @{author}'s KE ratio is over {MAX_AUTHOR_KE.toFixed(2)}, so curation requests aren't available right now. We may reconsider this author for curation in the future.
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] p-3">
              <p className="text-sm text-[var(--hrk-text-tertiary)] mb-3">
                You've already voted on this {curationType} — suggest a curation weight to the curators watching this feed.
              </p>
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
                disabled={loading}
                style={{
                  background: `linear-gradient(to right, var(--hrk-brand) ${curationFillPct}%, var(--hrk-border-default) ${curationFillPct}%)`,
                }}
              />
              <div className="flex justify-between text-[10px] text-[var(--hrk-text-tertiary)] mt-1">
                <span>{range.min}%</span>
                <span>{curationMax}%</span>
              </div>
            </div>
          )
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          {alreadyVoted ? (
            showCurationOnly && !curationBotAlreadyVoted && eligibilityChecked && !alreadySubmitted && authorKEOk && (
              <button
                onClick={handleCurationOnlySubmit}
                disabled={loading}
                className="flex-1 flex items-center justify-center rounded-full font-semibold transition
                  text-sm sm:text-base px-3 py-2 sm:px-4 sm:py-3 shadow
                  bg-[var(--hrk-brand)] hover:bg-[var(--hrk-brand-hover)] text-white disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-1 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
                    Request Curation
                  </>
                )}
              </button>
            )
          ) : (
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
          )}
          <button
            onClick={onCancel}
            disabled={loading} // prevent cancel during vote
            className="flex-1 flex items-center justify-center rounded-full font-semibold text-sm sm:text-base px-3 py-2 sm:px-4 sm:py-3 shadow
              bg-[var(--hrk-bg-surface-raised)] hover:bg-[var(--hrk-bg-hover)] text-white
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
            {alreadyVoted ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
