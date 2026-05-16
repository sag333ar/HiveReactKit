/**
 * Wallet action modals — Transfer, Power Up, Power Down, and HBD savings
 * add/remove. Used inside the Wallet view when the viewer is looking at
 * their own profile and the consumer wires action callbacks.
 */
import React, { useState, useMemo, useEffect } from "react";

type Currency = "HIVE" | "HBD";

const overlayCls =
  "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4";
const dialogCls =
  "w-full max-w-md sm:max-w-lg rounded-xl bg-[#181d23] border border-[var(--hrk-border-subtle)] shadow-2xl overflow-hidden";
const headerCls =
  "flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[var(--hrk-border-subtle)]";
const titleCls = "text-base sm:text-lg font-semibold text-white";
const bodyCls = "p-4 sm:p-5 space-y-4";
const infoBoxCls =
  "rounded-md border border-[var(--hrk-border-subtle)] bg-[#1e242c] px-3 py-2.5 text-xs text-[var(--hrk-text-tertiary)]";
const inputCls =
  "w-full bg-transparent border-b border-[var(--hrk-border-default)] px-1 py-1.5 text-sm text-white placeholder-[var(--hrk-text-tertiary)] focus:outline-none focus:border-[var(--hrk-info)] transition-colors";
const labelCls = "text-xs text-[var(--hrk-text-tertiary)] mb-1";
const footerCls =
  "flex justify-end gap-2 px-4 sm:px-5 py-3 border-t border-[var(--hrk-border-subtle)] bg-[#15191e]";
const cancelBtnCls =
  "px-4 py-2 rounded-md text-xs font-semibold tracking-wide bg-[var(--hrk-bg-surface-raised)] text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-hover)] transition-colors";
const continueBtnCls =
  "px-4 py-2 rounded-md text-xs font-semibold tracking-wide bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

const AvatarTag: React.FC<{ username: string }> = ({ username }) => (
  <div className="flex items-center gap-2 min-w-0">
    <img
      src={`https://images.hive.blog/u/${username}/avatar`}
      alt={username}
      className="w-7 h-7 rounded-full border border-[var(--hrk-border-subtle)] flex-shrink-0"
      onError={(e) => {
        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${username}&background=random&size=28`;
      }}
    />
    <span className="text-sm text-[var(--hrk-text-primary)] truncate">{username}</span>
  </div>
);

function parseBalance(value?: string): number {
  if (!value) return 0;
  const n = parseFloat(value.split(" ")[0]);
  return Number.isFinite(n) ? n : 0;
}

function clampAmount(value: string, max: number, decimals = 3): string {
  if (value === "" || value === ".") return value;
  // Replace comma with dot for locales that type commas.
  let v = value.replace(",", ".");
  // Strip everything except digits and a single dot.
  v = v.replace(/[^0-9.]/g, "");
  const parts = v.split(".");
  if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
  // Limit decimals.
  if (v.includes(".")) {
    const [intPart, decPart] = v.split(".");
    v = intPart + "." + decPart.slice(0, decimals);
  }
  const num = parseFloat(v);
  if (Number.isFinite(num) && num > max) {
    return max.toFixed(decimals);
  }
  return v;
}

// ─── Transfer ───────────────────────────────────────────────────────────────
export const TransferModal: React.FC<{
  from: string;
  toDefault?: string;
  hiveBalance?: string;
  hbdBalance?: string;
  initialCurrency?: Currency;
  hidePicker?: boolean;
  onClose: () => void;
  onSubmit: (
    to: string,
    amount: string,
    currency: Currency,
    memo: string,
  ) => void | boolean | Promise<void | boolean>;
}> = ({
  from,
  toDefault = "",
  hiveBalance,
  hbdBalance,
  initialCurrency = "HIVE",
  hidePicker = false,
  onClose,
  onSubmit,
}) => {
  const [to, setTo] = useState(toDefault);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const max = useMemo(
    () => parseBalance(currency === "HIVE" ? hiveBalance : hbdBalance),
    [currency, hiveBalance, hbdBalance],
  );

  const fillMax = () => setAmount(max.toFixed(3));

  const canSubmit =
    !!to.trim() && parseFloat(amount) > 0 && parseFloat(amount) <= max && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await onSubmit(to.trim(), amount, currency, memo);
      if (res !== false) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={overlayCls} onClick={onClose}>
      <div className={dialogCls} onClick={(e) => e.stopPropagation()}>
        <div className={headerCls}>
          <h3 className={titleCls}>Transfer {currency}</h3>
          <button onClick={onClose} className="text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-text-primary)] text-lg">×</button>
        </div>
        <div className={bodyCls}>
          <div className={infoBoxCls}>Transfer funds to another Hive account.</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={labelCls}>From:</div>
              <AvatarTag username={from} />
            </div>
            <div>
              <div className={labelCls}>To:</div>
              <div className="flex items-center gap-2">
                {to.trim() && (
                  <img
                    src={`https://images.hive.blog/u/${to.trim()}/avatar`}
                    alt={to}
                    className="w-7 h-7 rounded-full border border-[var(--hrk-border-subtle)] flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        `https://ui-avatars.com/api/?name=${to.trim()}&background=random&size=28`;
                    }}
                  />
                )}
                <input
                  type="text"
                  value={to}
                  onChange={(e) => setTo(e.target.value.replace(/^@/, "").trim())}
                  placeholder="username"
                  className={`${inputCls} flex-1`}
                />
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={labelCls}>
                Amount (Balance:{" "}
                <button
                  type="button"
                  onClick={fillMax}
                  className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                  title="Click to use full balance"
                >
                  {max.toFixed(3)} {currency}
                </button>
                )
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(clampAmount(e.target.value, max, 3))}
                placeholder="0"
                className={`${inputCls} flex-1`}
              />
              {hidePicker ? (
                <span className="px-3 py-1.5 rounded-md bg-[var(--hrk-bg-surface-raised)] text-xs text-[var(--hrk-text-primary)] font-semibold">
                  {currency}
                </span>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPickerOpen((o) => !o)}
                    className="px-3 py-1.5 rounded-md bg-[var(--hrk-bg-surface-raised)] hover:bg-[var(--hrk-bg-hover)] text-xs text-[var(--hrk-text-primary)] font-semibold flex items-center gap-1"
                  >
                    {currency} <span className="text-[10px]">▾</span>
                  </button>
                  {pickerOpen && (
                    <div className="absolute right-0 mt-1 rounded-md bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)] shadow-lg z-10 min-w-[80px]">
                      {(["HIVE", "HBD"] as Currency[]).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setCurrency(c);
                            setAmount("");
                            setPickerOpen(false);
                          }}
                          className="block w-full text-left px-3 py-1.5 text-xs text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-surface-raised)]"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <div className={labelCls}>Memo:</div>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="A message to include in the transfer"
              className={inputCls}
            />
          </div>
        </div>
        <div className={footerCls}>
          <button onClick={onClose} className={cancelBtnCls}>CANCEL</button>
          <button onClick={submit} disabled={!canSubmit} className={continueBtnCls}>
            {submitting ? "..." : "CONTINUE"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Power Up ───────────────────────────────────────────────────────────────
export const PowerUpModal: React.FC<{
  from: string;
  hiveBalance?: string;
  onClose: () => void;
  onSubmit: (to: string, amount: string) => void | boolean | Promise<void | boolean>;
}> = ({ from, hiveBalance, onClose, onSubmit }) => {
  const max = parseBalance(hiveBalance);
  const [to, setTo] = useState(from);
  const [amount, setAmount] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = parseFloat(amount) > 0 && parseFloat(amount) <= max && !!to.trim() && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await onSubmit(to.trim(), amount);
      if (res !== false) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={overlayCls} onClick={onClose}>
      <div className={dialogCls} onClick={(e) => e.stopPropagation()}>
        <div className={headerCls}>
          <h3 className={titleCls}>Stake HIVE (Power Up)</h3>
          <button onClick={onClose} className="text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-text-primary)] text-lg">×</button>
        </div>
        <div className={bodyCls}>
          <div className={infoBoxCls}>
            Influence tokens which give you more control over post payouts and allow you to earn on curation rewards.
            <br /><br />
            Hive Power is non-transferable and requires 3 months (13 payments) to convert back to Hive.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={labelCls}>From:</div>
              <AvatarTag username={from} />
            </div>
            <div>
              <div className={labelCls}>To (usually your own account):</div>
              <div className="flex items-center gap-2">
                {to.trim() && (
                  <img
                    src={`https://images.hive.blog/u/${to.trim()}/avatar`}
                    alt={to}
                    className="w-7 h-7 rounded-full border border-[var(--hrk-border-subtle)] flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        `https://ui-avatars.com/api/?name=${to.trim()}&background=random&size=28`;
                    }}
                  />
                )}
                <input
                  type="text"
                  value={to}
                  onChange={(e) => setTo(e.target.value.replace(/^@/, "").trim())}
                  placeholder="username"
                  className={`${inputCls} flex-1`}
                />
              </div>
            </div>
          </div>
          <div>
            <div className={labelCls}>
              Amount (Max{" "}
              <button
                type="button"
                onClick={() => setAmount(max.toFixed(3))}
                className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                title="Click to use max balance"
              >
                {max.toFixed(3)} HIVE
              </button>
              ):
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(clampAmount(e.target.value, max, 3))}
                className={`${inputCls} flex-1`}
              />
              <span className="px-3 py-1.5 rounded-md bg-[var(--hrk-bg-surface-raised)] text-xs text-[var(--hrk-text-primary)] font-semibold">HIVE</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0.001, max)}
              step={0.001}
              value={parseFloat(amount) || 0}
              onChange={(e) => setAmount(parseFloat(e.target.value).toFixed(3))}
              className="w-full mt-3 accent-blue-500"
            />
          </div>
        </div>
        <div className={footerCls}>
          <button onClick={onClose} className={cancelBtnCls}>CANCEL</button>
          <button onClick={submit} disabled={!canSubmit} className={continueBtnCls}>
            {submitting ? "..." : "CONTINUE"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Power Down ─────────────────────────────────────────────────────────────
export const PowerDownModal: React.FC<{
  from: string;
  hivePower?: string;
  onClose: () => void;
  onSubmit: (hp: string) => void | boolean | Promise<void | boolean>;
}> = ({ from, hivePower, onClose, onSubmit }) => {
  const max = parseBalance(hivePower);
  const [amount, setAmount] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  const perWeek = useMemo(() => {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return "0.000";
    return (n / 13).toFixed(3);
  }, [amount]);

  const canSubmit = parseFloat(amount) >= 0 && parseFloat(amount) <= max && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await onSubmit(amount);
      if (res !== false) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={overlayCls} onClick={onClose}>
      <div className={dialogCls} onClick={(e) => e.stopPropagation()}>
        <div className={headerCls}>
          <h3 className={titleCls}>Unstake HIVE (Power Down)</h3>
          <button onClick={onClose} className="text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-text-primary)] text-lg">×</button>
        </div>
        <div className={bodyCls}>
          <div className={infoBoxCls}>
            Create a Hive Power unstake request. The request is fulfilled once a week over the next 13 weeks.
          </div>
          <div>
            <div className={labelCls}>Account:</div>
            <AvatarTag username={from} />
          </div>
          <div>
            <div className={labelCls}>
              Amount (Max{" "}
              <button
                type="button"
                onClick={() => setAmount(max.toFixed(3))}
                className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                title="Click to use max balance"
              >
                {max.toFixed(3)} HP
              </button>
              ):
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(clampAmount(e.target.value, max, 3))}
                className={`${inputCls} flex-1`}
              />
              <span className="px-3 py-1.5 rounded-md bg-[var(--hrk-bg-surface-raised)] text-xs text-[var(--hrk-text-primary)] font-semibold">HP</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0.001, max)}
              step={0.001}
              value={parseFloat(amount) || 0}
              onChange={(e) => setAmount(parseFloat(e.target.value).toFixed(3))}
              className="w-full mt-3 accent-blue-500"
            />
            <div className="text-xs text-[var(--hrk-text-tertiary)] mt-2">
              You will receive <span className="text-[var(--hrk-text-primary)]">{perWeek} HIVE</span> per week
            </div>
          </div>
        </div>
        <div className={footerCls}>
          <button onClick={onClose} className={cancelBtnCls}>CANCEL</button>
          <button onClick={submit} disabled={!canSubmit} className={continueBtnCls}>
            {submitting ? "..." : "CONTINUE"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Savings (Add / Remove) ─────────────────────────────────────────────────
export const SavingsModal: React.FC<{
  mode: "add" | "remove";
  from: string;
  currency: Currency;
  availableBalance?: string;
  onClose: () => void;
  onSubmit: (
    currency: Currency,
    amount: string,
    memo: string,
  ) => void | boolean | Promise<void | boolean>;
}> = ({ mode, from, currency, availableBalance, onClose, onSubmit }) => {
  const max = parseBalance(availableBalance);
  const [amount, setAmount] = useState("0");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset on currency change.
  useEffect(() => { setAmount("0"); }, [currency]);

  const canSubmit = parseFloat(amount) > 0 && parseFloat(amount) <= max && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await onSubmit(currency, amount, memo);
      if (res !== false) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === "add"
    ? `Stake ${currency} (Transfer to Savings)`
    : `Unstake ${currency} (Withdraw Savings)`;

  const info = mode === "add"
    ? `Stake/Move funds to savings. Funds will be subject to 3 days unstake/withdraw waiting period.`
    : `Withdraw funds from savings. Funds are released after a 3-day waiting period.`;

  return (
    <div className={overlayCls} onClick={onClose}>
      <div className={dialogCls} onClick={(e) => e.stopPropagation()}>
        <div className={headerCls}>
          <h3 className={titleCls}>{title}</h3>
          <button onClick={onClose} className="text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-text-primary)] text-lg">×</button>
        </div>
        <div className={bodyCls}>
          <div className={infoBoxCls}>{info}</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={labelCls}>From:</div>
              <AvatarTag username={from} />
            </div>
            <div>
              <div className={labelCls}>To:</div>
              <AvatarTag username={from} />
            </div>
          </div>
          <div>
            <div className={labelCls}>
              Amount (Balance:{" "}
              <button
                type="button"
                onClick={() => setAmount(max.toFixed(3))}
                className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                title="Click to use full balance"
              >
                {max.toFixed(3)} {currency}
              </button>
              ):
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(clampAmount(e.target.value, max, 3))}
                className={`${inputCls} flex-1`}
              />
              <span className="px-3 py-1.5 rounded-md bg-[var(--hrk-bg-surface-raised)] text-xs text-[var(--hrk-text-primary)] font-semibold">{currency}</span>
            </div>
          </div>
          <div>
            <div className={labelCls}>Memo:</div>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="A message to include in the transaction"
              className={inputCls}
            />
          </div>
        </div>
        <div className={footerCls}>
          <button onClick={onClose} className={cancelBtnCls}>CANCEL</button>
          <button onClick={submit} disabled={!canSubmit} className={continueBtnCls}>
            {submitting ? "..." : "CONTINUE"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Confirmation prompt (used by STOP power-down & cancel savings) ─────────
export const ConfirmActionModal: React.FC<{
  title: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void | boolean | Promise<void | boolean>;
}> = ({ title, message, confirmLabel = "CONFIRM", onClose, onConfirm }) => {
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await onConfirm();
      if (res !== false) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={overlayCls} onClick={onClose}>
      <div className={dialogCls} onClick={(e) => e.stopPropagation()}>
        <div className={headerCls}>
          <h3 className={titleCls}>{title}</h3>
          <button onClick={onClose} className="text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-text-primary)] text-lg">×</button>
        </div>
        <div className={bodyCls}>
          <p className="text-sm text-[var(--hrk-text-primary)]">{message}</p>
        </div>
        <div className={footerCls}>
          <button onClick={onClose} disabled={submitting} className={cancelBtnCls}>
            CANCEL
          </button>
          <button onClick={submit} disabled={submitting} className={continueBtnCls}>
            {submitting ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export type { Currency };
