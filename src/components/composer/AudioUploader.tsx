import React, { useRef, useState, useCallback, useEffect } from 'react'
import { Music, Mic, Upload, X, Loader2, Play, Square, Trash2, RotateCcw, Pause } from 'lucide-react'

export interface AudioUploaderProps {
  /** Called with the audio embed URL and duration in seconds */
  onAudioUploaded: (audioUrl: string, durationSeconds: number) => void
  /** Hive username for the upload */
  username?: string
  /** 3Speak API key. Falls back to demo key if not provided. */
  threeSpeakApiKey?: string
  disabled?: boolean
}

const AUDIO_API_ENDPOINT = 'https://audio.3speak.tv'
const DEFAULT_API_KEY = 'sk_demo_b0d3f4b972c5065b701394df3de2f44fd59aa3244c58c478'
const ACCEPTED_AUDIO_TYPES = '.mp3,.wav,.ogg,.m4a,.aac,.flac,.weba,.opus,audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/flac,audio/webm,audio/opus'
const MAX_FILE_SIZE = 50 * 1024 * 1024
const MAX_RECORD_SECONDS = 300

type ModalView = 'pick' | 'record' | 'gallery-preview'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function getAudioDuration(file: File | Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    audio.addEventListener('loadedmetadata', () => {
      const d = audio.duration
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(d) ? Math.round(d) : 0)
    })
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      resolve(0)
    })
    audio.src = url
  })
}

const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|aac|flac|weba|opus)$/i

function isAudioFileExtension(name: string): boolean {
  return AUDIO_EXTENSIONS.test(name)
}

function getFileFormat(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? 'm4a'
}

function generateAudioEmbedUrl(permlink: string): string {
  return `${AUDIO_API_ENDPOINT}/play?a=${permlink}&mode=minimal&iframe=1`
}

function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

const AudioUploader: React.FC<AudioUploaderProps> = ({ onAudioUploaded, username, threeSpeakApiKey, disabled = false }) => {
  const apiKey = threeSpeakApiKey || DEFAULT_API_KEY
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null)

  const [modalView, setModalView] = useState<ModalView | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const [galleryFile, setGalleryFile] = useState<File | null>(null)
  const [galleryPreviewUrl, setGalleryPreviewUrl] = useState<string | null>(null)
  const [galleryFileName, setGalleryFileName] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (recordedUrl) URL.revokeObjectURL(recordedUrl)
      if (galleryPreviewUrl) URL.revokeObjectURL(galleryPreviewUrl)
      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause()
        playbackAudioRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (isRecording && recordSeconds >= MAX_RECORD_SECONDS) {
      stopRecording()
    }
  }, [isRecording, recordSeconds])

  const resetAll = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    if (galleryPreviewUrl) URL.revokeObjectURL(galleryPreviewUrl)
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause()
      playbackAudioRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null
    chunksRef.current = []
    setModalView(null)
    setIsUploading(false)
    setError(null)
    setIsRecording(false)
    setRecordSeconds(0)
    setRecordedBlob(null)
    setRecordedUrl(null)
    setIsPlaying(false)
    setGalleryFile(null)
    setGalleryPreviewUrl(null)
    setGalleryFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [recordedUrl, galleryPreviewUrl])

  const startRecording = async () => {
    setError(null)
    setRecordedBlob(null)
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    setRecordedUrl(null)
    setRecordSeconds(0)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        const url = URL.createObjectURL(blob)
        setRecordedBlob(blob)
        setRecordedUrl(url)
        setIsRecording(false)
        if (timerRef.current) clearInterval(timerRef.current)
      }

      recorder.start(100)
      setIsRecording(true)

      timerRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1)
      }, 1000)
    } catch {
      setError('Microphone access denied. Please allow microphone permission.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  const deleteRecording = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause()
      playbackAudioRef.current = null
    }
    setRecordedBlob(null)
    setRecordedUrl(null)
    setRecordSeconds(0)
    setIsPlaying(false)
    setError(null)
  }

  const togglePlayback = () => {
    if (!recordedUrl) return
    if (isPlaying && playbackAudioRef.current) {
      playbackAudioRef.current.pause()
      setIsPlaying(false)
      return
    }
    const audio = new Audio(recordedUrl)
    playbackAudioRef.current = audio
    audio.onended = () => setIsPlaying(false)
    audio.play()
    setIsPlaying(true)
  }

  const uploadRecording = async () => {
    if (!recordedBlob) return
    const file = new File([recordedBlob], `recording-${Date.now()}.webm`, { type: recordedBlob.type })
    await uploadAudio(file, recordSeconds)
  }

  const handleGallerySelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.type.startsWith('video/')) {
      setError('Video files are not allowed. Please select an audio file.')
      return
    }
    if (!file.type.startsWith('audio/') && !isAudioFileExtension(file.name)) {
      setError('Please select an audio file (MP3, WAV, OGG, M4A, etc.)')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be less than 50MB')
      return
    }
    setError(null)
    setGalleryFile(file)
    setGalleryFileName(file.name)
    setGalleryPreviewUrl(URL.createObjectURL(file))
    setModalView('gallery-preview')
  }

  const uploadGalleryFile = async () => {
    if (!galleryFile) return
    const duration = await getAudioDuration(galleryFile)
    await uploadAudio(galleryFile, duration)
  }

  const removeGalleryFile = () => {
    if (galleryPreviewUrl) URL.revokeObjectURL(galleryPreviewUrl)
    setGalleryFile(null)
    setGalleryPreviewUrl(null)
    setGalleryFileName(null)
    setError(null)
    setModalView('pick')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadAudio = async (file: File | Blob, durationSeconds: number) => {
    setIsUploading(true)
    setError(null)
    try {
      if (!username) throw new Error('Please log in to upload audio.')
      const format = file instanceof File ? getFileFormat(file.name) : 'webm'
      const formData = new FormData()
      formData.append('audio', file)
      formData.append('duration', String(durationSeconds))
      formData.append('format', format)
      formData.append('title', `Audio by ${username}`)

      const response = await fetch(`${AUDIO_API_ENDPOINT}/api/audio/upload`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey, 'X-User': username },
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        throw new Error(errData?.message ?? errData?.error ?? `Upload failed: ${response.statusText}`)
      }

      const data = (await response.json()) as { permlink?: string; cid?: string; playUrl?: string; error?: string }
      if (data.error) throw new Error(data.error)

      let audioEmbedUrl: string
      if (data.permlink) audioEmbedUrl = generateAudioEmbedUrl(data.permlink)
      else if (data.playUrl) audioEmbedUrl = data.playUrl
      else if (data.cid) audioEmbedUrl = `${AUDIO_API_ENDPOINT}/play?cid=${data.cid}&mode=minimal&iframe=1`
      else throw new Error('No audio URL returned from upload')

      onAudioUploaded(audioEmbedUrl, durationSeconds)
      resetAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload audio')
    } finally {
      setIsUploading(false)
    }
  }

  const progressPercent = (recordSeconds / MAX_RECORD_SECONDS) * 100

  return (
    <div className="relative">
      <input ref={fileInputRef} type="file" accept={ACCEPTED_AUDIO_TYPES} onChange={handleGallerySelect} className="hidden" disabled={disabled || isUploading} />

      <button
        type="button"
        onClick={() => !disabled && !isUploading && setModalView('pick')}
        disabled={disabled || isUploading}
        className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        title="Add Audio"
      >
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music className="h-4 w-4" />}
      </button>

      {modalView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <h3 className="text-base font-semibold text-white">
                {modalView === 'pick' && 'Add Audio'}
                {modalView === 'record' && 'Record Audio'}
                {modalView === 'gallery-preview' && 'Upload Audio'}
              </h3>
              <button type="button" onClick={resetAll} disabled={isUploading} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-50">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4">
              {error && <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>}

              {modalView === 'pick' && (
                <div className="flex flex-col gap-3">
                  <button type="button" onClick={() => { setError(null); setModalView('record') }} className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800 px-4 py-4 text-left transition-colors hover:border-blue-500/40 hover:bg-gray-800/80">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
                      <Mic className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Record Audio</p>
                      <p className="text-xs text-gray-400">Record up to 5 minutes from your microphone</p>
                    </div>
                  </button>
                  <button type="button" onClick={() => { setError(null); fileInputRef.current?.click() }} className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800 px-4 py-4 text-left transition-colors hover:border-blue-500/40 hover:bg-gray-800/80">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                      <Upload className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Upload from Gallery</p>
                      <p className="text-xs text-gray-400">Select an audio file (MP3, WAV, OGG, etc.)</p>
                    </div>
                  </button>
                  <p className="text-center text-xs text-gray-500">Max 50 MB per audio file</p>
                </div>
              )}

              {modalView === 'record' && (
                <div className="flex flex-col items-center gap-4">
                  <div className="text-center">
                    <p className={`text-3xl font-mono font-semibold tabular-nums ${isRecording ? 'text-red-400' : 'text-white'}`}>{formatTime(recordSeconds)}</p>
                    <p className="mt-1 text-xs text-gray-400">{isRecording ? 'Recording...' : recordedBlob ? 'Recording complete' : 'Tap to start recording'}</p>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-700 overflow-hidden">
                    <div className="h-full rounded-full bg-red-500 transition-all duration-1000" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
                  </div>
                  <p className="text-xs text-gray-400">Max {formatTime(MAX_RECORD_SECONDS)}</p>

                  {!recordedBlob ? (
                    <div className="flex items-center gap-4">
                      <button type="button" onClick={isRecording ? stopRecording : startRecording} className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95">
                        {isRecording ? <Square className="h-6 w-6 fill-current" /> : <Mic className="h-6 w-6" />}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 w-full">
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={togglePlayback} className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 border border-gray-700 text-white transition-colors hover:bg-gray-700">
                          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                        </button>
                        <button type="button" onClick={deleteRecording} disabled={isUploading} className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 border border-gray-700 text-gray-400 transition-colors hover:bg-gray-700 hover:text-red-400 disabled:opacity-50">
                          <Trash2 className="h-5 w-5" />
                        </button>
                        <button type="button" onClick={() => { deleteRecording(); void startRecording() }} disabled={isUploading} className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 border border-gray-700 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-50">
                          <RotateCcw className="h-5 w-5" />
                        </button>
                      </div>
                      <button type="button" onClick={() => void uploadRecording()} disabled={isUploading} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
                        {isUploading ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Uploading...</span> : 'Upload Recording'}
                      </button>
                    </div>
                  )}

                  {!isRecording && !isUploading && (
                    <button type="button" onClick={() => { deleteRecording(); setModalView('pick') }} className="text-xs text-gray-400 hover:text-white transition-colors">Back to options</button>
                  )}
                </div>
              )}

              {modalView === 'gallery-preview' && (
                <div className="flex flex-col gap-3">
                  {galleryFileName && (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Music className="h-4 w-4 shrink-0 text-blue-400" />
                      <span className="truncate">{galleryFileName}</span>
                    </div>
                  )}
                  {galleryPreviewUrl && <audio src={galleryPreviewUrl} controls className="w-full rounded-lg" preload="metadata" />}
                  <div className="flex gap-2">
                    <button type="button" onClick={removeGalleryFile} disabled={isUploading} className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50">Remove</button>
                    <button type="button" onClick={() => void uploadGalleryFile()} disabled={isUploading} className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
                      {isUploading ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Uploading...</span> : 'Upload'}
                    </button>
                  </div>
                  {!isUploading && <button type="button" onClick={removeGalleryFile} className="text-center text-xs text-gray-400 hover:text-white transition-colors">Back to options</button>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AudioUploader
