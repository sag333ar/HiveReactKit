/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { WalletStore, WalletData, Transaction } from "../types/wallet";
import * as dhive from "@hiveio/dhive";
const dhiveClient = new dhive.Client(["https://api.hive.blog"]);

// ------------------- Wallet Helpers -------------------
const getWalletDataDetail = async (username: string) => {
  try {
    const accounts = await dhiveClient.database.getAccounts([username]);
    if (!accounts || accounts.length === 0)
      throw new Error("Account not found");
    return accounts[0];
  } catch (error) {
    console.error("Error in getWalletDataDetail:", error);
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
};

const convertVestingSharesToHiveData = async (vestingShares: string) => {
  try {
    const props = await dhiveClient.database.getDynamicGlobalProperties();
    const vestingSharesFloat = parseFloat(vestingShares.split(" ")[0]);
    const totalVestingShares = parseFloat(
      String(props.total_vesting_shares).split(" ")[0]
    );
    const totalVestingFundHive = parseFloat(
      String(props.total_vesting_fund_hive).split(" ")[0]
    );
    return ((vestingSharesFloat * totalVestingFundHive) / totalVestingShares).toFixed(3);
  } catch (error) {
    console.error("Error in convertVestingSharesToHiveData:", error);
    return "0";
  }
};

const getFeedHistory = async () => {
  const feedHistory = await dhiveClient.database.call("get_feed_history", []);
  const currentMedian = feedHistory.current_median_history;
  // base: "0.059 HBD", quote: "1.000 HIVE" → 1 HBD = quote/base = 1.000/0.059 ≈ 16.95 HIVE
  const baseAmount = parseFloat(currentMedian.base.split(" ")[0]);
  const quoteAmount = parseFloat(currentMedian.quote.split(" ")[0]);
  return { baseAmount, quoteAmount };
};

const convertHivetoUSDData = async (hiveAmount: string | number) => {
  try {
    const { baseAmount } = await getFeedHistory();
    const hiveAmountFloat =
      typeof hiveAmount === "string" ? parseFloat(hiveAmount) : hiveAmount;
    return (baseAmount * hiveAmountFloat).toFixed(2);
  } catch (error) {
    console.error("Error in convertHivetoUSDData:", error);
    return "0";
  }
};

// Convert HBD to HIVE using feed price: 1 HBD = quote / base HIVE
const convertHBDtoHive = async (hbdAmount: number): Promise<number> => {
  try {
    const { baseAmount, quoteAmount } = await getFeedHistory();
    if (baseAmount === 0) return 0;
    return (hbdAmount * quoteAmount) / baseAmount;
  } catch (error) {
    console.error("Error in convertHBDtoHive:", error);
    return 0;
  }
};

// ------------------- Local Currency Helpers -------------------
const getLocalCurrency = (): string => {
  try {
    // Primary: detect country from system timezone (most reliable)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const timezoneCurrencyMap: Record<string, string> = {
      // Asia
      "Asia/Kolkata": "INR", "Asia/Calcutta": "INR", "Asia/Chennai": "INR",
      "Asia/Mumbai": "INR",
      "Asia/Karachi": "PKR", "Asia/Dhaka": "BDT", "Asia/Colombo": "LKR",
      "Asia/Kathmandu": "NPR", "Asia/Rangoon": "MMK", "Asia/Yangon": "MMK",
      "Asia/Bangkok": "THB", "Asia/Ho_Chi_Minh": "VND", "Asia/Saigon": "VND",
      "Asia/Jakarta": "IDR", "Asia/Kuala_Lumpur": "MYR", "Asia/Singapore": "SGD",
      "Asia/Manila": "PHP", "Asia/Hong_Kong": "HKD", "Asia/Taipei": "TWD",
      "Asia/Shanghai": "CNY", "Asia/Chongqing": "CNY", "Asia/Beijing": "CNY",
      "Asia/Tokyo": "JPY", "Asia/Seoul": "KRW", "Asia/Dubai": "AED",
      "Asia/Riyadh": "SAR", "Asia/Jerusalem": "ILS", "Asia/Tel_Aviv": "ILS",
      "Asia/Phnom_Penh": "KHR", "Asia/Vientiane": "LAK",
      // Americas
      "America/New_York": "USD", "America/Chicago": "USD",
      "America/Denver": "USD", "America/Los_Angeles": "USD",
      "America/Phoenix": "USD", "America/Anchorage": "USD",
      "Pacific/Honolulu": "USD",
      "America/Toronto": "CAD", "America/Vancouver": "CAD",
      "America/Montreal": "CAD", "America/Edmonton": "CAD",
      "America/Sao_Paulo": "BRL", "America/Rio_Branco": "BRL",
      "America/Mexico_City": "MXN", "America/Cancun": "MXN",
      "America/Argentina/Buenos_Aires": "ARS", "America/Bogota": "COP",
      "America/Lima": "PEN", "America/Santiago": "CLP",
      // Europe
      "Europe/London": "GBP", "Europe/Dublin": "EUR",
      "Europe/Berlin": "EUR", "Europe/Paris": "EUR", "Europe/Rome": "EUR",
      "Europe/Madrid": "EUR", "Europe/Lisbon": "EUR", "Europe/Amsterdam": "EUR",
      "Europe/Brussels": "EUR", "Europe/Vienna": "EUR", "Europe/Helsinki": "EUR",
      "Europe/Athens": "EUR", "Europe/Bratislava": "EUR", "Europe/Ljubljana": "EUR",
      "Europe/Vilnius": "EUR", "Europe/Riga": "EUR", "Europe/Tallinn": "EUR",
      "Europe/Malta": "EUR", "Europe/Nicosia": "EUR", "Europe/Luxembourg": "EUR",
      "Europe/Zagreb": "EUR",
      "Europe/Zurich": "CHF", "Europe/Stockholm": "SEK", "Europe/Oslo": "NOK",
      "Europe/Copenhagen": "DKK", "Europe/Warsaw": "PLN", "Europe/Prague": "CZK",
      "Europe/Budapest": "HUF", "Europe/Bucharest": "RON",
      "Europe/Moscow": "RUB", "Europe/Kiev": "UAH", "Europe/Kyiv": "UAH",
      "Europe/Istanbul": "TRY",
      // Africa
      "Africa/Lagos": "NGN", "Africa/Johannesburg": "ZAR",
      "Africa/Nairobi": "KES", "Africa/Accra": "GHS", "Africa/Cairo": "EGP",
      // Oceania
      "Australia/Sydney": "AUD", "Australia/Melbourne": "AUD",
      "Australia/Brisbane": "AUD", "Australia/Perth": "AUD",
      "Pacific/Auckland": "NZD",
    };

    if (timezoneCurrencyMap[timezone]) {
      return timezoneCurrencyMap[timezone];
    }

    // Fallback: try locale region code
    const locale = navigator.language || "en-US";
    const regionCurrencyMap: Record<string, string> = {
      US: "USD", GB: "GBP", IN: "INR", JP: "JPY", CN: "CNY",
      KR: "KRW", AU: "AUD", CA: "CAD", BR: "BRL", MX: "MXN",
      DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR",
    };
    const region = locale.split("-")[1]?.toUpperCase();
    return (region && regionCurrencyMap[region]) || "USD";
  } catch {
    return "USD";
  }
};

const fetchAllExchangeRates = async (): Promise<Record<string, number>> => {
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/USD`);
    const data = await response.json();
    if (data?.rates) return data.rates;
    return { USD: 1 };
  } catch {
    return { USD: 1 };
  }
};

// Supported currencies for the dropdown
const SUPPORTED_CURRENCIES: { code: string; name: string }[] = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "INR", name: "Indian Rupee" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "KRW", name: "South Korean Won" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "PLN", name: "Polish Zloty" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "RUB", name: "Russian Ruble" },
  { code: "ZAR", name: "South African Rand" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "THB", name: "Thai Baht" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "VND", name: "Vietnamese Dong" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "GTQ", name: "Guatemalan Quetzal" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "TWD", name: "Taiwan Dollar" },
  { code: "CZK", name: "Czech Koruna" },
  { code: "HUF", name: "Hungarian Forint" },
  { code: "ILS", name: "Israeli Shekel" },
  { code: "CLP", name: "Chilean Peso" },
  { code: "ARS", name: "Argentine Peso" },
  { code: "COP", name: "Colombian Peso" },
  { code: "LKR", name: "Sri Lankan Rupee" },
  { code: "NPR", name: "Nepalese Rupee" },
  { code: "UAH", name: "Ukrainian Hryvnia" },
  { code: "RON", name: "Romanian Leu" },
  { code: "GHS", name: "Ghanaian Cedi" },
];

export { SUPPORTED_CURRENCIES, getLocalCurrency };

const formatLocalCurrency = (value: number, currency: string): string => {
  try {
    const locale = navigator.language || "en-US";
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(value);
    return parts.map((p) => p.value).join("");
  } catch {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `$${value.toFixed(2)}`;
    }
  }
};

// ------------------- Transaction Helpers -------------------
const fetchAccountHistory = async (
  username: string,
  limit: number = 100
): Promise<Transaction[]> => {
  const response = await fetch("https://api.hive.blog/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: 0,
      jsonrpc: "2.0",
      method: "condenser_api.get_account_history",
      params: [username, -1, limit, "4", null],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "Failed to fetch transactions");

  const transactions: Transaction[] = (data.result || [])
    .filter((entry: any) => entry[1]?.op?.[0] === "transfer")
    .map((entry: any) => {
      const [id, tx] = entry;
      const op = tx.op[1];
      return {
        id,
        timestamp: tx.timestamp,
        type: op.from === username ? "sent" : "received",
        amount: op.amount,
        from: op.from,
        to: op.to,
        memo: op.memo || "",
        trx_id: tx.trx_id,
      } as Transaction;
    })
    .reverse();

  return transactions;
};

// ------------------- WalletStore -------------------
const detectedLocalCurrency = getLocalCurrency();

export const useWalletStore = create<WalletStore>((set, get) => ({
  walletData: null,
  isLoading: false,
  error: null,
  transactions: [],
  isLoadingTransactions: false,
  transactionError: null,
  selectedCurrency: detectedLocalCurrency,
  localCurrency: detectedLocalCurrency,
  exchangeRates: { USD: 1 },

  setWalletData: (data) => set({ walletData: data }),

  clearWalletData: () => set({ walletData: null, error: null, transactions: [], transactionError: null }),

  setSelectedCurrency: (currency: string) => {
    const { walletData, exchangeRates } = get();
    if (!walletData) {
      set({ selectedCurrency: currency });
      return;
    }
    const rate = exchangeRates[currency] || 1;
    const localValue = walletData.estimated_value_usd * rate;
    const formattedValue = formatLocalCurrency(localValue, currency);
    set({
      selectedCurrency: currency,
      walletData: { ...walletData, estimated_value: formattedValue },
    });
  },

  getFormattedEstimatedValue: () => {
    const { walletData, selectedCurrency, exchangeRates } = get();
    if (!walletData) return "-";
    const rate = exchangeRates[selectedCurrency] || 1;
    const localValue = walletData.estimated_value_usd * rate;
    return formatLocalCurrency(localValue, selectedCurrency);
  },

  fetchWalletData: async (username: string) => {
    set({ isLoading: true, error: null });
    try {
      const account = await getWalletDataDetail(username);

      // Type guard for error object
      const isErrorAccount = (obj: any): obj is { error: string } =>
        "error" in obj;

      if (!account || isErrorAccount(account)) {
        throw new Error(isErrorAccount(account) ? account.error : "Account not found");
      }

      // Convert Asset objects to string if necessary
      const vestingShares =
        typeof account.vesting_shares === "string"
          ? account.vesting_shares
          : "0.000000 VESTS";
      const balance =
        typeof account.balance === "string"
          ? account.balance
          : account.balance.toString();
      const hbdBalance =
        typeof account.hbd_balance === "string"
          ? account.hbd_balance
          : account.hbd_balance.toString();
      const savingsBalance =
        typeof account.savings_balance === "string"
          ? account.savings_balance
          : account.savings_balance.toString();
      const savingsHbdBalance =
        typeof account.savings_hbd_balance === "string"
          ? account.savings_hbd_balance
          : account.savings_hbd_balance.toString();

      const hivePower = await convertVestingSharesToHiveData(vestingShares);

      const liquidHive = parseFloat(balance.split(" ")[0] || "0");
      const stakedHive = parseFloat(hivePower);

      // Convert HBD balances to HIVE using feed price
      const liquidHBD = parseFloat(hbdBalance.split(" ")[0] || "0");
      const savingsHBD = parseFloat(savingsHbdBalance.split(" ")[0] || "0");
      const totalHBD = liquidHBD + savingsHBD;
      const hbdAsHive = await convertHBDtoHive(totalHBD);

      // Total HIVE = liquid + staked + HBD converted to HIVE
      const totalHive = (liquidHive + stakedHive + hbdAsHive).toFixed(3);

      const estimatedHiveUSD = await convertHivetoUSDData(totalHive);
      const usdValue = parseFloat(estimatedHiveUSD);

      // Fetch all exchange rates
      const rates = await fetchAllExchangeRates();

      // Format in the default selected currency (USD)
      const { selectedCurrency } = get();
      const rate = rates[selectedCurrency] || 1;
      const localValue = usdValue * rate;
      const formattedValue = formatLocalCurrency(localValue, selectedCurrency);

      const walletData: WalletData = {
        balance,
        hbd_balance: hbdBalance,
        savings_balance: savingsBalance,
        savings_hbd_balance: savingsHbdBalance,
        hive_power: `${hivePower} HP`,
        estimated_value: formattedValue,
        estimated_value_usd: usdValue,
      };

      set({ walletData, exchangeRates: rates });
      return walletData;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to fetch wallet data";
      console.error("Wallet fetch error:", errorMessage);

      const emptyWallet: WalletData = {
        balance: "0.000 HIVE",
        hbd_balance: "0.000 HBD",
        savings_balance: "0.000 HIVE",
        savings_hbd_balance: "0.000 HBD",
        hive_power: "0 HP",
        estimated_value: formatLocalCurrency(0, "USD"),
        estimated_value_usd: 0,
        error: errorMessage,
      };

      set({ walletData: emptyWallet, error: errorMessage });
      return emptyWallet;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchTransactions: async (username: string, limit: number = 100) => {
    set({ isLoadingTransactions: true, transactionError: null });
    try {
      const transactions = await fetchAccountHistory(username, limit);
      set({ transactions });
      return transactions;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to fetch transactions";
      console.error("Transaction fetch error:", msg);
      set({ transactionError: msg });
      return [];
    } finally {
      set({ isLoadingTransactions: false });
    }
  },
}));