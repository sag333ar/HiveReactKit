/**
 * LanguagePickerButton — a small globe icon in the header app bar
 * that opens a popover with the same 15-language list used by the
 * selection-translate flow. Choosing a language calls
 * `onSelectLanguage(code)` so the consumer can update its
 * `<HiveLanguageProvider language=…>`, which in turn re-translates
 * every `<TranslatedBody>` / `<TranslatedText>` / inline-comment
 * body inside the page automatically.
 *
 * The kit only renders the button when both `language` and
 * `onSelectLanguage` are provided. When the active language is the
 * default ("en"), the globe sits in a neutral tint; when a non-
 * default language is active, it picks up the brand accent so it's
 * obvious the page is being translated.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Globe } from "lucide-react";
import {
  DEFAULT_TRANSLATE_LANGUAGES,
  type SelectionTranslateLanguage,
} from "../i18n/selectionTranslate";

interface LanguagePickerButtonProps {
  /** Currently active language (BCP-47, e.g. "en", "es", "hi"). */
  language: string;
  /** Called when the user picks a new language. */
  onSelectLanguage: (code: string) => void;
  /** Optional override for the language list. Defaults to the same
   *  15-language set used by the selection-translate popover. */
  languages?: SelectionTranslateLanguage[];
  /** Optional class name to override styling. */
  className?: string;
  /** Optional flag to render as a menu item instead of header button. */
  isMenuItem?: boolean;
}

const MENU_WIDTH = 220;
const MENU_GAP = 6;

export function LanguagePickerButton({
  language,
  onSelectLanguage,
  languages = DEFAULT_TRANSLATE_LANGUAGES,
  className,
  isMenuItem = false,
}: LanguagePickerButtonProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const top = rect.bottom + MENU_GAP;
      const vw = window.innerWidth;
      // Right-align under the trigger; clamp so the popover never
      // falls off the viewport on narrow screens.
      const rawLeft = rect.right - MENU_WIDTH;
      const left = Math.max(8, Math.min(vw - MENU_WIDTH - 8, rawLeft));
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isTranslated = (language || "en").toLowerCase() !== "en";
  const activeLabel =
    languages.find((l) => l.code === language)?.label ?? language;

  const menu =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: MENU_WIDTH,
              zIndex: 2010,
            }}
            className="overflow-hidden rounded-lg border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface-sunken)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ul className="max-h-72 overflow-y-auto py-1" role="listbox">
              {languages.map((lang) => {
                const active = lang.code === language;
                return (
                  <li key={lang.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setOpen(false);
                        onSelectLanguage(lang.code);
                      }}
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
          </div>,
          document.body,
          )
        : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Translate page"
        title={`Translate page — current: ${activeLabel}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          isMenuItem
            ? "flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--hrk-text-secondary)] transition-colors hover:bg-[var(--hrk-bg-hover)]"
            : "p-1.5 rounded-lg transition-colors flex-shrink-0 " +
              (isTranslated
                ? "bg-[var(--hrk-brand-soft)] text-[var(--hrk-brand)] hover:bg-[var(--hrk-bg-hover)]"
                : "hover:bg-[var(--hrk-bg-surface-raised)] text-[var(--hrk-text-secondary)]") +
              (className ? " " + className : "")
        }
      >
        <Globe className={isMenuItem ? "h-3.5 w-3.5 text-gray-300" : "h-5 w-5"} />
        {isMenuItem ? <span>Translate</span> : null}
      </button>
      {menu}
    </>
  );
}

export default LanguagePickerButton;
