/**
 * HiveLink — router-agnostic "link or button" primitive for the kit.
 *
 * The kit can't depend on react-router (consumers wire their own
 * navigation via `onPostClick` / `onUserClick` callbacks). But a bare
 * <button onClick={navigate}> gives the browser no link semantics, so
 * users can't Cmd/Ctrl/middle-click or right-click → "Open in new tab".
 *
 * HiveLink bridges the gap: when the consumer supplies an `href` (built
 * from a URL-builder prop like `getPostUrl`), we render a real <a> so
 * all the native link affordances work. A plain left click is still
 * intercepted and routed through `onActivate` for SPA navigation;
 * modified / middle clicks fall through to the browser. When no `href`
 * is provided we fall back to a <button>, preserving the old behaviour
 * for consumers that haven't wired URL builders yet.
 */
import type { ReactNode, MouseEvent, CSSProperties } from 'react';

interface HiveLinkProps {
  /** Destination URL. When omitted, renders a <button> (no link
   *  semantics) so existing callback-only consumers keep working. */
  href?: string;
  /** SPA navigation handler — fired on a plain left click. */
  onActivate?: () => void;
  className?: string;
  style?: CSSProperties;
  title?: string;
  'aria-label'?: string;
  /** Stop the event from bubbling to an ancestor click handler
   *  (e.g. a clickable card body). Defaults to true since most kit
   *  links sit inside larger clickable surfaces. */
  stopPropagation?: boolean;
  children: ReactNode;
}

export function HiveLink({
  href,
  onActivate,
  className,
  style,
  title,
  stopPropagation = true,
  children,
  ...rest
}: HiveLinkProps) {
  const ariaLabel = rest['aria-label'];

  if (!href) {
    return (
      <button
        type="button"
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
          onActivate?.();
        }}
        className={className}
        style={style}
        title={title}
        aria-label={ariaLabel}
      >
        {children}
      </button>
    );
  }

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (stopPropagation) e.stopPropagation();
    // Defer to the browser for modified / non-primary clicks so
    // "open in new tab/window" keeps working.
    const isModified =
      e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
    if (isModified) return;
    e.preventDefault();
    onActivate?.();
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className={className}
      style={style}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}
