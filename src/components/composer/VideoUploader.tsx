import React, { useRef, useState, useCallback, useEffect } from 'react'
import { Video, X, Loader2, Play, Trash2 } from 'lucide-react'
import { uploadToHiveImages, type PostingSignMessageFn } from '../../services/hiveImageUpload'

export interface VideoUploaderProps {
  /** Called with embed URL, upload URL, aspect ratio, and optional local file for preview */
  onVideoUploaded: (videoEmbedUrl: string, uploadUrl: string, aspectRatio: string, localPreviewFile?: File) => void
  /** Hive username for the upload */
  username?: string
  /** Ecency image hosting token for thumbnail upload */
  ecencyToken?: string
  /** Optional signer used when the Ecency thumbnail upload fails. */
  onSignMessage?: PostingSignMessageFn
  /** 3Speak API key. Falls back to demo key if not provided. */
  threeSpeakApiKey?: string
  disabled?: boolean
}

const THREE_SPEAK_UPLOAD_ENDPOINT = 'https://embed.3speak.tv/uploads'
const DEFAULT_API_KEY = 'sk_demo_b0d3f4b972c5065b701394df3de2f44fd59aa3244c58c478'
const MAX_VIDEO_SIZE = 100 * 1024 * 1024
const CHUNK_SIZE = 5 * 1024 * 1024
const ACCEPTED_VIDEO_TYPES = 'video/mp4,video/quicktime,video/webm,video/3gpp,.mp4,.mov,.webm,.3gp'
const MAX_DURATION_SECONDS = 90

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
  file: File, username: string, durationSeconds: number, apiKey: string,
  onProgress: (progress: UploadProgress) => void, signal: AbortSignal
): Promise<{ embedUrl: string; uploadUrl: string }> {
  // Dynamic import so tus-js-client is optional
  const { Upload: TusUpload } = await import('tus-js-client')

  return new Promise((resolve, reject) => {
    let capturedEmbedUrl: string | null = null
    const upload = new TusUpload(file, {
      endpoint: THREE_SPEAK_UPLOAD_ENDPOINT,
      metadata: { filename: file.name, filetype: file.type || 'video/mp4', frontend_app: 'hive-react-kit', owner: username, short: 'true', duration: String(durationSeconds) },
      chunkSize: CHUNK_SIZE,
      retryDelays: [0, 2000, 5000, 10000],
      headers: { 'X-API-Key': apiKey },
      onProgress: (bytesUploaded, bytesTotal) => {
        if (!bytesTotal) return
        onProgress({ bytesUploaded, bytesTotal, percentage: Number(((bytesUploaded / bytesTotal) * 100).toFixed(1)) })
      },
      onAfterResponse: (_req: any, res: any) => {
        const embedUrl = res.getHeader('X-Embed-URL')
        if (embedUrl) capturedEmbedUrl = embedUrl
      },
      onError: (error: any) => reject(signal.aborted ? new Error('Upload aborted') : error),
      onSuccess: () => {
        if (!upload.url || !capturedEmbedUrl) { reject(new Error('3Speak upload completed without required URLs.')); return }
        resolve({ embedUrl: capturedEmbedUrl, uploadUrl: upload.url })
      },
    })
    const handleAbort = () => { upload.abort(true).catch(() => {}); reject(new Error('Upload aborted')) }
    if (signal.aborted) { handleAbort(); return }
    signal.addEventListener('abort', handleAbort)
    upload.findPreviousUploads().then((prev: any[]) => { if (prev.length > 0) upload.resumeFromPreviousUpload(prev[0]); upload.start() }).catch(reject)
  })
}

const VideoUploader: React.FC<VideoUploaderProps> = ({ onVideoUploaded, username, ecencyToken, onSignMessage, threeSpeakApiKey, disabled = false }) => {
  const apiKey = threeSpeakApiKey || DEFAULT_API_KEY
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadControllerRef = useRef<AbortController | null>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null)
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoAspectRatio, setVideoAspectRatio] = useState('16/9')
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (uploadControllerRef.current) uploadControllerRef.current.abort()
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    }
  }, [])

  const resetAll = useCallback(() => {
    if (uploadControllerRef.current) { uploadControllerRef.current.abort(); uploadControllerRef.current = null }
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    setIsOpen(false); setSelectedFile(null); setThumbnailDataUrl(null); setThumbnailBlob(null)
    setVideoDuration(0); setVideoAspectRatio('16/9'); setVideoPreviewUrl(null)
    setIsUploading(false); setUploadProgress(null); setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [videoPreviewUrl])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('video/')) { setError('Please select a video file (MP4, MOV, WebM, etc.)'); return }
    if (file.size > MAX_VIDEO_SIZE) { setError(`Video file is too large (${formatFileSize(file.size)}). Maximum is 100 MB.`); return }
    setError(null); setSelectedFile(file); setVideoPreviewUrl(URL.createObjectURL(file))

    try {
      const info = await getVideoInfo(file)
      setVideoDuration(info.duration)
      setVideoAspectRatio(info.width && info.height ? `${info.width}/${info.height}` : '9/16')
      if (info.width && info.height && info.width > info.height) { setError(`Only portrait (vertical) videos are allowed. Your video is ${info.width}×${info.height} (landscape). Please record or crop in portrait mode.`); return }
      if (info.duration > MAX_DURATION_SECONDS) { setError(`Video is too long (${formatDuration(info.duration)}). Maximum is ${formatDuration(MAX_DURATION_SECONDS)}.`); return }
      const thumb = await generateThumbnail(file)
      setThumbnailDataUrl(thumb.dataUrl); setThumbnailBlob(thumb.blob)
    } catch { console.warn('Failed to generate thumbnail') }
  }

  const startUpload = async () => {
    if (!selectedFile || !username) { setError(!username ? 'Please log in to upload videos.' : 'No video selected.'); return }
    setIsUploading(true); setError(null); setUploadProgress({ bytesUploaded: 0, bytesTotal: selectedFile.size, percentage: 0 })
    const controller = new AbortController()
    uploadControllerRef.current = controller

    try {
      let thumbnailUrlPromise: Promise<string | null> = Promise.resolve(null)
      if (thumbnailBlob) {
        const filename = `video-thumbnail-${Date.now()}.jpg`
        thumbnailUrlPromise = (async () => {
          if (ecencyToken) {
            try { return await uploadThumbnailToEcency(thumbnailBlob, ecencyToken) } catch { /* fallthrough */ }
          }
          if (onSignMessage && username) {
            try { return await uploadToHiveImages(onSignMessage, username, thumbnailBlob, filename) } catch { /* fallthrough */ }
          }
          return null
        })()
      }
      const result = await uploadVideoToThreeSpeak(selectedFile, username, videoDuration, apiKey, (p) => setUploadProgress(p), controller.signal)
      const thumbnailUrl = await thumbnailUrlPromise
      if (thumbnailUrl && result.embedUrl) {
        const permlink = extractPermlinkFromEmbedUrl(result.embedUrl)
        if (permlink) await setThumbnailOn3Speak(permlink, thumbnailUrl, apiKey)
      }
      const localFile = selectedFile
      onVideoUploaded(result.embedUrl, result.uploadUrl, videoAspectRatio, localFile)
      resetAll()
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Failed to upload video.')
    } finally {
      setIsUploading(false); uploadControllerRef.current = null
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

      <button type="button" onClick={() => { if (!disabled && !isUploading) { setError(null); setIsOpen(true); fileInputRef.current?.click() } }} disabled={disabled || isUploading} className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-50" title="Upload Video">
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
      </button>

      {isOpen && selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <h3 className="text-base font-semibold text-white">Upload Video</h3>
              <button type="button" onClick={resetAll} disabled={isUploading} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              {error && <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3 mb-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-800 border border-gray-700">
                  {thumbnailDataUrl ? <img src={thumbnailDataUrl} alt="Thumbnail" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Video className="h-8 w-8 text-gray-500" /></div>}
                  {!isUploading && !error && <div className="absolute inset-0 flex items-center justify-center bg-black/30"><Play className="h-5 w-5 text-white ml-0.5" /></div>}
                </div>
                <div className="flex flex-col justify-center min-w-0">
                  <p className="text-sm font-medium text-white truncate">{selectedFile.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatFileSize(selectedFile.size)}{videoDuration > 0 && ` · ${formatDuration(videoDuration)}`}</p>
                </div>
              </div>

              {videoPreviewUrl && !isUploading && (
                <div className="mb-4 overflow-hidden rounded-lg bg-black" style={{ maxHeight: '280px' }}>
                  <video src={videoPreviewUrl} controls playsInline preload="metadata" className="w-full" style={{ maxHeight: '280px' }} />
                </div>
              )}

              {isUploading && uploadProgress && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-400">Uploading...</span>
                    <span className="text-xs font-medium text-white">{uploadProgress.percentage.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-700 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${uploadProgress.percentage}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{formatFileSize(uploadProgress.bytesUploaded)} / {formatFileSize(uploadProgress.bytesTotal)}</p>
                </div>
              )}

              <div className="flex gap-2">
                {isUploading ? (
                  <button type="button" onClick={cancelUpload} className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700">Cancel</button>
                ) : (
                  <>
                    <button type="button" onClick={removeFile} className="flex items-center justify-center gap-1.5 flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700">
                      <Trash2 className="h-3.5 w-3.5" />Remove
                    </button>
                    <button type="button" onClick={() => void startUpload()} disabled={!!error} className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">Upload Video</button>
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
