import { useEffect, useState } from 'react';
import { TrendingUp, X, Info } from 'lucide-react';
import { calculateKERatio, type KERatioResult } from '@/services/userService';

interface KERatioBadgeProps {
  username: string;
  /** Hide the inline badge while loading (useful when sitting in a meta strip). */
  hideWhileLoading?: boolean;
  className?: string;
}

/** Color the badge based on how high the KE ratio is. Higher KE = the account
 *  has earned a lot relative to its own staked HP, which is often considered
 *  less healthy by curators. The buckets here are a soft heuristic, not a
 *  strict on-chain rule. */
function colorForKE(ke: number): string {
  if (ke < 1) return 'text-emerald-400';
  if (ke < 2) return 'text-yellow-400';
  if (ke < 3) return 'text-orange-400';
  return 'text-red-400';
}

function formatHP(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

/**
 * Small clickable badge showing an account's KE ratio. Opens a details modal
 * with the underlying numbers and a plain-language explanation of the metric.
 *
 *   ke = (posting_rewards + curation_rewards in HP) / own_HP
 *
 * Meant to live inline next to other account meta (VP, HP) on the profile
 * header, so it inherits a similar visual treatment.
 */
const KERatioBadge = ({
  username,
  hideWhileLoading = false,
  className = '',
}: KERatioBadgeProps) => {
  const [result, setResult] = useState<KERatioResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!username) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    calculateKERatio(username, controller.signal)
      .then((r) => setResult(r))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load KE ratio');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [username]);

  if (loading) {
    if (hideWhileLoading) return null;
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] text-gray-400 ${className}`}
      >
        <TrendingUp className="h-3 w-3 opacity-60" />
        KE …
      </span>
    );
  }
  if (error || !result) return null;

  const tone = colorForKE(result.ke);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 drop-shadow-md text-[11px] sm:text-xs text-gray-200 hover:text-white transition-colors ${className}`}
        aria-label={`KE ratio ${result.ke.toFixed(2)}. Tap for details.`}
      >
        <TrendingUp className={`h-3 w-3 ${tone}`} />
        KE {result.ke.toFixed(2)}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-xl w-full mx-4 max-w-md max-h-[90vh] overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label={`KE ratio details for @${username}`}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <TrendingUp className={`h-5 w-5 ${tone}`} />
                <h2 className="text-base font-semibold text-white">
                  KE Ratio — @{username}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-64px)] px-5 py-4 space-y-4">
              <div className="text-center">
                <div className={`text-4xl font-bold ${tone}`}>
                  {result.ke.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  posting + curation rewards relative to effective HP
                </div>
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-950/50 divide-y divide-gray-800">
                <div className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-gray-400">Effective Hive Power</span>
                  <span className="font-mono text-gray-100">
                    {formatHP(result.currentHP)} HP
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-gray-400">Posting rewards</span>
                  <span className="font-mono text-gray-100">
                    {result.postingRewards.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-gray-400">Curation rewards</span>
                  <span className="font-mono text-gray-100">
                    {result.curationRewards.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-sm bg-gray-900/60">
                  <span className="text-gray-300 font-medium">Total rewards</span>
                  <span className="font-mono font-semibold text-gray-100">
                    {result.totalRewards.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-3 text-xs text-gray-300 leading-relaxed">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
                  <div className="space-y-2">
                    <p>
                      <span className="font-semibold text-gray-100">
                        Formula:
                      </span>{' '}
                      <span className="font-mono text-blue-200">
                        (posting_rewards + curation_rewards in HP) ÷ own_HP
                      </span>
                    </p>
                    <p>
                      Own HP is the account&apos;s vesting_shares — received
                      delegations and delegations-out are excluded, so the
                      ratio reflects whether the account keeps its earnings
                      staked. Matches the value shown on peakd.com.
                    </p>
                    <p className="text-gray-400">
                      Lower is generally considered healthier for curators. The
                      heuristic colors here (green &lt; 1, yellow &lt; 2, orange &lt; 3,
                      red ≥ 3) are a soft guide, not a strict rule.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KERatioBadge;
