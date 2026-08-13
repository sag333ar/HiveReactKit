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

export type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

type DragMode =
  | { kind: 'none' }
  | { kind: 'move'; offsetX: number; offsetY: number }
  | { kind: 'resize'; handle: HandleType };

const MIN_SIZE = 24;

const HANDLES: Array<{
  id: HandleType;
  cursor: string;
  className: string;
}> = [
  { id: 'nw', cursor: 'nwse-resize', className: '-top-1.5 -left-1.5' },
  { id: 'n',  cursor: 'ns-resize',   className: '-top-1.5 left-1/2 -translate-x-1/2' },
  { id: 'ne', cursor: 'nesw-resize', className: '-top-1.5 -right-1.5' },
  { id: 'e',  cursor: 'ew-resize',   className: 'top-1/2 -translate-y-1/2 -right-1.5' },
  { id: 'se', cursor: 'nwse-resize', className: '-bottom-1.5 -right-1.5' },
  { id: 's',  cursor: 'ns-resize',   className: '-bottom-1.5 left-1/2 -translate-x-1/2' },
  { id: 'sw', cursor: 'nesw-resize', className: '-bottom-1.5 -left-1.5' },
  { id: 'w',  cursor: 'ew-resize',   className: 'top-1/2 -translate-y-1/2 -left-1.5' },
];

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

    const rawPx = e.clientX - rect.left;
    const rawPy = e.clientY - rect.top;

    if (drag.kind === 'move') {
      setSelection(
        clampToImage({
          x: rawPx - drag.offsetX,
          y: rawPy - drag.offsetY,
          w: selection.w,
          h: selection.h,
        }),
      );
      return;
    }

    if (drag.kind === 'resize') {
      const { handle } = drag;
      let { x, y, w, h } = selection;

      // Handle top edge adjustments (nw, n, ne)
      if (handle === 'nw' || handle === 'n' || handle === 'ne') {
        const py = Math.max(metrics.top, Math.min(metrics.top + metrics.height, rawPy));
        const newY = Math.min(py, y + h - MIN_SIZE);
        h = h + (y - newY);
        y = newY;
      }

      // Handle bottom edge adjustments (sw, s, se)
      if (handle === 'sw' || handle === 's' || handle === 'se') {
        const py = Math.max(metrics.top, Math.min(metrics.top + metrics.height, rawPy));
        h = Math.max(MIN_SIZE, py - y);
      }

      // Handle left edge adjustments (nw, w, sw)
      if (handle === 'nw' || handle === 'w' || handle === 'sw') {
        const px = Math.max(metrics.left, Math.min(metrics.left + metrics.width, rawPx));
        const newX = Math.min(px, x + w - MIN_SIZE);
        w = w + (x - newX);
        x = newX;
      }

      // Handle right edge adjustments (ne, e, se)
      if (handle === 'ne' || handle === 'e' || handle === 'se') {
        const px = Math.max(metrics.left, Math.min(metrics.left + metrics.width, rawPx));
        w = Math.max(MIN_SIZE, px - x);
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

  const startResize = (handle: HandleType) => (e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = { kind: 'resize', handle };
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
                {HANDLES.map(({ id, cursor, className }) => (
                  <div
                    key={id}
                    onPointerDown={startResize(id)}
                    className={`absolute h-3 w-3 bg-white border border-black/30 z-10 ${className}`}
                    style={{ cursor }}
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

