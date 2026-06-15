/**
 * BeneficiariesEditor — modal that lets the user attach a list of Hive accounts
 * that will automatically receive a portion of the rewards on the post being
 * composed.
 *
 * Rules enforced by the UI:
 * - Each beneficiary's percent is in [1, 100].
 * - The total of all beneficiaries (including the locked threespeakfund row,
 *   if shown) is capped at 100%.
 * - When `hasVideo` is true, the `threespeakfund` 10% row is auto-injected,
 *   not removable, and the remaining user-controlled allocation is capped at
 *   100 - 10 = 90%.
 * - The user can pick from `favorites` (typically previously-used beneficiary
 *   sets pulled from app settings/history) — clicking a favorite chip fills
 *   the staging row.
 *
 * The component is purely presentational: it owns its working copy of the
 * list while open and emits the final list via `onSave`.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Minus, Plus, Trash2, X } from 'lucide-react';
import {
  THREESPEAK_FUND_ACCOUNT,
  THREESPEAK_FUND_PERCENT,
  enforceVideoBeneficiaries,
  normalizeBeneficiaryAccount,
  sanitizeBeneficiaries,
  type Beneficiary,
} from '../../utils/beneficiaries';

export interface BeneficiariesEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (beneficiaries: Beneficiary[]) => void;
  /** Initial list. Defaults are pre-populated when the editor opens. */
  initialBeneficiaries?: Beneficiary[];
  /**
   * When true, the `threespeakfund` 10% row is added automatically and cannot
   * be removed; user beneficiaries are capped at 90% in total.
   */
  hasVideo?: boolean;
  /**
   * Extra accounts to render as locked alongside `threespeakfund`. The
   * composer wires DecentMemes auto-injected creator/submitter/frontend
   * entries through here so they get the same Lock icon, disabled stepper,
   * and disabled trash button — and they're excluded from the user
   * weight cap (which becomes `100 - sum(locked weights)`).
   *
   * Locked entries still need to appear in `initialBeneficiaries` with
   * their final weights — this prop only controls *which* of those rows
   * the editor treats as immutable.
   */
  lockedAccounts?: string[];
  /**
   * Per-account tooltip shown on the disabled trash button. Falls back to
   * a generic "auto-attached" message. Use this to explain *why* (e.g.
   * "Auto-attached by DecentMemes meme template @drake").
   */
  lockReasons?: Record<string, string>;
  /**
   * Suggested chips (favourites / previously-used presets). Each entry is one
   * beneficiary the user may want to add quickly. Click adds it at its weight
   * (capped to remaining allocation).
   */
  favorites?: Beneficiary[];
  /** Title shown in the header. */
  title?: string;
  /** Hint shown under the header. */
  description?: string;
  /** Save button label. */
  saveLabel?: string;
  /** Cancel button label. */
  cancelLabel?: string;
}

const MAX_TOTAL = 100;

/**
 * Small Hive avatar — same source other kit components use, with a UI Avatars
 * fallback if the user has no Hive avatar set yet.
 */
const BeneficiaryAvatar: React.FC<{ account: string; size?: number; className?: string }> = ({
  account,
  size = 20,
  className = '',
}) => (
  <img
    src={`https://images.hive.blog/u/${account}/avatar`}
    alt={`@${account}`}
    width={size}
    height={size}
    style={{ width: size, height: size }}
    className={`rounded-full bg-[var(--hrk-bg-surface-raised)] border border-[var(--hrk-border-default)] object-cover shrink-0 ${className}`}
    onError={(e) => {
      const img = e.target as HTMLImageElement;
      if (!img.dataset.fallback) {
        img.dataset.fallback = '1';
        img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(account)}&background=random&size=64`;
      }
    }}
  />
);
interface BeneficiaryWeightInputProps {
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (val: number) => void;
  className?: string;
}

const BeneficiaryWeightInput: React.FC<BeneficiaryWeightInputProps> = ({
  value,
  min,
  max,
  disabled = false,
  onChange,
  className = '',
}) => {
  const [localVal, setLocalVal] = useState(String(value));

  useEffect(() => {
    setLocalVal(String(value));
  }, [value]);

  const handleChange = (valStr: string) => {
    const parts = valStr.split('.');
    if (parts[1] && parts[1].length > 2) {
      return;
    }
    setLocalVal(valStr);
    const parsed = Number(valStr);
    if (!isNaN(parsed) && valStr.trim() !== '') {
      if (parsed >= min && parsed <= max) {
        onChange(parsed);
      }
    }
  };

  const handleBlur = () => {
    let parsed = Number(localVal) || 0;
    parsed = Math.max(min, Math.min(max, parsed));
    onChange(parsed);
    setLocalVal(String(parsed));
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      min={min}
      max={max}
      value={localVal}
      disabled={disabled}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      className={className}
    />
  );
};

const BeneficiariesEditor: React.FC<BeneficiariesEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  initialBeneficiaries,
  hasVideo = false,
  lockedAccounts,
  lockReasons,
  favorites,
  title = 'Beneficiaries',
  description = 'Add a user you want to automatically receive a portion of the rewards for this post.',
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
}) => {
  const [list, setList] = useState<Beneficiary[]>([]);
  const [draftAccount, setDraftAccount] = useState('');
  const [draftWeight, setDraftWeight] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  // Unified set of locked accounts: threespeakfund (when hasVideo) +
  // whatever extras the composer passes through (e.g. DecentMemes
  // creator/submitter rows).
  const lockedAccountsSet = useMemo(() => {
    const s = new Set<string>();
    if (hasVideo) s.add(THREESPEAK_FUND_ACCOUNT);
    for (const a of lockedAccounts ?? []) {
      const acc = normalizeBeneficiaryAccount(a);
      if (acc) s.add(acc);
    }
    return s;
  }, [hasVideo, lockedAccounts]);

  // Initialize the working list whenever the modal opens or the constraint
  // (hasVideo / lockedAccounts identity) changes — the editor always
  // reflects the current rules.
  useEffect(() => {
    if (!isOpen) return;
    setList(enforceVideoBeneficiaries(initialBeneficiaries, hasVideo));
    setDraftAccount('');
    setDraftWeight(1);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, hasVideo]);

  // userCap = 100 - sum(weights of locked entries currently in the list).
  // The DM lock weights are already merged into `initialBeneficiaries` by
  // the composer, so they're reflected in `list` from the first render.
  const lockedTotal = useMemo(
    () => list.filter((b) => lockedAccountsSet.has(b.account)).reduce((s, b) => s + b.weight, 0),
    [list, lockedAccountsSet],
  );
  const userCap = MAX_TOTAL - lockedTotal;
  const userTotal = useMemo(
    () => list.filter((b) => !lockedAccountsSet.has(b.account)).reduce((s, b) => s + b.weight, 0),
    [list, lockedAccountsSet],
  );
  const remaining = Math.max(0, userCap - userTotal);

  if (!isOpen) return null;

  const updateWeight = (account: string, next: number) => {
    if (lockedAccountsSet.has(account)) return;
    setError(null);
    const clamped = Math.max(0.01, Math.min(100, Math.round(next * 100) / 100));
    const others = list
      .filter((b) => !lockedAccountsSet.has(b.account) && b.account !== account)
      .reduce((s, b) => s + b.weight, 0);
    const allowed = Math.max(0.01, userCap - others);
    const finalWeight = Math.min(clamped, allowed);
    setList((prev) =>
      prev.map((b) => (b.account === account ? { ...b, weight: finalWeight } : b)),
    );
  };

  const removeRow = (account: string) => {
    if (lockedAccountsSet.has(account)) return;
    setList((prev) => prev.filter((b) => b.account !== account));
    setError(null);
  };

  const addBeneficiary = (rawAccount: string, weight: number) => {
    const account = normalizeBeneficiaryAccount(rawAccount);
    if (!account) {
      setError('Enter an account name.');
      return false;
    }
    if (list.some((b) => b.account === account)) {
      setError(`@${account} is already added.`);
      return false;
    }
    if (lockedAccountsSet.has(account)) {
      setError(`@${account} is locked / auto-attached.`);
      return false;
    }
    if (remaining <= 0) {
      setError(`Total cannot exceed ${userCap}%.`);
      return false;
    }
    const w = Math.max(0.01, Math.min(remaining, Math.round(weight * 100) / 100 || 0.01));
    setList((prev) => [...prev, { account, weight: w }]);
    setError(null);
    return true;
  };

  const handleAddDraft = () => {
    if (!draftAccount.trim()) return;
    const ok = addBeneficiary(draftAccount, draftWeight || 0.01);
    if (ok) {
      setDraftAccount('');
      setDraftWeight(Math.max(0.01, Math.min(remaining - (draftWeight || 0.01), remaining)));
    }
  };

  const handleSave = () => {
    const sanitized = sanitizeBeneficiaries(list);
    onSave(enforceVideoBeneficiaries(sanitized, hasVideo));
    onClose();
  };

  const sortedFavorites = (favorites ?? []).filter(
    (f) => !list.some((b) => b.account === normalizeBeneficiaryAccount(f.account)),
  );

  // Reusable weight stepper — same chunk used by both existing rows and the
  // staging row, sized down so two of them fit comfortably on a 320px screen.
  const renderWeightStepper = (
    value: number,
    onDec: () => void,
    onInc: () => void,
    onChangeValue: (next: number) => void,
    disabled = false,
    minVal = 0.01,
    maxVal = 100,
  ) => (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={onDec}
        disabled={disabled || value <= minVal}
        className="h-8 w-8 rounded bg-[var(--hrk-bg-surface)] text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-surface-raised)] disabled:opacity-40 flex items-center justify-center shrink-0"
        aria-label="Decrease"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <BeneficiaryWeightInput
        value={value}
        min={minVal}
        max={maxVal}
        disabled={disabled}
        onChange={onChangeValue}
        className="h-8 w-12 rounded border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-app)] px-1 text-center text-xs text-white focus:border-[var(--hrk-info)] outline-none disabled:opacity-50"
      />
      <span className="text-xs text-[var(--hrk-text-tertiary)] w-3">%</span>
      <button
        type="button"
        onClick={onInc}
        disabled={disabled || value >= maxVal}
        className="h-8 w-8 rounded bg-[var(--hrk-bg-surface)] text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-surface-raised)] disabled:opacity-40 flex items-center justify-center shrink-0"
        aria-label="Increase"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-t-2xl sm:rounded-xl border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface-sunken)] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--hrk-border-subtle)]">
          <h2 className="text-base sm:text-lg font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-surface)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-4">
          <p className="text-xs sm:text-sm text-[var(--hrk-text-secondary)]">{description}</p>

          {/* Column headers — desktop only. The mobile layout stacks each row,
              so a column header would only confuse the eye. */}
          <div className="hidden sm:flex items-center text-xs uppercase tracking-wide text-[var(--hrk-text-tertiary)] border-b border-[var(--hrk-border-subtle)] pb-2">
            <span className="flex-1">Username</span>
            <span className="w-44 text-center">Reward</span>
            <span className="w-10" />
          </div>

          {/* Existing rows. Mobile: account on its own row, controls + remove
              underneath; Desktop: everything inline. The trash button sits to
              the right on both layouts so the gesture is consistent. */}
          <div className="space-y-2">
            {list.map((b) => {
              const locked = lockedAccountsSet.has(b.account);
              const lockTitle = locked
                ? (lockReasons?.[b.account]
                  ?? (b.account === THREESPEAK_FUND_ACCOUNT
                    ? '10% to threespeakfund is required for video posts'
                    : `@${b.account} is auto-attached and cannot be removed`))
                : 'Remove';
              return (
                <div
                  key={b.account}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 border-b border-[var(--hrk-border-subtle)]/60 pb-2"
                >
                  <span className="flex-1 min-w-0 text-sm text-[var(--hrk-text-primary)] inline-flex items-center gap-2 truncate">
                    <BeneficiaryAvatar account={b.account} size={24} />
                    {locked && <Lock className="h-3 w-3 text-[var(--hrk-warning)] shrink-0" />}
                    <span className="truncate" title={locked ? lockTitle : undefined}>@{b.account}</span>
                  </span>
                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    {renderWeightStepper(
                      b.weight,
                      () => updateWeight(b.account, b.weight - 1),
                      () => updateWeight(b.account, b.weight + 1),
                      (n) => updateWeight(b.account, n),
                      locked,
                    )}
                    <button
                      type="button"
                      onClick={() => removeRow(b.account)}
                      disabled={locked}
                      className="h-8 w-8 rounded text-[var(--hrk-danger)] hover:bg-[var(--hrk-danger-soft)] disabled:opacity-30 flex items-center justify-center shrink-0"
                      aria-label={locked ? 'Locked' : 'Remove'}
                      title={lockTitle}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add new row. Mobile: input full-width on its own line, then a
              second line with stepper on the left and a wide labeled Add
              button on the right (so it never overflows). Desktop: single row
              like before. */}
          <div className="rounded-lg border border-dashed border-[var(--hrk-border-subtle)] p-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0 flex items-center gap-1 rounded border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-app)] px-2 h-9">
                <span className="text-[var(--hrk-text-tertiary)] text-sm shrink-0">@</span>
                <input
                  type="text"
                  value={draftAccount}
                  onChange={(e) => setDraftAccount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddDraft();
                    }
                  }}
                  placeholder="Account"
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm text-white placeholder-[var(--hrk-text-tertiary)]"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-2">
                {renderWeightStepper(
                  draftWeight,
                  () => setDraftWeight((v) => Math.max(0.01, v - 1)),
                  () => setDraftWeight((v) => Math.min(remaining || 0.01, v + 1)),
                  (n) => {
                    const next = Math.max(0.01, Math.min(remaining || 0.01, n || 0.01));
                    setDraftWeight(next);
                  },
                  false,
                  0.01,
                  Math.max(0.01, remaining),
                )}
                <button
                  type="button"
                  onClick={handleAddDraft}
                  disabled={!draftAccount.trim() || remaining <= 0}
                  className="h-8 inline-flex items-center justify-center gap-1 rounded bg-[var(--hrk-success)] hover:brightness-110 text-white text-xs font-medium disabled:opacity-40 px-3 sm:w-10 sm:px-0 shrink-0"
                  aria-label="Add beneficiary"
                  title="Add beneficiary"
                >
                  <Plus className="h-4 w-4" />
                  <span className="sm:hidden">Add</span>
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px]">
              <span className={`${error ? 'text-[var(--hrk-danger)]' : 'text-[var(--hrk-text-tertiary)]'}`}>
                {error || `Remaining: ${remaining}%${lockedTotal > 0 ? ` (capped at ${userCap}% — ${lockedTotal}% reserved for locked beneficiaries)` : ''}`}
              </span>
              <span className="text-[var(--hrk-text-tertiary)]">Total used: {userTotal + lockedTotal}%</span>
            </div>
          </div>

          {/* Favorites */}
          {sortedFavorites.length > 0 && (
            <div className="rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-app)]/40 p-3">
              <div className="text-xs font-semibold text-[var(--hrk-text-secondary)] mb-2">Favorites</div>
              <div className="flex flex-wrap gap-2">
                {sortedFavorites.map((f) => {
                  const account = normalizeBeneficiaryAccount(f.account);
                  const weight = Math.max(0.01, Math.min(100, Math.round(f.weight * 100) / 100 || 0.01));
                  return (
                    <button
                      key={`${account}-${weight}`}
                      type="button"
                      onClick={() => addBeneficiary(account, weight)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[var(--hrk-brand)]/80 hover:bg-[var(--hrk-brand)] pl-1 pr-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white max-w-full"
                    >
                      <BeneficiaryAvatar account={account} size={18} className="border-blue-300/40" />
                      <span className="truncate">{account} ({weight}%)</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer — buttons are full-width on mobile so they're easy to tap. */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 px-4 sm:px-6 py-3 border-t border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface-sunken)]">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[var(--hrk-bg-surface)] hover:bg-[var(--hrk-bg-surface-raised)] text-[var(--hrk-text-primary)] text-sm flex items-center justify-center gap-1"
          >
            <X className="h-4 w-4" /> {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="w-full sm:w-auto px-5 py-2 rounded-lg bg-[var(--hrk-brand)] hover:bg-[var(--hrk-brand-hover)] text-white text-sm font-medium"
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BeneficiariesEditor;
