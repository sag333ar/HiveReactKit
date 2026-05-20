/**
 * SelectionTranslator — wraps a region of rendered content (a post
 * body, an inline comment, a snap card body). When the user
 * highlights text inside that region, a small floating "Translate"
 * button appears next to the selection. Clicking it opens a popover
 * with a language picker + the translated result.
 *
 * Backed by `translateSelection` (Google Translate's public
 * `translate_a/single` endpoint) so consumers don't have to wire an
 * API key. Last-used language is remembered in sessionStorage.
 *
 * Positioning uses `position: fixed` via a portal so the popover
 * escapes any `overflow: hidden` ancestor and never gets clipped by
 * the card's container.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Languages, X, ChevronDown, Loader2 } from "lucide-react";
import {
  translateSelection,
  DEFAULT_TRANSLATE_LANGUAGES,
  getPreferredTranslateLanguage,
  setPreferredTranslateLanguage,
  type SelectionTranslateLanguage,
} from "../i18n/selectionTranslate";

interface SelectionTranslatorProps {
  children: React.ReactNode;
  /** Override the language list. Defaults to a 15-language set. */
  languages?: SelectionTranslateLanguage[];
  /** Minimum length of a selection (whitespace-trimmed) to show the
   *  translate trigger. Default `2` filters out stray single-char
   *  highlights. */
  minLength?: number;
}

interface AnchorPos {
  top: number;
  left: number;
}

const BUTTON_OFFSET = 8;

export function SelectionTranslator({
  children,
  languages = DEFAULT_TRANSLATE_LANGUAGES,
  minLength = 2,
}: SelectionTranslatorProps) {
  // The element this component wraps. Selections are only acted on
  // when their anchor lands inside this subtree — so a user
  // selecting the page title or an action-bar label doesn't trigger
  // the translate UI.
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [selection, setSelection] = useState<{
    text: string;
    anchor: AnchorPos;
  } | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<AnchorPos | null>(null);
  const [targetLang, setTargetLang] = useState<string>(() => getPreferredTranslateLanguage());
  const [picking, setPicking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState<string | null>(null);

  // Detect end-of-selection via `pointerup` / `touchend` on the
  // wrapped container — fires once when the user finishes the
  // selection gesture. We deliberately don't subscribe to
  // `selectionchange`: it fires constantly during a drag, and the
  // rAF-coalescing variant that "looks settled" sometimes races
  // with the browser's own selection clearing on the very last
  // tick, leaving the trigger pill stuck off-screen. Settling on
  // explicit gesture-end events matches what Medium / Notion do
  // and works the same on desktop + mobile.
  //
  // We also tear the trigger down on `mousedown` anywhere — that
  // covers the "user clicked away and cleared the selection"
  // case so the pill doesn't linger.
  useEffect(() => {
    const evaluate = () => {
      // Skip while a popover is open — the user has already moved
      // past the "highlight to translate" phase.
      if (popoverAnchor) return;
      const sel = typeof window !== "undefined" ? window.getSelection() : null;
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelection(null);
        return;
      }
      const text = sel.toString().trim();
      if (text.length < minLength) {
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const node =
        range.commonAncestorContainer.nodeType === Node.TEXT_NODE
          ? range.commonAncestorContainer.parentElement
          : (range.commonAncestorContainer as HTMLElement);
      if (!containerRef.current || !node || !containerRef.current.contains(node)) {
        setSelection(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setSelection({
        text,
        anchor: {
          top: rect.bottom + BUTTON_OFFSET,
          left: rect.left + rect.width / 2,
        },
      });
    };

    // `pointerup` covers mouse + pen; `touchend` ensures iOS/Safari
    // mobile users see the trigger after a text-selection long-press.
    // Fire on a short timeout so the browser has finished settling
    // the selection range before we read it.
    const settle = () => window.setTimeout(evaluate, 30);

    const onPointerUp = () => settle();
    const onTouchEnd = () => settle();
    const onMouseDown = (e: MouseEvent) => {
      // Clicks inside the floating trigger pill / popover (both
      // portalled to document.body) shouldn't clear selection —
      // they're handled by the elements themselves.
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-hrk-translate-ui]')) return;
      setSelection(null);
    };

    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [minLength, popoverAnchor]);

  // Clear popover when user clicks outside or hits Escape.
  useEffect(() => {
    if (!popoverAnchor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPopoverAnchor(null);
        setTranslated(null);
        setSourceText(null);
        setPicking(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popoverAnchor]);

  const runTranslate = useCallback(
    async (text: string, lang: string) => {
      setLoading(true);
      try {
        const out = await translateSelection(text, lang);
        setTranslated(out);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleTriggerClick = useCallback(() => {
    if (!selection) return;
    const lang = getPreferredTranslateLanguage();
    setTargetLang(lang);
    setSourceText(selection.text);
    setPopoverAnchor(selection.anchor);
    setSelection(null);
    setTranslated(null);
    void runTranslate(selection.text, lang);
  }, [selection, runTranslate]);

  const handlePickLanguage = useCallback(
    (lang: string) => {
      setTargetLang(lang);
      setPreferredTranslateLanguage(lang);
      setPicking(false);
      if (sourceText) void runTranslate(sourceText, lang);
    },
    [sourceText, runTranslate],
  );

  const closePopover = useCallback(() => {
    setPopoverAnchor(null);
    setTranslated(null);
    setSourceText(null);
    setPicking(false);
  }, []);

  return (
    <div ref={containerRef}>
      {children}
      {selection && <SelectionTrigger anchor={selection.anchor} onClick={handleTriggerClick} />}
      {popoverAnchor &&
        sourceText &&
        createPortal(
          <TranslatePopover
            anchor={popoverAnchor}
            sourceText={sourceText}
            translated={translated}
            loading={loading}
            targetLang={targetLang}
            picking={picking}
            languages={languages}
            onPickerToggle={() => setPicking((v) => !v)}
            onPickLanguage={handlePickLanguage}
            onClose={closePopover}
          />,
          document.body,
        )}
    </div>
  );
}

interface SelectionTriggerProps {
  anchor: AnchorPos;
  onClick: () => void;
}

function SelectionTrigger({ anchor, onClick }: SelectionTriggerProps) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <button
      type="button"
      data-hrk-translate-ui="trigger"
      // Use mousedown so the click registers before the browser's
      // own click-outside collapses the selection.
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      style={{
        position: "fixed",
        top: anchor.top,
        left: anchor.left,
        transform: "translateX(-50%)",
        zIndex: 2100,
      }}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface-raised)] px-2.5 py-1 text-[11px] font-semibold text-[var(--hrk-text-primary)] shadow-lg hover:bg-[var(--hrk-bg-hover)]"
      aria-label="Translate selection"
    >
      <Languages className="h-3.5 w-3.5 text-[var(--hrk-brand)]" />
      Translate
    </button>,
    document.body,
  );
}

interface TranslatePopoverProps {
  anchor: AnchorPos;
  sourceText: string;
  translated: string | null;
  loading: boolean;
  targetLang: string;
  picking: boolean;
  languages: SelectionTranslateLanguage[];
  onPickerToggle: () => void;
  onPickLanguage: (code: string) => void;
  onClose: () => void;
}

const POPOVER_WIDTH = 320;

function TranslatePopover({
  anchor,
  sourceText,
  translated,
  loading,
  targetLang,
  picking,
  languages,
  onPickerToggle,
  onPickLanguage,
  onClose,
}: TranslatePopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Clamp horizontally so the popover never falls off the viewport.
  const [pos, setPos] = useState<AnchorPos>(anchor);
  useLayoutEffect(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 0;
    const left = Math.max(
      8,
      Math.min(vw - POPOVER_WIDTH - 8, anchor.left - POPOVER_WIDTH / 2),
    );
    setPos({ top: anchor.top, left });
  }, [anchor]);

  // Click outside closes. We register on the next tick so the
  // same mousedown that opened us doesn't immediately close us.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest('[data-hrk-translate-ui]')) return;
      onClose();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDocClick);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [onClose]);

  const langLabel =
    languages.find((l) => l.code === targetLang)?.label ?? targetLang;

  return (
    <div
      ref={ref}
      data-hrk-translate-ui="popover"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: POPOVER_WIDTH,
        zIndex: 2200,
      }}
      className="rounded-xl border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] shadow-2xl"
      role="dialog"
      aria-label="Translation"
    >
      <div className="flex items-center justify-between border-b border-[var(--hrk-border-subtle)] px-3 py-2">
        <button
          type="button"
          onClick={onPickerToggle}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-hover)]"
        >
          <Languages className="h-3.5 w-3.5 text-[var(--hrk-brand)]" />
          {langLabel}
          <ChevronDown className="h-3 w-3 text-[var(--hrk-text-tertiary)]" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--hrk-text-tertiary)] hover:bg-[var(--hrk-bg-hover)] hover:text-[var(--hrk-text-primary)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {picking ? (
        <ul
          role="listbox"
          className="max-h-64 overflow-y-auto py-1"
        >
          {languages.map((lang) => {
            const active = lang.code === targetLang;
            return (
              <li key={lang.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => onPickLanguage(lang.code)}
                  className={
                    "flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors " +
                    (active
                      ? "bg-[var(--hrk-bg-hover)] text-[var(--hrk-text-primary)]"
                      : "text-[var(--hrk-text-secondary)] hover:bg-[var(--hrk-bg-hover)]")
                  }
                >
                  <span>{lang.label}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--hrk-text-tertiary)]">
                    {lang.code}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-3 py-2.5">
          <p className="mb-2 line-clamp-3 text-[11px] italic text-[var(--hrk-text-tertiary)]">
            {sourceText}
          </p>
          <div className="min-h-[36px] text-xs leading-relaxed text-[var(--hrk-text-primary)]">
            {loading ? (
              <span className="inline-flex items-center gap-1.5 text-[var(--hrk-text-tertiary)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Translating…
              </span>
            ) : (
              translated || sourceText
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SelectionTranslator;
