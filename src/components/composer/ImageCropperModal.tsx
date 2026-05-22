/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Crop, RotateCcw, Check, X } from 'lucide-react';
import type { CropRect } from '../../utils/imageProcessor';

/**
 * Minimal in-modal crop UI. Renders the source image inside a fixed
 * container, overlays a draggable rectangle on top, and reports the
 * final crop in *normalised* coordinates (0..1 of the source's
 * natural dimensions) so the actual crop happens against the full-
 * resolution image elsewhere.
 *
 * Deliberately library-free — `react-image-crop` / `react-easy-crop`
 * would add 20+ kB and a peer-dep maze we don't need for the
 * pre-upload "trim the edges" use case.
 *
 * Interactions:
 *   • Drag the selection's interior to move it.
 *   • Drag any of the 4 corner handles to resize.
 *   • Tap Reset to reselect the whole image.
 *   • Tap Apply to commit; Cancel/X dismiss without cropping.
 */

export interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Source image — either a File or a remote URL the user already
   *  uploaded. The modal renders it via an <img> tag. */
  src: string;
  /** Called when the user applies the crop. Coordinates are 0..1 in
   *  both axes, measured against the source image's natural size. */
  onApply: (rect: CropRect) => void;
}

interface Selection {
  // Pixel-space rectangle in the rendered image (not the source!).
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ImageMetrics {
  // The bounding box of the <img> element after object-fit: contain —
  // used so the selection rect snaps to the actual pixels, not the
  // letterboxed dead space around the image.
  left: number;
  top: number;
  width: number;
  height: number;
}

type DragMode =
  | { kind: 'none' }
  | { kind: 'move'; offsetX: number; offsetY: number }
  | { kind: 'resize'; corner: 'nw' | 'ne' | 'sw' | 'se' };

const MIN_SIZE = 24;

export function ImageCropperModal({ isOpen, onClose, src, onApply }: ImageCropperModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [metrics, setMetrics] = useState<ImageMetrics | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const dragRef = useRef<DragMode>({ kind: 'none' });

  // After the image finishes loading (or the modal resizes) we recompute
  // the rendered bounding box. `object-fit: contain` keeps aspect ratio,
  // so the image may not fill the container — we need its actual rect.
  const recomputeMetrics = () => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const ar = img.naturalWidth / img.naturalHeight;
    let w = cw;
    let h = cw / ar;
    if (h > ch) {
      h = ch;
      w = ch * ar;
    }
    const left = (cw - w) / 2;
    const top = (ch - h) / 2;
    setMetrics({ left, top, width: w, height: h });
    // Default to the full visible image as the selection.
    setSelection({ x: left, y: top, w, h });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    const onResize = () => recomputeMetrics();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setMetrics(null);
      setSelection(null);
      dragRef.current = { kind: 'none' };
    }
  }, [isOpen]);

  const handleImageLoad = () => {
    recomputeMetrics();
  };

  const clampToImage = (rect: Selection): Selection => {
    if (!metrics) return rect;
    const minX = metrics.left;
    const minY = metrics.top;
    const maxX = metrics.left + metrics.width;
    const maxY = metrics.top + metrics.height;
    let { x, y, w, h } = rect;
    w = Math.max(MIN_SIZE, Math.min(w, metrics.width));
    h = Math.max(MIN_SIZE, Math.min(h, metrics.height));
    x = Math.max(minX, Math.min(x, maxX - w));
    y = Math.max(minY, Math.min(y, maxY - h));
    return { x, y, w, h };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!selection || !metrics) return;
    const drag = dragRef.current;
    if (drag.kind === 'none') return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if (drag.kind === 'move') {
      setSelection(
        clampToImage({
          x: px - drag.offsetX,
          y: py - drag.offsetY,
          w: selection.w,
          h: selection.h,
        }),
      );
      return;
    }
    if (drag.kind === 'resize') {
      const { corner } = drag;
      let { x, y, w, h } = selection;
      if (corner === 'nw') {
        const newX = Math.min(px, x + w - MIN_SIZE);
        const newY = Math.min(py, y + h - MIN_SIZE);
        w = w + (x - newX);
        h = h + (y - newY);
        x = newX;
        y = newY;
      } else if (corner === 'ne') {
        const newY = Math.min(py, y + h - MIN_SIZE);
        w = Math.max(MIN_SIZE, px - x);
        h = h + (y - newY);
        y = newY;
      } else if (corner === 'sw') {
        const newX = Math.min(px, x + w - MIN_SIZE);
        w = w + (x - newX);
        x = newX;
        h = Math.max(MIN_SIZE, py - y);
      } else if (corner === 'se') {
        w = Math.max(MIN_SIZE, px - x);
        h = Math.max(MIN_SIZE, py - y);
      }
      setSelection(clampToImage({ x, y, w, h }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = { kind: 'none' };
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const startMove = (e: React.PointerEvent) => {
    if (!selection) return;
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      kind: 'move',
      offsetX: e.clientX - rect.left - selection.x,
      offsetY: e.clientY - rect.top - selection.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const startResize = (corner: 'nw' | 'ne' | 'sw' | 'se') => (e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = { kind: 'resize', corner };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleReset = () => {
    if (!metrics) return;
    setSelection({ x: metrics.left, y: metrics.top, w: metrics.width, h: metrics.height });
  };

  const handleApply = () => {
    if (!selection || !metrics) return;
    // Map from rendered pixel space → 0..1 of the source image.
    const relX = (selection.x - metrics.left) / metrics.width;
    const relY = (selection.y - metrics.top) / metrics.height;
    const relW = selection.w / metrics.width;
    const relH = selection.h / metrics.height;
    onApply({
      x: Math.max(0, Math.min(1, relX)),
      y: Math.max(0, Math.min(1, relY)),
      width: Math.max(0, Math.min(1, relW)),
      height: Math.max(0, Math.min(1, relH)),
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--hrk-bg-surface)] text-[var(--hrk-text-primary)] rounded-xl shadow-xl w-full max-w-3xl flex flex-col border border-[var(--hrk-border-default)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-[var(--hrk-border-default)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crop className="h-5 w-5 text-[var(--hrk-text-secondary)]" />
            <h3 className="text-base font-semibold">Crop image</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 hover:bg-[var(--hrk-bg-hover)] rounded transition-colors"
          >
            <X className="h-5 w-5 text-[var(--hrk-text-secondary)]" />
          </button>
        </div>

        <div
          ref={containerRef}
          className="relative bg-black/40 select-none"
          style={{ height: '60vh', touchAction: 'none' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <img
            ref={imgRef}
            src={src}
            alt="Crop preview"
            onLoad={handleImageLoad}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
          {selection && metrics && (
            <>
              {/* Darken everything outside the selection. Four divs
                  beat one mask for older browser parity. */}
              <div className="absolute left-0 top-0 right-0 bg-black/55 pointer-events-none" style={{ height: selection.y }} />
              <div className="absolute left-0 bottom-0 right-0 bg-black/55 pointer-events-none" style={{ height: `calc(100% - ${selection.y + selection.h}px)` }} />
              <div className="absolute bg-black/55 pointer-events-none" style={{ top: selection.y, left: 0, width: selection.x, height: selection.h }} />
              <div className="absolute bg-black/55 pointer-events-none" style={{ top: selection.y, left: selection.x + selection.w, width: `calc(100% - ${selection.x + selection.w}px)`, height: selection.h }} />

              <div
                onPointerDown={startMove}
                className="absolute border-2 border-white cursor-move"
                style={{ left: selection.x, top: selection.y, width: selection.w, height: selection.h }}
              >
                {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                  <div
                    key={corner}
                    onPointerDown={startResize(corner)}
                    className="absolute h-3 w-3 bg-white border border-black/30"
                    style={{
                      left: corner === 'nw' || corner === 'sw' ? -6 : undefined,
                      right: corner === 'ne' || corner === 'se' ? -6 : undefined,
                      top: corner === 'nw' || corner === 'ne' ? -6 : undefined,
                      bottom: corner === 'sw' || corner === 'se' ? -6 : undefined,
                      cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--hrk-border-default)] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--hrk-border-subtle)] px-3 py-1.5 text-xs hover:bg-[var(--hrk-bg-hover)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--hrk-border-subtle)] px-3 py-1.5 text-xs hover:bg-[var(--hrk-bg-hover)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--hrk-brand)] text-black px-3 py-1.5 text-xs font-semibold hover:opacity-90"
            >
              <Check className="h-3.5 w-3.5" />
              Apply crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImageCropperModal;
