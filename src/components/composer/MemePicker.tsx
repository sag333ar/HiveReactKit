/**
 * MemePicker — create a custom meme inside the composer.
 *
 * Two flows:
 *   1. Pick a template from memegen.link's free, no-auth catalogue (~100s of
 *      classic meme blanks; CORS-permissive so canvases stay un-tainted).
 *   2. Use your own image — file upload or a pasted URL — for a fully custom
 *      meme.
 *
 * Once an image is loaded, a canvas editor lets the user type Top / Bottom
 * captions in classic Impact-on-black-stroke style, tune the font size, and
 * generate the final PNG. The generated PNG is uploaded via Ecency first
 * (fastest, no signing), then `images.hive.blog` as a signed fallback
 * (mirrors `ImageUploader`'s behaviour). The picker calls `onSelectMeme`
 * with the public URL and the composer inserts it as a regular markdown
 * image — exactly like the GIF picker.
 *
 * No external service stores the captioned image: everything is rendered
 * client-side and the only network call beyond the template list is the
 * Hive image upload.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, ImageIcon, Upload, Loader2, ArrowLeft, Wand2 } from 'lucide-react';
import { uploadToHiveImages, type PostingSignMessageFn } from '../../services/hiveImageUpload';

// Memegen returns dozens of fields per template; we only use a handful.
interface MemegenTemplate {
  id: string;
  name: string;
  blank: string;
  lines: number;
  keywords?: string[];
}

type Source =
  | { kind: 'template'; tpl: MemegenTemplate }
  | { kind: 'upload'; objectUrl: string; file: File }
  | { kind: 'url'; url: string };

export interface MemePickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the public URL of the generated, uploaded meme. */
  onSelectMeme: (url: string) => void;
  /** Ecency token for the no-signing upload path. */
  ecencyToken?: string;
  /** Signer for the `images.hive.blog` fallback. */
  onSignMessage?: PostingSignMessageFn;
  /** Hive username used for the signed `images.hive.blog` fallback. */
  signingUsername?: string;
  /** Mirrors `ImageUploader.onSigningStateChange` for "Open Keychain & Approve" UX. */
  onSigningStateChange?: (isSigning: boolean) => void;
  walletApprovalLabel?: string;
}

const TEMPLATES_URL = 'https://api.memegen.link/templates';
const MAX_CANVAS_WIDTH = 720; // generated PNG width cap — keeps uploads light
const DEFAULT_FONT_SIZE = 56;

// Classic meme defaults — Impact ranks first; the fallback chain matches
// what most native browsers actually have available.
const MEME_FONT_STACK = 'Impact, "Anton", "Oswald", "Arial Black", system-ui, sans-serif';

function MemePicker({
  isOpen,
  onClose,
  onSelectMeme,
  ecencyToken,
  onSignMessage,
  signingUsername,
  onSigningStateChange,
  walletApprovalLabel = 'Open Keychain App & Approve',
}: MemePickerProps): React.JSX.Element | null {
  // ── Catalog state ────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<MemegenTemplate[]>([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplError, setTplError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // ── Editor state ─────────────────────────────────────────────────────────
  const [source, setSource] = useState<Source | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [topText, setTopText] = useState('');
  const [bottomText, setBottomText] = useState('');
  const [fontSize, setFontSize] = useState<number>(DEFAULT_FONT_SIZE);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [isAwaitingApproval, setIsAwaitingApproval] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Holds the loaded HTMLImageElement so the canvas can re-render as the
  // user types without paying the network cost again.
  const imageRef = useRef<HTMLImageElement | null>(null);

  // ── Reset transient state every time the dialog opens/closes ────────────
  useEffect(() => {
    if (!isOpen) {
      setSource(null);
      setUrlInput('');
      setTopText('');
      setBottomText('');
      setFontSize(DEFAULT_FONT_SIZE);
      setGenError(null);
      setGenerating(false);
      setIsAwaitingApproval(false);
      imageRef.current = null;
    }
  }, [isOpen]);

  // ── Templates fetch (lazy: only on first open) ──────────────────────────
  useEffect(() => {
    if (!isOpen || templates.length > 0) return;
    const controller = new AbortController();
    setTplLoading(true);
    setTplError(null);
    fetch(TEMPLATES_URL, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Templates request failed: ${r.status}`);
        return r.json() as Promise<MemegenTemplate[]>;
      })
      .then((rows) => {
        // memegen serves templates in arbitrary order. Sort by name so the
        // search-less default view is browsable.
        const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
        setTemplates(sorted);
        setTplLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setTplError(err instanceof Error ? err.message : 'Failed to load templates');
        setTplLoading(false);
      });
    return () => controller.abort();
  }, [isOpen, templates.length]);

  // ── Load the chosen source image into <img> for the canvas pipeline ─────
  useEffect(() => {
    if (!source) {
      imageRef.current = null;
      return;
    }
    const url =
      source.kind === 'template'
        ? source.tpl.blank
        : source.kind === 'upload'
          ? source.objectUrl
          : source.url;
    const img = new window.Image();
    // `crossOrigin = anonymous` is mandatory so the canvas stays un-tainted
    // and `toBlob` works. memegen.link sends `access-control-allow-origin: *`,
    // and ecency / hive image hosts do too. Pasted URLs that don't allow CORS
    // will still draw on screen but `toBlob` will throw; we surface that as
    // a friendly error rather than crashing.
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      // Trigger a re-render so the canvas effect below picks up the loaded
      // image. State update with the same value is a no-op, so use a ref
      // bump via fontSize.
      setFontSize((s) => s); // force render
      drawMemeOntoCanvas();
    };
    img.onerror = () => {
      setGenError(
        'Could not load that image. The host may not allow cross-origin use; try uploading the file instead.',
      );
    };
    img.src = url;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  // Re-draw whenever caption / size changes (image is already cached).
  useEffect(() => {
    if (imageRef.current) drawMemeOntoCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topText, bottomText, fontSize]);

  // ── Canvas renderer ─────────────────────────────────────────────────────
  const drawMemeOntoCanvas = () => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const aspect = img.naturalHeight / img.naturalWidth;
    const w = Math.min(MAX_CANVAS_WIDTH, img.naturalWidth);
    const h = Math.round(w * aspect);
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    // Caption text — classic Impact-on-black-stroke style.
    const px = Math.round((fontSize * w) / 720); // scale to canvas
    ctx.font = `900 ${px}px ${MEME_FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(2, Math.round(px / 12));
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    drawWrappedCaption(ctx, topText.toUpperCase(), w / 2, px * 0.9, w * 0.92, px * 1.05);
    drawWrappedCaption(
      ctx,
      bottomText.toUpperCase(),
      w / 2,
      h - px * 0.6,
      w * 0.92,
      px * 1.05,
      /* alignBottom */ true,
    );
  };

  // ── Source choosers ─────────────────────────────────────────────────────
  const choosePastedUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setGenError(null);
    setSource({ kind: 'url', url: trimmed });
  };

  const chooseUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setGenError('Please pick an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setGenError('File size must be under 10MB.');
      return;
    }
    setGenError(null);
    setSource({ kind: 'upload', objectUrl: URL.createObjectURL(file), file });
  };

  // ── Generate + upload ───────────────────────────────────────────────────
  const generate = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setGenerating(true);
    setGenError(null);
    try {
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png', 0.92),
      );
      if (!blob) throw new Error('Failed to render the meme image.');
      const file = new File([blob], `meme-${Date.now()}.png`, { type: 'image/png' });

      const canHive = Boolean(onSignMessage && signingUsername);
      if (!ecencyToken && !canHive) {
        throw new Error(
          'No image-upload path configured. Add `ecencyToken` or `onSignMessage` + `signingUsername`.',
        );
      }

      let url: string;
      try {
        url = await uploadToEcency(file);
      } catch (ecencyErr) {
        if (!canHive) throw ecencyErr;
        url = await uploadToHiveImages(onSignMessage!, signingUsername!, file, undefined, {
          onSignStart: () => {
            setIsAwaitingApproval(true);
            onSigningStateChange?.(true);
          },
          onSignEnd: () => {
            setIsAwaitingApproval(false);
            onSigningStateChange?.(false);
          },
        });
      }
      onSelectMeme(url);
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message === 'Tainted canvases may not be exported.'
            ? 'That image host blocks cross-origin use, so the meme can\'t be exported. Upload the file instead.'
            : err.message
          : 'Failed to generate meme.';
      setGenError(msg);
    } finally {
      setGenerating(false);
      setIsAwaitingApproval(false);
      onSigningStateChange?.(false);
    }
  };

  const uploadToEcency = async (file: File): Promise<string> => {
    if (!ecencyToken) throw new Error('Ecency token not provided');
    const formData = new FormData();
    formData.append('file', file);
    const r = await fetch('https://images.ecency.com/hs/' + ecencyToken, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/plain, */*',
        origin: 'https://ecency.com',
        referer: 'https://ecency.com/',
      },
      body: formData,
    });
    if (!r.ok) throw new Error(`Ecency upload failed: ${r.statusText}`);
    const data = (await r.json()) as { url?: string };
    if (!data.url) throw new Error('No URL returned from Ecency upload');
    return data.url;
  };

  // ── Filtered templates ──────────────────────────────────────────────────
  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      if (t.name.toLowerCase().includes(q)) return true;
      if (t.id.toLowerCase().includes(q)) return true;
      if (t.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [templates, search]);

  if (!isOpen) return null;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-3 py-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-[var(--hs-border-default,#3a424a)] bg-[var(--hs-bg-surface-raised,#262b30)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[var(--hs-border-subtle,#3a424a)] px-4 py-3">
          {source ? (
            <button
              type="button"
              onClick={() => {
                setSource(null);
                setTopText('');
                setBottomText('');
                setGenError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-[var(--hs-text-secondary,#cfd3da)] hover:bg-[var(--hs-bg-hover,#2f353d)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Pick another
            </button>
          ) : (
            <h3 className="inline-flex items-center gap-2 text-base font-semibold text-[var(--hs-text-primary,#f0f0f8)]">
              <Wand2 className="h-4 w-4 text-[var(--hs-warning,#f59e0b)]" />
              Create a meme
            </h3>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--hs-text-tertiary,#9ca3b0)] hover:bg-[var(--hs-bg-hover,#2f353d)] hover:text-[var(--hs-text-primary,#f0f0f8)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Body switches between "pick a source" and "edit captions". */}
        {!source ? (
          <PickerBody
            search={search}
            setSearch={setSearch}
            tplLoading={tplLoading}
            tplError={tplError}
            templates={filteredTemplates}
            onTemplatePick={(tpl) => setSource({ kind: 'template', tpl })}
            urlInput={urlInput}
            setUrlInput={setUrlInput}
            onPasteUrl={choosePastedUrl}
            onUpload={chooseUpload}
            fileInputRef={fileInputRef}
            genError={genError}
          />
        ) : (
          <EditorBody
            canvasRef={canvasRef}
            topText={topText}
            setTopText={setTopText}
            bottomText={bottomText}
            setBottomText={setBottomText}
            fontSize={fontSize}
            setFontSize={setFontSize}
            generating={generating}
            isAwaitingApproval={isAwaitingApproval}
            walletApprovalLabel={walletApprovalLabel}
            genError={genError}
            onGenerate={generate}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — separated for readability rather than encapsulation; both
// share the parent's local state via the props bag.
// ─────────────────────────────────────────────────────────────────────────────

interface PickerBodyProps {
  search: string;
  setSearch: (s: string) => void;
  tplLoading: boolean;
  tplError: string | null;
  templates: MemegenTemplate[];
  onTemplatePick: (tpl: MemegenTemplate) => void;
  urlInput: string;
  setUrlInput: (s: string) => void;
  onPasteUrl: () => void;
  onUpload: (file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  genError: string | null;
}

function PickerBody(props: PickerBodyProps): React.JSX.Element {
  const {
    search,
    setSearch,
    tplLoading,
    tplError,
    templates,
    onTemplatePick,
    urlInput,
    setUrlInput,
    onPasteUrl,
    onUpload,
    fileInputRef,
    genError,
  } = props;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      {/* Top row — search + upload + URL paste */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--hs-text-tertiary,#9ca3b0)]" />
          <input
            type="text"
            placeholder="Search templates (e.g. drake, distracted boyfriend)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--hs-border-default,#3a424a)] bg-[var(--hs-bg-surface-sunken,#2f353d)] py-2 pl-9 pr-3 text-sm text-[var(--hs-text-primary,#f0f0f8)] placeholder-[var(--hs-text-tertiary,#9ca3b0)] focus:outline-none focus:ring-2 focus:ring-[var(--hs-brand,#e31337)]"
          />
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hs-border-default,#3a424a)] bg-[var(--hs-bg-surface-sunken,#2f353d)] px-3 py-2 text-sm font-medium text-[var(--hs-text-primary,#f0f0f8)] hover:bg-[var(--hs-bg-hover,#3a424a)]"
        >
          <Upload className="h-4 w-4" />
          Upload image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            if (e.target) e.target.value = '';
          }}
        />
      </div>

      {/* Paste-URL row — collapsed but always available */}
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--hs-border-default,#3a424a)] bg-[var(--hs-bg-surface,#1c1f25)] p-2">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--hs-text-tertiary,#9ca3b0)]">
          Or paste URL:
        </span>
        <input
          type="url"
          placeholder="https://…/image.jpg"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-[var(--hs-text-primary,#f0f0f8)] placeholder-[var(--hs-text-tertiary,#9ca3b0)] focus:border-[var(--hs-border-default,#3a424a)] focus:outline-none"
        />
        <button
          type="button"
          onClick={onPasteUrl}
          disabled={!urlInput.trim()}
          className="shrink-0 rounded-md bg-[var(--hs-brand,#e31337)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--hs-brand-hover,#c41030)] disabled:opacity-50"
        >
          Use
        </button>
      </div>

      {genError && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {genError}
        </div>
      )}

      {/* Templates grid */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tplLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--hs-text-tertiary,#9ca3b0)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading templates…
          </div>
        ) : tplError ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {tplError}
          </div>
        ) : templates.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--hs-text-tertiary,#9ca3b0)]">
            No templates match “{search}”.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onTemplatePick(tpl)}
                className="group relative overflow-hidden rounded-lg border border-[var(--hs-border-subtle,#3a424a)] bg-[var(--hs-bg-surface-sunken,#1a1d21)] transition hover:border-[var(--hs-brand,#e31337)]"
                title={tpl.name}
              >
                <img
                  src={tpl.blank}
                  alt={tpl.name}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition group-hover:scale-105"
                />
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-2 py-1 text-left text-[11px] font-medium text-white">
                  {tpl.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface EditorBodyProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  topText: string;
  setTopText: (s: string) => void;
  bottomText: string;
  setBottomText: (s: string) => void;
  fontSize: number;
  setFontSize: (n: number) => void;
  generating: boolean;
  isAwaitingApproval: boolean;
  walletApprovalLabel: string;
  genError: string | null;
  onGenerate: () => void;
}

function EditorBody(props: EditorBodyProps): React.JSX.Element {
  const {
    canvasRef,
    topText,
    setTopText,
    bottomText,
    setBottomText,
    fontSize,
    setFontSize,
    generating,
    isAwaitingApproval,
    walletApprovalLabel,
    genError,
    onGenerate,
  } = props;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg border border-[var(--hs-border-subtle,#3a424a)] bg-black/55 p-2">
        <canvas
          ref={canvasRef}
          className="max-h-[55vh] max-w-full"
          style={{ imageRendering: 'auto' }}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-[var(--hs-text-secondary,#cfd3da)]">
          <span className="font-semibold uppercase tracking-wide text-[10px]">Top caption</span>
          <input
            type="text"
            value={topText}
            onChange={(e) => setTopText(e.target.value)}
            placeholder="Top text"
            maxLength={200}
            className="rounded-lg border border-[var(--hs-border-default,#3a424a)] bg-[var(--hs-bg-surface-sunken,#2f353d)] px-3 py-2 text-sm text-[var(--hs-text-primary,#f0f0f8)] placeholder-[var(--hs-text-tertiary,#9ca3b0)] focus:outline-none focus:ring-2 focus:ring-[var(--hs-brand,#e31337)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--hs-text-secondary,#cfd3da)]">
          <span className="font-semibold uppercase tracking-wide text-[10px]">Bottom caption</span>
          <input
            type="text"
            value={bottomText}
            onChange={(e) => setBottomText(e.target.value)}
            placeholder="Bottom text"
            maxLength={200}
            className="rounded-lg border border-[var(--hs-border-default,#3a424a)] bg-[var(--hs-bg-surface-sunken,#2f353d)] px-3 py-2 text-sm text-[var(--hs-text-primary,#f0f0f8)] placeholder-[var(--hs-text-tertiary,#9ca3b0)] focus:outline-none focus:ring-2 focus:ring-[var(--hs-brand,#e31337)]"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex flex-1 items-center gap-2 text-xs text-[var(--hs-text-secondary,#cfd3da)]">
          <span className="shrink-0 font-semibold uppercase tracking-wide text-[10px]">Font size</span>
          <input
            type="range"
            min={28}
            max={96}
            step={2}
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value, 10) || DEFAULT_FONT_SIZE)}
            className="min-w-0 flex-1 accent-[var(--hs-brand,#e31337)]"
          />
          <span className="w-8 shrink-0 text-right font-mono tabular-nums text-[var(--hs-text-tertiary,#9ca3b0)]">
            {fontSize}
          </span>
        </label>
      </div>

      {genError && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {genError}
        </div>
      )}

      {isAwaitingApproval && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300 [animation:blink_1.4s_ease-in-out_infinite]">
          {walletApprovalLabel}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--hs-brand,#e31337)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--hs-brand-hover,#c41030)] disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
          {generating ? 'Generating…' : 'Add meme to post'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Draw a caption with word-wrapping + Impact-on-stroke styling. Centred
 *  horizontally on `x`; `y` is the baseline of the first (top) line, or the
 *  baseline of the LAST line when `alignBottom` is true. */
function drawWrappedCaption(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  alignBottom = false,
) {
  if (!text) return;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return;

  // Greedy word wrap.
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);

  // Draw bottom-up when aligning to the bottom edge, otherwise top-down.
  const totalHeight = (lines.length - 1) * lineHeight;
  const startY = alignBottom ? y - totalHeight : y;
  lines.forEach((line, i) => {
    const lineY = startY + i * lineHeight;
    ctx.strokeText(line, x, lineY);
    ctx.fillText(line, x, lineY);
  });
}

export default MemePicker;
