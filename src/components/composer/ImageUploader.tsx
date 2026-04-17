import React, { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { uploadToHiveImages, type PostingSignMessageFn } from "../../services/hiveImageUpload";

/** Dig a human-readable message out of whatever an upload helper (or provider SDK) might throw. */
function extractUploadErrorMessage(err: unknown): string {
  if (err == null) return "Failed to upload image";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    if (err.message && err.message !== "[object Object]") return err.message;
    // Error whose message was built from an object — peek at common fields or stringify the cause.
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
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageUploaded,
  ecencyToken,
  onSignMessage,
  signingUsername,
  onSigningStateChange,
  walletApprovalLabel = 'Open Keychain App & Approve',
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAwaitingApproval, setIsAwaitingApproval] = useState(false);

  const cancelInFlight = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsAwaitingApproval(false);
    onSigningStateChange?.(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // Abort any prior in-flight upload before starting a new one.
    cancelInFlight();
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }
    setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    uploadImage(file);
  };

  const uploadToEcency = async (file: File, signal: AbortSignal): Promise<string> => {
    if (!ecencyToken) throw new Error("Ecency token not provided");
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("https://images.ecency.com/hss/" + ecencyToken, {
      method: "POST",
      headers: {
        accept: "application/json, text/plain, */*",
        origin: "https://ecency.com",
        referer: "https://ecency.com/",
      },
      body: formData,
      signal,
    });
    if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
    const data = await response.json();
    if (!data.url) throw new Error("No URL returned from upload");
    return data.url as string;
  };

  const uploadImage = async (file: File) => {
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;
    setIsUploading(true);
    setError(null);
    try {
      const canHiveFallback = Boolean(onSignMessage && signingUsername);
      if (!ecencyToken && !canHiveFallback) {
        throw new Error("No upload method configured");
      }

      let url: string;
      try {
        url = await uploadToEcency(file, signal);
      } catch (ecencyErr) {
        if (signal.aborted) return;
        if (!canHiveFallback) throw ecencyErr;
        url = await uploadToHiveImages(onSignMessage!, signingUsername!, file, undefined, {
          onSignStart: () => { if (!signal.aborted) { setIsAwaitingApproval(true); onSigningStateChange?.(true); } },
          onSignEnd: () => { setIsAwaitingApproval(false); onSigningStateChange?.(false); },
          signal,
        });
      }
      if (signal.aborted) return;
      onImageUploaded(url);
      setPreviewUrl(null);
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
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
        className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        title="Upload Image"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
      </button>
      {(previewUrl || error) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">{error ? "Upload Error" : "Image Preview"}</h3>
              <button type="button" onClick={clearPreview} className="p-1 hover:bg-gray-800 rounded">
                <X className="h-5 w-5 text-gray-300" />
              </button>
            </div>
            <div className="p-4">
              {error ? (
                <div className="text-red-400 text-sm">{error}</div>
              ) : previewUrl ? (
                <div className="space-y-4">
                  <img src={previewUrl} alt="Preview" className="w-full max-h-64 object-contain rounded" />
                  {isAwaitingApproval ? (
                    <div className="text-center">
                      <p className="text-sm text-amber-400 animate-pulse">{walletApprovalLabel}</p>
                    </div>
                  ) : isUploading ? (
                    <div className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-400" />
                      <p className="text-sm text-gray-400">Uploading image...</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
