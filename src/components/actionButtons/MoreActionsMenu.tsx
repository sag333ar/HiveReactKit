/**
 * MoreActionsMenu — a small kebab (⋮) popover that consolidates the
 * post's secondary actions (reblog · share · tip · report) into one
 * compact entry. Used by `PostActionButton` when `actionsAsMenu` is
 * true, and exported standalone so consumer-side cards (e.g. polls,
 * videos) can render the same menu next to their custom layouts.
 *
 * Each action item is conditional — pass only the handlers you want
 * to expose. The menu auto-closes on outside click, Escape, scroll,
 * resize, or after any item runs.
 *
 * Positioning: rendered into `document.body` via a portal with
 * `position: fixed`, anchored just below the trigger's bounding rect.
 * That escapes any `overflow: hidden` ancestor (cards, scroll
 * containers) and lets the popover paint over neighbouring rows.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bookmark,
  Flag,
  Gift,
  MoreVertical,
  Pencil,
  Repeat,
  Repeat2,
  Share2,
  Trash2,
} from 'lucide-react';

export interface MoreActionsMenuProps {
  /** Show the Edit item (rendered first, gated by the caller to the
   *  author themselves). */
  onEdit?: () => void;
  /** Show the Reblog item. */
  onReblog?: () => void;
  /** Show the Re-snap item. Re-snap broadcasts a new snap whose body is
   *  a URL pointing back at this snap — receivers render the original
   *  inline with a "RE-SNAP" badge. */
  onReSnap?: () => void;
  /** Show the Share item. */
  onShare?: () => void;
  /** Show the Tip item. */
  onTip?: () => void;
  /** Show the Flag item. */
  onReport?: () => void;
  /** Show the Bookmark item. The icon fills when `isBookmarked` is true
   *  so the user can see at a glance whether this post is saved.
   *  Consumer decides whether to add or remove based on `isBookmarked`. */
  onToggleBookmark?: () => void;
  isBookmarked?: boolean;
  /** Show the Delete item (rendered last, in red, gated by the caller
   *  to the author themselves — the kit does no ownership check). */
  onDelete?: () => void;
  /** Tailwind classes for the trigger button (defaults match the kit's
   *  inline action buttons). */
  buttonClassName?: string;
  /** aria-label for the trigger. */
  ariaLabel?: string;
}

const MENU_WIDTH = 160; // matches w-40
const GAP = 4;

export function MoreActionsMenu({
  onEdit,
  onReblog,
  onReSnap,
  onShare,
  onTip,
  onReport,
  onToggleBookmark,
  isBookmarked = false,
  onDelete,
  buttonClassName,
  ariaLabel = 'More actions',
}: MoreActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Compute the popover position from the trigger's bounding rect every
  // time it opens (and on resize) so it stays anchored under the kebab
  // even when the page is scrolled or the layout changes.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const top = rect.bottom + GAP;
      // Prefer extending the menu *to the right* of the kebab so it
      // uses any spare space on the right side of the device. Only
      // right-align (extend leftward) when the kebab sits too close
      // to the right edge for the full menu to fit.
      const vw = window.innerWidth;
      const fitsRight = rect.left + MENU_WIDTH <= vw - 8;
      const rawLeft = fitsRight ? rect.left : rect.right - MENU_WIDTH;
      const left = Math.max(8, Math.min(vw - MENU_WIDTH - 8, rawLeft));
      setPosition({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
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
      if (e.key === 'Escape') setOpen(false);
    };
    // Close on scroll/resize — re-anchoring while a row scrolls under
    // the popover looks worse than just dismissing it.
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  // No registered actions → render nothing (mirrors how the inline icons
  // disappear when their callbacks aren't passed).
  if (
    !onEdit &&
    !onReblog &&
    !onReSnap &&
    !onShare &&
    !onTip &&
    !onReport &&
    !onToggleBookmark &&
    !onDelete
  )
    return null;

  const run = (cb?: () => void) => () => {
    setOpen(false);
    cb?.();
  };

  const menu =
    open && position && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: MENU_WIDTH,
              zIndex: 2000,
            }}
            className="overflow-hidden rounded-lg border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface-sunken)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {onEdit && (
              <button
                type="button"
                role="menuitem"
                onClick={run(onEdit)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--hrk-text-secondary)] transition-colors hover:bg-[var(--hrk-bg-hover)]"
              >
                <Pencil className="h-3.5 w-3.5 text-blue-400" />
                <span>Edit</span>
              </button>
            )}
            {onReblog && (
              <button
                type="button"
                role="menuitem"
                onClick={run(onReblog)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--hrk-text-secondary)] transition-colors hover:bg-[var(--hrk-bg-hover)]"
              >
                <Repeat2 className="h-3.5 w-3.5 text-gray-300" />
                <span>Reblog</span>
              </button>
            )}
            {onReSnap && (
              <button
                type="button"
                role="menuitem"
                onClick={run(onReSnap)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--hrk-text-secondary)] transition-colors hover:bg-[var(--hrk-bg-hover)]"
              >
                <Repeat className="h-3.5 w-3.5 text-emerald-400" />
                <span>Re-snap</span>
              </button>
            )}
            {onShare && (
              <button
                type="button"
                role="menuitem"
                onClick={run(onShare)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--hrk-text-secondary)] transition-colors hover:bg-[var(--hrk-bg-hover)]"
              >
                <Share2 className="h-3.5 w-3.5 text-gray-300" />
                <span>Share</span>
              </button>
            )}
            {onTip && (
              <button
                type="button"
                role="menuitem"
                onClick={run(onTip)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--hrk-text-secondary)] transition-colors hover:bg-[var(--hrk-bg-hover)]"
              >
                <Gift className="h-3.5 w-3.5 text-green-400" />
                <span>Tip</span>
              </button>
            )}
            {onToggleBookmark && (
              <button
                type="button"
                role="menuitem"
                onClick={run(onToggleBookmark)}
                aria-pressed={isBookmarked}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--hrk-text-secondary)] transition-colors hover:bg-[var(--hrk-bg-hover)]"
              >
                <Bookmark
                  className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-current text-[var(--hrk-brand)]' : 'text-gray-300'}`}
                />
                <span>{isBookmarked ? 'Remove bookmark' : 'Bookmark'}</span>
              </button>
            )}
            {onReport && (
              <button
                type="button"
                role="menuitem"
                onClick={run(onReport)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-300 transition-colors hover:bg-[var(--hrk-bg-hover)]"
              >
                <Flag className="h-3.5 w-3.5" />
                <span>Flag</span>
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                role="menuitem"
                onClick={run(onDelete)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-400 transition-colors hover:bg-[var(--hrk-bg-hover)]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            )}
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
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          buttonClassName ??
          'flex items-center justify-center rounded p-0.5 sm:p-1 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors'
        }
      >
        <MoreVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
      {menu}
    </>
  );
}

export default MoreActionsMenu;
