export interface WalletData {
  balance: string;
  hbd_balance: string;
  savings_balance: string;
  savings_hbd_balance: string;
  hive_power: string;
  estimated_value: string;
  estimated_value_usd: number;
  /** When a power-down is in progress this is the per-week HIVE amount.
   *  Empty/undefined when no power-down is scheduled. */
  power_down_hp_per_week?: string;
  /** ISO timestamp of the next vesting withdrawal payout (UTC). */
  next_vesting_withdrawal?: string;
  /** True when `vesting_withdraw_rate` > 0 on the account. */
  power_down_active?: boolean;
  /** Pending savings withdrawals — populated by `fetchSavingsWithdrawals`. */
  pending_savings_withdrawals?: PendingSavingsWithdrawal[];
  /** Unclaimed reward balances. All three must be passed to
   *  `claim_reward_balance`. Surface a CLAIM button when any is > 0. */
  reward_hive_balance?: string;
  reward_hbd_balance?: string;
  reward_vesting_balance?: string;
  /** HP equivalent of `reward_vesting_balance` — useful for human-readable
   *  display next to the CLAIM button. */
  reward_vesting_hive?: string;
  error?: string;
}

export interface PendingSavingsWithdrawal {
  /** Unique per-user id picked when the withdrawal was created. Required to
   *  broadcast `cancel_transfer_from_savings`. */
  request_id: number;
  from: string;
  to: string;
  amount: string;
  memo: string;
  /** ISO timestamp when the 3-day waiting period ends (UTC). */
  complete: string;
}

export interface HpDelegation {
  /** Counterparty account — `delegatee` for outgoing, `delegator` for incoming. */
  account: string;
  /** Raw VESTS amount as a numeric string (e.g. "3942369739000000"). */
  vests: string;
  /** VESTS converted to HP using current dynamic global properties. */
  hp: number;
  operation_id?: string;
  block_num?: number;
}

export interface RcDelegation {
  /** Counterparty account — `delegatee` for outgoing, `delegator` for incoming. */
  account: string;
  /** Raw RC amount (max_rc) as a numeric string (e.g. "50000000000"). */
  max_rc: string;
  operation_id?: string;
  block_num?: number;
}

export interface DelegationsBundle {
  hp: { outgoing: HpDelegation[]; incoming: HpDelegation[] };
  rc: { outgoing: RcDelegation[]; incoming: RcDelegation[] };
}

export interface Transaction {
  id: number;
  timestamp: string;
  type: "sent" | "received";
  amount: string;
  from: string;
  to: string;
  memo: string;
  trx_id: string;
}

export interface WalletStore {
  walletData: WalletData | null;
  isLoading: boolean;
  error: string | null;
  transactions: Transaction[];
  isLoadingTransactions: boolean;
  transactionError: string | null;
  selectedCurrency: string;
  localCurrency: string;
  exchangeRates: Record<string, number>;

  setWalletData: (data: WalletData | null) => void;
  clearWalletData: () => void;
  fetchWalletData: (username: string) => Promise<WalletData>;
  fetchTransactions: (username: string, limit?: number) => Promise<Transaction[]>;
  /** Append the next page of transaction history (older than the current
   *  oldest entry). Returns the newly appended items. */
  fetchMoreTransactions: (username: string, limit?: number) => Promise<Transaction[]>;
  /** True when the most recent paginated fetch indicated more data is
   *  available — used to gate the infinite-scroll sentinel. */
  hasMoreTransactions: boolean;
  isLoadingMoreTransactions: boolean;
  /** Fetches `cancel_transfer_from_savings`-able requests via condenser API. */
  fetchSavingsWithdrawals: (username: string) => Promise<PendingSavingsWithdrawal[]>;
  setSelectedCurrency: (currency: string) => void;
  getFormattedEstimatedValue: () => string;
}