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
import { Play, Loader2 } from 'lucide-react';

interface ThreeSpeakPlayerProps {
  author: string;
  permlink: string;
  /** Suppress the layered thumbnail entirely — useful in surfaces
   *  (e.g. HiveDetailPost) where a thumbnail-shaped placeholder
   *  before play is unwanted. Defaults to false: the thumbnail is
   *  shown until first play. */
  hideThumbnail?: boolean;
  /** Poster image to show before first play. Takes priority over the
   *  embed API's thumbnail — pass the post's own thumbnail (e.g. the
   *  one in the 3Speak markdown) so the preview matches the composer
   *  instead of falling back to the video's first frame. */
  thumbnail?: string;
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

/** Strip a `images.hive.blog/<WxH>/` or `images.ecency.com/<WxH>/`
 *  resize prefix so we can rebuild the proxy chain from the original URL. */
function stripImageProxy(url: string): string {
  let out = url.trim();
  let prev: string;
  do {
    prev = out;
    out = out.replace(/^https:\/\/images\.(?:hive\.blog|ecency\.com)\/\d+x\d+\//i, '');
  } while (out !== prev);
  return out;
}

/** Poster candidates in priority order: Hive proxy → Ecency proxy → the
 *  original URL. data:/blob: URLs can't be proxied, so they pass through. */
function posterCandidates(url: string | undefined): string[] {
  const raw = stripImageProxy((url ?? '').trim());
  if (!raw) return [];
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return [raw];
  const chain = [
    `https://images.hive.blog/0x0/${raw}`,
    `https://images.ecency.com/0x0/${raw}`,
    raw,
  ];
  return chain.filter((u, i) => u && chain.indexOf(u) === i);
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

export function ThreeSpeakPlayer({ author, permlink, hideThumbnail = false, thumbnail }: ThreeSpeakPlayerProps) {
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
  /** Latched true the moment the user taps play, so we can swap the play
   *  icon for a spinner immediately instead of leaving the poster looking
   *  inert while HLS buffers the first segments. */
  const [starting, setStarting] = useState(false);
  /** Index into the poster proxy chain (Hive → Ecency → raw). Advances
   *  when the current candidate fails to load. */
  const [posterStep, setPosterStep] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    setStarting(true);
    // play() may reject (not yet ready / autoplay policy). On reject we
    // surface the poster + play icon again so the tap is retryable.
    const p = video.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => setStarting(false));
    }
  };

  // Fetch metadata + manifest URL — tries `/api/watch` (legacy-safe)
  // then `/api/embed`.
  useEffect(() => {
    let cancelled = false;
    setMeta(null);
    setError(null);
    setAspectRatio(null);
    setHasPlayed(false);
    setStarting(false);
    setPosterStep(0);
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

  // Poster proxy chain (Hive → Ecency → raw). Prefer the caller-supplied
  // thumbnail, falling back to the embed API's.
  const posters = posterCandidates(thumbnail || meta?.thumbnail);

  if (error) {
    return (
      <div className={wrapperClass} data-state="error">
        <div className="threeSpeakNativeMessage">{error}</div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className={wrapperClass} style={inlineStyle} data-state="loading">
        {/* Skeleton placeholder while the embed manifest resolves —
            an animated shimmer filling the reserved video box plus a
            faint play disc, instead of a bare "Loading…" line. */}
        <div className="threeSpeakNativeSkeleton" aria-hidden="true">
          <span className="threeSpeakNativeSkeletonDisc">
            <Play className="h-6 w-6 translate-x-0.5 text-white/60 sm:h-7 sm:w-7" fill="currentColor" />
          </span>
        </div>
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
      {!hideThumbnail && posters.length > 0 && posterStep < posters.length && !hasPlayed && (
        <>
          <img
            // Key on the candidate so a failed proxy re-requests the next.
            key={posterStep}
            src={posters[posterStep]}
            alt=""
            className="threeSpeakNativeThumb"
            aria-hidden="true"
            onError={() => setPosterStep((s) => s + 1)}
          />
          {/* Centered play overlay over the thumbnail — mirrors the post
              composer's video preview. Tapping it starts inline playback;
              the icon swaps to a spinner while the first segments buffer
              so the tap never feels inert. */}
          <button
            type="button"
            aria-label="Play video"
            onClick={startPlayback}
            className="absolute inset-0 z-10 flex items-center justify-center"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm transition hover:scale-105 hover:bg-black/70 sm:h-16 sm:w-16">
              {starting ? (
                <Loader2 className="h-6 w-6 animate-spin text-white sm:h-7 sm:w-7" />
              ) : (
                <Play className="h-6 w-6 translate-x-0.5 text-white sm:h-7 sm:w-7" fill="currentColor" />
              )}
            </span>
          </button>
        </>
      )}
      <video
        ref={videoRef}
        controls
        playsInline
        preload="auto"
      />
    </div>
  );
}

export default ThreeSpeakPlayer;
