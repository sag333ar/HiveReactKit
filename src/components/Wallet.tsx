import React, { useEffect, useState, useRef, type JSX } from "react";
import {
  FaWallet,
  FaMoneyBill,
  FaPiggyBank,
  FaCoins,
  FaBolt,
  FaExclamationTriangle,
  FaArrowUp,
  FaArrowDown,
  FaChevronDown,
} from "react-icons/fa";
import { useWalletStore, SUPPORTED_CURRENCIES } from "../store/walletStore";
import type { Transaction } from "../types/wallet";

interface WalletProps {
  username?: string;
  className?: string;
}

interface WalletTileProps {
  label: string;
  value?: string;
  icon?: JSX.Element;
  iconBgClass?: string;
  iconTextClass?: string;
  valueClass?: string;
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp + "Z");
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 30) {
    return then.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "just now";
}

const TransactionRow: React.FC<{ tx: Transaction }> = ({ tx }) => {
  const isSent = tx.type === "sent";
  const otherUser = isSent ? tx.to : tx.from;

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-lg bg-gray-800 border border-gray-700 mb-2 transition-all duration-200 hover:bg-gray-750 hover:border-gray-600">
      <div
        className={`p-2 rounded-full flex items-center justify-center flex-shrink-0 ${
          isSent ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"
        }`}
      >
        {isSent ? <FaArrowUp size={12} /> : <FaArrowDown size={12} />}
      </div>
      <img
        src={`https://images.hive.blog/u/${otherUser}/avatar`}
        alt={otherUser}
        className="w-9 h-9 rounded-full flex-shrink-0 border-2 border-gray-600"
        onError={(e) => {
          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${otherUser}&background=random&size=36`;
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-gray-200 truncate">
            {otherUser}
          </span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {isSent ? "Sent" : "Received"} &middot; {formatTimeAgo(tx.timestamp)}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div
          className={`text-sm font-bold ${
            isSent ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {isSent ? "-" : "+"}{tx.amount}
        </div>
      </div>
    </div>
  );
};

const CurrencyDropdown: React.FC = () => {
  const { selectedCurrency, localCurrency, setSelectedCurrency, exchangeRates } = useWalletStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Build ordered currency list: USD first, local currency second, then rest
  const orderedCurrencies = React.useMemo(() => {
    const usd = SUPPORTED_CURRENCIES.find((c) => c.code === "USD")!;
    const local = localCurrency !== "USD" ? SUPPORTED_CURRENCIES.find((c) => c.code === localCurrency) : null;
    const rest = SUPPORTED_CURRENCIES.filter(
      (c) => c.code !== "USD" && c.code !== localCurrency && exchangeRates[c.code]
    );
    return [usd, ...(local ? [local] : []), ...rest];
  }, [localCurrency, exchangeRates]);

  const getCurrencySymbol = (code: string): string => {
    try {
      const parts = new Intl.NumberFormat("en", { style: "currency", currency: code }).formatToParts(0);
      return parts.find((p) => p.type === "currency")?.value || code;
    } catch {
      return code;
    }
  };

  return (
    <div ref={dropdownRef} className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 transition-colors text-white text-xs font-medium border border-white/20"
      >
        <span>{getCurrencySymbol(selectedCurrency)}</span>
        <span>{selectedCurrency}</span>
        <FaChevronDown size={8} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 right-0 w-56 max-h-64 overflow-y-auto rounded-lg bg-gray-800 border border-gray-600 shadow-xl z-50 scrollbar-hide">
          {orderedCurrencies.map((currency, index) => (
            <React.Fragment key={currency.code}>
              {/* Divider after local currency */}
              {index === (localCurrency !== "USD" ? 2 : 1) && (
                <div className="border-t border-gray-600 my-1" />
              )}
              <button
                onClick={() => {
                  setSelectedCurrency(currency.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-700 ${
                  selectedCurrency === currency.code
                    ? "bg-blue-500/20 text-blue-300"
                    : "text-gray-300"
                }`}
              >
                <span className="w-6 text-center font-medium text-gray-400">
                  {getCurrencySymbol(currency.code)}
                </span>
                <span className="font-medium">{currency.code}</span>
                <span className="text-xs text-gray-500 truncate">{currency.name}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export const Wallet: React.FC<WalletProps> = ({ username, className = "" }) => {
  const { walletData, fetchWalletData, isLoading, error, transactions, fetchTransactions, isLoadingTransactions, transactionError } = useWalletStore();

  useEffect(() => {
    if (username) {
      fetchWalletData(username);
      fetchTransactions(username);
    }
  }, [username, fetchWalletData, fetchTransactions]);

  const WalletTile: React.FC<WalletTileProps> = ({
    label,
    value,
    icon,
    iconBgClass = "bg-blue-500/15",
    iconTextClass = "text-blue-400",
    valueClass = "text-gray-200",
  }) => (
    <div className="flex items-center justify-between p-3.5 rounded-lg bg-gray-800 border border-gray-700 mb-2.5 transition-all duration-200 hover:bg-gray-750 hover:border-gray-600">
      <div className="flex items-center gap-3">
        {icon && (
          <div className={`p-2 rounded-full flex items-center justify-center ${iconBgClass} ${iconTextClass}`}>
            {icon}
          </div>
        )}
        <span className="font-semibold text-sm text-gray-300">{label}</span>
      </div>
      <span className={`font-medium text-sm ${valueClass}`}>{value ?? "-"}</span>
    </div>
  );

  return (
    <div className={`p-4 transition-all duration-300 ${className}`}>
      <div className="max-w-md mx-auto">
        {/* Profile Header */}
        <div className="flex flex-col items-center p-5 mb-5 rounded-xl bg-gray-800 border border-gray-700">
          {username && (
            <img
              src={`https://images.hive.blog/u/${username}/avatar`}
              alt={`${username} avatar`}
              className="w-16 h-16 rounded-full border-3 border-blue-500/30 mb-2.5 transition-transform hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${username}&background=random`;
              }}
            />
          )}
          <div className="text-base font-bold text-white">{username}</div>
          <div className="text-xs text-gray-400">Hive Wallet Overview</div>
        </div>

        {/* Estimated Value Card */}
        <div className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 p-5 mb-5 transition-all duration-300 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-blue-500/10">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs font-semibold text-blue-100/80">Estimated Value</div>
            <CurrencyDropdown />
          </div>
          <div className="text-2xl font-bold text-white text-center">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span className="text-lg">Loading...</span>
              </div>
            ) : (
              walletData?.estimated_value ?? "-"
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 mb-4 text-sm">
            <FaExclamationTriangle className="mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <WalletTile
          label="Balance"
          value={walletData?.balance}
          icon={<FaWallet />}
          iconBgClass="bg-blue-500/15"
          iconTextClass="text-blue-400"
          valueClass="text-blue-300"
        />
        <WalletTile
          label="HBD Balance"
          value={walletData?.hbd_balance}
          icon={<FaMoneyBill />}
          iconBgClass="bg-emerald-500/15"
          iconTextClass="text-emerald-400"
          valueClass="text-emerald-300"
        />
        <WalletTile
          label="Savings Balance"
          value={walletData?.savings_balance}
          icon={<FaPiggyBank />}
          iconBgClass="bg-amber-500/15"
          iconTextClass="text-amber-400"
          valueClass="text-amber-300"
        />
        <WalletTile
          label="Savings HBD"
          value={walletData?.savings_hbd_balance}
          icon={<FaCoins />}
          iconBgClass="bg-purple-500/15"
          iconTextClass="text-purple-400"
          valueClass="text-purple-300"
        />
        <WalletTile
          label="Hive Power"
          value={walletData?.hive_power}
          icon={<FaBolt />}
          iconBgClass="bg-orange-500/15"
          iconTextClass="text-orange-400"
          valueClass="text-orange-300"
        />

        {/* Transaction History */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-bold text-gray-300 tracking-wide uppercase">
              Transaction History
            </h3>
            {transactions.length > 0 && (
              <span className="text-xs text-gray-500">
                {transactions.length} transactions
              </span>
            )}
          </div>

          {isLoadingTransactions && (
            <div className="flex items-center justify-center p-8">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin"></div>
                <span className="text-sm text-gray-400">Loading transactions...</span>
              </div>
            </div>
          )}

          {transactionError && (
            <div className="flex items-center p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 mb-4 text-sm">
              <FaExclamationTriangle className="mr-2 flex-shrink-0" />
              <span>{transactionError}</span>
            </div>
          )}

          {!isLoadingTransactions && !transactionError && transactions.length === 0 && (
            <div className="text-center p-8 rounded-lg bg-gray-800 border border-gray-700">
              <p className="text-sm text-gray-500">No transactions found</p>
            </div>
          )}

          {!isLoadingTransactions &&
            username &&
            transactions.map((tx) => (
              <TransactionRow key={tx.trx_id + tx.id} tx={tx} />
            ))}
        </div>
      </div>
    </div>
  );
};

export default Wallet;
