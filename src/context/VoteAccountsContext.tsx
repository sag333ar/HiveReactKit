import { createContext, useContext, type ReactNode } from 'react';

/**
 * App-wide multi-account voting. When the host provides 2+ accounts and a
 * `voteFromAccounts` handler, every upvote slider in the kit (posts, blogs,
 * polls, profiles, comments, replies) shows the account picker and routes
 * multi-account votes through the host handler — even where an intermediate
 * component only forwards `(author, permlink, percent)`.
 */
export interface VoteAccountsContextValue {
  /** Logged-in Hive accounts the user can vote from (picker shows with 2+). */
  accounts: string[];
  /** The active (logged-in) account — pre-selected and listed first in the
   *  picker. Lowercase. */
  currentAccount?: string;
  /** Content authors that never get the picker for the CURRENT voter (the
   *  host decides per logged-in user, e.g. an account that never self-votes
   *  excludes only itself). Also applied to explicit `voteAccounts`. Lowercase. */
  excludeAuthors?: string[];
  /** Broadcast one vote per selected account. Should resolve to
   *  `{ voted: string[] }` with the accounts whose vote landed. */
  voteFromAccounts?: (
    author: string,
    permlink: string,
    percent: number,
    accounts: string[],
  ) => Promise<void | { voted?: string[] }>;
}

const VoteAccountsContext = createContext<VoteAccountsContextValue | null>(null);

export function VoteAccountsProvider({ value, children }: { value: VoteAccountsContextValue; children: ReactNode }) {
  return <VoteAccountsContext.Provider value={value}>{children}</VoteAccountsContext.Provider>;
}

export function useVoteAccountsContext(): VoteAccountsContextValue | null {
  return useContext(VoteAccountsContext);
}

/** Accounts to offer for `author`'s content: [] when excluded or fewer than 2. */
export function voteAccountsForAuthor(ctx: VoteAccountsContextValue | null, author: string): string[] {
  if (!ctx || !ctx.voteFromAccounts) return [];
  const a = (author || '').toLowerCase();
  if ((ctx.excludeAuthors ?? []).some((x) => x.toLowerCase() === a)) return [];
  return ctx.accounts.length > 1 ? ctx.accounts : [];
}
