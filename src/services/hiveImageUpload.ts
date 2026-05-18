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

export interface UploadImageWithFallbackOptions {
  /** Ecency token — when present, the fast no-signing path is tried first. */
  ecencyToken?: string
  /** Signer for the signed `images.hive.blog` fallback. */
  onSignMessage?: PostingSignMessageFn
  /** Hive username used for the signed `images.hive.blog` fallback. */
  signingUsername?: string
  /** Filename to send with the multipart body on the hive.blog fallback. */
  filename?: string
  /** Abort signal applied to both upload requests. */
  signal?: AbortSignal
  /** Mirrors `UploadToHiveImagesOptions` — fires while the wallet sign
   *  step is in flight on the fallback path so the caller can flash the
   *  "Open Keychain App & Approve" UX. */
  onSignStart?: () => void
  onSignEnd?: () => void
}

/**
 * Shared "try Ecency first, then images.hive.blog as a signed fallback"
 * helper. Used by `ImageUploader` and `MemePicker` so the same code path
 * handles every meme + image upload across the composer.
 *
 *   • If `ecencyToken` is set → POST to images.ecency.com (no signing).
 *   • If that fails (or no token), and a signer + username are
 *     available → sign + POST to images.hive.blog.
 *   • If neither path works → throw.
 *
 * Returns the public URL of the uploaded image.
 */
export async function uploadImageWithFallback(
  file: Blob,
  options: UploadImageWithFallbackOptions,
): Promise<string> {
  const { ecencyToken, onSignMessage, signingUsername, filename, signal } = options
  const canHiveFallback = Boolean(onSignMessage && signingUsername)
  if (!ecencyToken && !canHiveFallback) {
    throw new Error('No upload method configured')
  }
  if (ecencyToken) {
    try {
      return await uploadToEcencyImages(ecencyToken, file, signal)
    } catch (ecencyErr) {
      if (signal?.aborted) throw ecencyErr
      if (!canHiveFallback) throw ecencyErr
      // Fall through to the signed fallback below.
    }
  }
  return uploadToHiveImages(onSignMessage!, signingUsername!, file, filename, {
    onSignStart: options.onSignStart,
    onSignEnd: options.onSignEnd,
    signal,
  })
}
