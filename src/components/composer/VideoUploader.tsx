import React, { useRef, useState, useCallback, useEffect } from 'react'
import { Video, X, Loader2, Play, Trash2 } from 'lucide-react'
import { uploadToHiveImages, type PostingSignMessageFn } from '../../services/hiveImageUpload'

/** Extra metadata about a completed 3Speak upload — surfaced for consumers
 *  that want to drive the publish step themselves. */
export interface VideoUploadDetails {
  /** Original file name (e.g. `IMG_1234.mp4`). */
  filename: string
  /** The user's original file name. */
  originalFilename: string
  /** File size in bytes. */
  fileSize: number
  /** Video duration in seconds (rounded). */
  videoDuration: number
  /** Aspect ratio string (e.g. `"16/9"` or `"9/16"`). */
  aspectRatio: string
  /** The 3Speak embed URL — `https://play.3speak.tv/embed?v=author/permlink`. */
  embedUrl: string
  /** The upload endpoint URL. */
  uploadUrl: string
  /** Local thumbnail blob (JPEG). */
  thumbnailBlob: Blob | null
  /** Canonical identifier / permlink. */
  uploadId: string
  /** Always `true` for the token-based 3Speak upload process. */
  isV2: boolean
  /** 3Speak asset permlink. */
  permlink?: string
  /** Upload host chosen for this upload. */
  uploadHost?: string
  /** Single-use token minted for this upload. */
  token?: string
}

export interface VideoUploaderProps {
  /** Called with embed URL, upload URL, aspect ratio, and optional local file for preview */
  onVideoUploaded: (videoEmbedUrl: string, uploadUrl: string, aspectRatio: string, localPreviewFile?: File) => void
  /**
   * Called alongside `onVideoUploaded` with the full set of 3Speak-specific
   * metadata. Consumers wiring the 3Speak API need every field to call
   * `/video/:permlink/hive` or post-process assets.
   */
  onVideoUploadDetails?: (details: VideoUploadDetails) => void
  /** Hive username for the upload */
  username?: string
  /** Ecency image hosting token for thumbnail upload */
  ecencyToken?: string
  /** Optional signer used when the Ecency thumbnail upload fails. */
  onSignMessage?: PostingSignMessageFn
  /** 3Speak API key. Falls back to default key if not provided. */
  threeSpeakApiKey?: string
  /** 3Speak upload host(s) — comma-separated URLs or single URL (e.g. 'https://embed.3speak.tv'). */
  threeSpeakUploadHost?: string
  /** 3Speak frontend app name (default: 'snapie-web'). */
  frontendApp?: string
  disabled?: boolean
  /** When true, accept landscape videos too (up to 2GB and 2 hours). Default false — portrait only (<=120s). */
  allowLandscape?: boolean
  /**
   * When true, the upload panel renders as a floating bottom-right card
   * instead of a full-screen backdrop modal. The rest of the page stays
   * interactive so the user can keep editing the post body, tags, etc.
   * while the upload runs in the background. Default `false`.
   */
  inline?: boolean
  /**
   * Open-state controller (controlled mode). When provided, the parent owns
   * panel visibility.
   */
  isOpen?: boolean
  /**
   * Called whenever the panel's open state should change.
   */
  onIsOpenChange?: (open: boolean) => void
  /**
   * Called with the current TUS upload progress, or `null` when no upload
   * is in flight (idle / success / error).
   */
  onUploadProgress?: (
    progress: { percentage: number; bytesUploaded: number; bytesTotal: number } | null,
  ) => void
  /**
   * Optional async gate run after a file is selected and validated, but
   * before the upload starts.
   */
  beforeUpload?: () => Promise<boolean>
  /** Backwards-compatibility flag. */
  useThreeSpeakV2?: boolean
}

export const DEFAULT_UPLOAD_HOST = 'https://embed.3speak.tv'
export const DEFAULT_API_KEY = 'sk_snapie_d199a5af8631c11706930f69cb2fcfceffcb362eb8306b2d'
export const DEFAULT_FRONTEND_APP = 'snapie-web'

const CHUNK_SIZE = 5 * 1024 * 1024
const ACCEPTED_VIDEO_TYPES = 'video/mp4,video/quicktime,video/webm,video/3gpp,.mp4,.mov,.webm,.3gp'

export interface UploadProgress {
  bytesUploaded: number
  bytesTotal: number
  percentage: number
}

export interface MintTokenResponse {
  success: boolean
  token: string
  upload_url: string
  permlink: string
  embed_url: string
  expires_at?: string
  gated?: boolean
  defer_encode?: boolean
  error?: string
}

/**
 * Choose the healthiest upload host from a comma-separated list or single host.
 * Checks `GET /health` and picks the one with the fewest active uploads and freeDiskPct >= 3%.
 */
export async function selectUploadHost(hostsInput?: string): Promise<string> {
  const hosts = (hostsInput || DEFAULT_UPLOAD_HOST)
    .split(',')
    .map((h) => h.trim().replace(/\/$/, ''))
    .filter(Boolean)
  if (hosts.length <= 1) return hosts[0] || DEFAULT_UPLOAD_HOST

  const checks = await Promise.all(
    hosts.map(async (host) => {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 2500)
        const res = await fetch(`${host}/health`, { signal: controller.signal })
        clearTimeout(timeout)
        if (!res.ok) return { host, activeUploads: Infinity, freeDiskPct: 0 }
        const data = await res.json()
        return {
          host,
          activeUploads: typeof data.activeUploads === 'number' ? data.activeUploads : 0,
          freeDiskPct: typeof data.freeDiskPct === 'number' ? data.freeDiskPct : 100,
        }
      } catch {
        return { host, activeUploads: Infinity, freeDiskPct: 0 }
      }
    }),
  )

  const viable = checks.filter((c) => c.freeDiskPct >= 3 && c.activeUploads !== Infinity)
  if (viable.length === 0) return hosts[0]
  viable.sort((a, b) => a.activeUploads - b.activeUploads)
  return viable[0].host
}

/**
 * Mint an upload token via POST /uploads/token on the chosen upload host.
 */
export async function mintUploadToken(options: {
  uploadHost: string
  apiKey: string
  owner: string
  frontendApp?: string
  short?: boolean
  allowedOrigins?: string[]
  deferEncode?: boolean
  signal?: AbortSignal
}): Promise<MintTokenResponse> {
  const {
    uploadHost,
    apiKey,
    owner,
    frontendApp = DEFAULT_FRONTEND_APP,
    short = false,
    allowedOrigins,
    deferEncode = false,
    signal,
  } = options

  const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : ''
  const origins = allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : (origin ? [origin] : [])

  const res = await fetch(`${uploadHost.replace(/\/$/, '')}/uploads/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      owner,
      frontend_app: frontendApp,
      short: Boolean(short),
      allowed_origins: origins,
      defer_encode: Boolean(deferEncode),
    }),
    signal,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    let errMsg = `Failed to get upload token (${res.status})`
    try {
      const parsed = JSON.parse(errText)
      if (parsed.error || parsed.message) errMsg = parsed.error || parsed.message
    } catch {
      if (errText) errMsg += `: ${errText}`
    }
    throw new Error(errMsg)
  }

  const data: MintTokenResponse = await res.json()
  if (!data.token) {
    throw new Error(data.error || 'Server did not return an upload token')
  }
  return data
}

/**
 * Upload video file using TUS protocol with Bearer token authentication.
 * Falls back to POST /upload/simple if TUS fails (e.g. mobile networks blocking PATCH).
 */
export async function uploadVideoWithToken(
  file: File,
  tokenData: MintTokenResponse,
  durationSeconds: number,
  onProgress: (progress: UploadProgress) => void,
  signal: AbortSignal,
): Promise<{ embedUrl: string; uploadUrl: string }> {
  const { Upload: TusUpload } = await import('tus-js-client')

  const endpoint = tokenData.upload_url
  const headers = {
    Authorization: `Bearer ${tokenData.token}`,
  }
  const metadata: Record<string, string> = {
    filename: file.name,
    filetype: file.type || 'video/mp4',
  }

  return new Promise((resolve, reject) => {
    let capturedEmbedUrl: string | null = tokenData.embed_url || null
    let settled = false
    let detachAbort: (() => void) | null = null

    const settle = (fn: () => void) => {
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
        onProgress({
          bytesUploaded,
          bytesTotal,
          percentage: Number(((bytesUploaded / bytesTotal) * 100).toFixed(1)),
        })
      },
      onAfterResponse: (_req: any, res: any) => {
        const embedUrl = res.getHeader('X-Embed-URL')
        if (embedUrl) capturedEmbedUrl = embedUrl
      },
      onError: async (error: any) => {
        if (signal.aborted) {
          settle(() => reject(new Error('Upload aborted')))
          return
        }
        // Fallback to /upload/simple if TUS fails
        try {
          console.warn('[VideoUploader] TUS upload error, attempting /upload/simple fallback:', error)
          const fallbackHost = endpoint.replace(/\/uploads\/?$/, '')
          const formData = new FormData()
          formData.append('token', tokenData.token)
          formData.append('filename', file.name)
          formData.append('duration', String(durationSeconds))
          formData.append('file', file) // Must be last

          const fallbackRes = await fetch(`${fallbackHost}/upload/simple`, {
            method: 'POST',
            body: formData,
            signal,
          })
          if (!fallbackRes.ok) {
            const txt = await fallbackRes.text().catch(() => '')
            throw new Error(`Fallback upload failed: ${txt || fallbackRes.statusText}`)
          }
          const simpleData = await fallbackRes.json().catch(() => ({}))
          const finalEmbed = simpleData.embed_url || capturedEmbedUrl || tokenData.embed_url
          settle(() => resolve({ embedUrl: finalEmbed, uploadUrl: endpoint }))
        } catch (fallbackErr) {
          settle(() => reject(error))
        }
      },
      onSuccess: () => {
        const finalEmbedUrl = capturedEmbedUrl || tokenData.embed_url
        settle(() => resolve({ embedUrl: finalEmbedUrl, uploadUrl: upload.url || endpoint }))
      },
    })

    const handleAbort = () =>
      settle(() => {
        upload.abort(true).catch(() => {})
        reject(new Error('Upload aborted'))
      })

    if (signal.aborted) {
      handleAbort()
      return
    }
    signal.addEventListener('abort', handleAbort)
    detachAbort = () => signal.removeEventListener('abort', handleAbort)

    upload
      .findPreviousUploads()
      .then((prev: any[]) => {
        if (settled) return
        if (prev.length > 0) upload.resumeFromPreviousUpload(prev[0])
        upload.start()
      })
      .catch((err) => settle(() => reject(err)))
  })
}

/** Set custom thumbnail on 3Speak via POST /video/:permlink/thumbnail */
export async function setThumbnailOn3Speak(
  uploadHost: string,
  permlink: string,
  thumbnailUrl: string,
  apiKey: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${uploadHost.replace(/\/$/, '')}/video/${permlink}/thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ thumbnail_url: thumbnailUrl }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Bind 3Speak video asset to a Hive post after broadcasting to Hive.
 * Calls POST /video/:permlink/hive with X-API-Key.
 */
export async function bindVideoToHivePost(
  permlink: string,
  payload: {
    hive_author: string
    hive_permlink: string
    hive_title?: string
    hive_body?: string
    hive_tags?: string[]
  },
  apiKey: string = DEFAULT_API_KEY,
  uploadHost: string = DEFAULT_UPLOAD_HOST,
): Promise<boolean> {
  try {
    const res = await fetch(`${uploadHost.replace(/\/$/, '')}/video/${permlink}/hive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch (err) {
    console.warn('Failed to bind video to Hive post:', err)
    return false
  }
}

/** Extract 3Speak permlink from embed URL or post body */
export function extractThreeSpeakPermlink(textOrUrl: string | null | undefined): string | null {
  if (!textOrUrl) return null
  try {
    const match = textOrUrl.match(/https?:\/\/(?:play|embed)\.3speak\.tv\/(?:watch|embed)\?v=[^/\s]+\/([a-zA-Z0-9_-]+)/)
    if (match) return match[1]
    const paramMatch = textOrUrl.match(/[?&]v=[^/\s&]+\/([a-zA-Z0-9_-]+)/)
    if (paramMatch) return paramMatch[1]
  } catch {
    /* ignore */
  }
  return null
}

/** Fetch public video processing status via GET /video/:permlink */
export async function getThreeSpeakVideoStatus(
  permlink: string,
  uploadHost: string = DEFAULT_UPLOAD_HOST,
): Promise<{ status?: string; encodingProgress?: number; input_cid?: string; manifest_cid?: string; error?: string } | null> {
  try {
    const res = await fetch(`${uploadHost.replace(/\/$/, '')}/video/${permlink}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

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
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.75, video.duration * 0.25)
    }
    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Cannot create canvas context'))
        return
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          if (!blob) {
            reject(new Error('Failed to generate thumbnail'))
            return
          }
          resolve({ blob, dataUrl: canvas.toDataURL('image/jpeg', 0.7) })
        },
        'image/jpeg',
        0.7,
      )
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video'))
    }
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
      resolve({
        duration: Number.isFinite(video.duration) ? Math.round(video.duration) : 0,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
      })
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ duration: 0, width: 0, height: 0 })
    }
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

const VideoUploader: React.FC<VideoUploaderProps> = ({
  onVideoUploaded,
  username,
  ecencyToken,
  onSignMessage,
  threeSpeakApiKey,
  threeSpeakUploadHost,
  frontendApp = DEFAULT_FRONTEND_APP,
  disabled = false,
  allowLandscape = false,
  inline = false,
  isOpen: controlledIsOpen,
  onIsOpenChange,
  onUploadProgress,
  beforeUpload,
  onVideoUploadDetails,
}) => {
  const apiKey = threeSpeakApiKey || DEFAULT_API_KEY
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadControllerRef = useRef<AbortController | null>(null)

  const [internalIsOpen, setInternalIsOpen] = useState(false)
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

  // Maximum constraints based on mode
  const maxFileSize = allowLandscape ? 2048 * 1024 * 1024 : 200 * 1024 * 1024 // 2GB vs 200MB
  const maxDurationSeconds = allowLandscape ? 7200 : 120 // 2 hours vs 120s

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
    if (uploadControllerRef.current) {
      uploadControllerRef.current.abort()
      uploadControllerRef.current = null
    }
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    notifyOpen(false)
    setSelectedFile(null)
    setThumbnailDataUrl(null)
    setThumbnailBlob(null)
    setVideoDuration(0)
    setVideoAspectRatio('16/9')
    setVideoPreviewUrl(null)
    setIsUploading(false)
    setUploadProgress(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [videoPreviewUrl, notifyOpen])

  const startUpload = useCallback(
    async (overrides?: {
      file?: File
      thumbnail?: Blob | null
      duration?: number
      aspectRatio?: string
      skipGate?: boolean
    }) => {
      const file = overrides?.file ?? selectedFile
      const thumb = overrides?.thumbnail !== undefined ? overrides.thumbnail : thumbnailBlob
      const duration = overrides?.duration ?? videoDuration
      const aspect = overrides?.aspectRatio ?? videoAspectRatio
      if (!file || !username) {
        setError(!username ? 'Please log in to upload videos.' : 'No video selected.')
        notifyOpen(true)
        return
      }

      if (!overrides?.skipGate && beforeUpload) {
        try {
          const ok = await beforeUpload()
          if (!ok) {
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

      setIsUploading(true)
      setError(null)
      setUploadProgress({ bytesUploaded: 0, bytesTotal: file.size, percentage: 0 })
      const controller = new AbortController()
      uploadControllerRef.current = controller

      try {
        // 1. Resolve healthiest upload host
        const chosenHost = await selectUploadHost(threeSpeakUploadHost)

        // 2. Mint single-use upload token from upload host
        const isShort = !allowLandscape || duration <= 120
        const tokenData = await mintUploadToken({
          uploadHost: chosenHost,
          apiKey,
          owner: username,
          frontendApp,
          short: isShort,
          signal: controller.signal,
        })

        // 3. Kick off thumbnail upload asynchronously
        let thumbnailUrlPromise: Promise<string | null> = Promise.resolve(null)
        if (thumb) {
          const filename = `video-thumbnail-${Date.now()}.jpg`
          thumbnailUrlPromise = (async () => {
            if (ecencyToken) {
              try {
                return await uploadThumbnailToEcency(thumb, ecencyToken)
              } catch {
                /* fallthrough */
              }
            }
            if (onSignMessage && username) {
              try {
                return await uploadToHiveImages(onSignMessage, username, thumb, filename)
              } catch {
                /* fallthrough */
              }
            }
            return null
          })()
        }

        // 4. Perform fast TUS upload
        const result = await uploadVideoWithToken(
          file,
          tokenData,
          duration,
          (p) => setUploadProgress(p),
          controller.signal,
        )

        // 5. Attach thumbnail if available
        const thumbnailUrl = await thumbnailUrlPromise
        if (thumbnailUrl && tokenData.permlink) {
          await setThumbnailOn3Speak(chosenHost, tokenData.permlink, thumbnailUrl, apiKey)
        }

        // 6. Surface full details to consumer
        if (onVideoUploadDetails) {
          onVideoUploadDetails({
            filename: file.name,
            originalFilename: file.name,
            fileSize: file.size,
            videoDuration: duration,
            aspectRatio: aspect,
            embedUrl: result.embedUrl,
            uploadUrl: result.uploadUrl,
            thumbnailBlob: thumb ?? null,
            uploadId: tokenData.permlink,
            isV2: true,
            permlink: tokenData.permlink,
            uploadHost: chosenHost,
            token: tokenData.token,
          })
        }

        onVideoUploaded(result.embedUrl, result.uploadUrl, aspect, file)
        resetAll()
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to upload video.')
          notifyOpen(true)
        }
      } finally {
        setIsUploading(false)
        uploadControllerRef.current = null
      }
    },
    [
      selectedFile,
      thumbnailBlob,
      videoDuration,
      videoAspectRatio,
      username,
      ecencyToken,
      onSignMessage,
      apiKey,
      threeSpeakUploadHost,
      frontendApp,
      allowLandscape,
      onVideoUploaded,
      onVideoUploadDetails,
      resetAll,
      notifyOpen,
      beforeUpload,
    ],
  )

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('video/')) {
      setError('Please select a video file (MP4, MOV, WebM, etc.)')
      notifyOpen(true)
      return
    }
    if (file.size > maxFileSize) {
      setError(`Video file is too large (${formatFileSize(file.size)}). Maximum is ${formatFileSize(maxFileSize)}.`)
      notifyOpen(true)
      return
    }

    setError(null)
    setSelectedFile(file)
    setVideoPreviewUrl(URL.createObjectURL(file))

    let resolvedDuration = 0
    let resolvedAspect = '16/9'
    let resolvedThumbBlob: Blob | null = null

    try {
      const info = await getVideoInfo(file)
      resolvedDuration = info.duration
      resolvedAspect = info.width && info.height ? `${info.width}/${info.height}` : '16/9'
      setVideoDuration(resolvedDuration)
      setVideoAspectRatio(resolvedAspect)

      if (!allowLandscape && info.width && info.height && info.width > info.height) {
        setError(
          `Only portrait (vertical) videos are allowed for Snaps. Your video is ${info.width}×${info.height} (landscape). Please record or crop in portrait mode.`,
        )
        notifyOpen(true)
        return
      }

      if (info.duration > maxDurationSeconds) {
        setError(
          `Video is too long (${formatDuration(info.duration)}). Maximum is ${formatDuration(maxDurationSeconds)}.`,
        )
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

    if (inline) {
      if (beforeUpload) {
        try {
          const ok = await beforeUpload()
          if (!ok) {
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
    if (uploadControllerRef.current) {
      uploadControllerRef.current.abort()
      uploadControllerRef.current = null
    }
    setIsUploading(false)
    setUploadProgress(null)
  }

  const removeFile = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    setSelectedFile(null)
    setThumbnailDataUrl(null)
    setThumbnailBlob(null)
    setVideoDuration(0)
    setVideoPreviewUrl(null)
    setError(null)
    setUploadProgress(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_VIDEO_TYPES}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <button
        type="button"
        onClick={() => {
          if (disabled) return
          if (isUploading) {
            notifyOpen(true)
            return
          }
          setError(null)
          if (!inline) notifyOpen(true)
          fileInputRef.current?.click()
        }}
        disabled={disabled}
        className="p-2 rounded-lg hover:bg-[var(--hrk-bg-surface-raised)] text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-text-primary)] transition-colors disabled:opacity-50"
        title={isUploading ? 'View upload progress' : 'Upload Video'}
      >
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin text-[var(--hrk-brand)]" /> : <Video className="h-4 w-4" />}
      </button>

      {isOpen && selectedFile && (
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
              {error && (
                <div className="mb-3 rounded-lg border border-[var(--hrk-danger)]/40 bg-[var(--hrk-danger-soft)] px-3 py-2 text-sm text-[var(--hrk-danger)]">
                  {error}
                </div>
              )}
              <div className="flex gap-3 mb-4">
                <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)]">
                  {thumbnailDataUrl ? (
                    <img src={thumbnailDataUrl} alt="Thumbnail" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Video className="h-7 w-7 text-[var(--hrk-text-tertiary)]" />
                    </div>
                  )}
                  {!isUploading && !error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play className="h-5 w-5 text-white ml-0.5" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-center min-w-0">
                  <p className="text-sm font-medium text-white truncate">{selectedFile.name}</p>
                  <p className="text-xs text-[var(--hrk-text-tertiary)] mt-0.5">
                    {formatFileSize(selectedFile.size)}
                    {videoDuration > 0 && ` · ${formatDuration(videoDuration)}`}
                  </p>
                </div>
              </div>

              {!inline && videoPreviewUrl && !isUploading && (
                <div className="mb-4 overflow-hidden rounded-lg bg-black" style={{ maxHeight: '280px' }}>
                  <video
                    src={videoPreviewUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full"
                    style={{ maxHeight: '280px' }}
                  />
                </div>
              )}

              {isUploading && uploadProgress && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-[var(--hrk-text-tertiary)]">Uploading to 3Speak…</span>
                    <span className="text-xs font-medium text-white">{uploadProgress.percentage.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--hrk-bg-surface-raised)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--hrk-info)] transition-all duration-300"
                      style={{ width: `${uploadProgress.percentage}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[var(--hrk-text-tertiary)]">
                    {formatFileSize(uploadProgress.bytesUploaded)} / {formatFileSize(uploadProgress.bytesTotal)}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                {isUploading ? (
                  <button
                    type="button"
                    onClick={cancelUpload}
                    className="flex-1 rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--hrk-bg-surface-raised)]"
                  >
                    Cancel
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="flex items-center justify-center gap-1.5 flex-1 rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--hrk-bg-surface-raised)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => void startUpload()}
                      disabled={!!error}
                      className="flex-1 rounded-lg bg-[var(--hrk-brand)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--hrk-brand-hover)] disabled:opacity-50"
                    >
                      Upload Video
                    </button>
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
