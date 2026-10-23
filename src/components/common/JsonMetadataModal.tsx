/**
 * JsonMetadataModal — popup that shows a post's `json_metadata` as a
 * formatted, collapsible, scrollable JSON tree.
 *
 * `metadata` may be the raw chain string or an already-parsed object.
 * Strings are parsed safely; if parsing fails the raw string is shown
 * verbatim so nothing is hidden from the viewer.
 *
 * Closes via the top-right X button, a backdrop tap, or Escape. Rendered
 * through a portal on `document.body` so transformed / virtualised feed
 * rows can't clip or mis-position it.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Braces, Check, Copy, X } from 'lucide-react';
import { JsonTreeView } from './JsonTreeView';

export interface JsonMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Raw `json_metadata` (string from the chain) or a parsed object. */
  metadata: unknown;
  /** Heading text. Default "JSON metadata". */
  title?: string;
  /** Optional secondary line under the title (e.g. `@author/permlink`). */
  subtitle?: ReactNode;
  /** Optional icon shown left of the title (e.g. the client app icon). */
  icon?: ReactNode;
}

interface ParsedMetadata {
  /** True when the metadata is valid JSON (or already an object). */
  ok: boolean;
  /** Parsed value (only meaningful when `ok`). */
  value: unknown;
  /** Pretty-printed JSON when `ok`, otherwise the raw unparsable string. */
  text: string;
}

function parseMetadata(metadata: unknown): ParsedMetadata {
  if (typeof metadata === 'string') {
    const trimmed = metadata.trim();
    if (!trimmed) return { ok: true, value: {}, text: '{}' };
    try {
      const value: unknown = JSON.parse(trimmed);
      return { ok: true, value, text: JSON.stringify(value, null, 2) };
    } catch {
      return { ok: false, value: undefined, text: metadata };
    }
  }
  if (metadata === undefined || metadata === null) {
    return { ok: true, value: {}, text: '{}' };
  }
  try {
    return { ok: true, value: metadata, text: JSON.stringify(metadata, null, 2) };
  } catch {
    return { ok: false, value: undefined, text: String(metadata) };
  }
}

export function JsonMetadataModal({
  isOpen,
  onClose,
  metadata,
  title = 'JSON metadata',
  subtitle,
  icon,
}: JsonMetadataModalProps) {
  const parsed = useMemo(() => (isOpen ? parseMetadata(metadata) : null), [isOpen, metadata]);
  const [expandDepth, setExpandDepth] = useState(2);
  const [treeKey, setTreeKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Escape to close, lock background scroll, focus the close button.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtnRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  // Reset view state each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setExpandDepth(2);
      setTreeKey((k) => k + 1);
      setCopied(false);
    }
  }, [isOpen]);

  const setAll = useCallback((expand: boolean) => {
    setExpandDepth(expand ? Number.POSITIVE_INFINITY : 1);
    setTreeKey((k) => k + 1);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!parsed) return;
    try {
      await navigator.clipboard.writeText(parsed.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (e.g. insecure context) — ignore */
    }
  }, [parsed]);

  if (!isOpen || !parsed || typeof document === 'undefined') return null;

  const isTree = parsed.ok && parsed.value !== null && typeof parsed.value === 'object';
  const toolbarBtn =
    'inline-flex cursor-pointer items-center gap-1 rounded-md border border-[var(--hrk-border-default)] px-2 py-1 text-[11px] font-medium text-[var(--hrk-text-secondary)] transition-colors hover:bg-[var(--hrk-bg-hover)] hover:text-[var(--hrk-text-primary)]';

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-3 sm:p-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] text-[var(--hrk-text-primary)] shadow-2xl sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--hrk-border-default)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {icon ?? <Braces className="h-5 w-5 shrink-0 text-[var(--hrk-text-secondary)]" />}
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{title}</h3>
              {subtitle && (
                <div className="truncate text-xs text-[var(--hrk-text-tertiary)]">{subtitle}</div>
              )}
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--hrk-text-secondary)] transition-colors hover:bg-[var(--hrk-bg-hover)] hover:text-[var(--hrk-text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--hrk-border-subtle)] px-4 py-2">
          {isTree && (
            <>
              <button type="button" className={toolbarBtn} onClick={() => setAll(true)}>
                Expand all
              </button>
              <button type="button" className={toolbarBtn} onClick={() => setAll(false)}>
                Collapse all
              </button>
            </>
          )}
          {!parsed.ok && (
            <span className="text-[11px] font-medium text-amber-400">Invalid JSON — showing raw value</span>
          )}
          <button type="button" className={`${toolbarBtn} ml-auto`} onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-3 py-3 [-webkit-overflow-scrolling:touch]">
          {parsed.ok ? (
            <JsonTreeView data={parsed.value} defaultExpandDepth={expandDepth} resetKey={treeKey} />
          ) : (
            <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-5 text-[var(--hrk-text-primary)]">
              {parsed.text}
            </pre>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default JsonMetadataModal;
