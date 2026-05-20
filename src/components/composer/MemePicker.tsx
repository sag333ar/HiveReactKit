/**
 * MemePicker — DecentMemes-powered meme inserter.
 *
 * The previous implementation built our own canvas editor on top of
 * memegen.link. It worked, but DecentMemes (https://decentmemes.com/widget/)
 * is the Hive-native solution and ships a richer template library / editor,
 * so we now embed their widget instead of duplicating it.
 *
 * Flow:
 *   1. User opens the picker → DecentMemes loads in an iframe inside the modal.
 *   2. User builds the meme on DecentMemes and taps their "Download" button.
 *      The browser saves the rendered PNG/JPG to the user's downloads folder.
 *   3. User taps "Use downloaded meme" in our modal footer → file picker.
 *   4. The picked file is uploaded with `uploadImageWithFallback` (Ecency
 *      first, signed images.hive.blog fallback — same pipeline the composer's
 *      "Upload image" button uses) and the public URL is handed back via
 *      `onSelectMeme` so the composer can insert it as a regular image.
 *
 * The user-facing prop surface is unchanged from the old MemePicker, so
 * callers (`AddCommentInput`, `ParentPostComposer`) keep working without edits.
 */
import React, { useRef, useState } from 'react';
import {
  X,
  Upload,
  Loader2,
  Wand2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { uploadImageWithFallback, type PostingSignMessageFn } from '../../services/hiveImageUpload';

const DECENTMEMES_URL = 'https://decentmemes.com/widget/';

export interface MemePickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the public URL of the uploaded meme image. */
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
  const [uploading, setUploading] = useState(false);
  const [isAwaitingApproval, setIsAwaitingApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setError(null);
    setUploading(true);
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
      onSelectMeme(url);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      setIsAwaitingApproval(false);
      onSigningStateChange?.(false);
    }
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
              href={DECENTMEMES_URL}
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
          {/* Inline how-to. Two steps: (1) build + Download inside the
              iframe, (2) hand the saved file back via "Use downloaded meme". */}
          <ol className="flex flex-col gap-1 rounded-lg border border-dashed border-[var(--hs-border-default,#3a424a)] bg-[var(--hs-bg-surface,#1c1f25)] px-3 py-2 text-xs text-[var(--hs-text-secondary,#cfd3da)]">
            <li>
              <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--hs-brand,#e31337)] text-[10px] font-bold text-white">1</span>
              Build your meme below and tap <strong>Download</strong> inside DecentMemes.
            </li>
            <li>
              <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--hs-brand,#e31337)] text-[10px] font-bold text-white">2</span>
              Hit <strong>Use downloaded meme</strong> and pick the file from your downloads — it uploads to Hive and drops into your post.
            </li>
          </ol>

          <div
            className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[var(--hs-border-subtle,#3a424a)] bg-black/40"
            style={{ minHeight: 380 }}
          >
            <iframe
              src={DECENTMEMES_URL}
              title="DecentMemes meme editor"
              className="h-full w-full"
              style={{ border: 0, minHeight: 380 }}
              // `clipboard-write` lets DecentMemes offer "copy image";
              // `downloads-without-user-activation` is harmless when unsupported
              // and lets the download button fire without extra prompts on
              // platforms that honour it.
              allow="clipboard-write; downloads-without-user-activation"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--hs-brand,#e31337)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--hs-brand-hover,#c41030)] disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? 'Uploading…' : 'Use downloaded meme'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MemePicker;
