/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Crop, RotateCcw, Check, X, Pencil, Sparkles, Grid, Square, Trash2, Undo2 } from 'lucide-react';
import type { CropRect, BlurRect, BlurStyle } from '../../utils/imageProcessor';

export interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Source image — either a local object URL or remote image URL. */
  src: string;
  /** Initial active tool tab when opened ('crop' or 'blur') */
  initialTool?: 'crop' | 'blur';
  /** Called when the user commits crop and blurs. Coordinates are 0..1 normalised. */
  onApply: (rect: CropRect, blurRects?: BlurRect[]) => void;
}

interface Selection {
  // Pixel-space rectangle in the rendered image.
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PixelBlurBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  style: BlurStyle;
}

interface ImageMetrics {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

type ToolMode = 'crop' | 'blur';

type DragMode =
  | { kind: 'none' }
  | { kind: 'move-crop'; offsetX: number; offsetY: number }
  | { kind: 'resize-crop'; handle: HandleType }
  | { kind: 'draw-blur'; startX: number; startY: number; currentX: number; currentY: number }
  | { kind: 'move-blur'; blurId: string; offsetX: number; offsetY: number }
  | { kind: 'resize-blur'; blurId: string; handle: HandleType };

const MIN_SIZE = 20;

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

export function ImageCropperModal({
  isOpen,
  onClose,
  src,
  initialTool = 'crop',
  onApply,
}: ImageCropperModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [metrics, setMetrics] = useState<ImageMetrics | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [activeTool, setActiveTool] = useState<ToolMode>(initialTool);
  const [blurStyle, setBlurStyle] = useState<BlurStyle>('blur');
  const [blurBoxes, setBlurBoxes] = useState<PixelBlurBox[]>([]);
  const [selectedBlurId, setSelectedBlurId] = useState<string | null>(null);
  const [drawingPreview, setDrawingPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const dragRef = useRef<DragMode>({ kind: 'none' });

  // Recompute the rendered image box inside container
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
    if (!selection) {
      setSelection({ x: left, y: top, w, h });
    }
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
      setBlurBoxes([]);
      setSelectedBlurId(null);
      setDrawingPreview(null);
      setActiveTool(initialTool);
      dragRef.current = { kind: 'none' };
    } else {
      setActiveTool(initialTool);
    }
  }, [isOpen, initialTool]);

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

  const onPointerDownContainer = (e: React.PointerEvent) => {
    if (!metrics || activeTool !== 'blur') return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawPx = Math.max(metrics.left, Math.min(metrics.left + metrics.width, e.clientX - rect.left));
    const rawPy = Math.max(metrics.top, Math.min(metrics.top + metrics.height, e.clientY - rect.top));

    dragRef.current = {
      kind: 'draw-blur',
      startX: rawPx,
      startY: rawPy,
      currentX: rawPx,
      currentY: rawPy,
    };
    setSelectedBlurId(null);
    setDrawingPreview({ x: rawPx, y: rawPy, w: 0, h: 0 });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!metrics) return;
    const drag = dragRef.current;
    if (drag.kind === 'none') return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const rawPx = Math.max(metrics.left, Math.min(metrics.left + metrics.width, e.clientX - rect.left));
    const rawPy = Math.max(metrics.top, Math.min(metrics.top + metrics.height, e.clientY - rect.top));

    if (drag.kind === 'draw-blur') {
      const sx = drag.startX;
      const sy = drag.startY;
      const curX = rawPx;
      const curY = rawPy;
      drag.currentX = curX;
      drag.currentY = curY;

      const bx = Math.min(sx, curX);
      const by = Math.min(sy, curY);
      const bw = Math.abs(curX - sx);
      const bh = Math.abs(curY - sy);
      setDrawingPreview({ x: bx, y: by, w: bw, h: bh });
      return;
    }

    if (drag.kind === 'move-crop' && selection) {
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

    if (drag.kind === 'resize-crop' && selection) {
      const { handle } = drag;
      let { x, y, w, h } = selection;

      if (handle === 'nw' || handle === 'n' || handle === 'ne') {
        const py = Math.max(metrics.top, Math.min(metrics.top + metrics.height, rawPy));
        const newY = Math.min(py, y + h - MIN_SIZE);
        h = h + (y - newY);
        y = newY;
      }
      if (handle === 'sw' || handle === 's' || handle === 'se') {
        const py = Math.max(metrics.top, Math.min(metrics.top + metrics.height, rawPy));
        h = Math.max(MIN_SIZE, py - y);
      }
      if (handle === 'nw' || handle === 'w' || handle === 'sw') {
        const px = Math.max(metrics.left, Math.min(metrics.left + metrics.width, rawPx));
        const newX = Math.min(px, x + w - MIN_SIZE);
        w = w + (x - newX);
        x = newX;
      }
      if (handle === 'ne' || handle === 'e' || handle === 'se') {
        const px = Math.max(metrics.left, Math.min(metrics.left + metrics.width, rawPx));
        w = Math.max(MIN_SIZE, px - x);
      }

      setSelection(clampToImage({ x, y, w, h }));
      return;
    }

    if (drag.kind === 'move-blur') {
      const targetId = drag.blurId;
      setBlurBoxes((prev) =>
        prev.map((b) => {
          if (b.id !== targetId) return b;
          const targetX = Math.max(metrics.left, Math.min(metrics.left + metrics.width - b.w, rawPx - drag.offsetX));
          const targetY = Math.max(metrics.top, Math.min(metrics.top + metrics.height - b.h, rawPy - drag.offsetY));
          return { ...b, x: targetX, y: targetY };
        }),
      );
      return;
    }

    if (drag.kind === 'resize-blur') {
      const targetId = drag.blurId;
      const { handle } = drag;
      setBlurBoxes((prev) =>
        prev.map((b) => {
          if (b.id !== targetId) return b;
          let { x, y, w, h } = b;
          if (handle === 'nw' || handle === 'n' || handle === 'ne') {
            const py = Math.max(metrics.top, Math.min(metrics.top + metrics.height, rawPy));
            const newY = Math.min(py, y + h - MIN_SIZE);
            h = h + (y - newY);
            y = newY;
          }
          if (handle === 'sw' || handle === 's' || handle === 'se') {
            const py = Math.max(metrics.top, Math.min(metrics.top + metrics.height, rawPy));
            h = Math.max(MIN_SIZE, py - y);
          }
          if (handle === 'nw' || handle === 'w' || handle === 'sw') {
            const px = Math.max(metrics.left, Math.min(metrics.left + metrics.width, rawPx));
            const newX = Math.min(px, x + w - MIN_SIZE);
            w = w + (x - newX);
            x = newX;
          }
          if (handle === 'ne' || handle === 'e' || handle === 'se') {
            const px = Math.max(metrics.left, Math.min(metrics.left + metrics.width, rawPx));
            w = Math.max(MIN_SIZE, px - x);
          }
          return { ...b, x, y, w, h };
        }),
      );
      return;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (drag.kind === 'draw-blur') {
      const bw = Math.abs(drag.currentX - drag.startX);
      const bh = Math.abs(drag.currentY - drag.startY);
      if (bw >= 10 && bh >= 10) {
        const newBox: PixelBlurBox = {
          id: `blur_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          x: Math.min(drag.startX, drag.currentX),
          y: Math.min(drag.startY, drag.currentY),
          w: bw,
          h: bh,
          style: blurStyle,
        };
        setBlurBoxes((prev) => [...prev, newBox]);
        setSelectedBlurId(newBox.id);
      }
      setDrawingPreview(null);
    }

    dragRef.current = { kind: 'none' };
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const startCropMove = (e: React.PointerEvent) => {
    if (!selection || activeTool !== 'crop') return;
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      kind: 'move-crop',
      offsetX: e.clientX - rect.left - selection.x,
      offsetY: e.clientY - rect.top - selection.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const startCropResize = (handle: HandleType) => (e: React.PointerEvent) => {
    if (activeTool !== 'crop') return;
    e.stopPropagation();
    dragRef.current = { kind: 'resize-crop', handle };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const startBlurMove = (blurId: string) => (e: React.PointerEvent) => {
    if (activeTool !== 'blur') return;
    e.stopPropagation();
    setSelectedBlurId(blurId);
    const target = blurBoxes.find((b) => b.id === blurId);
    if (!target) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      kind: 'move-blur',
      blurId,
      offsetX: e.clientX - rect.left - target.x,
      offsetY: e.clientY - rect.top - target.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const startBlurResize = (blurId: string, handle: HandleType) => (e: React.PointerEvent) => {
    if (activeTool !== 'blur') return;
    e.stopPropagation();
    setSelectedBlurId(blurId);
    dragRef.current = { kind: 'resize-blur', blurId, handle };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const removeBlur = (id: string) => {
    setBlurBoxes((prev) => prev.filter((b) => b.id !== id));
    if (selectedBlurId === id) setSelectedBlurId(null);
  };

  const handleUndoBlur = () => {
    setBlurBoxes((prev) => prev.slice(0, -1));
  };

  const handleClearBlurs = () => {
    setBlurBoxes([]);
    setSelectedBlurId(null);
  };

  const handleReset = () => {
    if (!metrics) return;
    if (activeTool === 'crop') {
      setSelection({ x: metrics.left, y: metrics.top, w: metrics.width, h: metrics.height });
    } else {
      setBlurBoxes([]);
      setSelectedBlurId(null);
    }
  };

  const handleApply = () => {
    if (!selection || !metrics) return;
    const relX = (selection.x - metrics.left) / metrics.width;
    const relY = (selection.y - metrics.top) / metrics.height;
    const relW = selection.w / metrics.width;
    const relH = selection.h / metrics.height;

    const finalCrop: CropRect = {
      x: Math.max(0, Math.min(1, relX)),
      y: Math.max(0, Math.min(1, relY)),
      width: Math.max(0, Math.min(1, relW)),
      height: Math.max(0, Math.min(1, relH)),
    };

    const finalBlurs: BlurRect[] = blurBoxes.map((b) => ({
      id: b.id,
      x: Math.max(0, Math.min(1, (b.x - metrics.left) / metrics.width)),
      y: Math.max(0, Math.min(1, (b.y - metrics.top) / metrics.height)),
      width: Math.max(0, Math.min(1, b.w / metrics.width)),
      height: Math.max(0, Math.min(1, b.h / metrics.height)),
      style: b.style,
    }));

    onApply(finalCrop, finalBlurs);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--hrk-bg-surface,#181a20)] text-[var(--hrk-text-primary,#f0f0f8)] rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col border border-[var(--hrk-border-default,#2b2f3a)] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 border-b border-[var(--hrk-border-default,#2b2f3a)] flex items-center justify-between gap-3 bg-[var(--hrk-bg-surface-raised,#20242c)]">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Crop className="h-5 w-5 text-white" />
              <h3 className="text-base font-semibold text-white tracking-tight">Crop image</h3>
            </div>

            <div className="hidden sm:block h-4 w-px bg-white/15" />

            {/* Tool Mode Tabs: Crop vs Pencil / Blur */}
            <div className="inline-flex rounded-lg bg-[var(--hrk-bg-hover,#2b313c)] p-0.5 border border-[var(--hrk-border-subtle,#363c48)]">
              <button
                type="button"
                onClick={() => setActiveTool('crop')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTool === 'crop'
                    ? 'bg-[var(--hrk-brand,#e31337)] text-white shadow-sm'
                    : 'text-[var(--hrk-text-secondary,#9aa0a6)] hover:text-white'
                }`}
                title="Crop bounds tool"
              >
                <Crop className="h-3.5 w-3.5" />
                Crop
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('blur')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTool === 'blur'
                    ? 'bg-[var(--hrk-brand,#e31337)] text-white shadow-sm'
                    : 'text-cyan-400 hover:text-white'
                }`}
                title="Pencil tool: Click & drag over sensitive parts to blur"
              >
                <Pencil className="h-3.5 w-3.5" />
                Blur Pencil
                {blurBoxes.length > 0 && (
                  <span className="ml-1 rounded-full bg-white/25 px-1.5 py-0.2 text-[10px] leading-tight font-bold">
                    {blurBoxes.length}
                  </span>
                )}
              </button>
            </div>

            <span className="hidden md:inline text-xs text-[var(--hrk-text-secondary,#8f96a3)]">
              {activeTool === 'crop'
                ? 'Drag corners to crop image'
                : '✏️ Drag pencil over phone numbers, names, or sensitive areas'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-[var(--hrk-text-secondary,#8f96a3)] hover:text-white hover:bg-[var(--hrk-bg-hover,#2b313c)] rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sub-bar for Blur Controls when in Blur Mode */}
        {activeTool === 'blur' && (
          <div className="px-4 sm:px-6 py-2 bg-[var(--hrk-bg-hover,#262a34)] border-b border-[var(--hrk-border-subtle,#363c48)] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[var(--hrk-text-secondary,#8f96a3)] font-medium">Blur Style:</span>
              <div className="inline-flex rounded-md bg-[var(--hrk-bg-surface,#181a20)] p-0.5 border border-[var(--hrk-border-subtle,#363c48)]">
                <button
                  type="button"
                  onClick={() => setBlurStyle('blur')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
                    blurStyle === 'blur'
                      ? 'bg-white/20 text-white font-semibold'
                      : 'text-[var(--hrk-text-secondary,#8f96a3)] hover:text-white'
                  }`}
                  title="Gaussian Frosted Blur"
                >
                  <Sparkles className="h-3 w-3" />
                  Blur
                </button>
                <button
                  type="button"
                  onClick={() => setBlurStyle('pixelate')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
                    blurStyle === 'pixelate'
                      ? 'bg-white/20 text-white font-semibold'
                      : 'text-[var(--hrk-text-secondary,#8f96a3)] hover:text-white'
                  }`}
                  title="Mosaic Pixelation"
                >
                  <Grid className="h-3 w-3" />
                  Pixelate
                </button>
                <button
                  type="button"
                  onClick={() => setBlurStyle('blackout')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
                    blurStyle === 'blackout'
                      ? 'bg-white/20 text-white font-semibold'
                      : 'text-[var(--hrk-text-secondary,#8f96a3)] hover:text-white'
                  }`}
                  title="Blackout Censor Box"
                >
                  <Square className="h-3 w-3 fill-current" />
                  Blackout
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {blurBoxes.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleUndoBlur}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[var(--hrk-text-secondary,#8f96a3)] hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Undo2 className="h-3 w-3" />
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={handleClearBlurs}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[var(--hrk-danger,#f43f5e)] hover:bg-[var(--hrk-danger,#f43f5e)]/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear blurs
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Viewport Canvas Area */}
        <div
          ref={containerRef}
          className={`relative bg-black/80 select-none overflow-hidden ${
            activeTool === 'blur' ? 'cursor-crosshair' : 'cursor-default'
          }`}
          style={{ height: '62vh', touchAction: 'none' }}
          onPointerDown={onPointerDownContainer}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <img
            ref={imgRef}
            src={src}
            alt="Editor preview"
            onLoad={handleImageLoad}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            draggable={false}
          />

          {/* Render All Existing Blur Boxes */}
          {metrics &&
            blurBoxes.map((box) => {
              const isSelected = selectedBlurId === box.id;
              const isBlackout = box.style === 'blackout';
              const isPixelate = box.style === 'pixelate';

              return (
                <div
                  key={box.id}
                  onPointerDown={startBlurMove(box.id)}
                  className={`absolute group cursor-move transition-shadow ${
                    isSelected
                      ? 'ring-2 ring-[var(--hrk-brand,#e31337)] shadow-lg'
                      : 'border border-cyan-400/80'
                  }`}
                  style={{
                    left: box.x,
                    top: box.y,
                    width: box.w,
                    height: box.h,
                    zIndex: 20,
                    backdropFilter: isBlackout ? 'none' : isPixelate ? 'blur(4px) contrast(150%)' : 'blur(16px)',
                    WebkitBackdropFilter: isBlackout ? 'none' : isPixelate ? 'blur(4px) contrast(150%)' : 'blur(16px)',
                    backgroundColor: isBlackout
                      ? '#000000'
                      : isPixelate
                      ? 'rgba(220, 220, 220, 0.25)'
                      : 'rgba(255, 255, 255, 0.18)',
                    backgroundImage: isPixelate
                      ? 'repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 3px, transparent 3px, transparent 6px), repeating-linear-gradient(90deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 3px, transparent 3px, transparent 6px)'
                      : 'none',
                  }}
                >
                  {/* Delete button on top-right */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBlur(box.id);
                    }}
                    title="Remove blur"
                    className="absolute -top-2.5 -right-2.5 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-transform hover:scale-110"
                  >
                    <X className="h-3 w-3 stroke-[3]" />
                  </button>

                  {/* Handles for resizing blur box in blur mode */}
                  {activeTool === 'blur' &&
                    HANDLES.map(({ id, cursor, className }) => (
                      <div
                        key={id}
                        onPointerDown={startBlurResize(box.id, id)}
                        className={`absolute h-2.5 w-2.5 bg-cyan-400 border border-black/40 rounded-sm z-30 ${className}`}
                        style={{ cursor }}
                      />
                    ))}
                </div>
              );
            })}

          {/* Active Drawing Preview in Blur Mode */}
          {drawingPreview && (
            <div
              className="absolute pointer-events-none border-2 border-dashed border-cyan-400 bg-cyan-400/20 z-30"
              style={{
                left: drawingPreview.x,
                top: drawingPreview.y,
                width: drawingPreview.w,
                height: drawingPreview.h,
                backdropFilter: blurStyle === 'blackout' ? 'none' : 'blur(12px)',
                backgroundColor: blurStyle === 'blackout' ? '#000000' : 'rgba(255, 255, 255, 0.2)',
              }}
            />
          )}

          {/* Crop Mode Overlay & Handles */}
          {selection && metrics && (
            <>
              {/* Darken outside crop bounds */}
              <div
                className="absolute left-0 top-0 right-0 bg-black/60 pointer-events-none z-10"
                style={{ height: selection.y }}
              />
              <div
                className="absolute left-0 bottom-0 right-0 bg-black/60 pointer-events-none z-10"
                style={{ height: `calc(100% - ${selection.y + selection.h}px)` }}
              />
              <div
                className="absolute bg-black/60 pointer-events-none z-10"
                style={{ top: selection.y, left: 0, width: selection.x, height: selection.h }}
              />
              <div
                className="absolute bg-black/60 pointer-events-none z-10"
                style={{
                  top: selection.y,
                  left: selection.x + selection.w,
                  width: `calc(100% - ${selection.x + selection.w}px)`,
                  height: selection.h,
                }}
              />

              {/* Crop Box Frame */}
              <div
                onPointerDown={startCropMove}
                className={`absolute border-2 z-15 ${
                  activeTool === 'crop'
                    ? 'border-white cursor-move'
                    : 'border-white/40 border-dashed pointer-events-none'
                }`}
                style={{
                  left: selection.x,
                  top: selection.y,
                  width: selection.w,
                  height: selection.h,
                }}
              >
                {/* 3x3 Grid Guide lines in Crop Mode */}
                {activeTool === 'crop' && (
                  <div className="absolute inset-0 pointer-events-none opacity-40">
                    <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white" />
                    <div className="absolute right-1/3 top-0 bottom-0 w-px bg-white" />
                    <div className="absolute top-1/3 left-0 right-0 h-px bg-white" />
                    <div className="absolute bottom-1/3 left-0 right-0 h-px bg-white" />
                  </div>
                )}

                {/* 8 Resize Handles in Crop Mode */}
                {activeTool === 'crop' &&
                  HANDLES.map(({ id, cursor, className }) => (
                    <div
                      key={id}
                      onPointerDown={startCropResize(id)}
                      className={`absolute h-3 w-3 bg-white border border-black/40 shadow-sm z-30 ${className}`}
                      style={{ cursor }}
                    />
                  ))}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-[var(--hrk-border-default,#2b2f3a)] flex items-center justify-between gap-3 bg-[var(--hrk-bg-surface-raised,#20242c)]">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hrk-border-subtle,#363c48)] px-3 py-1.5 text-xs font-medium text-[var(--hrk-text-secondary,#9aa0a6)] hover:text-white hover:bg-[var(--hrk-bg-hover,#2b313c)] transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {activeTool === 'crop' ? 'Reset Crop' : 'Reset Blurs'}
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--hrk-border-subtle,#363c48)] px-3.5 py-1.5 text-xs font-medium text-[var(--hrk-text-secondary,#9aa0a6)] hover:text-white hover:bg-[var(--hrk-bg-hover,#2b313c)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--hrk-brand,#e31337)] text-white px-4 py-1.5 text-xs font-semibold shadow-md hover:opacity-90 active:scale-98 transition-all"
            >
              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              Apply crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImageCropperModal;
