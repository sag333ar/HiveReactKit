import React, { useRef, useState, useCallback, useEffect } from 'react'
import { Video, X, Loader2, Play, Trash2 } from 'lucide-react'
import { uploadToHiveImages, type PostingSignMessageFn } from '../../services/hiveImageUpload'

/** Extra metadata about a completed 3Speak upload — surfaced for consumers
 *  that want to drive the publish step themselves (whether through the
 *  legacy `/upload_info` + `/update_info` pair or the v2 `/api/upload/finalize`
 *  endpoint). */
export interface VideoUploadDetails {
  /** TUS filename — the trailing segment of the upload URL. Required by
   *  3Speak's legacy `/upload_info` endpoint. Empty for v2 uploads where
   *  the `uploadId` field below is the canonical identifier. */
  filename: string
  /** The user's original file name (e.g. `IMG_1234.mp4`). */
  originalFilename: string
  /** File size in bytes. */
  fileSize: number
  /** Video duration in seconds (rounded). */
  videoDuration: number
  /** Aspect ratio string (e.g. `"16/9"` or `"9/16"`). */
  aspectRatio: string
  /** The 3Speak embed URL — `https://3speak.tv/embed?v=author/permlink`.
   *  Empty when uploading via the v2 endpoint (the embed URL is only
   *  knowable after the consumer runs `/api/upload/finalize`). */
  embedUrl: string
  /** The TUS upload URL — `https://embed.3speak.tv/uploads/<filename>` or
   *  `https://video.3speak.tv/files/<filename>` depending on mode. */
  uploadUrl: string
  /** Local thumbnail blob (JPEG). The kit always keeps this around so
   *  consumers can ship it to whichever thumbnail endpoint they use. */
  thumbnailBlob: Blob | null
  /** Client-generated `upload_id` used by 3Speak's v2 finalize endpoint.
   *  Empty when the upload used the legacy embed.3speak.tv endpoint. */
  uploadId: string
  /** `true` when the upload used the v2 `video.3speak.tv/files/` endpoint. */
  isV2: boolean
}

export interface VideoUploaderProps {
  /** Called with embed URL, upload URL, aspect ratio, and optional local file for preview */
  onVideoUploaded: (videoEmbedUrl: string, uploadUrl: string, aspectRatio: string, localPreviewFile?: File) => void
  /**
   * Called alongside `onVideoUploaded` with the full set of 3Speak-specific
   * metadata. Consumers wiring the 3Speak Studio API (publish-via-3Speak)
   * need every field to call `/upload_info` + `/update_info`. Existing
   * snap composers don't need this path so the prop is optional.
   */
  onVideoUploadDetails?: (details: VideoUploadDetails) => void
  /** Hive username for the upload */
  username?: string
  /** Ecency image hosting token for thumbnail upload */
  ecencyToken?: string
  /** Optional signer used when the Ecency thumbnail upload fails. */
  onSignMessage?: PostingSignMessageFn
  /** 3Speak API key. Falls back to demo key if not provided. */
  threeSpeakApiKey?: string
  disabled?: boolean
  /** When true, accept landscape videos too. Default false — only portrait
   *  (vertical) clips are accepted, matching the hSnaps Moments contract. */
  allowLandscape?: boolean
  /**
   * When true, the upload panel renders as a floating bottom-right card
   * instead of a full-screen backdrop modal. The rest of the page stays
   * interactive so the user can keep editing the post body, tags, etc.
   * while the upload runs in the background. Default `false` keeps the
   * existing modal behaviour for snap composers.
   */
  inline?: boolean
  /**
   * Open-state controller (controlled mode). When provided, the parent owns
   * panel visibility — useful in inline mode where the parent surfaces a
   * minimized progress bar elsewhere on screen and reopens the panel on
   * demand. When omitted the component manages its own state.
   */
  isOpen?: boolean
  /**
   * Called whenever the panel's open state should change — when the user
   * picks a file (`true`) or clicks the X button (`false`). Pair with
   * `isOpen` for full control.
   */
  onIsOpenChange?: (open: boolean) => void
  /**
   * Called with the current TUS upload progress, or `null` when no upload
   * is in flight (idle / success / error). Lets the parent render a
   * minimized progress chip while the panel is hidden.
   */
  onUploadProgress?: (
    progress: { percentage: number; bytesUploaded: number; bytesTotal: number } | null,
  ) => void
  /**
   * Optional async gate run after a file is selected and validated, but
   * before the TUS upload starts. The consumer can use this to check
   * external preconditions — e.g. that the user has granted `threespeak`
   * posting authority — and resolve `false` to abort the upload (after
   * showing its own UI). Resolving `true` lets the upload proceed.
   *
   * If omitted the upload starts unconditionally (existing behaviour).
   */
  beforeUpload?: () => Promise<boolean>
  /**
   * When true, route the TUS upload through 3Speak's v2 endpoint at
   * `https://video.3speak.tv/files/` with TUS metadata
   * `{ upload_id, owner, filename, filetype }`. The kit generates a
   * client-side `upload_id` (format `<owner>_<unix-ms>_<hex>`) and
   * surfaces it via `VideoUploadDetails.uploadId` so the consumer can
   * call `/api/upload/finalize` to publish the video. The Ecency /
   * Hive thumbnail upload + `setThumbnailOn3Speak` step is skipped
   * because the v2 frontend posts thumbnails to
   * `/api/upload/thumbnail/<videoId>` after finalize.
   *
   * Default false keeps the legacy `embed.3speak.tv/uploads` flow used
   * by the snap composer.
   */
  useThreeSpeakV2?: boolean
}

const THREE_SPEAK_UPLOAD_ENDPOINT = 'https://embed.3speak.tv/uploads'
const THREE_SPEAK_V2_UPLOAD_ENDPOINT = 'https://video.3speak.tv/files/'
const DEFAULT_API_KEY = 'sk_demo_b0d3f4b972c5065b701394df3de2f44fd59aa3244c58c478'
const MAX_VIDEO_SIZE = 100 * 1024 * 1024
const CHUNK_SIZE = 5 * 1024 * 1024
const ACCEPTED_VIDEO_TYPES = 'video/mp4,video/quicktime,video/webm,video/3gpp,.mp4,.mov,.webm,.3gp'
const MAX_DURATION_SECONDS = 90

/** Generate a 3Speak v2 upload_id — `<owner>_<unix-ms>_<32-hex>`. */
function generateUploadId(owner: string): string {
  const ts = Date.now()
  let rand = ''
  for (let i = 0; i < 16; i++) rand += Math.floor(Math.random() * 16).toString(16)
  return `${owner}_${ts}_${rand}`
}

interface UploadProgress { bytesUploaded: number; bytesTotal: number; percentage: number }

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function generateThumbnail(file: File): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.onloadeddata = () => { video.currentTime = Math.min(0.75, video.duration * 0.25) }
    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Cannot create canvas context')); return }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        if (!blob) { reject(new Error('Failed to generate thumbnail')); return }
        resolve({ blob, dataUrl: canvas.toDataURL('image/jpeg', 0.7) })
      }, 'image/jpeg', 0.7)
    }
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load video')) }
    video.src = url
  })
}

function getVideoInfo(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve({ duration: Number.isFinite(video.duration) ? Math.round(video.duration) : 0, width: video.videoWidth || 0, height: video.videoHeight || 0 })
    }
    video.onerror = () => { URL.revokeObjectURL(url); resolve({ duration: 0, width: 0, height: 0 }) }
    video.src = url
  })
}

async function uploadThumbnailToEcency(blob: Blob, ecencyToken: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', blob, `video-thumbnail-${Date.now()}.jpg`)
  const response = await fetch(`https://images.ecency.com/hs/${ecencyToken}`, {
    method: 'POST',
    headers: { accept: 'application/json, text/plain, */*', origin: 'https://ecency.com', referer: 'https://ecency.com/' },
    body: formData,
  })
  if (!response.ok) throw new Error(`Thumbnail upload failed: ${response.statusText}`)
  const data = await response.json()
  if (!data.url) throw new Error('No URL returned from thumbnail upload')
  return data.url
}

async function setThumbnailOn3Speak(permlink: string, thumbnailUrl: string, apiKey: string): Promise<void> {
  await fetch(`https://embed.3speak.tv/video/${permlink}/thumbnail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ thumbnail_url: thumbnailUrl }),
  }).catch(() => {})
}

function extractPermlinkFromEmbedUrl(embedUrl: string): string | null {
  try {
    const vParam = new URL(embedUrl).searchParams.get('v')
    if (!vParam) return null
    const parts = vParam.split('/')
    return parts[parts.length - 1] || null
  } catch { return null }
}

/** Upload video using TUS protocol. Uses dynamic import for tus-js-client to avoid bundling issues. */
async function uploadVideoToThreeSpeak(
  file: File,
  username: string,
  durationSeconds: number,
  apiKey: string,
  onProgress: (progress: UploadProgress) => void,
  signal: AbortSignal,
  options?: {
    /** When true, switch to the v2 endpoint + metadata format. */
    useV2?: boolean
    /** Pre-generated upload_id used in the v2 metadata. */
    uploadId?: string
  },
): Promise<{ embedUrl: string; uploadUrl: string }> {
  // Dynamic import so tus-js-client is optional
  const { Upload: TusUpload } = await import('tus-js-client')

  const useV2 = !!options?.useV2
  const endpoint = useV2 ? THREE_SPEAK_V2_UPLOAD_ENDPOINT : THREE_SPEAK_UPLOAD_ENDPOINT
  // The v2 endpoint expects the small canonical metadata set the new
  // 3speak.tv frontend sends. The legacy endpoint keeps the kit's
  // existing `frontend_app`/`owner`/`short`/`duration` fields.
  const metadata: Record<string, string> = useV2
    ? {
        upload_id: options?.uploadId ?? '',
        owner: username,
        filename: file.name,
        filetype: file.type || 'video/mp4',
      }
    : {
        filename: file.name,
        filetype: file.type || 'video/mp4',
        frontend_app: 'hive-react-kit',
        owner: username,
        short: 'true',
        duration: String(durationSeconds),
      }
  // The legacy endpoint authenticates via the demo X-API-Key header. The
  // v2 endpoint relies on the upload_id alone — sending a stale API key
  // can confuse the gateway, so we omit it.
  const headers: Record<string, string> = useV2 ? {} : { 'X-API-Key': apiKey }

  return new Promise((resolve, reject) => {
    let capturedEmbedUrl: string | null = null
    let settled = false
    let detachAbort: (() => void) | null = null
    const settle = (fn: () => void) => {
      // Idempotent terminal — runs the resolve/reject exactly once and
      // tears down the abort listener so a *post-upload* AbortController
      // signal (e.g. the kit's `resetAll()` aborts mid `onVideoUploaded`)
      // doesn't fire `upload.abort(true)` and DELETE the just-completed
      // file from the v2 endpoint.
      if (settled) return
      settled = true
      detachAbort?.()
      fn()
    }
    const upload = new TusUpload(file, {
      endpoint,
      metadata,
      chunkSize: CHUNK_SIZE,
      retryDelays: [0, 2000, 5000, 10000],
      headers,
      onProgress: (bytesUploaded, bytesTotal) => {
        if (!bytesTotal) return
        onProgress({ bytesUploaded, bytesTotal, percentage: Number(((bytesUploaded / bytesTotal) * 100).toFixed(1)) })
      },
      onAfterResponse: (_req: any, res: any) => {
        // Only the legacy endpoint emits this header. v2 publishing happens
        // via the consumer's `/api/upload/finalize` call afterwards.
        if (useV2) return
        const embedUrl = res.getHeader('X-Embed-URL')
        if (embedUrl) capturedEmbedUrl = embedUrl
      },
      onError: (error: any) => settle(() => reject(signal.aborted ? new Error('Upload aborted') : error)),
      onSuccess: () => {
        if (!upload.url) { settle(() => reject(new Error('3Speak upload completed without an upload URL.'))); return }
        if (useV2) {
          // No embed URL yet — the consumer's finalize call will return
          // the permlink we'd need to build it. Hand back an empty string.
          settle(() => resolve({ embedUrl: '', uploadUrl: upload.url! }))
          return
        }
        if (!capturedEmbedUrl) { settle(() => reject(new Error('3Speak upload completed without required URLs.'))); return }
        settle(() => resolve({ embedUrl: capturedEmbedUrl!, uploadUrl: upload.url! }))
      },
    })
    const handleAbort = () => settle(() => {
      upload.abort(true).catch(() => {})
      reject(new Error('Upload aborted'))
    })
    if (signal.aborted) { handleAbort(); return }
    signal.addEventListener('abort', handleAbort)
    detachAbort = () => signal.removeEventListener('abort', handleAbort)
    upload.findPreviousUploads().then((prev: any[]) => {
      if (settled) return
      if (prev.length > 0) upload.resumeFromPreviousUpload(prev[0])
      upload.start()
    }).catch((err) => settle(() => reject(err)))
  })
}

const VideoUploader: React.FC<VideoUploaderProps> = ({
  onVideoUploaded,
  username,
  ecencyToken,
  onSignMessage,
  threeSpeakApiKey,
  disabled = false,
  allowLandscape = false,
  inline = false,
  isOpen: controlledIsOpen,
  onIsOpenChange,
  onUploadProgress,
  beforeUpload,
  onVideoUploadDetails,
  useThreeSpeakV2 = false,
}) => {
  const apiKey = threeSpeakApiKey || DEFAULT_API_KEY
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadControllerRef = useRef<AbortController | null>(null)

  const [internalIsOpen, setInternalIsOpen] = useState(false)
  // Controlled vs uncontrolled isOpen — when the parent passes `isOpen` we
  // hand off panel visibility to it (so it can hide the panel without
  // tearing down the upload, and reopen it from a top-of-page progress chip).
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen
  const notifyOpen = useCallback(
    (next: boolean) => {
      if (controlledIsOpen === undefined) setInternalIsOpen(next)
      onIsOpenChange?.(next)
    },
    [controlledIsOpen, onIsOpenChange],
  )
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null)
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoAspectRatio, setVideoAspectRatio] = useState('16/9')
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Mirror upload progress out to the parent so it can render a minimized
  // progress bar while the panel is hidden.
  useEffect(() => {
    onUploadProgress?.(isUploading ? uploadProgress : null)
  }, [isUploading, uploadProgress, onUploadProgress])

  useEffect(() => {
    return () => {
      if (uploadControllerRef.current) uploadControllerRef.current.abort()
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    }
  }, [])

  const resetAll = useCallback(() => {
    if (uploadControllerRef.current) { uploadControllerRef.current.abort(); uploadControllerRef.current = null }
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    notifyOpen(false); setSelectedFile(null); setThumbnailDataUrl(null); setThumbnailBlob(null)
    setVideoDuration(0); setVideoAspectRatio('16/9'); setVideoPreviewUrl(null)
    setIsUploading(false); setUploadProgress(null); setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [videoPreviewUrl, notifyOpen])

  // `startUpload` accepts overrides so the file-select handler can kick off
  // the upload immediately after picking a file — without waiting for React
  // to commit `setSelectedFile` / `setThumbnailBlob` state. This is what
  // powers the inline auto-upload path (no manual "Upload Video" click).
  const startUpload = useCallback(async (overrides?: {
    file?: File
    thumbnail?: Blob | null
    duration?: number
    aspectRatio?: string
    /** When true, skip the `beforeUpload` gate. The auto-upload path runs
     *  the gate inline before calling startUpload, so we don't double-prompt. */
    skipGate?: boolean
  }) => {
    const file = overrides?.file ?? selectedFile
    const thumb = overrides?.thumbnail !== undefined ? overrides.thumbnail : thumbnailBlob
    const duration = overrides?.duration ?? videoDuration
    const aspect = overrides?.aspectRatio ?? videoAspectRatio
    if (!file || !username) {
      setError(!username ? 'Please log in to upload videos.' : 'No video selected.')
      // Surface the error by popping the panel back open if it was hidden.
      notifyOpen(true)
      return
    }
    // Run the consumer-provided pre-flight check (e.g. 3Speak posting authority)
    // unless the auto-upload path already cleared it.
    if (!overrides?.skipGate && beforeUpload) {
      try {
        const ok = await beforeUpload()
        if (!ok) {
          // Gate denied — keep file/thumbnail state so the user can retry,
          // but make sure the UI isn't stuck pretending we're uploading.
          setIsUploading(false)
          setUploadProgress(null)
          return
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload preflight failed')
        notifyOpen(true)
        return
      }
    }
    setIsUploading(true); setError(null); setUploadProgress({ bytesUploaded: 0, bytesTotal: file.size, percentage: 0 })
    const controller = new AbortController()
    uploadControllerRef.current = controller

    // v2 mode: generate the upload_id ahead of the TUS upload so we can
    // include it in the metadata AND echo it back to the consumer for
    // `/api/upload/finalize`. Skip the Ecency thumbnail leg — the v2
    // frontend posts the thumbnail to `/api/upload/thumbnail/<videoId>`
    // after finalize, which the consumer does on its own.
    const v2UploadId = useThreeSpeakV2 ? generateUploadId(username) : ''

    try {
      let thumbnailUrlPromise: Promise<string | null> = Promise.resolve(null)
      if (!useThreeSpeakV2 && thumb) {
        const filename = `video-thumbnail-${Date.now()}.jpg`
        thumbnailUrlPromise = (async () => {
          if (ecencyToken) {
            try { return await uploadThumbnailToEcency(thumb, ecencyToken) } catch { /* fallthrough */ }
          }
          if (onSignMessage && username) {
            try { return await uploadToHiveImages(onSignMessage, username, thumb, filename) } catch { /* fallthrough */ }
          }
          return null
        })()
      }
      const result = await uploadVideoToThreeSpeak(
        file, username, duration, apiKey,
        (p) => setUploadProgress(p),
        controller.signal,
        useThreeSpeakV2 ? { useV2: true, uploadId: v2UploadId } : undefined,
      )
      // Legacy flow only: post-process the thumbnail association. Skipped
      // for v2 since the consumer handles the thumbnail upload itself.
      if (!useThreeSpeakV2) {
        const thumbnailUrl = await thumbnailUrlPromise
        if (thumbnailUrl && result.embedUrl) {
          const permlink = extractPermlinkFromEmbedUrl(result.embedUrl)
          if (permlink) await setThumbnailOn3Speak(permlink, thumbnailUrl, apiKey)
        }
      }
      // Surface the full 3Speak metadata BEFORE `resetAll()` clears local
      // state — consumers that publish via 3Speak Studio (legacy or v2)
      // need every field (filename, originalFilename, fileSize,
      // videoDuration, thumbnailBlob, plus uploadId for v2).
      if (onVideoUploadDetails) {
        const tusFilename = result.uploadUrl.replace(/^https?:\/\/[^/]+\/(?:uploads\/|files\/)/, '')
        onVideoUploadDetails({
          filename: tusFilename,
          originalFilename: file.name,
          fileSize: file.size,
          videoDuration: duration,
          aspectRatio: aspect,
          embedUrl: result.embedUrl,
          uploadUrl: result.uploadUrl,
          thumbnailBlob: thumb ?? null,
          uploadId: v2UploadId,
          isV2: useThreeSpeakV2,
        })
      }
      onVideoUploaded(result.embedUrl, result.uploadUrl, aspect, file)
      resetAll()
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Failed to upload video.')
        // On failure, make sure the user can see the error.
        notifyOpen(true)
      }
    } finally {
      setIsUploading(false); uploadControllerRef.current = null
    }
  }, [selectedFile, thumbnailBlob, videoDuration, videoAspectRatio, username, ecencyToken, onSignMessage, apiKey, onVideoUploaded, onVideoUploadDetails, resetAll, notifyOpen, beforeUpload, useThreeSpeakV2])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    // Validation up front so we can pop the panel open with the message
    // when something is wrong, but stay silent when everything checks out.
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file (MP4, MOV, WebM, etc.)'); notifyOpen(true); return
    }
    if (file.size > MAX_VIDEO_SIZE) {
      setError(`Video file is too large (${formatFileSize(file.size)}). Maximum is 100 MB.`); notifyOpen(true); return
    }
    setError(null); setSelectedFile(file); setVideoPreviewUrl(URL.createObjectURL(file))

    let resolvedDuration = 0
    let resolvedAspect = '9/16'
    let resolvedThumbBlob: Blob | null = null
    try {
      const info = await getVideoInfo(file)
      resolvedDuration = info.duration
      resolvedAspect = info.width && info.height ? `${info.width}/${info.height}` : '9/16'
      setVideoDuration(resolvedDuration)
      setVideoAspectRatio(resolvedAspect)
      if (!allowLandscape && info.width && info.height && info.width > info.height) {
        setError(`Only portrait (vertical) videos are allowed. Your video is ${info.width}×${info.height} (landscape). Please record or crop in portrait mode.`)
        notifyOpen(true)
        return
      }
      if (info.duration > MAX_DURATION_SECONDS) {
        setError(`Video is too long (${formatDuration(info.duration)}). Maximum is ${formatDuration(MAX_DURATION_SECONDS)}.`)
        notifyOpen(true)
        return
      }
      const thumb = await generateThumbnail(file)
      resolvedThumbBlob = thumb.blob
      setThumbnailDataUrl(thumb.dataUrl)
      setThumbnailBlob(thumb.blob)
    } catch {
      console.warn('Failed to generate thumbnail')
    }

    // Inline mode: start uploading immediately so the user only sees the
    // top-of-editor progress chip — no preview/confirm step. Modal mode
    // keeps the existing flow (the user reviews the thumbnail and clicks
    // "Upload Video" inside the dialog).
    if (inline) {
      // Run the pre-flight gate (e.g. 3Speak authority check) first. The
      // consumer's modal may take a few seconds to resolve while the user
      // signs an `account_update` — keep the panel hidden so nothing
      // overlaps the modal, and skip the gate inside `startUpload` since
      // we already evaluated it here.
      if (beforeUpload) {
        try {
          const ok = await beforeUpload()
          if (!ok) {
            // User cancelled or denied authority — clear the staged file so
            // the next click re-opens the picker fresh.
            removeFile()
            return
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Upload preflight failed')
          notifyOpen(true)
          return
        }
      }
      notifyOpen(false)
      void startUpload({
        file,
        thumbnail: resolvedThumbBlob,
        duration: resolvedDuration,
        aspectRatio: resolvedAspect,
        skipGate: true,
      })
    }
  }

  const cancelUpload = () => {
    if (uploadControllerRef.current) { uploadControllerRef.current.abort(); uploadControllerRef.current = null }
    setIsUploading(false); setUploadProgress(null)
  }

  const removeFile = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    setSelectedFile(null); setThumbnailDataUrl(null); setThumbnailBlob(null); setVideoDuration(0); setVideoPreviewUrl(null); setError(null); setUploadProgress(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="relative">
      <input ref={fileInputRef} type="file" accept={ACCEPTED_VIDEO_TYPES} onChange={handleFileSelect} className="hidden" disabled={disabled || isUploading} />

      <button
        type="button"
        onClick={() => {
          if (disabled) return
          // While an upload is in flight the toolbar button re-opens the
          // panel rather than starting over — gives the user a way to
          // come back to the upload after they minimized the floating card.
          if (isUploading) {
            notifyOpen(true)
            return
          }
          setError(null)
          // In inline mode we skip opening the panel up front: clicking the
          // button just opens the OS file picker, and `handleFileSelect`
          // kicks off the upload directly. The panel only appears if
          // validation fails (so the error is visible) or if the user
          // reopens it from the top-of-editor progress chip.
          if (!inline) notifyOpen(true)
          fileInputRef.current?.click()
        }}
        disabled={disabled}
        className="p-2 rounded-lg hover:bg-[var(--hrk-bg-surface-raised)] text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-text-primary)] transition-colors disabled:opacity-50"
        title={isUploading ? 'View upload progress' : 'Upload Video'}
      >
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
      </button>

      {isOpen && selectedFile && (
        // The two render modes share the same panel markup; only the
        // outer-wrapper classes differ so behind-the-scenes there's just
        // one upload state machine. `inline` mode positions the card in
        // the bottom-right (mobile: bottom-stretched) and skips the
        // full-screen backdrop, so the user can keep editing the body /
        // toolbar / tags while the TUS upload runs in the background.
        <div
          className={
            inline
              ? 'fixed inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-4 sm:right-4 z-30 sm:max-w-md'
              : 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4'
          }
        >
          <div
            className={
              inline
                ? 'w-full rounded-xl border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-app)] shadow-2xl'
                : 'w-full max-w-lg rounded-xl border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-app)] shadow-2xl'
            }
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hrk-border-subtle)]">
              <h3 className="text-sm sm:text-base font-semibold text-white">
                {isUploading ? 'Uploading video…' : 'Upload Video'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  // In inline mode while an upload is in flight, the X
                  // button just *minimizes* the panel — the upload keeps
                  // running and the parent surfaces a top-of-editor progress
                  // chip the user can click to reopen this card. The
                  // explicit "Cancel" button inside the body is the only
                  // way to abort an upload in flight.
                  if (inline && isUploading) {
                    notifyOpen(false)
                  } else {
                    resetAll()
                  }
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--hrk-text-tertiary)] hover:bg-[var(--hrk-bg-surface)] hover:text-[var(--hrk-text-primary)]"
                title={inline && isUploading ? 'Minimize (upload continues)' : 'Close'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              {error && <div className="mb-3 rounded-lg border border-[var(--hrk-danger)]/40 bg-[var(--hrk-danger-soft)] px-3 py-2 text-sm text-[var(--hrk-danger)]">{error}</div>}
              <div className="flex gap-3 mb-4">
                <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)]">
                  {thumbnailDataUrl ? <img src={thumbnailDataUrl} alt="Thumbnail" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Video className="h-7 w-7 text-[var(--hrk-text-tertiary)]" /></div>}
                  {!isUploading && !error && <div className="absolute inset-0 flex items-center justify-center bg-black/30"><Play className="h-5 w-5 text-white ml-0.5" /></div>}
                </div>
                <div className="flex flex-col justify-center min-w-0">
                  <p className="text-sm font-medium text-white truncate">{selectedFile.name}</p>
                  <p className="text-xs text-[var(--hrk-text-tertiary)] mt-0.5">{formatFileSize(selectedFile.size)}{videoDuration > 0 && ` · ${formatDuration(videoDuration)}`}</p>
                </div>
              </div>

              {/* In inline mode we hide the local <video> preview while idle —
                  it eats vertical space and the body editor is what the user
                  wants to look at. The thumbnail above is enough confirmation. */}
              {!inline && videoPreviewUrl && !isUploading && (
                <div className="mb-4 overflow-hidden rounded-lg bg-black" style={{ maxHeight: '280px' }}>
                  <video src={videoPreviewUrl} controls playsInline preload="metadata" className="w-full" style={{ maxHeight: '280px' }} />
                </div>
              )}

              {isUploading && uploadProgress && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-[var(--hrk-text-tertiary)]">Uploading…</span>
                    <span className="text-xs font-medium text-white">{uploadProgress.percentage.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--hrk-bg-surface-raised)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--hrk-info)] transition-all duration-300" style={{ width: `${uploadProgress.percentage}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--hrk-text-tertiary)]">{formatFileSize(uploadProgress.bytesUploaded)} / {formatFileSize(uploadProgress.bytesTotal)}</p>
                </div>
              )}

              <div className="flex gap-2">
                {isUploading ? (
                  <button type="button" onClick={cancelUpload} className="flex-1 rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--hrk-bg-surface-raised)]">Cancel</button>
                ) : (
                  <>
                    <button type="button" onClick={removeFile} className="flex items-center justify-center gap-1.5 flex-1 rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--hrk-bg-surface-raised)]">
                      <Trash2 className="h-3.5 w-3.5" />Remove
                    </button>
                    <button type="button" onClick={() => void startUpload()} disabled={!!error} className="flex-1 rounded-lg bg-[var(--hrk-brand)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--hrk-brand-hover)] disabled:opacity-50">Upload Video</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoUploader
