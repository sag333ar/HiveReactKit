import { createContext, useContext, useMemo, type ReactNode } from 'react';

export type SupporterTier = 'silver' | 'gold' | 'platinum';
export type SupporterTierMap = Record<string, SupporterTier>;

/*
 * Static ring/badge (Tailwind) + a shared pulse animation (plain CSS in
 * build.css: `.hrk-tier-ring` / `.hrk-tier-badge` + `.hrk-tier--{tier}`).
 * Pulse period: silver 5s, gold 2.5s, platinum 1s. Under
 * `prefers-reduced-motion: reduce` the animation is off and the static
 * Tailwind ring/border below is what shows.
 */
const TIER_RING: Record<SupporterTier, string> = {
  silver:   'ring-1 ring-slate-400 hrk-tier-ring hrk-tier--silver',
  gold:     'ring-2 ring-amber-400 hrk-tier-ring hrk-tier--gold',
  platinum: 'ring-[3px] ring-violet-400 hrk-tier-ring hrk-tier--platinum',
};

const TIER_BADGE: Record<SupporterTier, string> = {
  silver:   'bg-slate-400/15 text-slate-300 border border-slate-400/40 hrk-tier-badge hrk-tier--silver',
  gold:     'bg-amber-400/15 text-amber-300 border border-amber-400/40 hrk-tier-badge hrk-tier--gold',
  platinum: 'bg-violet-400/15 text-violet-200 border border-violet-400/40 hrk-tier-badge hrk-tier--platinum',
};

/** Pulse period per tier (ms) — mirrors `--hrk-tier-period` in build.css. */
export const SUPPORTER_PULSE_PERIOD_MS: Record<SupporterTier, number> = {
  silver: 5000,
  gold: 2500,
  platinum: 1000,
};

interface SupporterTierContextValue {
  tierMap: SupporterTierMap;
}

const SupporterTierContext = createContext<SupporterTierContextValue>({ tierMap: {} });

export function SupporterTierProvider({
  tierMap,
  children,
}: {
  tierMap: SupporterTierMap;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ tierMap }), [tierMap]);
  return (
    <SupporterTierContext.Provider value={value}>
      {children}
    </SupporterTierContext.Provider>
  );
}

/** Use in list components to avoid per-item hook calls inside map(). */
export function useSupporterTierMap(): SupporterTierMap {
  return useContext(SupporterTierContext).tierMap;
}

/** Use in single-author components (SnapsFeedCard, CommentTile, etc.). */
export function useSupporterTier(username: string): SupporterTier | undefined {
  return useContext(SupporterTierContext).tierMap[username];
}

/** Returns the ring className for avatar border, or the fallback if no tier. */
export function getSupporterRing(tier: SupporterTier | undefined, fallback = ''): string {
  return tier ? TIER_RING[tier] : fallback;
}

/** Returns the badge className for username highlight, or '' if no tier. */
export function getSupporterBadge(tier: SupporterTier | undefined): string {
  return tier ? TIER_BADGE[tier] : '';
}
