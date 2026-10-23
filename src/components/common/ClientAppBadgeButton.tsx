/**
 * ClientAppBadgeButton — the posting-client logo shown in the top-right of
 * snap and blog cards, bundled with its JSON metadata popup.
 *
 * - Known apps (`json_metadata.app` / HiveSuite fingerprint) show their
 *   logo; `appIcons` overrides the kit's default logo per app id.
 * - Unknown apps show a letter badge (`peakd/2024.1` → `P`) on a colour
 *   derived from the app name; posts without an app show `?`.
 * - A logo that fails to load falls back to the letter badge.
 * - Tapping opens <JsonMetadataModal/> with the post's `json_metadata`.
 *   The click is stopped so the surrounding card never navigates.
 */
import { useCallback, useMemo, useState } from 'react';
import type { Post } from '@/types/post';
import {
  resolveSnapClientApp,
  resolveSnapClientAppBadge,
  type SnapClientAppBadge,
} from '@/utils/snapClientApp';
import { JsonMetadataModal } from './JsonMetadataModal';

export interface ClientAppBadgeButtonProps {
  post: Pick<Post, 'author' | 'permlink' | 'json_metadata'>;
  /** Per-app logo overrides keyed by app id (e.g. `{ peakd: '/img/peakd.png' }`). */
  appIcons?: Partial<Record<string, string>>;
  /** `md` (default, 24px — snap cards) or `sm` (12px — blog cards). `sm`
   *  keeps a ~24px tap area via an invisible hit box. */
  size?: 'md' | 'sm';
  /** Extra classes for the button. */
  className?: string;
}

const SIZES = {
  md: { box: 'h-6 w-6 rounded-md', text: 'text-[11px]', hit: '' },
  // Invisible ::before extends the tap target to ~24px without changing layout.
  sm: { box: 'h-3 w-3 rounded-[3px]', text: 'text-[7px]', hit: "before:absolute before:-inset-1.5 before:content-['']" },
} as const;

/** Letter badge used when a post's posting client has no known logo. */
export function ClientAppInitialBadge({ badge, textClassName = 'text-[11px]' }: { badge: SnapClientAppBadge; textClassName?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-full w-full select-none items-center justify-center ${textClassName} font-bold leading-none ${
        badge.color ? 'text-white' : 'text-[var(--hrk-text-secondary)]'
      }`}
      style={badge.color ? { backgroundColor: badge.color } : undefined}
    >
      {badge.initial}
    </span>
  );
}

export function ClientAppBadgeButton({ post, appIcons, size = 'md', className = '' }: ClientAppBadgeButtonProps) {
  const sz = SIZES[size];
  const clientApp = useMemo(
    () => resolveSnapClientApp(post, appIcons),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [post.json_metadata, appIcons],
  );
  const appBadge = useMemo(
    () => resolveSnapClientAppBadge(post),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [post.json_metadata],
  );
  const [failedIconUrl, setFailedIconUrl] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);

  const iconUrl = clientApp && clientApp.iconUrl !== failedIconUrl ? clientApp.iconUrl : null;
  const label = clientApp?.label ?? appBadge.label;
  const known = !!(appBadge.name || clientApp);

  return (
    <>
      <button
        type="button"
        className={`group/appbadge relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md focus:outline-none ${sz.hit} ${className}`}
        title={known ? `Posted via ${label} — view JSON metadata` : 'Unknown app — view JSON metadata'}
        aria-label={known ? `Posted via ${label}. View JSON metadata` : 'Unknown app. View JSON metadata'}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
      >
        <span
          className={`pointer-events-none inline-flex items-center justify-center overflow-hidden bg-[var(--hrk-bg-hover)] ring-1 ring-[var(--hrk-border-default)]/80 transition-opacity group-hover/appbadge:opacity-80 group-focus-visible/appbadge:ring-2 group-focus-visible/appbadge:ring-[var(--hrk-brand)] ${sz.box}`}
        >
          {iconUrl ? (
            <img
              src={iconUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
              onError={() => setFailedIconUrl(iconUrl)}
            />
          ) : (
            <ClientAppInitialBadge badge={appBadge} textClassName={sz.text} />
          )}
        </span>
      </button>
      <JsonMetadataModal
        isOpen={isOpen}
        onClose={close}
        metadata={post.json_metadata}
        subtitle={`@${post.author}/${post.permlink} · via ${label}`}
        icon={
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--hrk-bg-hover)] ring-1 ring-[var(--hrk-border-default)]/80">
            {iconUrl ? (
              <img src={iconUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <ClientAppInitialBadge badge={appBadge} />
            )}
          </span>
        }
      />
    </>
  );
}

export default ClientAppBadgeButton;
