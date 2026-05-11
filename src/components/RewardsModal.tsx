/**
 * RewardsModal — opens from the post's "Hive value" chip in the
 * action bar and displays the post's payout split:
 *
 *   1. Top panel — liquid HBD payout (when percent_hbd > 0) and the
 *      total Hive Power; payout countdown / paid-out marker.
 *   2. Curators (50%) — their HBD and Hive Power cut; in 100% PU
 *      mode, only the HP line is shown.
 *   3. Author (50%) — same breakdown, then a per-beneficiary list
 *      (with the actual HBD/HP amount each beneficiary receives)
 *      and the author's own net take after the deductions.
 *
 * The HBD↔Hive median price is fetched once from
 * `condenser_api.get_current_median_history_price` when the modal
 * opens; a conservative fallback keeps the numbers meaningful while
 * the network round-trip resolves.
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { userService } from '@/services/userService';

export interface RewardsModalBeneficiary {
  account: string;
  /** Hive `weight` field: 1 unit = 0.01% (10000 = 100%). */
  weight: number;
}

export interface RewardsModalPayoutDetails {
  /** Sum of pending payout in HBD-equivalent units. */
  pendingValue: number;
  authorValue: number;
  curatorValue: number;
  /** Final/total realised payout once `isPaidout` is true. */
  totalValue: number;
  isPaidout: boolean;
  /** ISO timestamp when payout will occur (only meaningful when not yet paid). */
  payoutAt?: string;
  /** Hive `percent_hbd` field: 10000 = 50/50 HBD/HP, 0 = 100% Powered Up. */
  percentHbd: number;
  beneficiaries: RewardsModalBeneficiary[];
}

interface RewardsModalProps {
  onClose: () => void;
  details: RewardsModalPayoutDetails;
  /** Optional avatar URL builder for beneficiary rows. Defaults to
   *  `https://images.hive.blog/u/<account>/avatar`. */
  avatarUrlFn?: (account: string) => string;
  /** URL for the small Hive icon shown next to payout totals. */
  hiveIconUrl?: string;
}

function formatRemaining(iso: string): string | null {
  // Hive timestamps come back without a `Z` (UTC) suffix — without
  // it the browser parses them as local time and the countdown
  // drifts by the user's timezone offset. Append `Z` if no offset
  // is already present.
  const tagged = /Z|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const diffMs = new Date(tagged).getTime() - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remainHours = diffHours % 24;
  if (diffDays > 0) {
    return `in ${diffDays} day${diffDays > 1 ? 's' : ''}${remainHours > 0 ? ` ${remainHours} hour${remainHours > 1 ? 's' : ''}` : ''}`;
  }
  return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
}

const FALLBACK_HBD_PER_HIVE = 0.134; // ~ 1 HBD ≈ 7.46 Hive when feed is unavailable.

export function RewardsModal({ onClose, details, avatarUrlFn, hiveIconUrl }: RewardsModalProps) {
  const { pendingValue, authorValue, curatorValue, totalValue, isPaidout, payoutAt, percentHbd, beneficiaries } = details;

  // HBD-per-Hive ratio from `get_current_median_history_price`.
  // Seeded with a conservative fallback so the modal renders
  // meaningful numbers even before the network round-trip resolves.
  const [hbdPerHive, setHbdPerHive] = useState<number>(FALLBACK_HBD_PER_HIVE);
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const apiUrl = (userService as unknown as { HIVE_API_URL: string }).HIVE_API_URL
          ?? 'https://api.hive.blog';
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'condenser_api.get_current_median_history_price',
            params: [],
          }),
          signal: ac.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        const base = parseFloat(String(data?.result?.base ?? '').split(' ')[0]);
        const quote = parseFloat(String(data?.result?.quote ?? '').split(' ')[0]) || 1;
        if (Number.isFinite(base) && base > 0) {
          setHbdPerHive(base / quote);
        }
      } catch {
        // keep the fallback
      }
    })();
    return () => ac.abort();
  }, []);

  const hbdToHive = (hbd: number) => (hbdPerHive > 0 ? hbd / hbdPerHive : 0);

  const totalHbd = isPaidout
    ? totalValue
    : (pendingValue > 0 ? pendingValue : authorValue + curatorValue);
  const isPoweredUp = percentHbd === 0;

  // Chain convention: `percent_hbd` runs 0..10000, where 10000 is
  // the default "50% HBD / 50% HP" split (not 100% HBD!) and 0 is
  // "100% Powered Up". The HBD fraction of the total payout is
  // therefore `percent_hbd / 20000` (0.5 for the default, 0 for
  // power-up).
  const hbdFraction = percentHbd / 20000;
  const hpFraction = 1 - hbdFraction;

  // Top-panel totals.
  //   • `totalHbdLiquid` is the actual HBD that lands on chain —
  //     half of the post's "total payout" headline by default,
  //     zero in 100% Power-Up mode.
  //   • `totalHpHive` is the Hive Power equivalent of the HP slice
  //     of the payout. Half of the chain's pending value in default
  //     mode, the full value in 100% PU.
  const totalHbdLiquid = totalHbd * hbdFraction;
  const totalHpHive = hbdToHive(totalHbd) * hpFraction;

  // Per-party split — curators and author each get 50%.
  const perPartyHbd = totalHbdLiquid * 0.5;
  const perPartyHpHive = totalHpHive * 0.5;

  // Beneficiary slice of the author's share. Beneficiaries do NOT
  // affect curators — they come off the author's HBD + HP cuts
  // proportionally to their `weight` (1 unit = 0.01%).
  const totalBeneficiaryWeight = (beneficiaries ?? []).reduce(
    (acc, b) => acc + (b.weight || 0),
    0,
  );
  const beneficiaryRows = (beneficiaries ?? []).map((b) => {
    const fraction = (b.weight || 0) / 10000;
    return {
      account: b.account,
      weight: b.weight,
      pct: (b.weight || 0) / 100,
      hbd: perPartyHbd * fraction,
      hpHive: perPartyHpHive * fraction,
    };
  });
  const authorNetFraction = Math.max(0, 1 - totalBeneficiaryWeight / 10000);
  const authorNetHbd = perPartyHbd * authorNetFraction;
  const authorNetHpHive = perPartyHpHive * authorNetFraction;

  const modeLabel = isPoweredUp
    ? 'Hive Rewards · 100% Powered Up'
    : `Hive Rewards · ${(hbdFraction * 100).toFixed(0)}% HBD / ${((1 - hbdFraction) * 100).toFixed(0)}% HP`;

  const remaining = !isPaidout && payoutAt ? formatRemaining(payoutAt) : null;

  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const fmt = (n: number) => n.toFixed(3);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-3 sm:px-4 h-screen"
      onClick={onOverlayClick}
    >
      <div
        className="relative bg-[#1f2429] rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden border border-[#3a424a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#3a424a] bg-[#1a1e22]/80 px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base sm:text-lg font-semibold text-white">Rewards</h2>
            <p className="truncate text-[11px] text-[#9ca3b0]">{modeLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#9ca3b0] transition-colors hover:bg-[#2f353d] hover:text-[#f0f0f8]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Total panel — liquid HBD (when applicable) + total Hive Power. */}
        <div className="border-b border-[#3a424a] px-5 py-4 space-y-2">
          {!isPoweredUp && (
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[#9ca3b0]">HBD (liquid)</div>
                <div className="text-[10px] text-[#7c8694]">Hive Backed Dollars paid out</div>
              </div>
              <span className="text-xl font-semibold text-emerald-400 tabular-nums">
                {fmt(totalHbdLiquid)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-[#9ca3b0]">
                {isPoweredUp ? 'Total Hive Power' : 'Hive Power Total'}
              </div>
              <div className="text-[10px] text-[#7c8694]">
                {isPoweredUp ? '100% of payout staked as HP' : 'Staked Hive paid out'}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-semibold text-emerald-400 tabular-nums">
                {fmt(totalHpHive)}
              </span>
              {hiveIconUrl && (
                <img src={hiveIconUrl} alt="" className="h-4 w-4 rounded-full" aria-hidden />
              )}
            </div>
          </div>
          <div className="pt-1 text-xs text-[#9ca3b0]">
            {isPaidout ? 'Paid out' : remaining ? `Payout ${remaining}` : 'Pending'}
          </div>
        </div>

        {/* Curators (50%) + Author (50%) breakdown */}
        <div className="space-y-3 overflow-y-auto px-5 py-4 text-sm">
          <PartyCard
            label="Curators (50%)"
            isPoweredUp={isPoweredUp}
            hbd={perPartyHbd}
            hpHive={perPartyHpHive}
            hbdFraction={hbdFraction}
            fmt={fmt}
          />

          <div className="rounded-lg border border-[#3a424a] bg-[#262b30] p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#e7e7f1]">
              <span>Author (50%)</span>
              {totalBeneficiaryWeight > 0 && (
                <span className="text-[10px] font-normal text-[#9ca3b0]">
                  − {(totalBeneficiaryWeight / 100).toFixed(2)}% to beneficiaries
                </span>
              )}
            </div>

            {/* Gross author share (before beneficiary cuts) */}
            {totalBeneficiaryWeight > 0 && (
              <div className="mb-2 text-[10px] uppercase tracking-wide text-[#7c8694]">
                Gross share
              </div>
            )}
            {isPoweredUp ? (
              <Row
                label="Hive Power"
                value={`${fmt(perPartyHpHive)} Hive Power`}
                subtle="100% as Hive Power"
              />
            ) : (
              <>
                <Row
                  label="HBD"
                  value={`${fmt(perPartyHbd)} HBD`}
                  subtle={`${(hbdFraction * 100).toFixed(0)}% as HBD`}
                />
                <Row
                  label="Hive Power"
                  value={`${fmt(perPartyHpHive)} Hive Power`}
                  subtle={`${((1 - hbdFraction) * 100).toFixed(0)}% as Hive Power`}
                />
              </>
            )}

            {/* Beneficiaries — each row shows the actual HBD/HP slice
                they receive, computed from the author's share. */}
            {beneficiaryRows.length > 0 && (
              <>
                <div className="my-2 border-t border-[#3a424a]" />
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[#7c8694]">
                  Beneficiaries take their cut
                </div>
                <ul className="space-y-1.5">
                  {beneficiaryRows.map((b) => (
                    <li
                      key={`${b.account}-${b.weight}`}
                      className="flex items-center gap-2.5 rounded-md bg-[#1f2429]/60 px-2 py-1.5"
                    >
                      <img
                        src={(avatarUrlFn ?? ((a) => `https://images.hive.blog/u/${a}/avatar`))(b.account)}
                        alt={b.account}
                        className="h-7 w-7 shrink-0 rounded-full bg-gray-700"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${b.account}&background=random`;
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs text-white">{b.account}</span>
                          <span className="shrink-0 text-[10px] font-medium text-[#9ca3b0]">
                            {b.pct.toFixed(2)}%
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0 text-[10px] text-[#9ca3b0]">
                          {!isPoweredUp && b.hbd > 0 && (
                            <span className="tabular-nums">{fmt(b.hbd)} HBD</span>
                          )}
                          {b.hpHive > 0 && (
                            <span className="tabular-nums">{fmt(b.hpHive)} Hive Power</span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Author's net take after beneficiary deductions */}
                <div className="my-2 border-t border-[#3a424a]" />
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[#7c8694]">
                  Author take (net)
                </div>
                {isPoweredUp ? (
                  <Row
                    label="Hive Power"
                    value={`${fmt(authorNetHpHive)} Hive Power`}
                    bold
                  />
                ) : (
                  <>
                    <Row label="HBD" value={`${fmt(authorNetHbd)} HBD`} bold />
                    <Row label="Hive Power" value={`${fmt(authorNetHpHive)} Hive Power`} bold />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PartyCardProps {
  label: string;
  isPoweredUp: boolean;
  hbd: number;
  hpHive: number;
  hbdFraction: number;
  fmt: (n: number) => string;
}

const PartyCard: React.FC<PartyCardProps> = ({ label, isPoweredUp, hbd, hpHive, hbdFraction, fmt }) => {
  return (
    <div className="rounded-lg border border-[#3a424a] bg-[#262b30] p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#e7e7f1]">{label}</div>
      {isPoweredUp ? (
        <Row
          label="Hive Power"
          value={`${fmt(hpHive)} Hive Power`}
          subtle="100% as Hive Power"
          bold
        />
      ) : (
        <>
          <Row
            label="HBD"
            value={`${fmt(hbd)} HBD`}
            subtle={`${(hbdFraction * 100).toFixed(0)}% as HBD`}
          />
          <Row
            label="Hive Power"
            value={`${fmt(hpHive)} Hive Power`}
            subtle={`${((1 - hbdFraction) * 100).toFixed(0)}% as Hive Power`}
          />
        </>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; subtle?: string; bold?: boolean }> = ({ label, value, subtle, bold }) => (
  <div className="flex items-start justify-between gap-2 py-0.5">
    <div className="min-w-0">
      <div className="text-[#9ca3b0]">{label}</div>
      {subtle && <div className="text-[10px] text-[#7c8694]">{subtle}</div>}
    </div>
    <span className={`shrink-0 tabular-nums ${bold ? 'text-white font-semibold' : 'text-[#e7e7f1]'}`}>
      {value}
    </span>
  </div>
);

export default RewardsModal;
