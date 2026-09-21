/**
 * ThreeSpeakPlayer — native HTML5 video player for 3Speak embeds with
 * HLS.js streaming, multi-CDN fallback, Hive RPC metadata resolution,
 * portrait/short letterboxing, and iframe fallback.
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
  videoUrl?: string;
  videoUrlFallback1?: string;
  videoUrlFallback2?: string;
  videoUrlFallback3?: string;
  thumbnail?: string;
  short?: boolean;
  isPlaceholder?: boolean;
  status?: string;
  useIframeFallback?: boolean;
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
    const match = raw.match(
      /(?:play\.)?3speak\.(?:tv|co)\/(?:embed|watch|shorts|play|v)(?:\?(?:[^"\s'<>]*[?&])?v=|\/)([^&\s/?#]+)\/([^&\s/?#]+)/i
    );
    if (match) {
      vParam = `${match[1]}/${match[2]}`;
    } else if (raw.includes('?v=')) {
      const vMatch = raw.match(/[?&]v=([^&\s/?#]+)(?:\/([^&\s/?#]+))?/i);
      if (vMatch) {
        vParam = vMatch[2] ? `${vMatch[1]}/${vMatch[2]}` : vMatch[1];
      }
    }
  }

  if (!vParam && options.author && options.permlink) {
    const a = options.author.toLowerCase().replace(/^@/, '');
    vParam = `${a}/${options.permlink}`;
  }

  if (!vParam) return '';
  const cleanV = vParam.replace(/^@/, '');
  const layout = options.layout || 'desktop';
  let url = `https://play.3speak.tv/embed?v=${cleanV}&mode=iframe&layout=${layout}&noscroll=1`;
  if (options.autoplay) {
    url += '&autoplay=1';
  }
  return url;
}

/** Resolve a video's metadata, trying `/api/watch` first (covers
 *  legacy uploads), then `/api/embed`, then `/videodetails`, then Hive RPC metadata. */
async function fetchThreeSpeakMeta(
  author?: string,
  permlink?: string,
  videoUrl?: string,
  signal: () => boolean = () => false,
): Promise<EmbedMeta> {
  // 1. If direct IPFS URL
  if (videoUrl?.startsWith('ipfs://')) {
    const p = videoUrl.replace(/^ipfs:\/\//, '');
    return {
      videoUrl: `https://ipfs-3speak.b-cdn.net/ipfs/${p}`,
      videoUrlFallback1: `https://ipfs.3speak.tv/ipfs/${p}`,
      videoUrlFallback2: `https://hotipfs-3speak-1.b-cdn.net/ipfs/${p}`,
      videoUrlFallback3: `https://play.3speak.tv/hls?u=https%3A%2F%2Fipfs-3speak.b-cdn.net%2Fipfs%2F${encodeURIComponent(p)}`,
    };
  }

  // 2. If direct HTTP m3u8 or mp4
  if (videoUrl && (videoUrl.includes('.m3u8') || videoUrl.includes('.mp4'))) {
    return {
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

  let cleanAuthor = (author || '').toLowerCase().replace(/^@/, '');
  let cleanPermlink = permlink || '';

  if (videoUrl && (!cleanAuthor || !cleanPermlink)) {
    const match = videoUrl.match(
      /(?:play\.)?3speak\.(?:tv|co)\/(?:embed|watch|shorts|play|v)(?:\?(?:[^"\s'<>]*[?&])?v=|\/)([^&\s/?#]+)\/([^&\s/?#]+)/i
    );
    if (match) {
      cleanAuthor = match[1].toLowerCase().replace(/^@/, '');
      cleanPermlink = match[2];
    } else if (videoUrl.includes('?v=')) {
      const vMatch = videoUrl.match(/[?&]v=([^&\s/?#]+)(?:\/([^&\s/?#]+))?/i);
      if (vMatch) {
        cleanAuthor = (vMatch[2] ? vMatch[1] : cleanAuthor).toLowerCase().replace(/^@/, '');
        cleanPermlink = vMatch[2] ? vMatch[2] : vMatch[1];
      }
    }
  }

  if (!cleanAuthor || !cleanPermlink) {
    throw new Error('No author or permlink provided');
  }

  const endpoints = [
    `${WATCH_API}?v=${cleanAuthor}/${cleanPermlink}`,
    `${EMBED_API}?v=${cleanAuthor}/${cleanPermlink}`,
  ];
  let lastErr: Error | null = null;
  for (const url of endpoints) {
    if (signal()) throw new Error('cancelled');
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (r.ok) {
        const data = (await r.json()) as { success?: boolean } & EmbedMeta;
        if (data?.success && manifestCandidates(data).length > 0) {
          return data;
        }
      }
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error('fetch failed');
    }
  }

  // 3. Fallback to checker.3speak.tv/videodetails
  if (!signal()) {
    try {
      const r = await fetch(`${CHECKER_API}/videodetails/${cleanAuthor}/${cleanPermlink}`, {
        headers: { Accept: 'application/json' },
      });
      if (r.ok) {
        const d = (await r.json()) as any;
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
      /* ignore */
    }
  }

  // 4. Fallback to Hive RPC metadata (bridge.get_post) to extract video_v2 / sourceMap
  if (!signal()) {
    try {
      const hiveNodes = ['https://api.hive.blog', 'https://api.deathwing.me', 'https://hive-api.arcange.eu'];
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
            const res = (await r.json()) as any;
            const post = res?.result;
            if (post) {
              const meta = typeof post.json_metadata === 'string' ? JSON.parse(post.json_metadata) : post.json_metadata;
              const video = meta?.video;
              const rawV2 =
                video?.info?.video_v2 ||
                video?.info?.sourceMap?.find((s: any) => s.type === 'video' || s.format === 'm3u8')?.url ||
                video?.url;
              if (rawV2 && typeof rawV2 === 'string') {
                if (rawV2.startsWith('ipfs://')) {
                  const p = rawV2.replace('ipfs://', '');
                  return {
                    videoUrl: `https://ipfs-3speak.b-cdn.net/ipfs/${p}`,
                    videoUrlFallback1: `https://ipfs.3speak.tv/ipfs/${p}`,
                    videoUrlFallback2: `https://hotipfs-3speak-1.b-cdn.net/ipfs/${p}`,
                    videoUrlFallback3: `https://play.3speak.tv/hls?u=https%3A%2F%2Fipfs-3speak.b-cdn.net%2Fipfs%2F${encodeURIComponent(p)}`,
                    thumbnail: video?.info?.thumbnail || (Array.isArray(meta?.image) ? meta.image[0] : undefined),
                    short: video?.info?.short === true,
                  };
                } else if (rawV2.startsWith('http')) {
                  return {
                    videoUrl: rawV2,
                    thumbnail: video?.info?.thumbnail || (Array.isArray(meta?.image) ? meta.image[0] : undefined),
                  };
                }
              }
            }
          }
        } catch {
          /* try next node */
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 5. If everything else failed, use iframe fallback
  return {
    useIframeFallback: true,
  };
}

/** All candidate manifest URLs, in priority order. */
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
 * to native HLS on Safari.
 */
function attachHls(
  video: HTMLVideoElement,
  src: string,
  onFatal?: () => void,
): () => void {
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
  const [useIframeFallback, setUseIframeFallback] = useState(false);
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
    setUseIframeFallback(false);

    fetchThreeSpeakMeta(author, permlink, videoUrl, () => cancelled)
      .then((data) => {
        if (!cancelled) {
          if (data.useIframeFallback) {
            setUseIframeFallback(true);
          }
          setMeta(data);
        }
      })
      .catch((e) => {
        if (!cancelled && (!(e instanceof Error) || e.message !== 'cancelled')) {
          setUseIframeFallback(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [author, permlink, videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !meta || meta.useIframeFallback || useIframeFallback) return;
    const candidates = manifestCandidates(meta);
    if (candidates.length === 0) {
      setUseIframeFallback(true);
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
        // Fallback to iframe if all CDN streams fail
        setUseIframeFallback(true);
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
  }, [meta, useIframeFallback]);

  const isPortrait = aspectRatio != null ? aspectRatio < 1 : meta?.short === true;
  const orientationClass = isPortrait ? 'threeSpeakNativePortrait' : 'threeSpeakNativeLandscape';
  const wrapperClass = `threeSpeakNative ${orientationClass}${
    hideThumbnail ? ' threeSpeakNativeNoThumb' : ''
  } ${className}`;

  const fallbackRatio = meta?.short === true ? 9 / 16 : 16 / 9;
  const reservedRatio = aspectRatio ?? (meta ? fallbackRatio : 16 / 9);
  const inlineStyle: React.CSSProperties = {
    maxWidth: isPortrait ? '450px' : '800px',
    margin: '0 auto',
    aspectRatio: `${reservedRatio}`,
    width: '100%',
    ...style,
  };

  const posters = posterCandidates(thumbnail || meta?.thumbnail);

  // If iframe fallback is required
  if (useIframeFallback) {
    const embedSrc = build3SpeakEmbedUrl({ author, permlink, videoUrl, autoplay, layout });
    if (!embedSrc) {
      return (
        <div id={id} className={wrapperClass} style={inlineStyle} data-state="error">
          <div className="threeSpeakNativeMessage">Video unavailable</div>
        </div>
      );
    }
    return (
      <div
        id={id}
        className={`threeSpeakNative threeSpeakNativeLandscape overflow-hidden rounded-xl bg-black w-full relative mx-auto ${className}`}
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
        <div className="threeSpeakNativeMessage">{error}</div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div id={id} className={wrapperClass} style={inlineStyle} data-state="loading">
        <div className="threeSpeakNativeSkeleton" aria-hidden="true">
          <span className="threeSpeakNativeSkeletonDisc">
            <Play className="h-6 w-6 translate-x-0.5 text-white/60 sm:h-7 sm:w-7" fill="currentColor" />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div id={id} className={wrapperClass} style={inlineStyle} data-state="ready">
      {!hideThumbnail && posters.length > 0 && posterStep < posters.length && !hasPlayed && (
        <>
          <img
            key={posterStep}
            src={posters[posterStep]}
            alt=""
            className="threeSpeakNativeThumb"
            aria-hidden="true"
            onError={() => setPosterStep((s) => s + 1)}
          />
          <button
            type="button"
            aria-label="Play video"
            onClick={startPlayback}
            className="absolute inset-0 z-10 flex items-center justify-center cursor-pointer"
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
        className="w-full h-full rounded-xl bg-black object-contain"
      />
    </div>
  );
}

export default ThreeSpeakPlayer;

