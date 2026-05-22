import React, { useEffect, useRef, useState } from "react";
import { Upload, X, Loader2, Crop as CropIcon } from "lucide-react";
import { uploadImageWithFallback, type PostingSignMessageFn } from "../../services/hiveImageUpload";
import { prepareImageForUpload, cropImage, type CropRect } from "../../utils/imageProcessor";
import ImageCropperModal from "./ImageCropperModal";

/** Dig a human-readable message out of whatever an upload helper (or provider SDK) might throw. */
function extractUploadErrorMessage(err: unknown): string {
  if (err == null) return "Failed to upload image";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    if (err.message && err.message !== "[object Object]") return err.message;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyErr = err as any;
    if (anyErr.cause) return extractUploadErrorMessage(anyErr.cause);
    if (typeof anyErr.error === "string") return anyErr.error;
    if (anyErr.error && typeof anyErr.error === "object") return extractUploadErrorMessage(anyErr.error);
  }
  if (typeof err === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyErr = err as any;
    if (typeof anyErr.message === "string" && anyErr.message !== "[object Object]") return anyErr.message;
    if (typeof anyErr.error === "string") return anyErr.error;
    if (anyErr.cmd === "sign_nack" || anyErr.cmd === "auth_nack") return "Request rejected in wallet";
    if (anyErr.cmd === "sign_err" || anyErr.cmd === "auth_err") return typeof anyErr.error === "string" ? anyErr.error : "Wallet error";
    if (anyErr.data && typeof anyErr.data.msg === "string") return anyErr.data.msg;
    try {
      const str = JSON.stringify(err);
      if (str && str !== "{}") return str;
    } catch { /* fallthrough */ }
  }
  return "Failed to upload image";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ImageUploaderProps {
  /** Called with the uploaded image URL */
  onImageUploaded: (imageUrl: string) => void;
  /** Ecency image hosting token for upload authentication */
  ecencyToken?: string;
  /** Optional signer used when the Ecency upload fails. Signs a posting-key message. */
  onSignMessage?: PostingSignMessageFn;
  /** Hive username used for the signed images.hive.blog fallback upload. */
  signingUsername?: string;
  /** Fires true while the caller's wallet signer is running (wallet approval window). */
  onSigningStateChange?: (isSigning: boolean) => void;
  /** Text shown in blinking amber while waiting for wallet approval during the hive image fallback. */
  walletApprovalLabel?: string;
  disabled?: boolean;
  /** Cap on the longest edge of the uploaded image. Default 2048px.
   *  Photos taken on modern phones are routinely 4032px+ wide, which
   *  the upstream image hosts truncate or reject — this guarantees we
   *  always ship a sensible size. */
  maxImageDimension?: number;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageUploaded,
  ecencyToken,
  onSignMessage,
  signingUsername,
  onSigningStateChange,
  walletApprovalLabel = 'Open Keychain App & Approve',
  disabled = false,
  maxImageDimension,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAwaitingApproval, setIsAwaitingApproval] = useState(false);
  // We hold the prepared (potentially downsized / cropped) file in
  // state so the user can review the preview, optionally re-crop, and
  // only then commit to the actual upload.
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);

  // Make sure the preview's object URL is released when it's replaced
  // or the component unmounts; otherwise we leak memory on every photo.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const cancelInFlight = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsAwaitingApproval(false);
    onSigningStateChange?.(false);
  };

  const stageFile = async (file: File) => {
    setIsProcessing(true);
    try {
      const prepared = await prepareImageForUpload(file, { maxDimension: maxImageDimension });
      setOriginalFile(file);
      setStagedFile(prepared);
      // Object URL is built from the *prepared* blob so the preview
      // reflects what will actually be uploaded.
      const url = URL.createObjectURL(prepared);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      setError(extractUploadErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    cancelInFlight();
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      // 25 MB cap on the *source* — we'll downsize before upload, but
      // anything bigger than this is almost certainly a misclick.
      setError("File size must be less than 25MB");
      return;
    }
    setError(null);
    await stageFile(file);
  };

  const handleApplyCrop = async (rect: CropRect) => {
    setCropperOpen(false);
    const source = originalFile ?? stagedFile;
    if (!source) return;
    setIsProcessing(true);
    try {
      const cropped = await cropImage(source, rect, { maxDimension: maxImageDimension });
      setStagedFile(cropped);
      const url = URL.createObjectURL(cropped);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      setError(extractUploadErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const startUpload = async () => {
    if (!stagedFile) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;
    setIsUploading(true);
    setError(null);
    try {
      const url = await uploadImageWithFallback(stagedFile, {
        ecencyToken,
        onSignMessage,
        signingUsername,
        signal,
        onSignStart: () => {
          if (!signal.aborted) {
            setIsAwaitingApproval(true);
            onSigningStateChange?.(true);
          }
        },
        onSignEnd: () => {
          setIsAwaitingApproval(false);
          onSigningStateChange?.(false);
        },
      });
      if (signal.aborted) return;
      onImageUploaded(url);
      setStagedFile(null);
      setOriginalFile(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      if (signal.aborted) return;
      // eslint-disable-next-line no-console
      console.error('[ImageUploader] upload error:', err);
      setError(extractUploadErrorMessage(err));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (!signal.aborted) setIsUploading(false);
    }
  };

  const clearPreview = () => {
    cancelInFlight();
    setIsUploading(false);
    setIsProcessing(false);
    setStagedFile(null);
    setOriginalFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const modalOpen = previewUrl !== null || error !== null;

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />
      <button
        type="button"
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
        disabled={disabled || isUploading}
        className="p-2 rounded-lg hover:bg-[var(--hrk-bg-surface-raised)] text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-text-primary)] transition-colors disabled:opacity-50"
        title="Upload Image"
      >
        {isUploading || isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
      </button>
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--hrk-bg-app)] border border-[var(--hrk-border-subtle)] rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b border-[var(--hrk-border-subtle)]">
              <h3 className="text-lg font-semibold text-white">{error ? "Upload Error" : "Image Preview"}</h3>
              <button type="button" onClick={clearPreview} className="p-1 hover:bg-[var(--hrk-bg-surface)] rounded">
                <X className="h-5 w-5 text-[var(--hrk-text-secondary)]" />
              </button>
            </div>
            <div className="p-4">
              {error ? (
                <div className="text-[var(--hrk-danger)] text-sm">{error}</div>
              ) : previewUrl ? (
                <div className="space-y-4">
                  <img src={previewUrl} alt="Preview" className="w-full max-h-64 object-contain rounded" />
                  {stagedFile && originalFile && (
                    <div className="text-xs text-[var(--hrk-text-tertiary)] text-center">
                      {originalFile.size > stagedFile.size
                        ? `Resized for upload: ${formatBytes(originalFile.size)} → ${formatBytes(stagedFile.size)}`
                        : `Ready to upload: ${formatBytes(stagedFile.size)}`}
                    </div>
                  )}
                  {isAwaitingApproval ? (
                    <div className="text-center">
                      <p className="text-sm text-[var(--hrk-warning)] animate-pulse">{walletApprovalLabel}</p>
                    </div>
                  ) : isUploading ? (
                    <div className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[var(--hrk-info)]" />
                      <p className="text-sm text-[var(--hrk-text-tertiary)]">Uploading image...</p>
                    </div>
                  ) : isProcessing ? (
                    <div className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[var(--hrk-info)]" />
                      <p className="text-sm text-[var(--hrk-text-tertiary)]">Preparing image...</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setCropperOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--hrk-border-subtle)] px-3 py-1.5 text-xs hover:bg-[var(--hrk-bg-surface)] text-[var(--hrk-text-secondary)]"
                      >
                        <CropIcon className="h-3.5 w-3.5" />
                        Crop
                      </button>
                      <button
                        type="button"
                        onClick={clearPreview}
                        className="rounded-md border border-[var(--hrk-border-subtle)] px-3 py-1.5 text-xs hover:bg-[var(--hrk-bg-surface)] text-[var(--hrk-text-secondary)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={startUpload}
                        disabled={!stagedFile}
                        className="rounded-md bg-[var(--hrk-brand)] text-black px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                      >
                        Upload
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
      {previewUrl && (
        <ImageCropperModal
          isOpen={cropperOpen}
          onClose={() => setCropperOpen(false)}
          src={previewUrl}
          onApply={handleApplyCrop}
        />
      )}
    </div>
  );
};

export default ImageUploader;
