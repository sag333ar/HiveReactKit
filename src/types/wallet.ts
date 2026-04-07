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