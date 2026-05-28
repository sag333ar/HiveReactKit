/**
 * ThreeSpeakPlayer — native HTML5 video player for 3Speak embeds in
 * post bodies. Replaces the old iframe wrapper so we can:
 *
 *   - Resolve the actual HLS manifest via play.3speak.tv/api/embed
 *     (with three CDN fallbacks).
 *   - Read the canonical `short: boolean` flag and pick the right
 *     container aspect: landscape (16:9, default) for normal clips,
 *     portrait (9:16 column inside a 16:9 frame with black side
 *     bars) for shorts.
 *   - Show our own poster + native controls instead of the 3Speak
 *     embed page chrome.
 *
 * Mounted by HiveDetailPost via React 19 `createRoot` into the
 * `.threeSpeakEmbed` placeholders the markdown rewrite leaves behind.
 */
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface ThreeSpeakPlayerProps {
  author: string;
  permlink: string;
  /** Suppress the layered thumbnail entirely — useful in surfaces
   *  (e.g. HiveDetailPost) where a thumbnail-shaped placeholder
   *  before play is unwanted. Defaults to false: the thumbnail is
   *  shown until first play. */
  hideThumbnail?: boolean;
}

interface EmbedMeta {
  videoUrl?: string;
  videoUrlFallback1?: string;
  videoUrlFallback2?: string;
  videoUrlFallback3?: string;
  thumbnail?: string;
  short?: boolean;
  isPlaceholder?: boolean;
  status?: string;
}

const EMBED_API = 'https://play.3speak.tv/api/embed';
// The newer `/api/watch` endpoint resolves legacy videos that
// `/api/embed` reports as "Video not found" (embed only knows about
// videos published through the new pipeline). Both return the same
// `{ success, videoUrl, videoUrlFallback1..3, thumbnail, … }` shape,
// so we try watch first and fall back to embed.
const WATCH_API = 'https://play.3speak.tv/api/watch';

/** Resolve a video's metadata, trying `/api/watch` first (covers
 *  legacy uploads) and falling back to `/api/embed`. Returns the first
 *  successful payload, or throws if neither resolves. */
async function fetchThreeSpeakMeta(
  author: string,
  permlink: string,
  signal: () => boolean,
): Promise<EmbedMeta> {
  const endpoints = [
    `${WATCH_API}?v=${author}/${permlink}`,
    `${EMBED_API}?v=${author}/${permlink}`,
  ];
  let lastErr: Error | null = null;
  for (const url of endpoints) {
    if (signal()) throw new Error('cancelled');
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) {
        lastErr = new Error(`HTTP ${r.status}`);
        continue;
      }
      const data = (await r.json()) as { success?: boolean } & EmbedMeta;
      // A successful response still needs at least one manifest URL —
      // otherwise treat it as a miss and try the next endpoint.
      if (data?.success && manifestCandidates(data).length > 0) {
        return data;
      }
      lastErr = new Error('Video not found');
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error('fetch failed');
    }
  }
  throw lastErr ?? new Error('Video unavailable');
}

/** All candidate manifest URLs, in priority order. The embed API
 *  ships up to four CDN mirrors and any individual one can be slow,
 *  rate-limited, or simply down — we try them in sequence so one
 *  unreachable CDN doesn't leave the user staring at a blank player. */
function manifestCandidates(meta: EmbedMeta): string[] {
  return [
    meta.videoUrl,
    meta.videoUrlFallback1,
    meta.videoUrlFallback2,
    meta.videoUrlFallback3,
  ].filter((u): u is string => typeof u === 'string' && u.length > 0);
}

/**
 * Attach an HLS source. Uses hls.js where supported and falls back
 * to native HLS on Safari. The `onFatal` callback fires once for any
 * unrecoverable failure (HLS fatal error or `<video>` error event)
 * so the caller can advance to the next CDN. Returns a teardown
 * function — safe to call multiple times.
 */
function attachHls(
  video: HTMLVideoElement,
  src: string,
  onFatal?: () => void,
): () => void {
  // Safari can play HLS natively. We also use the same path for non-HLS
  // sources (rare for 3Speak but cheap to support).
  if (video.canPlayType('application/vnd.apple.mpegurl') || !src.includes('.m3u8')) {
    let fired = false;
    const handleError = () => {
      if (fired) return;
      fired = true;
      onFatal?.();
    };
    video.addEventListener('error', handleError);
    video.src = src;
    return () => {
      video.removeEventListener('error', handleError);
      video.removeAttribute('src');
      video.load();
    };
  }
  if (Hls.isSupported()) {
    const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
    let fired = false;
    hls.on(Hls.Events.ERROR, (_evt, data) => {
      if (!data.fatal || fired) return;
      fired = true;
      onFatal?.();
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    return () => {
      try {
        hls.destroy();
      } catch {
        /* swallow */
      }
    };
  }
  // Last-ditch: hand the URL to the <video> directly. Most browsers
  // without HLS support will error; we surface that to the caller.
  let fired = false;
  const handleError = () => {
    if (fired) return;
    fired = true;
    onFatal?.();
  };
  video.addEventListener('error', handleError);
  video.src = src;
  return () => {
    video.removeEventListener('error', handleError);
    video.removeAttribute('src');
    video.load();
  };
}

export function ThreeSpeakPlayer({ author, permlink, hideThumbnail = false }: ThreeSpeakPlayerProps) {
  const [meta, setMeta] = useState<EmbedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Actual video aspect ratio (W / H) read from `loadedmetadata`.
   *  We size the container with the real aspect so poster + frames
   *  always paint in the same box — no "thumbnail too big, video
   *  plays smaller" jump. Falls back to the API's `short` hint while
   *  metadata is still in flight. */
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  /** Latched true on the first `playing` event. Drives the thumbnail
   *  layer's visibility — shown ONCE before first play and hidden
   *  thereafter. We deliberately don't reset on pause, so the user
   *  sees the paused frame instead of the thumbnail snapping back. */
  const [hasPlayed, setHasPlayed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Fetch metadata + manifest URL — tries `/api/watch` (legacy-safe)
  // then `/api/embed`.
  useEffect(() => {
    let cancelled = false;
    setMeta(null);
    setError(null);
    setAspectRatio(null);
    setHasPlayed(false);
    fetchThreeSpeakMeta(author, permlink, () => cancelled)
      .then((data) => {
        if (!cancelled) setMeta(data);
      })
      .catch((e) => {
        if (!cancelled && (!(e instanceof Error) || e.message !== 'cancelled')) {
          setError('Failed to load video');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [author, permlink]);

  // Wire HLS once we have the manifest URL, and listen for both real
  // video dimensions (resize container) and first `playing` (hide
  // thumbnail). Walks the candidate list on fatal errors so a slow or
  // unreachable CDN doesn't leave the player blank — the next mirror
  // takes over automatically.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !meta) return;
    const candidates = manifestCandidates(meta);
    if (candidates.length === 0) {
      setError('Video unavailable');
      return;
    }

    const onMeta = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setAspectRatio(video.videoWidth / video.videoHeight);
      }
    };
    const onPlaying = () => setHasPlayed(true);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('playing', onPlaying);

    let cancelled = false;
    let detach: (() => void) | null = null;
    let index = 0;

    const tryNext = () => {
      if (cancelled) return;
      if (detach) {
        detach();
        detach = null;
      }
      if (index >= candidates.length) {
        // Every CDN failed — surface a real error instead of leaving
        // the player silently stuck on the spinner / a blank box.
        setError('Failed to load video');
        return;
      }
      const url = candidates[index];
      index += 1;
      detach = attachHls(video, url, () => {
        // Defer slightly so HLS internal teardown finishes before we
        // attach a new instance to the same <video>.
        setTimeout(tryNext, 0);
      });
    };

    tryNext();

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('playing', onPlaying);
      if (detach) detach();
    };
  }, [meta]);

  const isPortrait =
    aspectRatio != null ? aspectRatio < 1 : meta?.short === true;
  const orientationClass = isPortrait ? 'threeSpeakNativePortrait' : 'threeSpeakNativeLandscape';
  const wrapperClass = `threeSpeakNative ${orientationClass}${
    hideThumbnail ? ' threeSpeakNativeNoThumb' : ''
  }`;
  // Reserve space for the player using whatever aspect we know:
  //  - prefer the measured ratio from `loadedmetadata`
  //  - fall back to 9:16 / 16:9 from the API's `short` hint
  //  - in non-hideThumbnail mode, keep the original behaviour where
  //    the inline style only applies once a measured ratio is known
  //    (the wrapper class handles the initial reservation there)
  // Without this, hideThumbnail mode collapsed to 0 height while HLS
  // was still parsing the manifest — the video appeared "missing"
  // until a reload happened to hit a hot CDN cache.
  const fallbackRatio = meta?.short === true ? 9 / 16 : 16 / 9;
  const reservedRatio = aspectRatio ?? (meta ? fallbackRatio : null);
  const inlineStyle = hideThumbnail
    ? reservedRatio != null
      ? { aspectRatio: `${reservedRatio}` }
      : undefined
    : aspectRatio != null
      ? { aspectRatio: `${aspectRatio}` }
      : undefined;

  if (error) {
    return (
      <div className={wrapperClass} data-state="error">
        <div className="threeSpeakNativeMessage">{error}</div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className={wrapperClass} data-state="loading">
        <div className="threeSpeakNativeMessage">Loading video…</div>
      </div>
    );
  }

  return (
    <div className={wrapperClass} style={inlineStyle} data-state="ready">
      {/* Thumbnail shown before first play. Both <img> and <video>
          are absolutely-positioned at inset:0 with the same
          `object-fit: contain`, so they paint at exactly the same
          size and position. Once playback starts, the <img> is
          unmounted and never returns — pause leaves the current
          video frame visible (browser default).
          When `hideThumbnail` is set (e.g. by HiveDetailPost), the
          <img> is suppressed entirely — the video element shows its
          own pre-play empty state instead. */}
      {!hideThumbnail && meta.thumbnail && !hasPlayed && (
        <img
          src={meta.thumbnail}
          alt=""
          className="threeSpeakNativeThumb"
          aria-hidden="true"
        />
      )}
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
      />
    </div>
  );
}

export default ThreeSpeakPlayer;
