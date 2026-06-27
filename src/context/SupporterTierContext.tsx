import { createContext, useContext, useMemo, type ReactNode } from 'react';

export type SupporterTier = 'silver' | 'gold' | 'platinum';
export type SupporterTierMap = Record<string, SupporterTier>;

const TIER_RING: Record<SupporterTier, string> = {
  silver:   'ring-1 ring-slate-400',
  gold:     'ring-2 ring-amber-400',
  platinum: 'ring-[3px] ring-violet-400',
};

const TIER_BADGE: Record<SupporterTier, string> = {
  silver:   'bg-slate-400/15 text-slate-300 border border-slate-400/40',
  gold:     'bg-amber-400/15 text-amber-300 border border-amber-400/40',
  platinum: 'bg-violet-400/15 text-violet-200 border border-violet-400/40',
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
