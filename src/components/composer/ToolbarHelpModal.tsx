/**
 * ToolbarHelpModal — small reference popup that documents what every
 * toolbar button does. Each composer builds its own entries array (the
 * toolbar differs slightly between PostComposer and ParentPostComposer)
 * and passes it in.
 */
import React from 'react';
import { HelpCircle, X } from 'lucide-react';

export interface ToolbarHelpEntry {
  /** Icon rendered in the leading chip — typically the same lucide icon the
   *  toolbar button uses, so the help row visually matches the button. */
  icon: React.ReactNode;
  /** Short name (e.g. "Bold"). */
  label: string;
  /** Optional keyboard shortcut (rendered as a kbd-style chip). */
  shortcut?: string;
  /** One-line description of what the button does. */
  description: string;
}

export interface ToolbarHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: ToolbarHelpEntry[];
  title?: string;
}

function ToolbarHelpModal({
  isOpen,
  onClose,
  entries,
  title = 'Toolbar help',
}: ToolbarHelpModalProps): React.JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-3 py-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface-sunken)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-[var(--hrk-border-subtle)] px-4 py-3">
          <h3 className="inline-flex items-center gap-2 text-base font-semibold text-[var(--hrk-text-primary)]">
            <HelpCircle className="h-4 w-4 text-[var(--hrk-info)]" />
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--hrk-text-tertiary)] hover:bg-[var(--hrk-bg-surface)] hover:text-[var(--hrk-text-primary)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <ul className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {entries.map((e, i) => (
            <li
              key={`${e.label}-${i}`}
              className="flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--hrk-bg-surface)]"
            >
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] text-[var(--hrk-text-primary)]">
                {e.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--hrk-text-primary)]">
                  <span>{e.label}</span>
                  {e.shortcut && (
                    <kbd className="rounded border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-app)] px-1 py-0.5 text-[10px] font-mono text-[var(--hrk-text-tertiary)]">
                      {e.shortcut}
                    </kbd>
                  )}
                </div>
                <div className="text-xs leading-relaxed text-[var(--hrk-text-secondary)]">
                  {e.description}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ToolbarHelpModal;
