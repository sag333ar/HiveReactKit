/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { WalletStore, WalletData, Transaction, PendingSavingsWithdrawal } from "../types/wallet";
import { getHiveApiEndpoint, getHiveClient } from "../config/hiveEndpoint";
// Shared dhive client — address is updated at runtime via setHiveApiEndpoint().
const dhiveClient = getHiveClient();

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

// ------------------- Savings Withdrawals -------------------
const fetchPendingSavingsWithdrawals = async (
  username: string,
): Promise<PendingSavingsWithdrawal[]> => {
  try {
    const response = await fetch(getHiveApiEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: 0,
        jsonrpc: "2.0",
        method: "condenser_api.get_savings_withdraw_from",
        params: [username],
      }),
    });
    const data = await response.json();
    if (data.error) return [];
    return (data.result || []).map((r: any) => ({
      request_id: r.request_id,
      from: r.from,
      to: r.to,
      amount: r.amount,
      memo: r.memo || "",
      complete: r.complete,
    })) as PendingSavingsWithdrawal[];
  } catch (e) {
    console.error("fetchPendingSavingsWithdrawals failed:", e);
    return [];
  }
};

// ------------------- Transaction Helpers -------------------
/**
 * condenser_api.get_account_history `op_filter_low` / `op_filter_high`
 * bitmask copied from peakd. Each bit position corresponds to an op type;
 * peakd selects every financial operation a wallet user expects to see —
 * transfer, power up, power down, savings deposit / withdraw, claim
 * rewards, delegations, market orders, recurrent transfers, fill events,
 * etc. The earlier filter of "4" only matched op id 2 (`transfer`), so
 * everything else was silently dropped and the history looked nearly empty.
 *
 * Strings (not numbers) because the high bits don't fit in JS' safe
 * integer range; the node expects them as strings anyway.
 */
const OP_FILTER_LOW = "848647637693366652";
const OP_FILTER_HIGH = "129639434";

/** Map a raw account-history entry to our Transaction shape. Returns null
 *  for op types we don't render. Captures the canonical financial ops
 *  peakd surfaces in its wallet timeline. */
function mapHistoryEntryToTransaction(
  entry: [number, { timestamp: string; trx_id: string; op: [string, Record<string, any>] }],
  username: string,
): Transaction | null {
  const [id, tx] = entry;
  const [opType, op] = tx.op;
  const base = { id, timestamp: tx.timestamp, trx_id: tx.trx_id };

  switch (opType) {
    case "transfer":
      return {
        ...base,
        type: op.from === username ? "sent" : "received",
        amount: String(op.amount),
        from: op.from,
        to: op.to,
        memo: op.memo || "",
      };
    case "transfer_to_vesting":
      // Power Up — stake HIVE as HP. From the user's POV this leaves the
      // liquid balance, so render as "sent" with a descriptive memo.
      return {
        ...base,
        type: op.from === username ? "sent" : "received",
        amount: String(op.amount),
        from: op.from,
        to: op.to,
        memo: op.from === op.to ? "Power up" : `Power up → @${op.to}`,
      };
    case "transfer_to_savings":
      return {
        ...base,
        type: op.from === username ? "sent" : "received",
        amount: String(op.amount),
        from: op.from,
        to: op.to,
        memo: op.memo ? `Savings deposit · ${op.memo}` : "Savings deposit",
      };
    case "transfer_from_savings":
      return {
        ...base,
        type: op.from === username ? "sent" : "received",
        amount: String(op.amount),
        from: op.from,
        to: op.to,
        memo: op.memo ? `Savings withdraw · ${op.memo}` : "Savings withdraw",
      };
    case "fill_transfer_from_savings":
      return {
        ...base,
        type: "received",
        amount: String(op.amount),
        from: op.from,
        to: op.to,
        memo: "Savings withdraw fill",
      };
    case "cancel_transfer_from_savings":
      return {
        ...base,
        type: "received",
        amount: "—",
        from: op.from,
        to: op.from,
        memo: `Cancelled savings withdrawal #${op.request_id}`,
      };
    case "fill_vesting_withdraw": {
      // Power Down weekly payout — `deposited` is HIVE the user receives.
      return {
        ...base,
        type: op.to_account === username ? "received" : "sent",
        amount: String(op.deposited),
        from: op.from_account,
        to: op.to_account,
        memo: "Power down",
      };
    }
    case "claim_reward_balance": {
      const parts: string[] = [];
      if (op.reward_hive && parseFloat(op.reward_hive) > 0) parts.push(String(op.reward_hive));
      if (op.reward_hbd && parseFloat(op.reward_hbd) > 0) parts.push(String(op.reward_hbd));
      if (op.reward_vests && parseFloat(op.reward_vests) > 0) parts.push(String(op.reward_vests));
      return {
        ...base,
        type: "received",
        amount: parts.join(", ") || "—",
        from: op.account,
        to: op.account,
        memo: "Claimed rewards",
      };
    }
    case "delegate_vesting_shares":
      return {
        ...base,
        type: op.delegator === username ? "sent" : "received",
        amount: String(op.vesting_shares),
        from: op.delegator,
        to: op.delegatee,
        memo: `Delegate HP → @${op.delegatee}`,
      };
    case "return_vesting_delegation":
      return {
        ...base,
        type: "received",
        amount: String(op.vesting_shares),
        from: "delegation",
        to: op.account,
        memo: "Delegation returned",
      };
    case "author_reward": {
      const parts: string[] = [];
      if (op.hive_payout && parseFloat(op.hive_payout) > 0) parts.push(String(op.hive_payout));
      if (op.hbd_payout && parseFloat(op.hbd_payout) > 0) parts.push(String(op.hbd_payout));
      if (op.vesting_payout && parseFloat(op.vesting_payout) > 0) parts.push(String(op.vesting_payout));
      return {
        ...base,
        type: "received",
        amount: parts.join(", ") || "—",
        from: "author_reward",
        to: op.author,
        memo: `Author reward · ${op.permlink}`,
      };
    }
    case "curation_reward":
      return {
        ...base,
        type: "received",
        amount: String(op.reward),
        from: "curation",
        to: op.curator,
        memo: `Curation · @${op.comment_author}/${op.permlink}`,
      };
    case "comment_benefactor_reward": {
      const parts: string[] = [];
      if (op.hive_payout && parseFloat(op.hive_payout) > 0) parts.push(String(op.hive_payout));
      if (op.hbd_payout && parseFloat(op.hbd_payout) > 0) parts.push(String(op.hbd_payout));
      if (op.vesting_payout && parseFloat(op.vesting_payout) > 0) parts.push(String(op.vesting_payout));
      return {
        ...base,
        type: "received",
        amount: parts.join(", ") || "—",
        from: op.author,
        to: op.benefactor,
        memo: "Benefactor reward",
      };
    }
    case "producer_reward":
      return {
        ...base,
        type: "received",
        amount: String(op.vesting_shares),
        from: "producer",
        to: op.producer,
        memo: "Producer reward",
      };
    case "fill_order":
      return {
        ...base,
        type: "received",
        amount: `${op.current_pays} → ${op.open_pays}`,
        from: op.current_owner,
        to: op.open_owner,
        memo: "Market fill",
      };
    case "recurrent_transfer":
      return {
        ...base,
        type: op.from === username ? "sent" : "received",
        amount: String(op.amount),
        from: op.from,
        to: op.to,
        memo: op.memo ? `Recurrent · ${op.memo}` : "Recurrent transfer",
      };
    case "fill_recurrent_transfer":
      return {
        ...base,
        type: op.from === username ? "sent" : "received",
        amount: String(op.amount),
        from: op.from,
        to: op.to,
        memo: "Recurrent fill",
      };
    default:
      return null;
  }
}

/**
 * Pull a slice of account history. `start = -1` returns the latest `limit`
 * entries; for pagination pass the smallest id from the previous page minus
 * one. `rawCount` is the number of underlying history entries received
 * before op-type filtering — used by callers to decide whether more pages
 * are available (the filtered list can be much shorter than the raw page).
 */
const fetchAccountHistory = async (
  username: string,
  limit: number = 100,
  start: number = -1,
): Promise<{ transactions: Transaction[]; rawCount: number; oldestIndex: number | null }> => {
  const response = await fetch(getHiveApiEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: 0,
      jsonrpc: "2.0",
      method: "condenser_api.get_account_history",
      params: [username, start, limit, OP_FILTER_LOW, OP_FILTER_HIGH],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "Failed to fetch transactions");

  const raw: any[] = data.result || [];

  // The condenser returns entries oldest→newest within the requested
  // window. The smallest id in `raw` is the oldest entry in this page;
  // we pass `oldestIndex - 1` as the next page's `start`.
  let oldestIndex: number | null = null;
  if (raw.length > 0) {
    oldestIndex = raw.reduce(
      (min, entry) => (entry[0] < min ? entry[0] : min),
      raw[0][0] as number,
    );
  }

  const transactions: Transaction[] = raw
    .map((entry: any) => mapHistoryEntryToTransaction(entry, username))
    .filter((t): t is Transaction => t !== null)
    .reverse();

  return { transactions, rawCount: raw.length, oldestIndex };
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
  hasMoreTransactions: true,
  isLoadingMoreTransactions: false,
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

      // Unclaimed reward balances. peakd surfaces a "Pending Rewards"
      // card whenever any of these is non-zero. The HP-equivalent of
      // the VESTS reward is read straight from the account when the
      // node provides it (`reward_vesting_hive`); else we fall back to
      // converting via the global props.
      const rewardHive =
        typeof (account as any).reward_hive_balance === "string"
          ? (account as any).reward_hive_balance
          : "0.000 HIVE";
      const rewardHbd =
        typeof (account as any).reward_hbd_balance === "string"
          ? (account as any).reward_hbd_balance
          : "0.000 HBD";
      const rewardVests =
        typeof (account as any).reward_vesting_balance === "string"
          ? (account as any).reward_vesting_balance
          : "0.000000 VESTS";
      let rewardVestingHive: string | undefined =
        typeof (account as any).reward_vesting_hive === "string"
          ? (account as any).reward_vesting_hive
          : undefined;
      if (!rewardVestingHive && parseFloat(rewardVests.split(" ")[0] || "0") > 0) {
        const hp = await convertVestingSharesToHiveData(rewardVests);
        rewardVestingHive = `${hp} HIVE`;
      }

      // Power-down state — vesting_withdraw_rate is the per-week VESTS payout.
      // When > 0 the account is actively powering down. next_vesting_withdrawal
      // is the timestamp of the next weekly payout.
      const vestingWithdrawRateRaw =
        typeof (account as any).vesting_withdraw_rate === "string"
          ? (account as any).vesting_withdraw_rate
          : "0.000000 VESTS";
      const vestingWithdrawRateVests = parseFloat(
        vestingWithdrawRateRaw.split(" ")[0] || "0",
      );
      const powerDownActive = vestingWithdrawRateVests > 0;
      const powerDownHpPerWeek = powerDownActive
        ? await convertVestingSharesToHiveData(vestingWithdrawRateRaw)
        : undefined;
      const nextVestingWithdrawal =
        powerDownActive && (account as any).next_vesting_withdrawal
          ? String((account as any).next_vesting_withdrawal)
          : undefined;

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

      // Pull pending savings withdrawals in parallel — we keep this in
      // walletData rather than a separate store key so the UI can fan out
      // STOP buttons next to each request without juggling extra loaders.
      const pendingSavingsWithdrawals = await fetchPendingSavingsWithdrawals(username);

      const walletData: WalletData = {
        balance,
        hbd_balance: hbdBalance,
        savings_balance: savingsBalance,
        savings_hbd_balance: savingsHbdBalance,
        hive_power: `${hivePower} HP`,
        estimated_value: formattedValue,
        estimated_value_usd: usdValue,
        power_down_active: powerDownActive,
        power_down_hp_per_week: powerDownHpPerWeek,
        next_vesting_withdrawal: nextVestingWithdrawal,
        pending_savings_withdrawals: pendingSavingsWithdrawals,
        reward_hive_balance: rewardHive,
        reward_hbd_balance: rewardHbd,
        reward_vesting_balance: rewardVests,
        reward_vesting_hive: rewardVestingHive,
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

  fetchSavingsWithdrawals: async (username: string) => {
    const list = await fetchPendingSavingsWithdrawals(username);
    const { walletData } = get();
    if (walletData) {
      set({ walletData: { ...walletData, pending_savings_withdrawals: list } });
    }
    return list;
  },

  fetchTransactions: async (username: string, limit: number = 100) => {
    set({ isLoadingTransactions: true, transactionError: null });
    try {
      const { transactions, oldestIndex } = await fetchAccountHistory(username, limit, -1);
      // No older pages once the oldest id returned is at the start of
      // the account's history. Using oldestIndex here instead of
      // rawCount: with the wider bitmask filter, even short pages can
      // still have older ops to discover.
      set({
        transactions,
        hasMoreTransactions: oldestIndex !== null && oldestIndex > 0,
      });
      return transactions;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to fetch transactions";
      console.error("Transaction fetch error:", msg);
      set({ transactionError: msg, hasMoreTransactions: false });
      return [];
    } finally {
      set({ isLoadingTransactions: false });
    }
  },

  fetchMoreTransactions: async (username: string, limit: number = 100) => {
    const { transactions, isLoadingMoreTransactions, hasMoreTransactions } = get();
    if (isLoadingMoreTransactions || !hasMoreTransactions) return [];
    set({ isLoadingMoreTransactions: true });
    try {
      // Smallest history id we already have — its value minus one is
      // the next `start` cursor. The bitmask filter means there may be
      // older non-matching ops between this id and the next matching
      // one; the node skips them server-side, so we just keep walking.
      const oldest = transactions.reduce(
        (min, t) => (t.id < min ? t.id : min),
        transactions[0]?.id ?? -1,
      );
      if (oldest <= 0) {
        set({ hasMoreTransactions: false });
        return [];
      }
      const nextStart = oldest - 1;
      const { transactions: more, oldestIndex } = await fetchAccountHistory(
        username,
        limit,
        nextStart,
      );
      // De-dupe by trx_id+id — some nodes echo a boundary entry.
      const seen = new Set(transactions.map((t) => `${t.trx_id}:${t.id}`));
      const newOnes = more.filter((t) => !seen.has(`${t.trx_id}:${t.id}`));
      set({
        transactions: [...transactions, ...newOnes],
        hasMoreTransactions: oldestIndex !== null && oldestIndex > 0,
      });
      return newOnes;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to fetch more transactions";
      console.error("Transaction paginate error:", msg);
      return [];
    } finally {
      set({ isLoadingMoreTransactions: false });
    }
  },
}));