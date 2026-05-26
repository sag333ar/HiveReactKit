/* eslint-disable react-refresh/only-export-components */
/**
 * IPFS gateway media renderer. IPFS URLs (`https://<gateway>/ipfs/<CID>`) have
 * no file extension so we can't tell from the URL whether the content is an
 * image, a video, or something else. This component does a one-time HEAD
 * request to resolve the content-type, then picks the right element:
 *
 *   - `image/*` → <img>
 *   - `video/*` → <video controls>
 *   - anything else (including HEAD failure) → external link
 *
 * The resolved kind is cached process-wide so re-renders and multiple cards
 * pointing at the same CID share one network call.
 */
import { useEffect, useState } from "react";

export const IPFS_URL_REGEX =
  /https?:\/\/[^\s"'<>)]+\/ipfs\/[a-zA-Z0-9]+(?:\/[^\s"'<>)]*)?/gi;

export type IpfsKind = "image" | "video" | "unknown";

const kindCache = new Map<string, IpfsKind>();
const inFlight = new Map<string, Promise<IpfsKind>>();

export function getIpfsKind(url: string): Promise<IpfsKind> {
  const cached = kindCache.get(url);
  if (cached) return Promise.resolve(cached);
  const pending = inFlight.get(url);
  if (pending) return pending;

  const probe = fetch(url, { method: "HEAD" })
    .then((res) => {
      const ct = (res.headers.get("content-type") ?? "").toLowerCase();
      const kind: IpfsKind = ct.startsWith("image/")
        ? "image"
        : ct.startsWith("video/")
          ? "video"
          : "unknown";
      kindCache.set(url, kind);
      return kind;
    })
    .catch(() => {
      const kind: IpfsKind = "unknown";
      kindCache.set(url, kind);
      return kind;
    })
    .finally(() => {
      inFlight.delete(url);
    });
  inFlight.set(url, probe);
  return probe;
}

export function useIpfsKind(url: string): IpfsKind | null {
  const [kind, setKind] = useState<IpfsKind | null>(() => kindCache.get(url) ?? null);
  useEffect(() => {
    let cancelled = false;
    const cached = kindCache.get(url);
    if (cached) {
      setKind(cached);
      return;
    }
    setKind(null);
    getIpfsKind(url).then((k) => {
      if (!cancelled) setKind(k);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return kind;
}

export interface IpfsMediaProps {
  url: string;
  /** Strip-tile preview (lazy-loaded image, video poster + play badge). */
  variant?: "tile" | "full";
  /** Tile-only — fires when the user taps the tile so the host can open it
   *  in its own popup viewer instead of relying on the inline player. */
  onTileClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export const IpfsMedia: React.FC<IpfsMediaProps> = ({
  url,
  variant = "full",
  onTileClick,
  className,
}) => {
  const kind = useIpfsKind(url);

  if (kind === null) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-[var(--hrk-bg-surface-sunken)] ${className ?? ""}`}
        aria-label="Resolving IPFS media"
      >
        <div className="h-6 w-6 animate-pulse rounded-full bg-[var(--hrk-bg-hover)]" />
      </div>
    );
  }

  if (kind === "image") {
    if (variant === "tile") {
      return (
        <button
          type="button"
          onClick={onTileClick}
          className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-[var(--hrk-bg-surface-sunken)] ${className ?? ""}`}
          aria-label="Open image preview"
        >
          <img src={url} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
        </button>
      );
    }
    return <img src={url} alt="" className={`max-h-full max-w-full object-contain ${className ?? ""}`} />;
  }

  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className={`max-h-full max-w-full ${className ?? ""}`}
      />
    );
  }

  // Unknown content-type — fall back to a plain external link.
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-sm text-[var(--hrk-brand)] underline ${className ?? ""}`}
    >
      {url}
    </a>
  );
};

export default IpfsMedia;
