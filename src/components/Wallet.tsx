import React, { useEffect, useState, useRef, type JSX } from "react";
import {
  FaWallet,
  FaMoneyBill,
  FaCoins,
  FaBolt,
  FaExclamationTriangle,
  FaArrowUp,
  FaArrowDown,
  FaChevronDown,
} from "react-icons/fa";
import { useWalletStore, SUPPORTED_CURRENCIES } from "../store/walletStore";
import type { Transaction, WalletData } from "../types/wallet";
import { Delegations, type DelegationsProps } from "./Delegations";
import {
  TransferModal,
  PowerUpModal,
  PowerDownModal,
  SavingsModal,
  ConfirmActionModal,
  type Currency,
} from "./WalletActionModals";

interface WalletProps {
  username?: string;
  className?: string;
  /** The actual scroll container this wallet lives inside. When provided,
   *  the transaction-history infinite scroll observes it directly instead
   *  of the viewport — `root: null` is unreliable inside the profile's
   *  nested scroll pane (the sentinel never crosses the viewport). */
  scrollRootRef?: React.RefObject<HTMLElement | null>;
  /** Logged-in user — when equal to `username`, RC Update / Delete buttons
   *  and Delegate HP/RC buttons are exposed (and only fire when the matching
   *  callbacks below are wired). */
  currentUsername?: string;
  onUpdateRcDelegation?: DelegationsProps["onUpdateRcDelegation"];
  onDeleteRcDelegation?: DelegationsProps["onDeleteRcDelegation"];
  onCreateHpDelegation?: DelegationsProps["onCreateHpDelegation"];
  onCreateRcDelegation?: DelegationsProps["onCreateRcDelegation"];
  /** Hide the Delegated HIVE / RC panel inside the wallet view. */
  hideDelegations?: boolean;
  /** Wallet actions — only surfaced when `currentUsername === username`.
   *  Each returns `false` to indicate cancellation (keychain denied) so the
   *  modal stays open; void / true closes the modal. */
  onTransfer?: (
    to: string,
    amount: string,
    currency: Currency,
    memo: string,
  ) => void | boolean | Promise<void | boolean>;
  onPowerUp?: (
    to: string,
    amount: string,
  ) => void | boolean | Promise<void | boolean>;
  onPowerDown?: (hp: string) => void | boolean | Promise<void | boolean>;
  onTransferToSavings?: (
    currency: Currency,
    amount: string,
    memo: string,
  ) => void | boolean | Promise<void | boolean>;
  onTransferFromSavings?: (
    currency: Currency,
    amount: string,
    memo: string,
  ) => void | boolean | Promise<void | boolean>;
  /** Cancels the in-progress HP power-down (broadcasts `withdraw_vesting`
   *  with 0 vests). Surfaces a STOP button on the Hive Power row when the
   *  account has an active vesting_withdraw_rate. */
  onStopPowerDown?: () => void | boolean | Promise<void | boolean>;
  /** Cancels a single pending savings withdrawal via
   *  `cancel_transfer_from_savings`. Surfaces a STOP button next to each
   *  pending request. */
  onCancelSavingsWithdrawal?: (
    requestId: number,
  ) => void | boolean | Promise<void | boolean>;
  /** Claim unclaimed reward balances. Receives the three reward strings
   *  the consumer must pass to `claim_reward_balance`. Surfaces a
   *  "Pending Rewards" card with a CLAIM button when any reward balance
   *  on the account is non-zero. */
  onClaimRewards?: (rewards: {
    hive: string;
    hbd: string;
    vests: string;
  }) => void | boolean | Promise<void | boolean>;
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

/** Try to parse a transfer memo as a structured tip payload (peak.snaps
 *  / commentrewarder / etc.). Recognises `key: value` lines and only
 *  returns a result if the typical tip markers (`author:` AND either
 *  `sender:` or `app:`) are present — so a regular promo memo with
 *  one stray colon doesn't get mis-rendered as a tip block. */
function parseTipMemo(memo: string): Record<string, string> | null {
  if (!memo || memo.indexOf(':') === -1) return null;
  const lines = memo.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: Record<string, string> = {};
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!key || !value) continue;
    // Only collect a known whitelist of tip keys so a sentence like
    // "Hello: visit our site" doesn't blow open into the structured
    // renderer.
    if (['author', 'post', 'sender', 'app', 'message'].includes(key)) {
      out[key] = value;
    }
  }
  if (!out.author) return null;
  if (!out.sender && !out.app) return null;
  return out;
}

/** Map a Transaction onto a human title + presentation kind. Pulled
 *  out of the row component so the logic stays inspectable. */
function describeTx(tx: Transaction): {
  title: string;
  kind: 'tip' | 'transfer' | 'power' | 'reward' | 'market' | 'delegation' | 'other';
  tipData?: Record<string, string>;
  badge?: 'in' | 'out';
} {
  const memo = tx.memo || '';
  // Memo-driven flavour markers (set by the mapper for non-transfer
  // ops). Detect them first so the generic transfer branch doesn't
  // wrongly fire on, e.g., "Power up".
  if (memo === 'Stopped power down' || memo === 'Started power down') {
    return { title: memo, kind: 'power' };
  }
  if (memo.startsWith('Power up') || memo.startsWith('Power down')) {
    return { title: memo, kind: 'power', badge: tx.type === 'sent' ? 'out' : 'in' };
  }
  if (memo === 'Claimed rewards') return { title: 'Claimed rewards', kind: 'reward' };
  if (memo.startsWith('Author reward')) return { title: 'Author reward', kind: 'reward' };
  if (memo === 'Producer reward') return { title: 'Producer reward', kind: 'reward' };
  if (memo === 'Benefactor reward') return { title: 'Benefactor reward', kind: 'reward' };
  if (memo.startsWith('Curation')) return { title: 'Curation reward', kind: 'reward' };
  if (memo === 'Market fill') return { title: 'Market fill', kind: 'market' };
  if (memo.startsWith('Delegate HP') || memo === 'Delegation returned') {
    return { title: memo, kind: 'delegation' };
  }
  if (memo === 'Recurrent fill' || memo.startsWith('Recurrent')) {
    return {
      title: tx.type === 'sent' ? `Recurrent sent to ${tx.to}` : `Recurrent received from ${tx.from}`,
      kind: 'transfer',
      badge: tx.type === 'sent' ? 'out' : 'in',
    };
  }
  if (memo.startsWith('Savings deposit')) {
    return { title: 'Savings deposit', kind: 'transfer', badge: 'out' };
  }
  if (memo.startsWith('Savings withdraw')) {
    return { title: 'Savings withdraw', kind: 'transfer', badge: 'in' };
  }

  // Regular transfer. Inspect the memo for tip-style key/value lines
  // — peak.snaps / commentrewarder / etc. write structured memos so
  // we render them in a code-style block rather than as one long
  // string of "author: foo\nsender: bar".
  const tipData = parseTipMemo(memo);
  if (tipData) {
    const sender = tipData.sender || tx.from;
    return {
      title: tx.type === 'received' ? `Tip received from ${sender}` : `Tip sent to ${tx.to}`,
      kind: 'tip',
      tipData,
      badge: tx.type === 'sent' ? 'out' : 'in',
    };
  }
  return {
    title: tx.type === 'sent' ? `Sent to ${tx.to}` : `Received from ${tx.from}`,
    kind: 'transfer',
    badge: tx.type === 'sent' ? 'out' : 'in',
  };
}

const TransactionRow: React.FC<{ tx: Transaction }> = ({ tx }) => {
  const isSent = tx.type === "sent";
  const otherUser = isSent ? tx.to : tx.from;
  const meta = describeTx(tx);
  const tip = meta.tipData;

  return (
    <div className="flex items-start gap-2.5 p-2.5 sm:p-3.5 rounded-lg bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)] mb-2 transition-all duration-200 hover:bg-[var(--hrk-bg-surface-raised)] hover:border-[var(--hrk-border-default)] min-w-0">
      {/* Avatar with directional badge — replaces the separate arrow column
          so narrow rows don't burn 32px on metadata. */}
      <div className="relative flex-shrink-0">
        <img
          src={`https://images.hive.blog/u/${otherUser}/avatar`}
          alt={otherUser}
          className="w-9 h-9 rounded-full border border-[var(--hrk-border-subtle)]"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${otherUser}&background=random&size=36`;
          }}
        />
        <span
          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--hrk-border-subtle)] flex items-center justify-center ${
            isSent ? "bg-red-500/90 text-white" : "bg-emerald-500/90 text-white"
          }`}
        >
          {isSent ? <FaArrowUp size={7} /> : <FaArrowDown size={7} />}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        {/* Top line — operation title & amount share the row so neither
            gets squashed by a fixed-width sibling. */}
        <div className="flex items-baseline justify-between gap-2 min-w-0">
          <span className="text-sm font-semibold text-[var(--hrk-text-primary)] truncate">
            {meta.title}
          </span>
          <span
            className={`text-xs sm:text-sm font-bold whitespace-nowrap ${
              isSent ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {isSent ? "-" : "+"}{tx.amount}
          </span>
        </div>
        {/* Sub line — timestamp on its own row so the title above can
            breathe at full width. */}
        <div className="text-[11px] text-[var(--hrk-text-tertiary)] mt-0.5 truncate">
          {formatTimeAgo(tx.timestamp)}
        </div>

        {tip ? (
          // Structured tip detail block — mirrors peakd's tip card so
          // a glance tells the user which post was tipped and from
          // which app. Values use the brand-blue accent to lift them
          // off the muted keys.
          <pre className="mt-2 max-w-full overflow-x-auto rounded-md border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-app)] px-2.5 py-2 font-mono text-[11px] leading-relaxed text-[var(--hrk-text-tertiary)] whitespace-pre-wrap break-words">
            {(['author', 'post', 'sender', 'app', 'message'] as const).map((k) =>
              tip[k] ? (
                <div key={k}>
                  <span className="text-[var(--hrk-text-tertiary)]">{k}:</span>{' '}
                  <span className="text-blue-400">{tip[k]}</span>
                </div>
              ) : null,
            )}
          </pre>
        ) : tx.memo && meta.kind === 'transfer' ? (
          // Plain transfer with a non-structured memo — keep it short
          // so promo spam doesn't dominate the row.
          <p className="mt-1 text-[11px] text-[var(--hrk-text-tertiary)] line-clamp-2">
            {tx.memo}
          </p>
        ) : null}
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

  // Build ordered currency list: USD first, local currency second, GTQ third, then rest
  const pinnedCodes = ["USD", localCurrency, "GTQ"];
  const orderedCurrencies = React.useMemo(() => {
    const usd = SUPPORTED_CURRENCIES.find((c) => c.code === "USD")!;
    const local = localCurrency !== "USD" ? SUPPORTED_CURRENCIES.find((c) => c.code === localCurrency) : null;
    const gtq = localCurrency !== "GTQ" ? SUPPORTED_CURRENCIES.find((c) => c.code === "GTQ") : null;
    const rest = SUPPORTED_CURRENCIES.filter(
      (c) => !pinnedCodes.includes(c.code) && exchangeRates[c.code]
    );
    return [usd, ...(local ? [local] : []), ...(gtq ? [gtq] : []), ...rest];
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
        <div className="absolute top-full mt-1 right-0 w-56 max-h-64 overflow-y-auto rounded-lg bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-default)] shadow-xl z-50 scrollbar-hide">
          {orderedCurrencies.map((currency, index) => (
            <React.Fragment key={currency.code}>
              {/* Divider after pinned currencies */}
              {index === (localCurrency !== "USD" ? 3 : 2) && (
                <div className="border-t border-[var(--hrk-border-default)] my-1" />
              )}
              <button
                onClick={() => {
                  setSelectedCurrency(currency.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--hrk-bg-surface-raised)] ${
                  selectedCurrency === currency.code
                    ? "bg-blue-500/20 text-blue-300"
                    : "text-[var(--hrk-text-secondary)]"
                }`}
              >
                <span className="w-6 text-center font-medium text-[var(--hrk-text-tertiary)]">
                  {getCurrencySymbol(currency.code)}
                </span>
                <span className="font-medium">{currency.code}</span>
                <span className="text-xs text-[var(--hrk-text-tertiary)] truncate">{currency.name}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

interface BalanceRowProps {
  icon: JSX.Element;
  iconBg: string;
  iconText: string;
  label: string;
  value: string;
  valueText: string;
  actions?: { label: string; onClick: () => void; variant?: "primary" | "secondary" }[];
}

const BalanceRow: React.FC<BalanceRowProps> = ({
  icon, iconBg, iconText, label, value, valueText, actions,
}) => (
  <div className="p-3 sm:p-3.5 rounded-lg bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)] mb-2.5 transition-all duration-200 hover:bg-[var(--hrk-bg-surface-raised)] hover:border-[var(--hrk-border-default)] min-w-0">
    <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className={`p-2 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg} ${iconText}`}>
          {icon}
        </div>
        <span className="font-semibold text-xs sm:text-sm text-[var(--hrk-text-secondary)] truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 ml-auto flex-wrap justify-end">
        <span className={`font-medium text-xs sm:text-sm whitespace-nowrap ${valueText}`}>{value}</span>
        {actions && actions.length > 0 && (
          <div className="flex gap-2 flex-wrap justify-end">
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={a.onClick}
                className={`px-3 py-1.5 rounded-[10px] text-[11px] sm:text-xs font-semibold tracking-wide transition-colors ${
                  a.variant === "secondary"
                    ? "bg-[var(--hrk-bg-surface-sunken)] border border-[var(--hrk-border-subtle)] text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-surface-raised)] hover:border-[var(--hrk-border-default)]"
                    : "bg-[var(--hrk-info)] text-[var(--hrk-text-on-brand)] hover:brightness-110"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

const WalletTile: React.FC<WalletTileProps & {
  actions?: { label: string; onClick: () => void; variant?: "primary" | "secondary" }[];
}> = ({
  label,
  value,
  icon,
  iconBgClass = "bg-blue-500/15",
  iconTextClass = "text-blue-400",
  valueClass = "text-[var(--hrk-text-primary)]",
  actions,
}) => (
  <div className="p-3 sm:p-3.5 rounded-lg bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)] mb-2.5 transition-all duration-200 hover:bg-[var(--hrk-bg-surface-raised)] hover:border-[var(--hrk-border-default)] min-w-0">
    <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {icon && (
          <div className={`p-2 rounded-full flex items-center justify-center flex-shrink-0 ${iconBgClass} ${iconTextClass}`}>
            {icon}
          </div>
        )}
        <span className="font-semibold text-xs sm:text-sm text-[var(--hrk-text-secondary)] truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 ml-auto flex-wrap justify-end">
        <span className={`font-medium text-xs sm:text-sm whitespace-nowrap ${valueClass}`}>{value ?? "-"}</span>
        {actions && actions.length > 0 && (
          <div className="flex gap-2 flex-wrap justify-end">
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={a.onClick}
                className={`px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold tracking-wide transition-colors ${
                  a.variant === "secondary"
                    ? "bg-[var(--hrk-bg-surface-raised)] text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-hover)]"
                    : "bg-blue-600 text-white hover:bg-blue-500"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

interface ExpandableBalancesProps {
  walletData: WalletData | null;
  isOwn: boolean;
  onTransferHive?: () => void;
  onPowerUp?: () => void;
  onAddSavingsHbd?: () => void;
  onRemoveSavingsHbd?: () => void;
  onPowerDown?: () => void;
  onStopPowerDown?: () => void;
  onCancelSavingsWithdrawal?: (requestId: number) => void;
}

function formatDaysFromNow(iso?: string): string {
  if (!iso) return "";
  const t = new Date(/Z|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`).getTime();
  const ms = t - Date.now();
  if (ms <= 0) return "any moment";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

const ExpandableBalances: React.FC<ExpandableBalancesProps> = ({
  walletData,
  isOwn,
  onTransferHive,
  onPowerUp,
  onAddSavingsHbd,
  onRemoveSavingsHbd,
  onPowerDown,
  onStopPowerDown,
  onCancelSavingsWithdrawal,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const pending = walletData?.pending_savings_withdrawals ?? [];
  const powerDownActive = !!walletData?.power_down_active;

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 rounded-lg bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)] mb-2.5 transition-all duration-200 hover:bg-[var(--hrk-bg-surface-raised)] hover:border-[var(--hrk-border-default)]"
      >
        <span className="font-semibold text-sm text-[var(--hrk-text-secondary)]">All Balances</span>
        <FaChevronDown
          size={12}
          className={`text-[var(--hrk-text-tertiary)] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>
      {isExpanded && (
        <div className="ml-2 border-l-2 border-[var(--hrk-border-subtle)] pl-2 space-y-0">
          <BalanceRow
            icon={<FaWallet />}
            iconBg="bg-blue-500/15"
            iconText="text-blue-400"
            label="Balance"
            value={walletData?.balance ?? "-"}
            valueText="text-blue-300"
            actions={isOwn && (onTransferHive || onPowerUp) ? [
              ...(onTransferHive ? [{ label: "Transfer", onClick: onTransferHive }] : []),
              ...(onPowerUp ? [{ label: "Power Up", onClick: onPowerUp, variant: "secondary" as const }] : []),
            ] : undefined}
          />
          <BalanceRow
            icon={<FaCoins />}
            iconBg="bg-purple-500/15"
            iconText="text-purple-400"
            label="Savings HBD"
            value={walletData?.savings_hbd_balance ?? "-"}
            valueText="text-purple-300"
            actions={isOwn && (onAddSavingsHbd || onRemoveSavingsHbd) ? [
              ...(onAddSavingsHbd ? [{ label: "Add", onClick: onAddSavingsHbd }] : []),
              ...(onRemoveSavingsHbd ? [{ label: "Remove", onClick: onRemoveSavingsHbd, variant: "secondary" as const }] : []),
            ] : undefined}
          />

          {/* Pending HBD savings withdrawals — STOP per request (cancel_transfer_from_savings). */}
          {pending.length > 0 && (
            <div className="ml-2 p-3 rounded-lg bg-[var(--hrk-bg-app)] border border-[var(--hrk-border-subtle)] mb-2.5">
              <div className="text-xs font-semibold text-[var(--hrk-text-secondary)] mb-2">
                Pending withdraws from savings
              </div>
              <div className="space-y-2">
                {pending.map((w) => (
                  <div
                    key={w.request_id}
                    className="flex items-center justify-between gap-2 text-xs text-[var(--hrk-text-secondary)] flex-wrap"
                  >
                    <span>
                      <span className="text-purple-300">{w.amount}</span>{" "}
                      withdraw will complete in{" "}
                      <span className="text-[var(--hrk-text-primary)]">{formatDaysFromNow(w.complete)}</span>
                    </span>
                    {isOwn && onCancelSavingsWithdrawal && (
                      <button
                        onClick={() => onCancelSavingsWithdrawal(w.request_id)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide bg-red-600/20 text-red-300 border border-red-500/40 hover:bg-red-600/30 transition-colors"
                      >
                        STOP
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <BalanceRow
            icon={<FaBolt />}
            iconBg="bg-orange-500/15"
            iconText="text-orange-400"
            label="Hive Power"
            value={walletData?.hive_power ?? "-"}
            valueText="text-orange-300"
            actions={isOwn ? [
              ...(onPowerDown ? [{ label: "Power Down", onClick: onPowerDown, variant: "secondary" as const }] : []),
              ...(powerDownActive && onStopPowerDown ? [{ label: "Stop Power Down", onClick: onStopPowerDown }] : []),
            ] : undefined}
          />

          {/* Active power-down schedule banner. Shown alongside the STOP button
              so the user sees why STOP is offered. */}
          {powerDownActive && walletData?.power_down_hp_per_week && (
            <div className="ml-2 p-3 rounded-lg bg-[var(--hrk-bg-app)] border border-orange-500/30 mb-2.5 text-xs text-[var(--hrk-text-secondary)]">
              An unstake (power down) is in progress —{" "}
              <span className="text-orange-300">
                ~{walletData.power_down_hp_per_week} HIVE / week
              </span>
              {walletData.next_vesting_withdrawal && (
                <>
                  ; next payout in{" "}
                  <span className="text-[var(--hrk-text-primary)]">
                    {formatDaysFromNow(walletData.next_vesting_withdrawal)}
                  </span>
                </>
              )}
              .
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const Wallet: React.FC<WalletProps> = ({
  username,
  className = "",
  scrollRootRef,
  currentUsername,
  onUpdateRcDelegation,
  onDeleteRcDelegation,
  onCreateHpDelegation,
  onCreateRcDelegation,
  hideDelegations = false,
  onTransfer,
  onPowerUp,
  onPowerDown,
  onTransferToSavings,
  onTransferFromSavings,
  onStopPowerDown,
  onCancelSavingsWithdrawal,
  onClaimRewards,
}) => {
  const {
    walletData,
    fetchWalletData,
    isLoading,
    error,
    transactions,
    fetchTransactions,
    fetchMoreTransactions,
    hasMoreTransactions,
    isLoadingMoreTransactions,
    isLoadingTransactions,
    transactionError,
  } = useWalletStore();

  const [filterOutgoing, setFilterOutgoing] = useState(false);
  const [filterIncoming, setFilterIncoming] = useState(false);
  const [filterExcludeSpam, setFilterExcludeSpam] = useState(false);
  const [filterTransfers, setFilterTransfers] = useState(false);

  const filteredTransactions = React.useMemo(() => {
    return transactions.filter((tx) => {
      const isSent = tx.type === "sent";

      // 1 & 2. Outgoing / Incoming filter
      // If either filter is active, only show the active one(s). Otherwise show both.
      if (filterOutgoing || filterIncoming) {
        if (isSent && !filterOutgoing) return false;
        if (!isSent && !filterIncoming) return false;
      }

      // 3. Exclude 0.001
      if (filterExcludeSpam) {
        const isZeroZeroOne = tx.amount.startsWith("0.001 ") || tx.amount === "0.001";
        if (isZeroZeroOne) return false;
      }

      // 4. Transfers (only show transfer/tip kind)
      if (filterTransfers) {
        const meta = describeTx(tx);
        const isTransfer = meta.kind === "transfer" || meta.kind === "tip";
        if (!isTransfer) return false;
      }

      return true;
    });
  }, [transactions, filterOutgoing, filterIncoming, filterExcludeSpam, filterTransfers]);

  // Sentinel for infinite scroll on the transaction history list. We
  // attach a scroll listener to the nearest scrollable ancestor of this
  // sentinel (could be the kit's mainScrollRef when embedded in the
  // user profile page, or the window when used standalone).
  const txSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (username) {
      fetchWalletData(username);
      fetchTransactions(username);
    }
  }, [username, fetchWalletData, fetchTransactions]);

  // Infinite scroll — mirrors the UserDetailProfile Comments tab: a
  // direct, rAF-throttled scroll listener on the actual scroll container
  // (caller-supplied `scrollRootRef`, else the nearest scrollable
  // ancestor, else the window). Scroll events fire on every scroll
  // regardless of layout, so this is the bulletproof approach (an
  // IntersectionObserver needed its `root` pinned to exactly the right
  // element to work inside nested panes).
  const findTxScrollEl = React.useCallback((): HTMLElement | null => {
    const fromRef = scrollRootRef?.current;
    if (fromRef) return fromRef;
    let el: HTMLElement | null = txSentinelRef.current?.parentElement || null;
    while (el && el !== document.body && el !== document.documentElement) {
      const { overflowY } = window.getComputedStyle(el);
      if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) return el;
      el = el.parentElement;
    }
    return null;
  }, [scrollRootRef]);

  useEffect(() => {
    if (!username || !hasMoreTransactions) return;
    const el = findTxScrollEl();
    const THRESHOLD = 600;
    const nearBottom = () => {
      if (el) return el.scrollTop + el.clientHeight >= el.scrollHeight - THRESHOLD;
      const doc = document.scrollingElement ?? document.documentElement;
      return window.scrollY + window.innerHeight >= doc.scrollHeight - THRESHOLD;
    };
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (!isLoadingMoreTransactions && nearBottom()) fetchMoreTransactions(username);
      });
    };
    const target: EventTarget = el ?? window;
    target.addEventListener("scroll", onScroll, { passive: true } as AddEventListenerOptions);
    return () => target.removeEventListener("scroll", onScroll);
  }, [username, hasMoreTransactions, isLoadingMoreTransactions, fetchMoreTransactions, findTxScrollEl]);

  // Peek after a load completes: if the new page didn't make the content
  // taller than the viewport, the scroll listener never fires again —
  // so check the position and load again, bounded by hasMore/loading.
  useEffect(() => {
    if (!username || !hasMoreTransactions || isLoadingMoreTransactions) return;
    const el = findTxScrollEl();
    const THRESHOLD = 600;
    const near = el
      ? el.scrollTop + el.clientHeight >= el.scrollHeight - THRESHOLD
      : window.scrollY + window.innerHeight >= (document.scrollingElement ?? document.documentElement).scrollHeight - THRESHOLD;
    if (near) fetchMoreTransactions(username);
  }, [username, hasMoreTransactions, isLoadingMoreTransactions, transactions.length, fetchMoreTransactions, findTxScrollEl]);

  const isOwn = !!username && !!currentUsername &&
    username.toLowerCase() === currentUsername.toLowerCase();

  /**
   * Schedule a wallet refresh ~4s after a successful broadcast. Hive nodes
   * take a few seconds to confirm the operation and update `getAccounts` —
   * pulling immediately would just re-fetch the pre-transaction snapshot.
   */
  const scheduleRefresh = React.useCallback(() => {
    if (!username) return;
    setTimeout(() => {
      fetchWalletData(username);
      fetchTransactions(username);
    }, 4000);
  }, [username, fetchWalletData, fetchTransactions]);

  /**
   * Wrap a modal onSubmit so the wallet auto-refreshes when the consumer
   * reports success (i.e. the callback didn't return `false`).
   */
  const withRefresh = <Args extends unknown[]>(
    fn?: (...args: Args) => void | boolean | Promise<void | boolean>,
  ) => fn
    ? async (...args: Args): Promise<void | boolean> => {
        const res = await fn(...args);
        if (res !== false) scheduleRefresh();
        return res;
      }
    : undefined;

  type ActionModal =
    | { kind: "transfer"; initialCurrency: Currency }
    | { kind: "powerUp" }
    | { kind: "powerDown" }
    | { kind: "savingsAdd"; currency: Currency }
    | { kind: "savingsRemove"; currency: Currency }
    | { kind: "stopPowerDown" }
    | { kind: "cancelSavingsWithdrawal"; requestId: number; amount: string }
    | null;
  const [activeModal, setActiveModal] = useState<ActionModal>(null);
  const [claiming, setClaiming] = useState(false);

  type WalletSubTab = "delegations" | "transactions";
  const [subTab, setSubTab] = useState<WalletSubTab>("delegations");
  // If delegations are hidden by the consumer, default to transactions so the
  // user never lands on a hidden tab.
  useEffect(() => {
    if (hideDelegations && subTab === "delegations") setSubTab("transactions");
  }, [hideDelegations, subTab]);

  const subTabBtn = (active: boolean) =>
    `flex-1 py-2 sm:py-2.5 px-2 text-[11px] sm:text-xs font-semibold tracking-wide rounded transition-colors whitespace-nowrap ${
      active ? "bg-teal-600 text-white" : "bg-[var(--hrk-bg-surface)] text-[var(--hrk-text-secondary)] hover:bg-[var(--hrk-bg-surface-raised)]"
    }`;

  return (
    <div className={`p-2 sm:p-4 transition-all duration-300 min-w-0 ${className}`}>
      <div className="max-w-3xl mx-auto min-w-0">
        {/* Profile Header */}
        <div className="flex flex-col items-center p-4 sm:p-5 mb-4 sm:mb-5 rounded-xl bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)]">
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
          <div className="text-xs text-[var(--hrk-text-tertiary)]">Hive Wallet Overview</div>
        </div>

        {/* Estimated Value Card */}
        <div className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 p-4 sm:p-5 mb-4 sm:mb-5 transition-all duration-300 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-blue-500/10">
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

        {/* Pending Rewards card — only renders when ANY of the three
            reward balances on the account is non-zero. Mirrors peakd's
            "Pending Rewards" pill above the wallet rows. Tapping CLAIM
            broadcasts `claim_reward_balance` via the consumer's
            `onClaimRewards` callback; we don't fire the broadcast
            ourselves so the kit stays signing-method agnostic. */}
        {isOwn && onClaimRewards && (() => {
          const hive = parseFloat((walletData?.reward_hive_balance ?? "0").split(" ")[0] || "0");
          const hbd = parseFloat((walletData?.reward_hbd_balance ?? "0").split(" ")[0] || "0");
          const vests = parseFloat((walletData?.reward_vesting_balance ?? "0").split(" ")[0] || "0");
          const vestingHive = parseFloat((walletData?.reward_vesting_hive ?? "0").split(" ")[0] || "0");
          if (hive <= 0 && hbd <= 0 && vests <= 0) return null;
          const parts: string[] = [];
          if (hive > 0) parts.push(walletData?.reward_hive_balance ?? "");
          if (hbd > 0) parts.push(walletData?.reward_hbd_balance ?? "");
          // Show HP equivalent (`reward_vesting_hive`) rather than raw VESTS
          // — matches what peakd shows in the same card.
          if (vests > 0 && vestingHive > 0) parts.push(`${vestingHive.toFixed(3)} HP`);
          return (
            <div className="p-3 sm:p-4 rounded-lg bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-700/40 mb-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
                  Pending Rewards
                </div>
                <div className="text-xs text-amber-200/80 mt-0.5">
                  {parts.length > 0
                    ? parts.join("  ·  ")
                    : "You have some pending rewards to claim."}
                </div>
              </div>
              <button
                disabled={claiming}
                onClick={async () => {
                  setClaiming(true);
                  try {
                    const res = await onClaimRewards({
                      hive: walletData?.reward_hive_balance ?? "0.000 HIVE",
                      hbd: walletData?.reward_hbd_balance ?? "0.000 HBD",
                      vests: walletData?.reward_vesting_balance ?? "0.000000 VESTS",
                    });
                    if (res !== false) scheduleRefresh();
                  } finally {
                    setClaiming(false);
                  }
                }}
                className="px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              >
                {claiming ? "Claiming…" : "CLAIM"}
              </button>
            </div>
          );
        })()}

        <WalletTile
          label="HBD Balance"
          value={walletData?.hbd_balance}
          icon={<FaMoneyBill />}
          iconBgClass="bg-emerald-500/15"
          iconTextClass="text-emerald-400"
          valueClass="text-emerald-300"
          actions={isOwn && onTransfer ? [
            { label: "Transfer", onClick: () => setActiveModal({ kind: "transfer", initialCurrency: "HBD" }) },
          ] : undefined}
        />

        {/* Expandable All Balances */}
        <ExpandableBalances
          walletData={walletData}
          isOwn={isOwn}
          onTransferHive={onTransfer ? () => setActiveModal({ kind: "transfer", initialCurrency: "HIVE" }) : undefined}
          onPowerUp={onPowerUp ? () => setActiveModal({ kind: "powerUp" }) : undefined}
          onAddSavingsHbd={onTransferToSavings ? () => setActiveModal({ kind: "savingsAdd", currency: "HBD" }) : undefined}
          onRemoveSavingsHbd={onTransferFromSavings ? () => setActiveModal({ kind: "savingsRemove", currency: "HBD" }) : undefined}
          onPowerDown={onPowerDown ? () => setActiveModal({ kind: "powerDown" }) : undefined}
          onStopPowerDown={onStopPowerDown ? () => setActiveModal({ kind: "stopPowerDown" }) : undefined}
          onCancelSavingsWithdrawal={onCancelSavingsWithdrawal ? (requestId) => {
            const w = walletData?.pending_savings_withdrawals?.find(p => p.request_id === requestId);
            setActiveModal({ kind: "cancelSavingsWithdrawal", requestId, amount: w?.amount ?? "" });
          } : undefined}
        />

        {/* Sub-tabs: Delegations / Transaction History */}
        <div className="mt-4 sm:mt-5 flex gap-2 mb-3">
          {!hideDelegations && (
            <button
              onClick={() => setSubTab("delegations")}
              className={subTabBtn(subTab === "delegations")}
            >
              <span className="sm:hidden">Delegations</span>
              <span className="hidden sm:inline">DELEGATIONS</span>
            </button>
          )}
          <button
            onClick={() => setSubTab("transactions")}
            className={subTabBtn(subTab === "transactions")}
          >
            <span className="sm:hidden">Transactions</span>
            <span className="hidden sm:inline">TRANSACTION HISTORY</span>
          </button>
        </div>

        {subTab === "delegations" && !hideDelegations && username && (
          <Delegations
            username={username}
            currentUsername={currentUsername}
            onUpdateRcDelegation={onUpdateRcDelegation}
            onDeleteRcDelegation={onDeleteRcDelegation}
            onCreateHpDelegation={onCreateHpDelegation}
            onCreateRcDelegation={onCreateRcDelegation}
          />
        )}

        {subTab === "transactions" && (
          <div className="rounded-xl bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)] p-2 sm:p-4 min-w-0">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-bold text-[var(--hrk-text-secondary)] tracking-wide uppercase">
                Transaction History
              </h3>
              {filteredTransactions.length !== transactions.length ? (
                <span className="text-xs text-[var(--hrk-text-tertiary)]">
                  Showing {filteredTransactions.length} of {transactions.length}
                </span>
              ) : transactions.length > 0 ? (
                <span className="text-xs text-[var(--hrk-text-tertiary)]">
                  {transactions.length} transactions
                </span>
              ) : null}
            </div>

            {/* Filter checkboxes */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 px-2 py-2 bg-[var(--hrk-bg-surface-raised)]/35 rounded-lg border border-[var(--hrk-border-subtle)]/50 text-xs text-[var(--hrk-text-secondary)] font-medium">
              <label className="flex items-center gap-2 cursor-pointer select-none hover:text-white transition-colors">
                <input
                  type="checkbox"
                  checked={filterOutgoing}
                  onChange={(e) => setFilterOutgoing(e.target.checked)}
                  className="rounded border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] text-blue-500 focus:ring-blue-500 focus:ring-offset-[var(--hrk-bg-surface)] cursor-pointer w-3.5 h-3.5"
                />
                <span>Outgoing</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none hover:text-white transition-colors">
                <input
                  type="checkbox"
                  checked={filterIncoming}
                  onChange={(e) => setFilterIncoming(e.target.checked)}
                  className="rounded border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] text-blue-500 focus:ring-blue-500 focus:ring-offset-[var(--hrk-bg-surface)] cursor-pointer w-3.5 h-3.5"
                />
                <span>Incoming</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none hover:text-white transition-colors">
                <input
                  type="checkbox"
                  checked={filterExcludeSpam}
                  onChange={(e) => setFilterExcludeSpam(e.target.checked)}
                  className="rounded border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] text-blue-500 focus:ring-blue-500 focus:ring-offset-[var(--hrk-bg-surface)] cursor-pointer w-3.5 h-3.5"
                />
                <span>Exclude 0.001</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none hover:text-white transition-colors">
                <input
                  type="checkbox"
                  checked={filterTransfers}
                  onChange={(e) => setFilterTransfers(e.target.checked)}
                  className="rounded border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] text-blue-500 focus:ring-blue-500 focus:ring-offset-[var(--hrk-bg-surface)] cursor-pointer w-3.5 h-3.5"
                />
                <span>Transfers</span>
              </label>
            </div>

            {isLoadingTransactions && (
              <div className="flex items-center justify-center p-8">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-[var(--hrk-border-default)] border-t-blue-400 rounded-full animate-spin"></div>
                  <span className="text-sm text-[var(--hrk-text-tertiary)]">Loading transactions...</span>
                </div>
              </div>
            )}

            {transactionError && (
              <div className="flex items-center p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 mb-4 text-sm">
                <FaExclamationTriangle className="mr-2 flex-shrink-0" />
                <span>{transactionError}</span>
              </div>
            )}

            {!isLoadingTransactions && !transactionError && filteredTransactions.length === 0 && (
              <div className="text-center p-8 rounded-lg bg-[var(--hrk-bg-app)] border border-[var(--hrk-border-subtle)]">
                <p className="text-sm text-[var(--hrk-text-tertiary)]">No transactions found</p>
              </div>
            )}

            {!isLoadingTransactions &&
              username &&
              filteredTransactions.map((tx) => (
                <TransactionRow key={tx.trx_id + tx.id} tx={tx} />
              ))}

            {/* Infinite-scroll sentinel. Renders only when there are
                already transactions on screen and more pages remain — so
                we never trigger paging on an empty list or after the
                history has been exhausted. While a page is loading we show
                a spinner; otherwise a tappable "Load more" fallback so the
                user can always advance even if the scroll auto-trigger
                doesn't fire in a given layout. */}
            {!isLoadingTransactions && transactions.length > 0 && hasMoreTransactions && (
              <div ref={txSentinelRef} className="py-4 flex items-center justify-center">
                {isLoadingMoreTransactions ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-[var(--hrk-border-default)] border-t-blue-400 rounded-full animate-spin"></div>
                    <span className="text-xs text-[var(--hrk-text-tertiary)]">Loading more transactions…</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => username && fetchMoreTransactions(username)}
                    className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-default)] text-[var(--hrk-text-secondary)] hover:text-[var(--hrk-text-primary)] hover:border-blue-400/50 transition-colors"
                  >
                    Load more transactions
                  </button>
                )}
              </div>
            )}

            {!isLoadingTransactions && transactions.length > 0 && !hasMoreTransactions && (
              <div className="py-3 text-center text-[11px] text-[var(--hrk-text-tertiary)]">
                No more transactions
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Wallet action modals ──────────────────────────────────── */}
      {isOwn && username && activeModal?.kind === "transfer" && onTransfer && (
        <TransferModal
          from={username}
          hiveBalance={walletData?.balance}
          hbdBalance={walletData?.hbd_balance}
          initialCurrency={activeModal.initialCurrency}
          onClose={() => setActiveModal(null)}
          onSubmit={withRefresh(onTransfer)!}
        />
      )}
      {isOwn && username && activeModal?.kind === "powerUp" && onPowerUp && (
        <PowerUpModal
          from={username}
          hiveBalance={walletData?.balance}
          onClose={() => setActiveModal(null)}
          onSubmit={withRefresh(onPowerUp)!}
        />
      )}
      {isOwn && username && activeModal?.kind === "powerDown" && onPowerDown && (
        <PowerDownModal
          from={username}
          hivePower={walletData?.hive_power}
          onClose={() => setActiveModal(null)}
          onSubmit={withRefresh(onPowerDown)!}
        />
      )}
      {isOwn && username && activeModal?.kind === "savingsAdd" && onTransferToSavings && (
        <SavingsModal
          mode="add"
          from={username}
          currency={activeModal.currency}
          availableBalance={activeModal.currency === "HIVE" ? walletData?.balance : walletData?.hbd_balance}
          onClose={() => setActiveModal(null)}
          onSubmit={withRefresh(onTransferToSavings)!}
        />
      )}
      {isOwn && username && activeModal?.kind === "savingsRemove" && onTransferFromSavings && (
        <SavingsModal
          mode="remove"
          from={username}
          currency={activeModal.currency}
          availableBalance={activeModal.currency === "HIVE" ? walletData?.savings_balance : walletData?.savings_hbd_balance}
          onClose={() => setActiveModal(null)}
          onSubmit={withRefresh(onTransferFromSavings)!}
        />
      )}
      {isOwn && username && activeModal?.kind === "stopPowerDown" && onStopPowerDown && (
        <ConfirmActionModal
          title="Cancel Unstake (Power Down)?"
          message="This will cancel the current unstake (power down) request. Are you sure?"
          onClose={() => setActiveModal(null)}
          onConfirm={withRefresh(onStopPowerDown)!}
        />
      )}
      {isOwn && username && activeModal?.kind === "cancelSavingsWithdrawal" && onCancelSavingsWithdrawal && (
        <ConfirmActionModal
          title="Cancel Unstake (Withdraw) From Savings?"
          message={`This will cancel the selected unstake (withdraw) request${activeModal.amount ? ` of ${activeModal.amount}` : ""}. Are you sure?`}
          onClose={() => setActiveModal(null)}
          onConfirm={withRefresh(() => onCancelSavingsWithdrawal(activeModal.requestId))!}
        />
      )}
    </div>
  );
};

export default Wallet;
