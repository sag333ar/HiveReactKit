/**
 * Signed upload to https://images.hive.blog via a caller-provided signer.
 *
 * The consumer passes a `signMessage` callback that wraps their auth provider
 * (Aioha, Hive Keychain, a custom WIF signer, etc.). The callback must sign
 * the given message with the user's posting key and return the signature string.
 *
 * The message format is the JSON-stringified Node Buffer shape
 * (`{"type":"Buffer","data":[...]}`) of `Buffer.concat(["ImageSigningChallenge", imageBytes])`.
 * Hive Keychain reconstructs this shape server-side before hashing, which matches
 * what images.hive.blog expects.
 */

export type PostingSignMessageFn = (message: string) => Promise<string>

/** Build the JSON-stringified Buffer that Hive Keychain / images.hive.blog expects. */
async function buildSigningMessage(file: Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const imageBytes = new Uint8Array(arrayBuffer)
  const prefix = new TextEncoder().encode('ImageSigningChallenge')

  const combined = new Uint8Array(prefix.length + imageBytes.length)
  combined.set(prefix)
  combined.set(imageBytes, prefix.length)

  // Buffer.prototype.toJSON() shape — Keychain detects this and reconstructs the binary before hashing.
  return JSON.stringify({ type: 'Buffer', data: Array.from(combined) })
}

export interface UploadToHiveImagesOptions {
  /** Fires immediately before the caller's signMessage runs (wallet approval begins). */
  onSignStart?: () => void
  /** Fires after signMessage resolves/rejects (wallet approval ended). */
  onSignEnd?: () => void
  /** Abort signal — aborts the upload fetch (the wallet sign step itself can't be cancelled). */
  signal?: AbortSignal
}

export async function uploadToHiveImages(
  signMessage: PostingSignMessageFn,
  username: string,
  file: Blob,
  filename?: string,
  options?: UploadToHiveImagesOptions,
): Promise<string> {
  if (!username) throw new Error('Hive username is required for image upload')

  const message = await buildSigningMessage(file)

  options?.onSignStart?.()
  let signature: string
  try {
    signature = await signMessage(message)
  } finally {
    options?.onSignEnd?.()
  }
  if (!signature) throw new Error('Image signing returned empty signature')

  const formData = new FormData()
  if (filename) formData.append('file', file, filename)
  else formData.append('file', file)

  const response = await fetch(`https://images.hive.blog/${username}/${signature}`, {
    method: 'POST',
    body: formData,
    signal: options?.signal,
  })
  if (!response.ok) {
    throw new Error(`Hive image upload failed: ${response.statusText}`)
  }
  const data = (await response.json()) as { url?: string }
  if (!data.url) throw new Error('No URL returned from Hive image upload')
  return data.url
}

/**
 * POST a blob to Ecency's hosted image service. No wallet signing — the
 * `ecencyToken` is the auth handle Ecency issues after Hive Signer login,
 * so the call returns instantly with a public URL.
 */
export async function uploadToEcencyImages(
  ecencyToken: string,
  file: Blob,
  signal?: AbortSignal,
): Promise<string> {
  if (!ecencyToken) throw new Error('Ecency token not provided')
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`https://images.ecency.com/hs/${ecencyToken}`, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/plain, */*',
      origin: 'https://ecency.com',
      referer: 'https://ecency.com/',
    },
    body: formData,
    signal,
  })
  if (!response.ok) throw new Error(`Ecency upload failed: ${response.statusText}`)
  const data = (await response.json()) as { url?: string }
  if (!data.url) throw new Error('No URL returned from Ecency upload')
  return data.url
}

/**
 * POST a file to ThreeSpeak's image upload endpoint (encoder.hivesuite.app).
 * Requires user JWT authorization.
 */
export async function uploadToThreeSpeakImages(
  token: string,
  file: Blob,
  filename?: string,
  options?: { signal?: AbortSignal; encoderUrl?: string },
): Promise<string> {
  if (!token) throw new Error('JWT token is required for ThreeSpeak image upload')
  const baseUrl = (options?.encoderUrl || 'https://encoder.hivesuite.app').replace(/\/$/, '')
  const formData = new FormData()
  if (filename) formData.append('file', file, filename)
  else formData.append('file', file)

  const response = await fetch(`${baseUrl}/upload/image`, {
    method: 'POST',
    headers: {
      Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
    },
    body: formData,
    signal: options?.signal,
  })

  if (!response.ok) {
    let errMsg = `ThreeSpeak image upload failed: ${response.statusText}`
    try {
      const errData = (await response.json()) as { error?: string; message?: string }
      if (errData?.error) errMsg = errData.error
      else if (errData?.message) errMsg = errData.message
    } catch {
      /* ignore JSON parse error */
    }
    throw new Error(errMsg)
  }

  const data = (await response.json()) as { url?: string; link?: string; image?: string }
  let url = data.url || data.link || data.image
  if (!url) throw new Error('No URL returned from ThreeSpeak image upload')

  if (url.startsWith('ipfs://')) {
    const cid = url.replace(/^ipfs:\/\//, '')
    url = `https://ipfs.3speak.tv/ipfs/${cid}`
  } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://ipfs.3speak.tv/ipfs/${url}`
  }

  return url
}

export interface UploadImageWithFallbackOptions {
  /** ThreeSpeak user JWT token — tried first (default). */
  threeSpeakToken?: string
  /** Encoder base URL (defaults to https://encoder.hivesuite.app). */
  encoderUrl?: string
  /** Ecency token — tried as final fallback. */
  ecencyToken?: string
  /** Signer for the signed `images.hive.blog` fallback (tried second). */
  onSignMessage?: PostingSignMessageFn
  /** Hive username used for the signed `images.hive.blog` fallback. */
  signingUsername?: string
  /** Filename to send with the multipart body. */
  filename?: string
  /** Abort signal applied to upload requests. */
  signal?: AbortSignal
  /** Mirrors `UploadToHiveImagesOptions` — fires while the wallet sign
   *  step is in flight on the fallback path so the caller can flash the
   *  "Open Keychain App & Approve" UX. */
  onSignStart?: () => void
  onSignEnd?: () => void
}

/**
 * Shared image upload helper with fallback support:
 *   1. Try ThreeSpeak (encoder.hivesuite.app) first (default).
 *   2. If that fails (or no token), try Hive image proxy (images.hive.blog).
 *   3. If that fails (or no signer), try Ecency uploader (images.ecency.com).
 *   4. If all fail -> throw.
 *
 * Returns the public URL of the uploaded image.
 */
export async function uploadImageWithFallback(
  file: Blob,
  options: UploadImageWithFallbackOptions,
): Promise<string> {
  const { threeSpeakToken, encoderUrl, ecencyToken, onSignMessage, signingUsername, filename, signal } = options
  const canThreeSpeak = Boolean(threeSpeakToken)
  const canHiveFallback = Boolean(onSignMessage && signingUsername)
  const canEcencyFallback = Boolean(ecencyToken)

  if (!canThreeSpeak && !canHiveFallback && !canEcencyFallback) {
    throw new Error('No upload method configured')
  }

  // 1. ThreeSpeak (default)
  if (canThreeSpeak) {
    try {
      return await uploadToThreeSpeakImages(threeSpeakToken!, file, filename, { signal, encoderUrl })
    } catch (threeSpeakErr) {
      if (signal?.aborted) throw threeSpeakErr
      if (!canHiveFallback && !canEcencyFallback) throw threeSpeakErr
      console.warn('[uploadImageWithFallback] ThreeSpeak upload failed, falling back to Hive image proxy:', threeSpeakErr)
    }
  }

  // 2. Hive's image proxy (fallback 1)
  if (canHiveFallback) {
    try {
      return await uploadToHiveImages(onSignMessage!, signingUsername!, file, filename, {
        onSignStart: options.onSignStart,
        onSignEnd: options.onSignEnd,
        signal,
      })
    } catch (hiveErr) {
      if (signal?.aborted) throw hiveErr
      if (!canEcencyFallback) throw hiveErr
      console.warn('[uploadImageWithFallback] Hive image proxy upload failed, falling back to Ecency uploader:', hiveErr)
    }
  }

  // 3. Ecency uploader (fallback 2)
  if (canEcencyFallback) {
    return await uploadToEcencyImages(ecencyToken!, file, signal)
  }

  throw new Error('All image upload methods failed')
}
