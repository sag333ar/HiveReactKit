import { useEffect, useRef, useState, type FC } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { parseThreeSpeakRef, type PostMedia } from '../utils/postMedia';

/**
 * Shared lightbox / preview overlay used by feed-card carousels
 * (`BlogPostList` PostMediaCarousel, `UserDetailProfile` post tiles,
 * etc.).
 *
 * Capabilities for image entries:
 *   • Pan + pinch + wheel zoom (1× – 4×, in 0.5 steps)
 *   • Double-click toggles 1× ↔ 2×
 *   • Dedicated +/-/reset buttons in a bottom toolbar
 *   • Keyboard: + / - to zoom, 0 to reset, ←/→ to navigate, Esc to close
 *
 * YouTube and 3Speak entries render their official embed iframes; the
 * zoom toolbar is suppressed because iframes can't be transformed
 * sensibly. Twitter entries are filtered out by callers since they
 * open in a new tab from the tile itself.
 */
export interface MediaLightboxProps {
  items: PostMedia[];
  startIndex?: number;
  onClose: () => void;
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.5;

export const MediaLightbox: FC<MediaLightboxProps> = ({ items, startIndex = 0, onClose }) => {
  const [index, setIndex] = useState(() =>
    Math.max(0, Math.min(startIndex, Math.max(0, items.length - 1))),
  );
  const [scale, setScale] = useState(1);
  // Pan offsets in pixels — only meaningful when scale > 1.
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragRef = useRef<{ startX: number; startY: number; baseTx: number; baseTy: number } | null>(null);
  // Tracks whether the visible image has loaded. We flip this to false
  // each time `safeIndex` changes so the spinner shows up while the
  // network fetch happens, then back to true from the <img onLoad>.
  // Errors map to "loaded" too — we don't want the spinner spinning
  // forever on a broken URL.
  const [imageLoaded, setImageLoaded] = useState(false);

  const safeIndex = items.length === 0 ? 0 : Math.max(0, Math.min(index, items.length - 1));
  const current = items[safeIndex];
  const isImage = current?.kind === 'image';

  // Reset zoom/pan whenever the current item changes — otherwise
  // moving from a zoomed image to a video leaves the iframe offset.
  // Also reset the loaded flag so the spinner re-appears for the new
  // image's network fetch.
  useEffect(() => {
    setScale(1);
    setTx(0);
    setTy(0);
    setImageLoaded(false);
  }, [safeIndex]);

  // Lock body scroll + listen for Escape / arrows while the lightbox
  // is open. Keyboard nav matches what people expect from Photos /
  // Lightroom-style viewers.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') setIndex((p) => (items.length === 0 ? p : (p - 1 + items.length) % items.length));
      else if (e.key === 'ArrowRight') setIndex((p) => (items.length === 0 ? p : (p + 1) % items.length));
      else if (e.key === '+' || e.key === '=') setScale((s) => Math.min(ZOOM_MAX, s + ZOOM_STEP));
      else if (e.key === '-' || e.key === '_') setScale((s) => Math.max(ZOOM_MIN, s - ZOOM_STEP));
      else if (e.key === '0') { setScale(1); setTx(0); setTy(0); }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, items.length]);

  if (!current) return null;

  const goPrev = () => {
    if (items.length <= 1) return;
    setIndex((p) => (p - 1 + items.length) % items.length);
  };
  const goNext = () => {
    if (items.length <= 1) return;
    setIndex((p) => (p + 1) % items.length);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!isImage) return;
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    setScale((s) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, s + dir * ZOOM_STEP)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isImage || scale === 1) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseTx: tx, baseTy: ty };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setTx(dragRef.current.baseTx + (e.clientX - dragRef.current.startX));
    setTy(dragRef.current.baseTy + (e.clientY - dragRef.current.startY));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const handleDoubleClick = () => {
    if (!isImage) return;
    setScale((s) => (s === 1 ? 2 : 1));
    if (scale !== 1) { setTx(0); setTy(0); }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-5xl items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute -top-10 right-0 z-10 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {items.length > 1 && (
          <span className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
            {safeIndex + 1} / {items.length}
          </span>
        )}

        {items.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
              aria-label="Previous"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
              aria-label="Next"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {isImage && (
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full bg-black/60 px-2 py-1 text-white">
            <button
              onClick={(e) => { e.stopPropagation(); setScale((s) => Math.max(ZOOM_MIN, s - ZOOM_STEP)); }}
              className="rounded-full p-1.5 hover:bg-white/15 disabled:opacity-40"
              aria-label="Zoom out"
              disabled={scale <= ZOOM_MIN}
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="min-w-[3rem] text-center text-xs tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setScale((s) => Math.min(ZOOM_MAX, s + ZOOM_STEP)); }}
              className="rounded-full p-1.5 hover:bg-white/15 disabled:opacity-40"
              aria-label="Zoom in"
              disabled={scale >= ZOOM_MAX}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <span className="mx-1 h-4 w-px bg-white/25" />
            <button
              onClick={(e) => { e.stopPropagation(); setScale(1); setTx(0); setTy(0); }}
              className="rounded-full p-1.5 hover:bg-white/15"
              aria-label="Reset zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        )}

        {current.kind === 'image' && (
          <div
            className="relative flex max-h-[80vh] w-full items-center justify-center overflow-hidden select-none"
            onWheel={handleWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={handleDoubleClick}
            style={{ touchAction: scale === 1 ? 'auto' : 'none' }}
          >
            {/* Loading spinner overlay. Sits above the image while the
                new src is decoding/downloading; cleared the moment
                onLoad fires (or onError, so a bad URL doesn't trap us
                in a spinning state forever). */}
            {!imageLoaded && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <Loader2 className="h-8 w-8 animate-spin text-white/80" />
              </div>
            )}
            <img
              src={current.url}
              alt=""
              draggable={false}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
              className="max-h-[80vh] max-w-full rounded-lg object-contain transition-transform duration-100"
              style={{
                transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                cursor: scale === 1 ? 'zoom-in' : dragRef.current ? 'grabbing' : 'grab',
                opacity: imageLoaded ? 1 : 0.2,
              }}
            />
          </div>
        )}
        {current.kind === 'youtube' && (
          <div className="w-full overflow-hidden rounded-lg" style={{ aspectRatio: '16/9' }}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${current.id}?autoplay=1&rel=0&playsinline=1`}
              title="YouTube"
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        {current.kind === 'threespeak' && (() => {
          const ref = parseThreeSpeakRef(current.url);
          const src = ref
            ? `https://play.3speak.tv/embed?v=${encodeURIComponent(`${ref.author}/${ref.permlink}`)}&mode=iframe&noscroll=1&autoplay=1`
            : current.url;
          return (
            <div className="w-full overflow-hidden rounded-lg" style={{ aspectRatio: '9/16', maxWidth: '380px' }}>
              <iframe
                src={src}
                title="3Speak"
                className="h-full w-full border-0"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default MediaLightbox;
