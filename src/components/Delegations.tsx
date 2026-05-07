import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FaTrash, FaSearch, FaCheck, FaTimes, FaPen, FaPlus } from "react-icons/fa";
import { getHiveClient } from "../config/hiveEndpoint";
import type {
  HpDelegation,
  RcDelegation,
  DelegationsBundle,
} from "../types/wallet";

const BALANCE_API = "https://api.hive.blog/balance-api";

type DelegationTab = "hp" | "rc";

export interface DelegationsProps {
  /** Profile being viewed. */
  username: string;
  /** Currently logged-in user. When equal to `username`, outgoing rows show
   *  Update / Delete actions for RC delegations. */
  currentUsername?: string;
  /** Hide the panel entirely until the parent decides to mount it. */
  className?: string;
  /** Update or create an RC delegation: `max_rc` is the new value in raw RC
   *  (e.g. 51000000000 for 51 b RC). Return `false` if the operation was
   *  cancelled (e.g. keychain denied) — the row stays put. */
  onUpdateRcDelegation?: (
    delegatee: string,
    maxRc: string,
  ) => void | boolean | Promise<void | boolean>;
  /** Remove an RC delegation (broadcasts max_rc=0). Same return semantics. */
  onDeleteRcDelegation?: (
    delegatee: string,
  ) => void | boolean | Promise<void | boolean>;
  /** Create a new HP delegation. `hp` is HP as a numeric string (e.g. "1000").
   *  When provided, a "Delegate HP" button appears on the HP tab for the
   *  profile owner. Requires the active key — see consumer wiring. */
  onCreateHpDelegation?: (
    delegatee: string,
    hp: string,
  ) => void | boolean | Promise<void | boolean>;
  /** Create a new RC delegation. `maxRc` is the raw RC integer string (e.g.
   *  "50000000000" for 50 b RC). When provided, a "Delegate RC" button
   *  appears on the RC tab for the profile owner. */
  onCreateRcDelegation?: (
    delegatee: string,
    maxRc: string,
  ) => void | boolean | Promise<void | boolean>;
}

interface BalanceApiHpResponse {
  outgoing_delegations: Array<{
    delegatee: string;
    amount: string;
    operation_id?: string;
    block_num?: number;
  }>;
  incoming_delegations: Array<{
    delegator: string;
    amount: string;
    operation_id?: string;
    block_num?: number;
  }>;
}

interface BalanceApiRcResponse {
  outgoing_delegations: Array<{
    delegatee: string;
    max_rc: string;
    operation_id?: string;
    block_num?: number;
  }>;
  incoming_delegations: Array<{
    delegator: string;
    max_rc: string;
    operation_id?: string;
    block_num?: number;
  }>;
}

const formatBillions = (raw: string): string => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  const billions = n / 1_000_000_000;
  return `${billions.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}b RC`;
};

const formatHp = (hp: number): string =>
  `${hp.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} HP`;

const fetchHp = async (username: string): Promise<BalanceApiHpResponse> => {
  const res = await fetch(`${BALANCE_API}/accounts/${username}/delegations`);
  if (!res.ok) throw new Error(`HP delegations: ${res.status}`);
  return res.json();
};

const fetchRc = async (username: string): Promise<BalanceApiRcResponse> => {
  const res = await fetch(`${BALANCE_API}/accounts/${username}/rc-delegations`);
  if (!res.ok) throw new Error(`RC delegations: ${res.status}`);
  return res.json();
};

const vestsToHpFactor = async (): Promise<number> => {
  try {
    const client = getHiveClient();
    const props = await client.database.getDynamicGlobalProperties();
    const totalVestingShares = parseFloat(
      String(props.total_vesting_shares).split(" ")[0],
    );
    const totalVestingFundHive = parseFloat(
      String(props.total_vesting_fund_hive).split(" ")[0],
    );
    if (!totalVestingShares) return 0;
    // VESTS in balance-api are integers without the 6-decimal scaling, so the
    // factor must include 1e-6 to match dhive's `vesting_shares` ("X.YYYYYY VESTS").
    return totalVestingFundHive / totalVestingShares / 1_000_000;
  } catch (err) {
    console.error("Delegations: failed to load global props:", err);
    return 0;
  }
};

const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 24 }) => (
  <img
    src={`https://images.hive.blog/u/${name}/avatar`}
    alt={name}
    style={{ width: size, height: size }}
    className="rounded-full flex-shrink-0 border border-gray-700"
    onError={(e) => {
      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${name}&background=random&size=${size}`;
    }}
  />
);

const SectionHeader: React.FC<{
  direction: "outgoing" | "incoming";
  total: string;
  count: number;
  search: string;
  onSearch: (v: string) => void;
  onCreate?: () => void;
  createLabel?: string;
}> = ({ direction, total, count, search, onSearch, onCreate, createLabel }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 min-w-0">
    <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-200 min-w-0">
      <span
        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
          direction === "outgoing" ? "bg-orange-400" : "bg-emerald-400"
        }`}
      />
      <span className="truncate">
        {direction === "outgoing" ? "Delegated:" : "Received:"} {total}
        {count > 0 && (
          <span className="text-gray-400 font-normal"> ({count})</span>
        )}
      </span>
    </div>
    {direction === "outgoing" && (
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative flex-1 sm:flex-none min-w-0">
          <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search"
            className="pl-8 pr-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-gray-200 focus:outline-none focus:border-blue-500 w-full sm:w-40"
          />
        </div>
        {onCreate && (
          <button
            onClick={onCreate}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 text-[11px] font-semibold tracking-wide rounded bg-teal-600 hover:bg-teal-500 text-white transition-colors flex-shrink-0"
            title={createLabel}
          >
            <FaPlus size={10} />
            <span className="hidden sm:inline">{createLabel}</span>
          </button>
        )}
      </div>
    )}
  </div>
);

/** Modal to create a new delegation (HP or RC). */
const CreateDelegationModal: React.FC<{
  kind: "hp" | "rc";
  delegator: string;
  onClose: () => void;
  onSubmit: (delegatee: string, amount: string) => Promise<void>;
}> = ({ kind, delegator, onClose, onSubmit }) => {
  const [delegatee, setDelegatee] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    const cleanAccount = delegatee.trim().replace(/^@/, "").toLowerCase();
    if (!cleanAccount) { setErr("Enter a delegatee account."); return; }
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setErr("Enter a valid amount."); return; }
    setBusy(true);
    try {
      const finalAmount =
        kind === "rc" ? Math.round(amt * 1_000_000_000).toString() : amt.toString();
      await onSubmit(cleanAccount, finalAmount);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delegate");
    } finally {
      setBusy(false);
    }
  };

  const title = kind === "hp" ? "Delegate HP" : "Delegate RC";
  const help =
    kind === "hp"
      ? "Delegate Hive Power to another account. Updating an existing delegation replaces the previous amount; reducing it locks the difference for 5 days."
      : "Delegate Resource Credits (RC) to another account. Updating an existing delegation replaces the previous amount.";
  const unit = kind === "hp" ? "HP" : "B (BILLION) RC";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <FaTimes size={14} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-4 leading-relaxed border border-gray-700 rounded-md p-2.5 bg-gray-800/40">
          {help}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Delegator</label>
            <div className="mt-1 flex items-center gap-2 px-3 py-2 rounded-md bg-gray-800 border border-gray-700">
              <Avatar name={delegator} size={22} />
              <span className="text-sm text-gray-200 truncate">{delegator}</span>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Delegatee</label>
            <input
              type="text"
              value={delegatee}
              onChange={(e) => setDelegatee(e.target.value)}
              placeholder="username"
              className="mt-1 w-full px-3 py-2 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-100 focus:outline-none focus:border-teal-500"
              autoFocus
            />
          </div>
        </div>
        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          Amount ({unit})
        </label>
        <input
          type="number"
          min="0"
          step={kind === "hp" ? "0.001" : "0.01"}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={kind === "hp" ? "1000" : "50"}
          className="mt-1 w-full px-3 py-2 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-100 focus:outline-none focus:border-teal-500"
        />
        {err && (
          <div className="mt-3 text-xs text-red-400">{err}</div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm rounded-md border border-gray-700 text-gray-200 hover:bg-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold rounded-md bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};

const RcUpdateInline: React.FC<{
  delegatee: string;
  initialBillions: number;
  onCancel: () => void;
  onSubmit: (maxRcRaw: string) => Promise<void>;
}> = ({ delegatee, initialBillions, onCancel, onSubmit }) => {
  const [value, setValue] = useState<string>(initialBillions.toString());
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const billions = parseFloat(value);
    if (!Number.isFinite(billions) || billions < 0) return;
    setBusy(true);
    try {
      const raw = Math.round(billions * 1_000_000_000).toString();
      await onSubmit(raw);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-2 sm:px-3 py-2 bg-gray-900 border border-blue-500/40 rounded-md min-w-0">
      <div className="text-[11px] text-gray-400 mb-1 truncate">@{delegatee}</div>
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 min-w-0 px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-blue-500"
          autoFocus
        />
        <span className="text-[11px] text-gray-400 whitespace-nowrap">b RC</span>
        <button
          onClick={submit}
          disabled={busy}
          className="p-1.5 rounded bg-blue-600/80 hover:bg-blue-500 text-white disabled:opacity-50 flex-shrink-0"
          title="Confirm"
        >
          <FaCheck size={11} />
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50 flex-shrink-0"
          title="Cancel"
        >
          <FaTimes size={11} />
        </button>
      </div>
    </div>
  );
};

export const Delegations: React.FC<DelegationsProps> = ({
  username,
  currentUsername,
  className = "",
  onUpdateRcDelegation,
  onDeleteRcDelegation,
  onCreateHpDelegation,
  onCreateRcDelegation,
}) => {
  const [tab, setTab] = useState<DelegationTab>("hp");
  const [bundle, setBundle] = useState<DelegationsBundle>({
    hp: { outgoing: [], incoming: [] },
    rc: { outgoing: [], incoming: [] },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [createKind, setCreateKind] = useState<"hp" | "rc" | null>(null);

  const isOwnProfile = currentUsername === username;
  const canEditRc =
    isOwnProfile && (!!onUpdateRcDelegation || !!onDeleteRcDelegation);
  const canCreateHp = isOwnProfile && !!onCreateHpDelegation;
  const canCreateRc = isOwnProfile && !!onCreateRcDelegation;

  const load = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      const [hpRes, rcRes, factor] = await Promise.all([
        fetchHp(username),
        fetchRc(username),
        vestsToHpFactor(),
      ]);

      const toHp = (vests: string): number => {
        const n = parseFloat(vests);
        if (!Number.isFinite(n) || !factor) return 0;
        return n * factor;
      };

      setBundle({
        hp: {
          outgoing: hpRes.outgoing_delegations.map<HpDelegation>((d) => ({
            account: d.delegatee,
            vests: d.amount,
            hp: toHp(d.amount),
            operation_id: d.operation_id,
            block_num: d.block_num,
          })),
          incoming: hpRes.incoming_delegations.map<HpDelegation>((d) => ({
            account: d.delegator,
            vests: d.amount,
            hp: toHp(d.amount),
            operation_id: d.operation_id,
            block_num: d.block_num,
          })),
        },
        rc: {
          outgoing: rcRes.outgoing_delegations.map<RcDelegation>((d) => ({
            account: d.delegatee,
            max_rc: d.max_rc,
            operation_id: d.operation_id,
            block_num: d.block_num,
          })),
          incoming: rcRes.incoming_delegations.map<RcDelegation>((d) => ({
            account: d.delegator,
            max_rc: d.max_rc,
            operation_id: d.operation_id,
            block_num: d.block_num,
          })),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load delegations";
      console.error("Delegations load error:", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset transient state when switching profile or tab.
  useEffect(() => {
    setSearch("");
    setEditing(null);
    setPending(null);
  }, [username, tab]);

  const totalHpOut = useMemo(
    () => bundle.hp.outgoing.reduce((s, d) => s + d.hp, 0),
    [bundle.hp.outgoing],
  );
  const totalHpIn = useMemo(
    () => bundle.hp.incoming.reduce((s, d) => s + d.hp, 0),
    [bundle.hp.incoming],
  );
  const totalRcOut = useMemo(
    () =>
      bundle.rc.outgoing.reduce((s, d) => s + Number(d.max_rc), 0) /
      1_000_000_000,
    [bundle.rc.outgoing],
  );
  const totalRcIn = useMemo(
    () =>
      bundle.rc.incoming.reduce((s, d) => s + Number(d.max_rc), 0) /
      1_000_000_000,
    [bundle.rc.incoming],
  );

  const filterOut = useCallback(
    <T extends { account: string }>(rows: T[]): T[] => {
      const q = search.trim().toLowerCase();
      if (!q) return rows;
      return rows.filter((r) => r.account.toLowerCase().includes(q));
    },
    [search],
  );

  const handleUpdate = async (delegatee: string, maxRcRaw: string) => {
    if (!onUpdateRcDelegation) return;
    setPending(delegatee);
    try {
      const result = await onUpdateRcDelegation(delegatee, maxRcRaw);
      if (result === false) return; // cancelled — keep editor open
      setEditing(null);
      // Optimistic local update; the chain may take a moment to reflect, but
      // refetching gives the user the canonical state shortly.
      setBundle((prev) => ({
        ...prev,
        rc: {
          ...prev.rc,
          outgoing: prev.rc.outgoing.map((d) =>
            d.account === delegatee ? { ...d, max_rc: maxRcRaw } : d,
          ),
        },
      }));
      // Re-sync after a small delay.
      setTimeout(() => { void load(); }, 4000);
    } finally {
      setPending(null);
    }
  };

  const handleDelete = async (delegatee: string) => {
    if (!onDeleteRcDelegation) return;
    setPending(delegatee);
    try {
      const result = await onDeleteRcDelegation(delegatee);
      if (result === false) return;
      setBundle((prev) => ({
        ...prev,
        rc: {
          ...prev.rc,
          outgoing: prev.rc.outgoing.filter((d) => d.account !== delegatee),
        },
      }));
      setTimeout(() => { void load(); }, 4000);
    } finally {
      setPending(null);
    }
  };

  const handleCreate = async (delegatee: string, amount: string) => {
    const cb = createKind === "hp" ? onCreateHpDelegation : onCreateRcDelegation;
    if (!cb) return;
    const result = await cb(delegatee, amount);
    if (result === false) return; // cancelled — keep modal open
    setCreateKind(null);
    setTimeout(() => { void load(); }, 4000);
  };

  const renderHpRow = (d: HpDelegation, percent: number) => (
    <div
      key={`${d.account}-${d.operation_id ?? ""}`}
      className="flex items-center gap-2 sm:gap-3 py-2 border-b border-gray-800 last:border-b-0 min-w-0"
    >
      <Avatar name={d.account} />
      <span className="text-sm text-gray-200 flex-1 truncate min-w-0" title={`@${d.account}`}>
        @{d.account}
      </span>
      <span className="text-sm text-gray-300 font-medium whitespace-nowrap">{formatHp(d.hp)}</span>
      <div className="hidden md:flex w-20 h-2 rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full bg-emerald-500"
          style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );

  const renderRcRow = (d: RcDelegation, percent: number, allowEdit: boolean) => {
    if (editing === d.account) {
      return (
        <div key={d.account} className="py-2 border-b border-gray-800 last:border-b-0">
          <RcUpdateInline
            delegatee={d.account}
            initialBillions={Number(d.max_rc) / 1_000_000_000}
            onCancel={() => setEditing(null)}
            onSubmit={(raw) => handleUpdate(d.account, raw)}
          />
        </div>
      );
    }
    return (
      <div
        key={`${d.account}-${d.operation_id ?? ""}`}
        className="flex items-center gap-2 sm:gap-3 py-2 border-b border-gray-800 last:border-b-0 min-w-0"
      >
        <Avatar name={d.account} />
        <span className="text-sm text-gray-200 flex-1 truncate min-w-0" title={`@${d.account}`}>
          @{d.account}
        </span>
        <span className="text-sm text-gray-300 font-medium whitespace-nowrap">{formatBillions(d.max_rc)}</span>
        <div className="hidden md:flex w-20 h-2 rounded-full bg-gray-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
          />
        </div>
        {allowEdit && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {onUpdateRcDelegation && (
              <button
                onClick={() => setEditing(d.account)}
                disabled={pending === d.account}
                className="p-1.5 rounded border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-50"
                title="Update delegation"
              >
                <FaPen size={10} />
              </button>
            )}
            {onDeleteRcDelegation && (
              <button
                onClick={() => handleDelete(d.account)}
                disabled={pending === d.account}
                className="p-1.5 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                title="Remove delegation"
              >
                <FaTrash size={10} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const tabBtn = (active: boolean) =>
    `flex-1 py-2 sm:py-2.5 px-2 text-[11px] sm:text-xs font-semibold tracking-wide rounded transition-colors whitespace-nowrap ${
      active ? "bg-teal-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
    }`;

  return (
    <div className={`rounded-xl bg-gray-800 border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="px-3 sm:px-4 pt-3 pb-2 border-b border-gray-700">
        <div className="text-sm font-bold text-white">Delegated HIVE</div>
        <div className="text-xs text-gray-400">
          Staked tokens delegated between users.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-2 sm:p-3 border-b border-gray-700">
        <button onClick={() => setTab("hp")} className={tabBtn(tab === "hp")}>
          <span className="sm:hidden">HP</span>
          <span className="hidden sm:inline">HP DELEGATIONS</span>
        </button>
        <button onClick={() => setTab("rc")} className={tabBtn(tab === "rc")}>
          <span className="sm:hidden">RC</span>
          <span className="hidden sm:inline">RC DELEGATIONS</span>
        </button>
      </div>

      <div className="p-2 sm:p-4">
        {error && (
          <div className="text-xs text-red-400 mb-2">{error}</div>
        )}
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 bg-gray-900 rounded" />
            ))}
          </div>
        ) : tab === "hp" ? (
          <>
            <SectionHeader
              direction="outgoing"
              total={`${totalHpOut.toLocaleString("en-US", { maximumFractionDigits: 3 })} HP`}
              count={bundle.hp.outgoing.length}
              search={search}
              onSearch={setSearch}
              onCreate={canCreateHp ? () => setCreateKind("hp") : undefined}
              createLabel="Delegate HP"
            />
            {bundle.hp.outgoing.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No outgoing delegations</p>
            ) : (
              <div className="mb-4">
                {filterOut(bundle.hp.outgoing).map((d) =>
                  renderHpRow(d, totalHpOut > 0 ? (d.hp / totalHpOut) * 100 : 0),
                )}
              </div>
            )}
            <SectionHeader
              direction="incoming"
              total={`${totalHpIn.toLocaleString("en-US", { maximumFractionDigits: 3 })} HP`}
              count={bundle.hp.incoming.length}
              search=""
              onSearch={() => {}}
            />
            {bundle.hp.incoming.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No incoming delegations</p>
            ) : (
              <div>
                {bundle.hp.incoming.map((d) =>
                  renderHpRow(d, totalHpIn > 0 ? (d.hp / totalHpIn) * 100 : 0),
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <SectionHeader
              direction="outgoing"
              total={`${totalRcOut.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}b RC`}
              count={bundle.rc.outgoing.length}
              search={search}
              onSearch={setSearch}
              onCreate={canCreateRc ? () => setCreateKind("rc") : undefined}
              createLabel="Delegate RC"
            />
            {bundle.rc.outgoing.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No outgoing RC delegations</p>
            ) : (
              <div className="mb-4">
                {filterOut(bundle.rc.outgoing).map((d) => {
                  const rcBn = Number(d.max_rc) / 1_000_000_000;
                  const pct = totalRcOut > 0 ? (rcBn / totalRcOut) * 100 : 0;
                  return renderRcRow(d, pct, canEditRc);
                })}
              </div>
            )}
            <SectionHeader
              direction="incoming"
              total={`${totalRcIn.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}b RC`}
              count={bundle.rc.incoming.length}
              search=""
              onSearch={() => {}}
            />
            {bundle.rc.incoming.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No incoming RC delegations</p>
            ) : (
              <div>
                {bundle.rc.incoming.map((d) => {
                  const rcBn = Number(d.max_rc) / 1_000_000_000;
                  const pct = totalRcIn > 0 ? (rcBn / totalRcIn) * 100 : 0;
                  return renderRcRow(d, pct, false);
                })}
              </div>
            )}
          </>
        )}
      </div>

      {createKind && (
        <CreateDelegationModal
          kind={createKind}
          delegator={username}
          onClose={() => setCreateKind(null)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
};

export default Delegations;
