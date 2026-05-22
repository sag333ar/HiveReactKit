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
import { GripHorizontal, Languages, X, ChevronDown, Loader2 } from "lucide-react";
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
  // Clamp horizontally + vertically so the popover never falls off
  // the viewport. Previously only horizontal clamping ran, so a
  // selection near the bottom of the screen anchored the popover
  // off-screen and the user had no way to scroll a `position: fixed`
  // element back into view.
  const [pos, setPos] = useState<AnchorPos>(anchor);
  // Hard cap on the popover's height, computed from the actual
  // available vertical space so the inner content area scroll bar
  // is reachable on mobile too. Without this, `maxHeight: 100vh`
  // ignores the top offset and the popover bottom still spills
  // below the viewport on tall translations.
  const [maxH, setMaxH] = useState<number>(0);
  useLayoutEffect(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 0;
    const vh = typeof window !== "undefined" ? window.innerHeight : 0;
    const left = Math.max(
      8,
      Math.min(vw - POPOVER_WIDTH - 8, anchor.left - POPOVER_WIDTH / 2),
    );
    const margin = 8;
    const measured = ref.current?.offsetHeight ?? 240;
    let top = anchor.top;
    let available = vh - top - margin;
    if (measured > available) {
      // Doesn't fit below — try flipping above.
      const flippedTop = anchor.top - measured - 16 - 2 * BUTTON_OFFSET;
      const aboveAvailable = anchor.top - 16 - 2 * BUTTON_OFFSET - margin;
      if (flippedTop >= margin) {
        top = flippedTop;
        available = aboveAvailable;
      } else if (aboveAvailable > available) {
        // Cap at the top — gives more room than below would.
        top = margin;
        available = aboveAvailable;
      }
    }
    if (top < margin) top = margin;
    // Final cap: at least 160px so a short popover stays usable on
    // a narrow viewport, but never taller than the available space.
    const finalMax = Math.max(160, Math.min(available, vh - margin * 2));
    setPos({ top, left });
    setMaxH(finalMax);
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

  // ── Drag-to-move ─────────────────────────────────────────────────
  // The user can grab the header bar and drag the popover anywhere
  // on the screen — useful when the auto-positioned spot covers the
  // sentence they were reading. `dragOffset` is the {dx, dy} delta
  // applied to `pos` on top of the auto-positioner; it survives until
  // the popover unmounts so the user's chosen spot persists across
  // language picks / refetches inside the same popover session.
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startDx: number;
    startDy: number;
    pointerId: number;
  } | null>(null);

  const onHeaderPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Don't start dragging when the user is interacting with the
    // language-picker toggle or close button — those need their own
    // click. The drag handle is the rest of the header bar.
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button')) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startDx: dragOffset.dx,
      startDy: dragOffset.dy,
      pointerId: e.pointerId,
    };
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch { /* setPointerCapture unsupported — drag still works via pointermove */ }
  }, [dragOffset.dx, dragOffset.dy]);

  const onHeaderPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.preventDefault();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popH = ref.current?.offsetHeight ?? 240;
    const margin = 8;
    // Clamp so the popover always keeps at least a sliver on-screen.
    const minLeft = -(pos.left + POPOVER_WIDTH - margin);     // can drag mostly off the left edge
    const maxLeft = vw - pos.left - margin;                    // … but keep `margin` visible at right
    const minTop = -(pos.top - margin);                        // keep margin from top
    const maxTop = vh - pos.top - Math.min(40, popH);          // keep header bar visible
    const proposedDx = drag.startDx + (e.clientX - drag.startClientX);
    const proposedDy = drag.startDy + (e.clientY - drag.startClientY);
    setDragOffset({
      dx: Math.max(minLeft, Math.min(maxLeft, proposedDx)),
      dy: Math.max(minTop, Math.min(maxTop, proposedDy)),
    });
  }, [pos.left, pos.top]);

  const onHeaderPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch { /* releasePointerCapture unsupported */ }
      dragRef.current = null;
    }
  }, []);

  const langLabel =
    languages.find((l) => l.code === targetLang)?.label ?? targetLang;

  return (
    <div
      ref={ref}
      data-hrk-translate-ui="popover"
      style={{
        position: "fixed",
        // Auto-positioned anchor + the user's drag offset. The
        // offset is whatever delta they've dragged the popover
        // since it opened — zero on first paint, non-zero after a
        // grab-and-move on the header bar.
        top: pos.top + dragOffset.dy,
        left: pos.left + dragOffset.dx,
        width: POPOVER_WIDTH,
        maxHeight: maxH ? `${maxH}px` : "calc(100vh - 16px)",
        display: "flex",
        flexDirection: "column",
        zIndex: 2200,
      }}
      className="overflow-hidden rounded-xl border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] shadow-2xl"
      role="dialog"
      aria-label="Translation"
    >
      {/* Header doubles as a drag handle. `touchAction: 'none'` is
          required so the browser doesn't claim the touch for a
          page-pan gesture before our pointermove handler can move
          the popover. The two buttons inside live above the drag
          handler — `onHeaderPointerDown` short-circuits when the
          pointer originated on a <button>, so the language picker
          and close X still work normally. */}
      <div
        className="flex shrink-0 cursor-grab items-center justify-between gap-2 border-b border-[var(--hrk-border-subtle)] px-3 py-2 active:cursor-grabbing"
        style={{ touchAction: "none" }}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
        aria-label="Drag to move"
      >
        <button
          type="button"
          onClick={onPickerToggle}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-hover)]"
        >
          <Languages className="h-3.5 w-3.5 text-[var(--hrk-brand)]" />
          {langLabel}
          <ChevronDown className="h-3 w-3 text-[var(--hrk-text-tertiary)]" />
        </button>
        {/* Visual grip — also serves as the obvious drag affordance. */}
        <GripHorizontal
          aria-hidden
          className="pointer-events-none h-3.5 w-3.5 text-[var(--hrk-text-tertiary)]"
        />
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
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
          style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch" }}
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
        // Body scrolls inside the popover when the translated text
        // overflows the available height. `min-h-0` is required to
        // let the flex child shrink below its content size so
        // `overflow-y-auto` actually kicks in. `touchAction: pan-y`
        // + `WebkitOverflowScrolling: touch` make the vertical
        // scroll gesture work inside the popover on iOS / Android.
        // `overscroll-contain` stops the scroll from bubbling out
        // to the underlying post body once the popover hits its
        // top / bottom edge.
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2.5"
          style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch" }}
        >
          <p className="mb-2 text-[11px] italic text-[var(--hrk-text-tertiary)]">
            {sourceText}
          </p>
          <div className="min-h-[36px] whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--hrk-text-primary)]">
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
