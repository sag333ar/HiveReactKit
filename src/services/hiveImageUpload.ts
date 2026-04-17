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

export async function uploadToHiveImages(
  signMessage: PostingSignMessageFn,
  username: string,
  file: Blob,
  filename?: string,
): Promise<string> {
  if (!username) throw new Error('Hive username is required for image upload')

  const message = await buildSigningMessage(file)
  const signature = await signMessage(message)
  if (!signature) throw new Error('Image signing returned empty signature')

  const formData = new FormData()
  if (filename) formData.append('file', file, filename)
  else formData.append('file', file)

  const response = await fetch(`https://images.hive.blog/${username}/${signature}`, {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    throw new Error(`Hive image upload failed: ${response.statusText}`)
  }
  const data = (await response.json()) as { url?: string }
  if (!data.url) throw new Error('No URL returned from Hive image upload')
  return data.url
}
