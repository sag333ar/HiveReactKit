/**
 * ThreeSpeakPlayer — Smart 3Speak video player with automatic fallback:
 *   1. Primary: Official 3Speak iframe player (`play.3speak.tv/embed?v=...&mode=iframe&layout=desktop&noscroll=1`)
 *      used whenever the video is indexed on 3Speak's embed API (200 OK).
 *   2. Fallback: If 3Speak embed returns 404 / Video Not Found (e.g. uploads from hivesuite/Ecency),
 *      automatically resolves the on-chain IPFS manifest via Hive RPC metadata (`video_v2`) / `api/watch` / `checker.3speak.tv`
 *      and streams directly with Hls.js & Safari Native HLS.
 */
import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Loader2 } from 'lucide-react';

export interface ThreeSpeakPlayerProps {
  author?: string;
  permlink?: string;
  /** Direct 3Speak URL if available (e.g. https://play.3speak.tv/embed?v=kraken99/s0311cym or ipfs://...) */
  videoUrl?: string;
  hideThumbnail?: boolean;
  thumbnail?: string;
  className?: string;
  style?: React.CSSProperties;
  autoplay?: boolean;
  layout?: 'desktop' | 'mobile' | 'square';
  id?: string;
}

interface EmbedMeta {
  useIframe?: boolean;
  videoUrl?: string;
  videoUrlFallback1?: string;
  videoUrlFallback2?: string;
  videoUrlFallback3?: string;
  thumbnail?: string;
  short?: boolean;
  isPlaceholder?: boolean;
  status?: string;
}

/** Strip image proxy prefixes to build fallback chains */
function stripImageProxy(url: string): string {
  let out = url.trim();
  let prev: string;
  do {
    prev = out;
    out = out.replace(/^https:\/\/images\.(?:hive\.blog|ecency\.com)\/\d+x\d+\//i, '');
  } while (out !== prev);
  return out;
}

/** Poster candidates in priority order: direct → Hive proxy → Ecency proxy */
function posterCandidates(url: string | undefined): string[] {
  const raw = stripImageProxy((url ?? '').trim());
  if (!raw) return [];
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return [raw];
  const chain = [
    raw,
    `https://images.hive.blog/0x0/${raw}`,
    `https://images.ecency.com/0x0/${raw}`,
  ];
  return chain.filter((u, i) => u && chain.indexOf(u) === i);
}

const EMBED_API = 'https://play.3speak.tv/api/embed';
const WATCH_API = 'https://play.3speak.tv/api/watch';
const CHECKER_API = 'https://checker.3speak.tv';

/**
 * Builds the canonical 3Speak embed URL with `mode=iframe` and `layout=desktop`.
 */
export function build3SpeakEmbedUrl(options: {
  author?: string;
  permlink?: string;
  videoUrl?: string;
  autoplay?: boolean;
  layout?: 'desktop' | 'mobile' | 'square';
}): string {
  let vParam = '';
  if (options.videoUrl) {
    const raw = options.videoUrl.trim();
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      /* ignore */
    }

    const match = decoded.match(
      /(?:play\.)?3speak\.(?:tv|co)\/(?:embed|watch|shorts|play|v)(?:\?(?:[^"\s'<>]*[?&])?v=|\/)([^&\s/?#]+)\/([^&\s/?#]+)/i
    );
    if (match) {
      vParam = `${match[1]}/${match[2]}`;
    } else if (decoded.includes('?v=') || decoded.includes('&v=')) {
      const vMatch = decoded.match(/[?&]v=([^&\s/?#]+)(?:\/([^&\s/?#]+))?/i);
      if (vMatch) {
        vParam = vMatch[2] ? `${vMatch[1]}/${vMatch[2]}` : vMatch[1];
      }
    }
  }

  if (!vParam && options.author && options.permlink) {
    const a = options.author.toLowerCase().replace(/^@/, '').trim();
    const p = options.permlink.trim();
    vParam = `${a}/${p}`;
  }

  if (!vParam) return '';
  const cleanV = vParam.replace(/^@/, '').trim();
  const layout = options.layout || 'desktop';
  let url = `https://play.3speak.tv/embed?v=${cleanV}&mode=iframe&layout=${layout}&noscroll=1`;
  if (options.autoplay) {
    url += '&autoplay=1';
  }
  return url;
}

/**
 * Smart metadata resolution:
 * 1. Test official 3Speak embed API (/api/embed). If 200 OK -> use official 3Speak iframe player!
 * 2. If 404 / Video Not Found -> Fallback to decentralized HLS stream from Hive RPC / IPFS / api/watch.
 */
async function resolveVideoSource(
  author?: string,
  permlink?: string,
  videoUrl?: string,
  signal: () => boolean = () => false,
): Promise<EmbedMeta> {
  // 1. If direct IPFS URL
  if (videoUrl?.startsWith('ipfs://')) {
    const p = videoUrl.replace(/^ipfs:\/\//, '');
    return {
      useIframe: false,
      videoUrl: `https://ipfs-3speak.b-cdn.net/ipfs/${p}`,
      videoUrlFallback1: `https://ipfs.3speak.tv/ipfs/${p}`,
      videoUrlFallback2: `https://hotipfs-3speak-1.b-cdn.net/ipfs/${p}`,
      videoUrlFallback3: `https://play.3speak.tv/hls?u=https%3A%2F%2Fipfs-3speak.b-cdn.net%2Fipfs%2F${encodeURIComponent(p)}`,
    };
  }

  // 2. If direct HTTP m3u8 or mp4
  if (videoUrl && (videoUrl.includes('.m3u8') || videoUrl.includes('.mp4'))) {
    return {
      useIframe: false,
      videoUrl,
      videoUrlFallback1: videoUrl.includes('hotipfs-3speak-1.b-cdn.net')
        ? videoUrl.replace('hotipfs-3speak-1.b-cdn.net', 'ipfs-3speak.b-cdn.net')
        : videoUrl.includes('ipfs-3speak.b-cdn.net')
        ? videoUrl.replace('ipfs-3speak.b-cdn.net', 'ipfs.3speak.tv')
        : undefined,
      videoUrlFallback2: videoUrl.includes('hotipfs-3speak-1.b-cdn.net')
        ? videoUrl.replace('hotipfs-3speak-1.b-cdn.net', 'ipfs.3speak.tv')
        : undefined,
    };
  }

  let cleanAuthor = (author || '').toLowerCase().replace(/^@/, '').trim();
  let cleanPermlink = (permlink || '').trim();

  if (videoUrl && (!cleanAuthor || !cleanPermlink)) {
    let decoded = videoUrl.trim();
    try {
      decoded = decodeURIComponent(videoUrl);
    } catch {
      /* ignore */
    }
    const match = decoded.match(
      /(?:play\.)?3speak\.(?:tv|co)\/(?:embed|watch|shorts|play|v)(?:\?(?:[^"\s'<>]*[?&])?v=|\/)([^&\s/?#]+)\/([^&\s/?#]+)/i
    );
    if (match) {
      cleanAuthor = match[1].toLowerCase().replace(/^@/, '').trim();
      cleanPermlink = match[2].trim();
    } else if (decoded.includes('?v=') || decoded.includes('&v=')) {
      const vMatch = decoded.match(/[?&]v=([^&\s/?#]+)(?:\/([^&\s/?#]+))?/i);
      if (vMatch) {
        cleanAuthor = (vMatch[2] ? vMatch[1] : cleanAuthor).toLowerCase().replace(/^@/, '').trim();
        cleanPermlink = (vMatch[2] ? vMatch[2] : vMatch[1]).trim();
      }
    }
  }

  if (!cleanAuthor || !cleanPermlink) {
    throw new Error('No author or permlink provided');
  }

  // Step 1: Check if official 3Speak embed API (/api/embed) succeeds
  try {
    const embedRes = await fetch(`${EMBED_API}?v=${cleanAuthor}/${cleanPermlink}`, {
      headers: { Accept: 'application/json' },
    });
    if (embedRes.ok) {
      const embedData = await embedRes.json();
      if (embedData && embedData.status !== 'failed' && (embedData.videoUrl || embedData.manifest_cid || embedData.success !== false)) {
        return { useIframe: true };
      }
    }
  } catch {
    /* proceed to fallback */
  }

  if (signal()) throw new Error('cancelled');

  // Step 2: Fallback — check /api/watch (legacy uploads)
  try {
    const watchRes = await fetch(`${WATCH_API}?v=${cleanAuthor}/${cleanPermlink}`, {
      headers: { Accept: 'application/json' },
    });
    if (watchRes.ok) {
      const watchData = await watchRes.json();
      if (watchData?.videoUrl || watchData?.manifest_cid) {
        return {
          useIframe: false,
          ...watchData,
        };
      }
    }
  } catch {
    /* proceed to next fallback */
  }

  if (signal()) throw new Error('cancelled');

  // Step 3: Fallback — check checker.3speak.tv
  try {
    const checkerRes = await fetch(`${CHECKER_API}/videodetails/${cleanAuthor}/${cleanPermlink}`, {
      headers: { Accept: 'application/json' },
    });
    if (checkerRes.ok) {
      const d = await checkerRes.json();
      if (d && (d.manifest_cid || d.spkvideo?.play_url || d.play_url || d.video_v2)) {
        let vUrl = '';
        let fb1 = '';
        let fb2 = '';
        let fb3 = '';
        if (d.manifest_cid) {
          vUrl = `https://ipfs-3speak.b-cdn.net/ipfs/${d.manifest_cid}/manifest.m3u8`;
          fb1 = `https://ipfs.3speak.tv/ipfs/${d.manifest_cid}/manifest.m3u8`;
          fb2 = `https://hotipfs-3speak-1.b-cdn.net/ipfs/${d.manifest_cid}/manifest.m3u8`;
          fb3 = `https://play.3speak.tv/hls?u=https%3A%2F%2Fipfs-3speak.b-cdn.net%2Fipfs%2F${d.manifest_cid}%2Fmanifest.m3u8`;
        } else {
          const raw = d.spkvideo?.play_url || d.play_url || d.video_v2 || '';
          if (raw.startsWith('ipfs://')) {
            const p = raw.replace('ipfs://', '');
            vUrl = `https://ipfs-3speak.b-cdn.net/ipfs/${p}`;
            fb1 = `https://ipfs.3speak.tv/ipfs/${p}`;
            fb2 = `https://hotipfs-3speak-1.b-cdn.net/ipfs/${p}`;
            fb3 = `https://play.3speak.tv/hls?u=https%3A%2F%2Fipfs-3speak.b-cdn.net%2Fipfs%2F${encodeURIComponent(p)}`;
          } else if (raw.startsWith('http')) {
            vUrl = raw;
          }
        }
        if (vUrl) {
          return {
            useIframe: false,
            videoUrl: vUrl,
            videoUrlFallback1: fb1,
            videoUrlFallback2: fb2,
            videoUrlFallback3: fb3,
            thumbnail: d.thumbnail_url || d.images?.thumbnail || d.images?.poster || d.thumbnail,
            short: d.short === true,
            status: d.status,
          };
        }
      }
    }
  } catch {
    /* proceed to next fallback */
  }

  if (signal()) throw new Error('cancelled');

  // Step 4: Fallback — Hive blockchain RPC metadata (bridge.get_post)
  const hiveNodes = ['https://api.deathwing.me', 'https://api.hive.blog', 'https://hive-api.arcange.eu'];
  for (const node of hiveNodes) {
    try {
      const r = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'bridge.get_post',
          params: { author: cleanAuthor, permlink: cleanPermlink },
          id: 1,
        }),
      });
      if (r.ok) {
        const res = await r.json();
        const post = res?.result;
        if (post) {
          const meta = typeof post.json_metadata === 'string' ? JSON.parse(post.json_metadata) : post.json_metadata;
          const video = meta?.video;
          const rawV2 =
            video?.info?.video_v2 ||
            video?.info?.sourceMap?.find((s: any) => s.type === 'video' || s.format === 'm3u8')?.url ||
            video?.url;
          const thumb =
            video?.info?.thumbnail ||
            video?.thumbnail ||
            video?.info?.sourceMap?.find((s: any) => s.type === 'thumbnail')?.url ||
            (Array.isArray(meta?.image) ? meta.image[0] : undefined);
          const isShort = video?.info?.short === true;

          if (rawV2 && typeof rawV2 === 'string') {
            if (rawV2.startsWith('ipfs://')) {
              const p = rawV2.replace('ipfs://', '');
              return {
                useIframe: false,
                videoUrl: `https://ipfs-3speak.b-cdn.net/ipfs/${p}`,
                videoUrlFallback1: `https://ipfs.3speak.tv/ipfs/${p}`,
                videoUrlFallback2: `https://hotipfs-3speak-1.b-cdn.net/ipfs/${p}`,
                videoUrlFallback3: `https://play.3speak.tv/hls?u=https%3A%2F%2Fipfs-3speak.b-cdn.net%2Fipfs%2F${encodeURIComponent(p)}`,
                thumbnail: thumb,
                short: isShort,
              };
            } else if (rawV2.startsWith('http')) {
              return {
                useIframe: false,
                videoUrl: rawV2,
                thumbnail: thumb,
                short: isShort,
              };
            }
          }
        }
      }
    } catch {
      /* try next node */
    }
  }

  // Default fallback: try iframe
  return { useIframe: true };
}

/** All candidate manifest URLs in priority order with IPFS CDN derivation */
function extractManifestCandidates(meta: EmbedMeta): string[] {
  const urls: string[] = [];
  const rawList = [
    meta.videoUrl,
    meta.videoUrlFallback1,
    meta.videoUrlFallback2,
    meta.videoUrlFallback3,
  ].filter((u): u is string => typeof u === 'string' && u.length > 0);

  let ipfsCid = '';
  for (const r of rawList) {
    const match = r.match(/(?:ipfs\/|ipfs:\/\/)([a-zA-Z0-9]{46,})/i);
    if (match) {
      ipfsCid = match[1];
      break;
    }
  }

  if (ipfsCid) {
    urls.push(
      `https://ipfs-3speak.b-cdn.net/ipfs/${ipfsCid}/manifest.m3u8`,
      `https://ipfs.3speak.tv/ipfs/${ipfsCid}/manifest.m3u8`,
      `https://hotipfs-3speak-1.b-cdn.net/ipfs/${ipfsCid}/manifest.m3u8`,
      `https://play.3speak.tv/hls?u=https%3A%2F%2Fipfs-3speak.b-cdn.net%2Fipfs%2F${ipfsCid}%2Fmanifest.m3u8`,
    );
  }

  urls.push(...rawList);
  return Array.from(new Set(urls.filter(Boolean)));
}

/**
 * Attach HLS stream to video element with Hls.js or Safari native HLS
 */
function attachHls(
  video: HTMLVideoElement,
  src: string,
  onFatal?: () => void,
): () => void {
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (isSafari && video.canPlayType('application/vnd.apple.mpegurl')) {
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
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      // Without this, `attachMedia`/`loadSource` below start pulling actual
      // media *segments* into memory immediately — for every 3Speak
      // attachment that scrolls into a feed's (unvirtualized) DOM, whether
      // or not the viewer ever presses play. `loadSource` alone only
      // fetches the tiny .m3u8 manifest; the multi-MB segment downloads are
      // deferred until `startLoad()` is called explicitly below, gated on
      // the viewer actually requesting playback.
      autoStartLoad: false,
    });
    let fired = false;
    let loadStarted = false;
    const startLoadOnce = () => {
      if (loadStarted) return;
      loadStarted = true;
      try {
        hls.startLoad();
      } catch {
        /* swallow */
      }
    };
    hls.on(Hls.Events.ERROR, (_evt, data) => {
      if (!data.fatal || fired) return;
      fired = true;
      try {
        hls.destroy();
      } catch {
        /* swallow */
      }
      onFatal?.();
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    // `play` fires as soon as playback is requested (native controls'
    // Play button, or an explicit video.play() call) — even before any
    // data is buffered — so this is the right moment to start pulling
    // segments, not component mount.
    video.addEventListener('play', startLoadOnce);
    return () => {
      video.removeEventListener('play', startLoadOnce);
      try {
        hls.destroy();
      } catch {
        /* swallow */
      }
    };
  }
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

export function ThreeSpeakPlayer({
  author,
  permlink,
  videoUrl,
  hideThumbnail = false,
  thumbnail,
  className = '',
  style,
  autoplay = false,
  layout = 'desktop',
  id,
}: ThreeSpeakPlayerProps) {
  const [meta, setMeta] = useState<EmbedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [posterStep, setPosterStep] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    setStarting(true);
    const p = video.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => setStarting(false));
    }
  };

  useEffect(() => {
    let cancelled = false;
    setMeta(null);
    setError(null);
    setAspectRatio(null);
    setHasPlayed(false);
    setStarting(false);
    setPosterStep(0);

    resolveVideoSource(author, permlink, videoUrl, () => cancelled)
      .then((data) => {
        if (!cancelled) {
          setMeta(data);
        }
      })
      .catch((e) => {
        if (!cancelled && (!(e instanceof Error) || e.message !== 'cancelled')) {
          setMeta({ useIframe: true });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [author, permlink, videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !meta || meta.useIframe) return;
    const candidates = extractManifestCandidates(meta);
    if (candidates.length === 0) return;

    const onMeta = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setAspectRatio(video.videoWidth / video.videoHeight);
      }
    };
    const onPlaying = () => {
      setHasPlayed(true);
      setStarting(false);
    };
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
        return;
      }
      const url = candidates[index];
      index += 1;
      detach = attachHls(video, url, () => {
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

  const isPortrait = aspectRatio != null ? aspectRatio < 1 : meta?.short === true;
  const orientationClass = isPortrait ? 'threeSpeakNativePortrait' : 'threeSpeakNativeLandscape';
  const wrapperClass = `threeSpeakEmbed ${orientationClass}${
    hideThumbnail ? ' threeSpeakNativeNoThumb' : ''
  } ${className}`;

  const fallbackRatio = meta?.short === true ? 9 / 16 : 16 / 9;
  const reservedRatio = aspectRatio ?? (meta ? fallbackRatio : 16 / 9);
  const inlineStyle: React.CSSProperties = {
    maxWidth: isPortrait ? '450px' : '800px',
    margin: '0 auto',
    aspectRatio: `${reservedRatio}`,
    width: '100%',
    position: 'relative',
    ...style,
  };

  const posters = posterCandidates(thumbnail || meta?.thumbnail);

  // If official 3Speak iframe player is preferred and available
  if (meta?.useIframe) {
    const embedSrc = build3SpeakEmbedUrl({ author, permlink, videoUrl, autoplay, layout });
    if (!embedSrc) {
      return (
        <div id={id} className={wrapperClass} style={inlineStyle} data-state="error">
          <div className="flex h-full w-full items-center justify-center rounded-xl bg-black/40 text-sm text-gray-400">
            Video unavailable
          </div>
        </div>
      );
    }
    return (
      <div
        id={id}
        className={`threeSpeakEmbed overflow-hidden rounded-xl bg-black w-full relative mx-auto ${className}`}
        style={{
          aspectRatio: '16 / 9',
          width: '100%',
          maxWidth: '800px',
          margin: '0 auto',
          ...style,
        }}
      >
        <iframe
          src={embedSrc}
          title={`3Speak video by ${author || 'creator'}`}
          className="w-full h-full border-0 absolute inset-0 rounded-xl"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div id={id} className={wrapperClass} style={inlineStyle} data-state="error">
        <div className="flex h-full w-full items-center justify-center rounded-xl bg-black/40 text-sm text-gray-400">
          {error}
        </div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div
        id={id}
        className={`threeSpeakEmbed relative overflow-hidden rounded-xl bg-black flex items-center justify-center w-full mx-auto ${className}`}
        style={inlineStyle}
        data-state="loading"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm sm:h-16 sm:w-16">
          <Play className="h-6 w-6 translate-x-0.5 text-white/60 sm:h-7 sm:w-7" fill="currentColor" />
        </span>
      </div>
    );
  }

  // Fallback direct HLS streaming player
  return (
    <div
      id={id}
      className={`threeSpeakEmbed relative overflow-hidden rounded-xl bg-black w-full mx-auto ${className}`}
      style={inlineStyle}
      data-state="ready"
    >
      {!hideThumbnail && posters.length > 0 && posterStep < posters.length && !hasPlayed && (
        <div className="vjs-poster absolute inset-0 z-10 overflow-hidden rounded-xl bg-black" aria-disabled="false">
          <picture className="vjs-poster w-full h-full block" tabIndex={-1}>
            <img
              key={posterStep}
              loading="lazy"
              alt=""
              src={posters[posterStep]}
              className="w-full h-full object-contain"
              onError={() => setPosterStep((s) => s + 1)}
            />
          </picture>
          <button
            type="button"
            className="vjs-big-play-button absolute inset-0 z-20 flex items-center justify-center cursor-pointer bg-black/25 transition hover:bg-black/35"
            title="Play Video"
            aria-label="Play Video"
            aria-disabled="false"
            onClick={startPlayback}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/65 backdrop-blur-md transition hover:scale-110 hover:bg-black/80 shadow-lg">
              {starting ? (
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              ) : (
                <Play className="h-8 w-8 translate-x-0.5 text-white" fill="currentColor" />
              )}
            </span>
            <span className="vjs-control-text sr-only" aria-live="polite">Play Video</span>
          </button>
        </div>
      )}
      <video
        ref={videoRef}
        id={id ? `${id}_html5_api` : 'snapie-player_html5_api'}
        className="vjs-tech w-full h-full rounded-xl bg-black object-contain"
        // "metadata" (not "auto"): the HLS.js path above already gates real
        // segment downloads on the `play` event; `auto` would tell Safari's
        // native HLS player (and any no-HLS.js fallback) to start buffering
        // the moment this element renders, undermining that gate for
        // Safari/iOS viewers scrolling an unvirtualized feed.
        preload="metadata"
        playsInline
        {...({ 'webkit-playsinline': '' } as any)}
        tabIndex={-1}
        crossOrigin="anonymous"
        poster={posters[posterStep] || thumbnail || meta?.thumbnail}
        controls
      >
        <p className="vjs-no-js">
          To view this video please enable JavaScript, and consider upgrading to a web browser that{' '}
          <a
            href="https://videojs.com/html5-video-support/"
            target="_blank"
            rel="noreferrer"
            className="keychainify-checked vjs-hidden"
            hidden
          >
            supports HTML5 video
          </a>
        </p>
      </video>
    </div>
  );
}

export default ThreeSpeakPlayer;
