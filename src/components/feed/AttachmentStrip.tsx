import { useCallback, useEffect, useRef, useState, type FC, type ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Music,
  ImageOff,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
  Repeat,
} from 'lucide-react';
import type { Post } from '@/types/post';
import { ThreeSpeakPlayer as ThreeSpeakNativePlayer } from '../ThreeSpeakPlayer';
import { IPFS_URL_REGEX, useIpfsKind } from '../IpfsMedia';

export interface AttachmentStripProps {
  attachments: Attachment[];
}

export interface ParsedBody {
  segments: BodySegment[];
  attachments: Attachment[];
}

export type BodySegment =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; username: string }
  | { kind: 'hashtag'; tag: string }
  | { kind: 'link'; url: string };

export type Attachment =
  | { kind: 'image'; url: string }
  | { kind: 'ipfs'; url: string }
  | { kind: 'youtube'; id: string }
  | { kind: 'threespeak'; url: string }
  | { kind: 'twitter'; id: string }
  | { kind: 'audio'; url: string }
  | { kind: '3speak-audio'; url: string }
  | { kind: 'spotify'; url: string };

export const SPOTIFY_REGEX = /https?:\/\/(?:open|play)\.spotify\.com\/(?:track|playlist|album|artist|episode|show)\/[a-zA-Z0-9]+(?:\?[^\s"'<>)]*)?/gi;
export const TWITTER_REGEX = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/gi;
export const YOUTUBE_REGEX =
  /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([^&\s]+)|https?:\/\/youtu\.be\/([^?\s]+)|https?:\/\/(?:www\.)?youtube\.com\/shorts\/([^?\s]+)/gi;
export const THREE_SPEAK_REGEX = /https?:\/\/(?:play\.)?3speak\.tv\/[^\s"'<>)]+/gi;
// Direct audio file URLs
export const AUDIO_FILE_REGEX =
  /https?:\/\/[^\s"'<>)]+?\.(?:mp3|wav|ogg|m4a|aac|flac|webm|opus)(?:\?[^\s"'<>)]*)?/gi;
// 3Speak's hosted audio player — `audio.3speak.tv/play?a=...&v=...`.
export const THREE_SPEAK_AUDIO_REGEX = /https?:\/\/audio\.3speak\.tv\/play\?[^\s"'<>)]+/gi;
export const IMG_MD_REGEX = /!\[[^\]]*\]\(([^\s)]+)\)/g;
export const IMG_HTML_REGEX = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
export const IMG_URL_REGEX =
  /https?:\/\/[^\s"'<>)]+?\.(?:jpe?g|png|gif|webp|avif|bmp|svg)(?:\?[^\s"'<>)]*)?/gi;
export const URL_REGEX = /https?:\/\/[^\s)<>\]]+/g;
export const MENTION_REGEX = /@([a-z][a-z0-9.-]{1,15}[a-z0-9])/g;
export const HASHTAG_REGEX = /(?:^|\s)#([a-zA-Z][\w-]{0,31})/g;

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function sanitizeImageUrl(url: string): string {
  return url.trim()
    .replace(/[)\],.;:>\s"'<]+$/, '')
    .replace(/^(https?):\/(?!\/)/, '$1://');
}

function uniqImageUrls(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    if (typeof raw !== 'string') continue;
    const cleaned = sanitizeImageUrl(raw);
    if (!cleaned || !/^https?:\/\//.test(cleaned)) continue;
    let key = cleaned;
    try { key = decodeURIComponent(cleaned); } catch { /* keep as-is */ }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

export function parseJsonMetadata(jm: unknown): Record<string, unknown> {
  if (!jm) return {};
  if (typeof jm === 'string') {
    try {
      return JSON.parse(jm) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof jm === 'object') return jm as Record<string, unknown>;
  return {};
}

const HIVESUITE_FAMILY_TAGS = new Set(['hsnaps', 'hreplier', 'hivesuite']);

export function hasHivesuiteFamilyTag(post: Post): boolean {
  const meta = parseJsonMetadata(post.json_metadata as unknown);
  const raw = Array.isArray(meta.tags) ? (meta.tags as unknown[]) : [];
  return raw.some(
    (t) => typeof t === 'string' && HIVESUITE_FAMILY_TAGS.has(t.toLowerCase()),
  );
}

export function extractTagsFromMeta(post: Post): string[] {
  const meta = parseJsonMetadata(post.json_metadata as unknown);
  const raw = Array.isArray(meta.tags) ? (meta.tags as unknown[]) : [];
  return raw.filter((t): t is string => typeof t === 'string' && t.length > 0);
}

export function stripViaAppsCredit(body: string): string {
  return body
    .replace(
      /\s*(?:<br\s*\/?>)?\s*<sub>\s*\[via Apps from\][^<]*<\/sub>\s*$/,
      '',
    )
    .replace(
      /\s*(?:<br\s*\/?>)?\s*\[via Apps from\]\([^)]*\)\s*$/,
      '',
    )
    .replace(
      /\s*(?:<br\s*\/?>)?\s*via Apps from\s+https?:\/\/\S+\s*$/,
      '',
    );
}

export function parseBody(post: Post): ParsedBody {
  const raw = stripViaAppsCredit(post.body ?? '');

  const imageUrls: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = IMG_MD_REGEX.exec(raw))) imageUrls.push(m[1]);
  while ((m = IMG_HTML_REGEX.exec(raw))) imageUrls.push(m[1]);
  while ((m = IMG_URL_REGEX.exec(raw))) imageUrls.push(m[0]);

  const ipfsUrls: string[] = [];
  const ipfsReParse = new RegExp(IPFS_URL_REGEX.source, IPFS_URL_REGEX.flags);
  while ((m = ipfsReParse.exec(raw))) ipfsUrls.push(m[0]);

  const youtubeIds: string[] = [];
  while ((m = YOUTUBE_REGEX.exec(raw))) youtubeIds.push((m[1] || m[2] || m[3])!);

  const threeSpeakUrls: string[] = [];
  while ((m = THREE_SPEAK_REGEX.exec(raw))) threeSpeakUrls.push(m[0]);

  const threeSpeakAudioUrls: string[] = [];
  while ((m = THREE_SPEAK_AUDIO_REGEX.exec(raw))) threeSpeakAudioUrls.push(m[0]);
  const audioUrls: string[] = [];
  while ((m = AUDIO_FILE_REGEX.exec(raw))) {
    if (!threeSpeakAudioUrls.includes(m[0])) audioUrls.push(m[0]);
  }

  const twitterIds: string[] = [];
  while ((m = TWITTER_REGEX.exec(raw))) twitterIds.push(m[1]);

  const spotifyUrls: string[] = [];
  while ((m = SPOTIFY_REGEX.exec(raw))) spotifyUrls.push(m[0]);

  const attachments: Attachment[] = [
    ...uniqImageUrls(imageUrls).map((url) => ({ kind: 'image' as const, url })),
    ...uniq(ipfsUrls).map((url) => ({ kind: 'ipfs' as const, url })),
    ...uniq(youtubeIds).map((id) => ({ kind: 'youtube' as const, id })),
    ...uniq(threeSpeakUrls).map((url) => ({ kind: 'threespeak' as const, url })),
    ...uniq(twitterIds).map((id) => ({ kind: 'twitter' as const, id })),
    ...uniq(threeSpeakAudioUrls).map((url) => ({ kind: '3speak-audio' as const, url })),
    ...uniq(audioUrls).map((url) => ({ kind: 'audio' as const, url })),
    ...uniq(spotifyUrls).map((url) => ({ kind: 'spotify' as const, url })),
  ];

  let text = raw;
  text = text.replace(IMG_MD_REGEX, '');
  text = text.replace(IMG_HTML_REGEX, '');
  text = text.replace(IPFS_URL_REGEX, '');
  text = text.replace(YOUTUBE_REGEX, '');
  text = text.replace(THREE_SPEAK_REGEX, '');
  text = text.replace(THREE_SPEAK_AUDIO_REGEX, '');
  text = text.replace(AUDIO_FILE_REGEX, '');
  text = text.replace(TWITTER_REGEX, '');
  text = text.replace(SPOTIFY_REGEX, '');
  text = text.replace(/<[^>]+>/g, ''); // strip remaining HTML
  text = text.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, '$1 $2'); // [text](url) → "text url"
  text = text.replace(/[*_~`>#-]+/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();

  const segments: BodySegment[] = [];
  let cursor = 0;
  type Token = { start: number; end: number; node: BodySegment };
  const tokens: Token[] = [];
  let mm: RegExpExecArray | null;

  const urlRe = new RegExp(URL_REGEX.source, 'g');
  while ((mm = urlRe.exec(text)) !== null) {
    tokens.push({ start: mm.index, end: mm.index + mm[0].length, node: { kind: 'link', url: mm[0] } });
  }
  const mentionRe = new RegExp(MENTION_REGEX.source, 'g');
  while ((mm = mentionRe.exec(text)) !== null) {
    if (tokens.some((t) => mm!.index >= t.start && mm!.index < t.end)) continue;
    tokens.push({ start: mm.index, end: mm.index + mm[0].length, node: { kind: 'mention', username: mm[1] } });
  }
  const hashRe = new RegExp(HASHTAG_REGEX.source, 'g');
  while ((mm = hashRe.exec(text)) !== null) {
    const start = mm.index + (mm[0].startsWith(' ') ? 1 : 0);
    if (tokens.some((t) => start >= t.start && start < t.end)) continue;
    tokens.push({ start, end: start + (mm[0].length - (mm[0].startsWith(' ') ? 1 : 0)), node: { kind: 'hashtag', tag: mm[1] } });
  }
  tokens.sort((a, b) => a.start - b.start);

  for (const tok of tokens) {
    if (cursor < tok.start) segments.push({ kind: 'text', text: text.slice(cursor, tok.start) });
    segments.push(tok.node);
    cursor = tok.end;
  }
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });

  if (segments.length === 0 && text) segments.push({ kind: 'text', text });

  return { segments, attachments };
}

export function parse3SpeakAuthorPermlink(url: string): { author: string; permlink: string } | null {
  try {
    const u = new URL(url);
    const v = u.searchParams.get('v');
    if (!v) return null;
    const [author, permlink] = v.split('/');
    if (!author || !permlink) return null;
    return { author, permlink };
  } catch {
    return null;
  }
}

export const ThreeSpeakPlayer: FC<{ author: string; permlink: string }> = ({ author, permlink }) => {
  return (
    <div className="three-speak-embed my-3 hive-post-body" style={{ margin: '0.75rem auto' }}>
      <ThreeSpeakNativePlayer author={author} permlink={permlink} />
    </div>
  );
};

export const attachmentLabel = (a: Attachment): string => {
  if (a.kind === 'image') return a.url.toLowerCase().includes('.gif') ? 'GIF' : 'Image';
  if (a.kind === 'youtube') return 'YouTube';
  if (a.kind === 'threespeak') return '3Speak';
  if (a.kind === 'twitter') return 'Tweet';
  if (a.kind === '3speak-audio') return '3Speak audio';
  if (a.kind === 'spotify') return 'Spotify';
  return 'Audio';
};

export const TwitterEmbed: FC<{ id: string }> = ({ id }) => {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (!d || typeof d !== 'object') return;
        let h: number | undefined;
        if (d.method === 'resize' && Array.isArray(d.params)) {
          for (const p of d.params) {
            if (typeof p === 'number' && p > 0) h = p;
            if (p && typeof p === 'object' && typeof p.height === 'number') h = p.height;
          }
        }
        if (d['twttr.private.resize']?.height) h = d['twttr.private.resize'].height;
        if (!h && typeof d.height === 'number') h = d.height;
        if (!h && d.msg_type === 'resize' && d.msg_data?.height) h = d.msg_data.height;
        if (h && h > 50) setHeight(Math.ceil(h));
      } catch { /* ignore */ }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div
      className="twitter-embed-wrapper w-full overflow-hidden rounded-lg bg-black/60"
      style={height ? { maxHeight: '80vh', overflowY: 'auto' } : undefined}
    >
      <iframe
        src={`https://platform.twitter.com/embed/Tweet.html?id=${id}&theme=dark&dnt=true&origin=${encodeURIComponent(origin)}`}
        title={`Tweet ${id}`}
        className="twitter-embed-iframe w-full border-0 bg-black"
        scrolling="yes"
        style={{ height: height ?? '60vh' }}
      />
    </div>
  );
};

const ZOOM_MIN = 1;
const ZOOM_STEP = 0.25;
const ZOOM_WHEEL_STEP = 0.15;

export const ZoomableImage: FC<{ src: string }> = ({ src }) => {
  const [zoom, setZoom] = useState(1);
  const [zoomMax, setZoomMax] = useState(3);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const panDragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const pinchRef = useRef<{ startDistance: number; startZoom: number } | null>(null);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => { resetZoom(); }, [src, resetZoom]);

  const recomputeZoomMax = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const rw = img.clientWidth || 1;
    const rh = img.clientHeight || 1;
    const ratio = Math.max(img.naturalWidth / rw, img.naturalHeight / rh);
    setZoomMax(Math.max(1, Math.min(6, ratio || 1)));
  }, []);

  const zoomedIn = zoom > 1;
  const zoomPercent = Math.round(zoom * 100);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const cx = e.clientX - (rect.left + rect.width / 2);
    const cy = e.clientY - (rect.top + rect.height / 2);
    setZoom((prev) => {
      const dir = e.deltaY < 0 ? 1 : -1;
      const next = Math.max(ZOOM_MIN, Math.min(zoomMax, prev + dir * ZOOM_WHEEL_STEP));
      if (next === prev) return prev;
      setPan((p) => {
        if (next === 1) return { x: 0, y: 0 };
        const k = next / prev;
        return { x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k };
      });
      return next;
    });
  }, [zoomMax]);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoom === 1) setZoom(zoomMax);
    else resetZoom();
  }, [zoom, zoomMax, resetZoom]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinchRef.current = {
        startDistance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        startZoom: zoom,
      };
      return;
    }
    if (zoomedIn) {
      const t = e.touches[0];
      if (t) panDragRef.current = {
        startClientX: t.clientX,
        startClientY: t.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
    }
  }, [zoom, zoomedIn, pan.x, pan.y]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = d / pinchRef.current.startDistance;
      setZoom(Math.max(ZOOM_MIN, Math.min(zoomMax, pinchRef.current.startZoom * ratio)));
      return;
    }
    if (zoomedIn && panDragRef.current && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - panDragRef.current.startClientX;
      const dy = t.clientY - panDragRef.current.startClientY;
      setPan({ x: panDragRef.current.startPanX + dx, y: panDragRef.current.startPanY + dy });
    }
  }, [zoomMax, zoomedIn]);

  const onTouchEnd = useCallback(() => {
    pinchRef.current = null;
    panDragRef.current = null;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!zoomedIn) return;
    panDragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
  }, [zoomedIn, pan.x, pan.y]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!panDragRef.current || e.buttons !== 1) return;
    const dx = e.clientX - panDragRef.current.startClientX;
    const dy = e.clientY - panDragRef.current.startClientY;
    setPan({ x: panDragRef.current.startPanX + dx, y: panDragRef.current.startPanY + dy });
  }, []);

  const onPointerUp = useCallback(() => { panDragRef.current = null; }, []);

  const stopE = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="relative w-full" onClick={stopE}>
      <div className="mb-2 flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
            setPan((p) => ({ x: p.x * 0.85, y: p.y * 0.85 }));
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
          aria-label="Zoom out"
          disabled={zoom <= ZOOM_MIN}
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="min-w-[3.25rem] text-center text-xs font-medium tabular-nums text-white">
          {zoomPercent}%
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setZoom((z) => Math.min(zoomMax, z + ZOOM_STEP));
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
          aria-label="Zoom in"
          disabled={zoom >= zoomMax}
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); resetZoom(); }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
          aria-label="Reset zoom"
          disabled={zoom === ZOOM_MIN}
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={wrapRef}
        className="relative flex items-center justify-center overflow-hidden rounded-lg"
        style={{ minHeight: 240, touchAction: zoomedIn ? 'none' : 'pan-y' }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          className="max-h-[80vh] max-w-full select-none object-contain"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: panDragRef.current || pinchRef.current ? 'none' : 'transform 120ms ease-out',
            cursor: zoomedIn ? (panDragRef.current ? 'grabbing' : 'grab') : 'zoom-in',
          }}
          onDoubleClick={onDoubleClick}
          onLoad={() => requestAnimationFrame(recomputeZoomMax)}
        />
      </div>
    </div>
  );
};

export const IpfsStripTile: FC<{ url: string; onOpen: (e: React.MouseEvent) => void }> = ({
  url,
  onOpen,
}) => {
  const kind = useIpfsKind(url);
  if (kind === null) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--hrk-bg-surface-sunken)]">
        <div className="h-6 w-6 animate-pulse rounded-full bg-[var(--hrk-bg-hover)]" />
      </div>
    );
  }
  if (kind === 'video') {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black"
        aria-label="Play video"
      >
        <video
          src={url}
          preload="metadata"
          muted
          playsInline
          className="h-full w-full object-cover opacity-80"
        />
        <span className="pointer-events-none absolute flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-white">
          <Play className="h-6 w-6" />
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-[var(--hrk-bg-surface-sunken)]"
      aria-label="Open image preview"
    >
      <img src={url} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
    </button>
  );
};

export const IpfsPopupBody: FC<{ url: string }> = ({ url }) => {
  const kind = useIpfsKind(url);
  if (kind === 'video') {
    return (
      <video
        src={url}
        controls
        autoPlay
        playsInline
        className="max-h-[80vh] max-w-full"
      />
    );
  }
  if (kind === 'image' || kind === null) {
    return <ZoomableImage src={url} />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-[var(--hrk-brand)] underline"
    >
      Open in new tab
    </a>
  );
};

export const MediaPopup: FC<{
  attachment: Attachment;
  onClose: () => void;
  index?: number;
  total?: number;
  onPrev?: () => void;
  onNext?: () => void;
}> = ({
  attachment,
  onClose,
  index,
  total,
  onPrev,
  onNext,
}) => {
  const hasNav = typeof total === 'number' && total > 1 && !!onPrev && !!onNext;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', onKey);
    const prevVal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevVal;
    };
  }, [onClose, onPrev, onNext]);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const closeAndStop = (e: React.SyntheticEvent) => { e.stopPropagation(); onClose(); };
  const isCompact = attachment.kind === 'audio' || attachment.kind === '3speak-audio' || attachment.kind === 'spotify';

  return (
    <div
      className="fixed inset-0 z-[2000] flex flex-col bg-black/85 sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={closeAndStop}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 bg-black/40 px-4 py-3 pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:hidden"
        onClick={stop}
      >
        <span className="truncate text-sm font-medium text-white/80">
          {attachmentLabel(attachment)}
        </span>
        {hasNav && (
          <span className="shrink-0 text-xs text-white/60 tabular-nums">
            {(index ?? 0) + 1} / {total}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={closeAndStop}
        className="fixed right-3 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-[2010] flex h-11 w-11 items-center justify-center rounded-full bg-black/80 text-white shadow-lg ring-1 ring-white/30 transition hover:bg-black sm:hidden"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--hrk-bg-surface-sunken)] shadow-2xl sm:flex-initial sm:overflow-visible sm:rounded-2xl sm:border sm:border-[var(--hrk-border-default)] ${
          isCompact ? 'sm:max-w-md' : 'sm:max-w-3xl'
        } sm:w-full`}
        onClick={stop}
      >
        <div className="hidden shrink-0 items-center justify-between border-b border-[var(--hrk-border-default)]/60 px-4 py-2.5 sm:flex">
          <span className="flex items-center gap-2 text-sm font-medium text-white/70">
            <span>{attachmentLabel(attachment)}</span>
            {hasNav && (
              <span className="text-xs text-white/50 tabular-nums">
                {(index ?? 0) + 1} / {total}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={closeAndStop}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center p-3 sm:p-4">
          {hasNav && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
                className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-lg transition hover:bg-black/80"
                aria-label="Previous media"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-lg transition hover:bg-black/80"
                aria-label="Next media"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
          {attachment.kind === 'image' && (
            <ZoomableImage src={attachment.url} />
          )}

          {attachment.kind === 'ipfs' && (
            <IpfsPopupBody url={attachment.url} />
          )}

          {attachment.kind === 'youtube' && (
            <div className="w-full">
              <div className="w-full overflow-hidden rounded-lg" style={{ aspectRatio: '16/9' }}>
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${attachment.id}?autoplay=1&rel=0&playsinline=1`}
                  title="YouTube"
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <a
                href={`https://www.youtube.com/watch?v=${attachment.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/20"
              >
                <Play className="h-4 w-4 fill-current" />
                Watch on YouTube
              </a>
            </div>
          )}

          {attachment.kind === 'twitter' && (
            <div className="w-full">
              <TwitterEmbed id={attachment.id} />
            </div>
          )}

          {attachment.kind === 'threespeak' && (() => {
            const ap = parse3SpeakAuthorPermlink(attachment.url);
            return ap ? (
              <div className="w-full">
                <ThreeSpeakPlayer author={ap.author} permlink={ap.permlink} />
              </div>
            ) : (
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--hrk-brand)] underline"
              >
                Open on 3Speak
              </a>
            );
          })()}

          {attachment.kind === 'audio' && (
            <div className="w-full overflow-hidden rounded-xl border border-[var(--hrk-border-default)] bg-[#1a1d21] p-3">
              <div className="mb-2 flex items-center gap-2 text-sm text-[var(--hrk-text-tertiary)]">
                <Music className="h-4 w-4 shrink-0 text-[var(--hrk-brand)]" />
                <span className="truncate">
                  {decodeURIComponent(attachment.url.split('/').pop()?.split('?')[0] ?? 'Audio')}
                </span>
              </div>
              <audio src={attachment.url} controls preload="metadata" autoPlay className="h-10 w-full" />
            </div>
          )}

          {attachment.kind === '3speak-audio' && (
            <div className="w-full overflow-hidden rounded-xl border border-[var(--hrk-border-default)] bg-[#1a1d21]">
              <iframe
                src={attachment.url}
                title="3Speak audio"
                className="h-24 w-full border-0"
                allow="autoplay"
              />
            </div>
          )}

          {attachment.kind === 'spotify' && (() => {
            const embedUrl = attachment.url.replace('open.spotify.com/', 'open.spotify.com/embed/');
            return (
              <div className="w-full overflow-hidden rounded-xl border border-[var(--hrk-border-default)] bg-[#1a1d21]">
                <iframe
                  src={embedUrl}
                  title="Spotify Player"
                  className="h-80 w-full border-0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export const AttachmentStrip: FC<AttachmentStripProps> = ({ attachments }) => {
  const [idx, setIdx] = useState(0);
  const [activeAttachment, setActiveAttachment] = useState<Attachment | null>(null);
  const [popupIdx, setPopupIdx] = useState<number>(0);
  const [errored, setErrored] = useState<Set<number>>(new Set());
  const [tileLoading, setTileLoading] = useState(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
  }, []);

  if (attachments.length === 0) return null;
  const safeIdx = Math.min(idx, attachments.length - 1);
  const current = attachments[safeIdx];

  const startTileLoading = () => {
    setTileLoading(true);
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    loadingTimerRef.current = setTimeout(() => setTileLoading(false), 1200);
  };
  const stopTileLoading = () => {
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
    setTileLoading(false);
  };
  const next = () => { startTileLoading(); setIdx((i) => (i + 1) % attachments.length); };
  const prev = () => { startTileLoading(); setIdx((i) => (i - 1 + attachments.length) % attachments.length); };
  const open = (e: React.MouseEvent, a: Attachment) => {
    e.stopPropagation();
    const i = attachments.indexOf(a);
    setPopupIdx(i >= 0 ? i : 0);
    setActiveAttachment(a);
  };

  const imageAttachments: Attachment[] = attachments.filter(
    (a): a is Attachment => a.kind === 'image' || a.kind === 'ipfs',
  );
  const popupPrev = () => {
    if (imageAttachments.length === 0) return;
    setPopupIdx((i) => {
      const currentSubIdx = Math.max(0, imageAttachments.indexOf(attachments[i]));
      const ni = (currentSubIdx - 1 + imageAttachments.length) % imageAttachments.length;
      const target = imageAttachments[ni];
      setActiveAttachment(target);
      return attachments.indexOf(target);
    });
  };
  const popupNext = () => {
    if (imageAttachments.length === 0) return;
    setPopupIdx((i) => {
      const currentSubIdx = Math.max(0, imageAttachments.indexOf(attachments[i]));
      const ni = (currentSubIdx + 1) % imageAttachments.length;
      const target = imageAttachments[ni];
      setActiveAttachment(target);
      return attachments.indexOf(target);
    });
  };

  const renderTile = () => {
    if (current.kind === 'ipfs') {
      return <IpfsStripTile url={current.url} onOpen={(e) => open(e, current)} />;
    }
    if (current.kind === 'image') {
      const isErr = errored.has(safeIdx);
      if (isErr) {
        return (
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full items-center justify-center bg-[var(--hrk-bg-app)] text-[var(--hrk-text-tertiary)]"
          >
            <ImageOff className="h-6 w-6" />
          </button>
        );
      }
      return (
        <button
          type="button"
          onClick={(e) => open(e, current)}
          className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-[var(--hrk-bg-surface-sunken)]"
          aria-label="Open image preview"
        >
          <img
            key={safeIdx}
            ref={(node) => {
              if (node && node.complete) stopTileLoading();
            }}
            src={current.url}
            alt=""
            loading="lazy"
            className="max-h-full max-w-full object-contain"
            onLoad={stopTileLoading}
            onError={() => {
              stopTileLoading();
              setErrored((prev) => new Set(prev).add(safeIdx));
            }}
          />
        </button>
      );
    }
    if (current.kind === 'youtube') {
      return (
        <div
          className="flex h-full w-full items-center justify-center bg-black"
          onClick={(e) => e.stopPropagation()}
        >
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${current.id}?rel=0&playsinline=1`}
            title="YouTube"
            className="border-0"
            style={{ aspectRatio: '16/9', height: '100%', maxHeight: '100%', maxWidth: '100%' }}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    if (current.kind === 'threespeak') {
      const ap = parse3SpeakAuthorPermlink(current.url);
      return (
        <div
          className="three-speak-snap-strip flex h-full w-full items-center justify-center overflow-hidden bg-black"
          onClick={(e) => e.stopPropagation()}
        >
          {ap ? (
            <ThreeSpeakNativePlayer author={ap.author} permlink={ap.permlink} hideThumbnail />
          ) : (
            <a
              href={current.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--hrk-brand)] underline"
              onClick={(e) => e.stopPropagation()}
            >
              Open on 3Speak
            </a>
          )}
        </div>
      );
    }
    if (current.kind === 'twitter') {
      return (
        <div
          className="flex h-full w-full items-center justify-center p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <TwitterEmbed id={current.id} />
        </div>
      );
    }
    if (current.kind === 'audio') {
      return (
        <div
          className="flex h-full w-full items-center justify-center bg-[#1a1d21] p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-md rounded-xl border border-[var(--hrk-border-default)] bg-[#15181b] p-3 shadow-lg">
            <div className="mb-2 flex items-center gap-2 text-xs text-[var(--hrk-text-tertiary)]">
              <Music className="h-4 w-4 shrink-0 text-[var(--hrk-brand)]" />
              <span className="truncate">
                {decodeURIComponent(current.url.split('/').pop()?.split('?')[0] ?? 'Audio')}
              </span>
            </div>
            <audio src={current.url} controls preload="metadata" className="h-9 w-full" />
          </div>
        </div>
      );
    }
    if (current.kind === '3speak-audio') {
      return (
        <div
          className="flex h-full w-full items-center justify-center bg-[#1a1d21] p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-[var(--hrk-border-default)] bg-[#15181b]">
            <iframe
              src={current.url}
              title="3Speak audio player"
              className="h-24 w-full border-0"
            />
          </div>
        </div>
      );
    }
    if (current.kind === 'spotify') {
      const embedUrl = current.url.replace('open.spotify.com/', 'open.spotify.com/embed/');
      return (
        <div
          className="flex h-full w-full items-center justify-center bg-[#1a1d21] p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-[var(--hrk-border-default)] bg-[#15181b]">
            <iframe
              src={embedUrl}
              title="Spotify Player"
              className="h-56 w-full border-0 rounded-lg"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <div className="relative flex h-72 w-full items-center justify-center overflow-hidden rounded-xl bg-black my-2">
        {renderTile()}
        {tileLoading && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/40">
            <Loader2 className="h-7 w-7 animate-spin text-white" />
          </div>
        )}
        {attachments.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 right-2 z-30 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
              {safeIdx + 1} / {attachments.length}
            </div>
          </>
        )}
      </div>

      {activeAttachment && (
        <MediaPopup
          attachment={activeAttachment}
          index={Math.max(0, imageAttachments.indexOf(activeAttachment))}
          total={imageAttachments.length}
          onPrev={popupPrev}
          onNext={popupNext}
          onClose={() => setActiveAttachment(null)}
        />
      )}
    </>
  );
};
