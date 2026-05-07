export interface WalletData {
  balance: string;
  hbd_balance: string;
  savings_balance: string;
  savings_hbd_balance: string;
  hive_power: string;
  estimated_value: string;
  estimated_value_usd: number;
  error?: string;
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
  setSelectedCurrency: (currency: string) => void;
  getFormattedEstimatedValue: () => string;
}