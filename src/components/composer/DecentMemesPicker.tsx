/**
 * DecentMemesPicker — embed the DecentMemes widget (https://decentmemes.com/widget/)
 * so users can build a meme with the Hive-native catalogue/editor and bring the
 * generated image back into the composer.
 *
 * Spec: https://decentmemes.com/docs/peakd-integration.md
 *
 * Primary flow (production):
 *   1. Iframe loads → we optionally `frontendInit` (account + theme).
 *   2. User picks a template and clicks **Add to post** inside the widget.
 *   3. Widget posts `memeCreated` to the parent — we decode the base64 PNG,
 *      upload it via `uploadImageWithFallback`, and hand the public URL +
 *      per-meme metadata (template id + beneficiaries) back to the host
 *      via `onSelectMeme(url, meta)`.
 *
 * Fallback flow (dev / non-allowlisted origin):
 *   The widget's `postMessage` origin allowlist is `peakd.com`, `ecency.com`,
 *   `hive.blog`, `beta.peakd.com`, `decentmemes.com`. On any other parent
 *   origin the widget silently drops inbound messages (frontendInit/setTheme)
 *   and may target a specific origin for `memeCreated` too. We keep the
 *   "Use downloaded meme" file picker as a safety net for those environments
 *   — it goes through the same upload pipeline but skips the metadata
 *   (no templateId / beneficiaries available outside the postMessage).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Upload,
  Loader2,
  Wand2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { uploadImageWithFallback, type PostingSignMessageFn } from '../../services/hiveImageUpload';
import {
  DECENTMEMES_WIDGET_ORIGIN,
  DECENTMEMES_WIDGET_URL,
  isDecentMemesCreatedEvent,
  type DecentMemesMeme,
} from '../../utils/decentmemes';

export interface DecentMemesPickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the public URL of the uploaded meme. When the upload was
   *  triggered by a `memeCreated` postMessage, `meta` carries the template
   *  id + per-meme beneficiaries from the widget — pass this back up to the
   *  composer so the host can build `comment_options` and stamp
   *  `json_metadata.decentmemes`. `meta` is `undefined` for the
   *  file-picker fallback path. */
  onSelectMeme: (url: string, meta?: DecentMemesMeme) => void;
  /** Ecency token for the no-signing upload path. */
  ecencyToken?: string;
  /** Signer for the `images.hive.blog` fallback. */
  onSignMessage?: PostingSignMessageFn;
  /** Hive username used for the signed `images.hive.blog` fallback. */
  signingUsername?: string;
  /** Mirrors `ImageUploader.onSigningStateChange` for "Open Keychain & Approve" UX. */
  onSigningStateChange?: (isSigning: boolean) => void;
  walletApprovalLabel?: string;
  /** Optional. Forwarded as `frontendInit.account` so the widget assigns the
   *  1% frontend beneficiary slot. PeakD has opted out per spec; pass your
   *  own Hive account here if you want to claim the slot for your frontend. */
  appAccount?: string;
  /** Optional. Forwarded as `frontendInit.theme` on load and via `setTheme`
   *  whenever it changes. Defaults to dark widget-side when unset. */
  theme?: 'light' | 'dark';
}

function DecentMemesPicker({
  isOpen,
  onClose,
  onSelectMeme,
  ecencyToken,
  onSignMessage,
  signingUsername,
  onSigningStateChange,
  walletApprovalLabel = 'Open Keychain App & Approve',
  appAccount,
  theme,
}: DecentMemesPickerProps): React.JSX.Element | null {
  const [uploading, setUploading] = useState(false);
  const [isAwaitingApproval, setIsAwaitingApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'received' | 'uploading'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Avoid double-processing if the widget re-sends `memeCreated` while an
  // upload from a previous event is still in flight.
  const inFlightRef = useRef(false);

  // Reset error when the modal opens.
  useEffect(() => {
    if (isOpen) setError(null);
  }, [isOpen]);

  /**
   * Run the bytes from a `memeCreated` event (or the file-picker fallback)
   * through the host's image-upload pipeline and emit `onSelectMeme`.
   */
  const uploadAndEmit = async (file: File, meta?: DecentMemesMeme['template'] & {
    beneficiaries: DecentMemesMeme['beneficiaries'];
  }) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus('uploading');
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImageWithFallback(file, {
        ecencyToken,
        onSignMessage,
        signingUsername,
        filename: file.name,
        onSignStart: () => {
          setIsAwaitingApproval(true);
          onSigningStateChange?.(true);
        },
        onSignEnd: () => {
          setIsAwaitingApproval(false);
          onSigningStateChange?.(false);
        },
      });
      if (meta) {
        const memeMeta: DecentMemesMeme = {
          imageUrl: url,
          template: { id: meta.id, name: meta.name, isOriginalCreator: meta.isOriginalCreator },
          beneficiaries: meta.beneficiaries,
        };
        onSelectMeme(url, memeMeta);
      } else {
        onSelectMeme(url);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      setIsAwaitingApproval(false);
      onSigningStateChange?.(false);
      setStatus('idle');
      inFlightRef.current = false;
    }
  };

  // ── postMessage listener for `memeCreated` ────────────────────────────────
  // Listens whenever the modal is open. Verifies origin per spec.
  useEffect(() => {
    if (!isOpen) return;
    const handler = async (event: MessageEvent) => {
      if (event.origin !== DECENTMEMES_WIDGET_ORIGIN) return;
      if (!isDecentMemesCreatedEvent(event.data)) return;
      const payload = event.data;
      setStatus('received');
      try {
        const blob = await (await fetch(payload.imageDataUrl)).blob();
        const file = new File(
          [blob],
          payload.imageFileName || 'meme.png',
          { type: payload.imageMimeType || blob.type || 'image/png' },
        );
        await uploadAndEmit(file, {
          id: payload.template.id,
          name: payload.template.name,
          isOriginalCreator: payload.template.isOriginalCreator,
          beneficiaries: payload.beneficiaries,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to read meme image.');
        setStatus('idle');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
    // uploadAndEmit captures the latest props via closure; restating
    // dependencies here would force a listener rebind on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── frontendInit on iframe load (origin allowlist permitting) ─────────────
  const handleIframeLoad = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const payload: { type: 'frontendInit'; account?: string; theme?: 'light' | 'dark' } = {
      type: 'frontendInit',
    };
    if (appAccount) payload.account = appAccount;
    if (theme) payload.theme = theme;
    win.postMessage(payload, DECENTMEMES_WIDGET_ORIGIN);
  };

  // ── setTheme on theme prop change ─────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !theme) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ type: 'setTheme', theme }, DECENTMEMES_WIDGET_ORIGIN);
  }, [theme, isOpen]);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please pick an image file (the meme you just downloaded).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('File size must be under 15MB.');
      return;
    }
    await uploadAndEmit(file);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-3 py-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[95vh] w-full max-w-3xl flex-col rounded-2xl border border-[var(--hs-border-default,#3a424a)] bg-[var(--hs-bg-surface-raised,#262b30)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-[var(--hs-border-subtle,#3a424a)] px-4 py-3">
          <h3 className="inline-flex items-center gap-2 text-base font-semibold text-[var(--hs-text-primary,#f0f0f8)]">
            <Wand2 className="h-4 w-4 text-[var(--hs-warning,#f59e0b)]" />
            Create a meme
            <span className="ml-1 rounded-full bg-[var(--hs-bg-surface-sunken,#1c1f25)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--hs-text-tertiary,#9ca3b0)]">
              DecentMemes
            </span>
          </h3>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={DECENTMEMES_WIDGET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--hs-text-secondary,#cfd3da)] hover:bg-[var(--hs-bg-hover,#2f353d)]"
              title="Open DecentMemes in a new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in tab
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-[var(--hs-text-tertiary,#9ca3b0)] hover:bg-[var(--hs-bg-hover,#2f353d)] hover:text-[var(--hs-text-primary,#f0f0f8)]"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          <p className="rounded-lg border border-dashed border-[var(--hs-border-default,#3a424a)] bg-[var(--hs-bg-surface,#1c1f25)] px-3 py-2 text-xs text-[var(--hs-text-secondary,#cfd3da)]">
            Build a meme below and tap <strong>Add to post</strong> inside DecentMemes — we'll
            upload it and drop it into your composer automatically. If nothing happens after
            you click, your browser likely blocked the postMessage; use{' '}
            <strong>Use downloaded meme</strong> as a manual fallback.
          </p>

          <div
            className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[var(--hs-border-subtle,#3a424a)] bg-black/40"
            style={{ minHeight: 380 }}
          >
            <iframe
              ref={iframeRef}
              src={DECENTMEMES_WIDGET_URL}
              title="DecentMemes meme editor"
              className="h-full w-full"
              style={{ border: 0, minHeight: 380 }}
              // `clipboard-write` covers the widget's "copy image" affordance.
              // No need for `downloads-without-user-activation` anymore — the
              // primary flow returns bytes via postMessage rather than a
              // browser download.
              allow="clipboard-write"
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={handleIframeLoad}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {(status === 'received' || status === 'uploading') && !error && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              <span>
                {status === 'received'
                  ? 'Received meme — uploading…'
                  : 'Uploading to Hive…'}
              </span>
            </div>
          )}

          {isAwaitingApproval && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300 [animation:blink_1.4s_ease-in-out_infinite]">
              {walletApprovalLabel}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                if (e.target) e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hs-border-default,#3a424a)] bg-[var(--hs-bg-surface,#1c1f25)] px-3 py-2 text-xs font-medium text-[var(--hs-text-secondary,#cfd3da)] hover:bg-[var(--hs-bg-hover,#2f353d)] disabled:opacity-50"
              title="Fallback if the widget couldn't postMessage your meme"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploading ? 'Uploading…' : 'Use downloaded meme'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DecentMemesPicker;
