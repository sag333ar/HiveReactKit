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

function pickManifest(meta: EmbedMeta): string | undefined {
  return (
    meta.videoUrl ||
    meta.videoUrlFallback1 ||
    meta.videoUrlFallback2 ||
    meta.videoUrlFallback3
  );
}

/**
 * Attach an HLS source. Uses hls.js where supported and falls back
 * to native HLS on Safari. Returns a teardown function.
 */
function attachHls(video: HTMLVideoElement, src: string): () => void {
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = src;
    return () => {
      video.removeAttribute('src');
      video.load();
    };
  }
  if (Hls.isSupported() && src.includes('.m3u8')) {
    const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
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
  video.src = src;
  return () => {
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

  // Fetch metadata + manifest URL from the embed API.
  useEffect(() => {
    let cancelled = false;
    setMeta(null);
    setError(null);
    setAspectRatio(null);
    setHasPlayed(false);
    fetch(`${EMBED_API}?v=${author}/${permlink}`, {
      headers: { Accept: 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { success?: boolean } & EmbedMeta) => {
        if (cancelled) return;
        if (!data?.success) {
          setError('Video unavailable');
          return;
        }
        setMeta(data);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load video');
      });
    return () => {
      cancelled = true;
    };
  }, [author, permlink]);

  // Wire HLS once we have the manifest URL, and listen for both real
  // video dimensions (resize container) and first `playing` (hide
  // thumbnail).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !meta) return;
    const src = pickManifest(meta);
    if (!src) return;

    const onMeta = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setAspectRatio(video.videoWidth / video.videoHeight);
      }
    };
    const onPlaying = () => setHasPlayed(true);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('playing', onPlaying);

    const detach = attachHls(video, src);
    return () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('playing', onPlaying);
      detach();
    };
  }, [meta]);

  const isPortrait =
    aspectRatio != null ? aspectRatio < 1 : meta?.short === true;
  const orientationClass = isPortrait ? 'threeSpeakNativePortrait' : 'threeSpeakNativeLandscape';
  const wrapperClass = `threeSpeakNative ${orientationClass}${
    hideThumbnail ? ' threeSpeakNativeNoThumb' : ''
  }`;
  // Inline aspect-ratio is meaningful only when the wrapper actually
  // reserves space via aspect-ratio. With `hideThumbnail` we let the
  // <video> element flow with its intrinsic aspect, so don't apply
  // an inline aspect — the video sets its own height.
  const inlineStyle =
    !hideThumbnail && aspectRatio != null ? { aspectRatio: `${aspectRatio}` } : undefined;

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
