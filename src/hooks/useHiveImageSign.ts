/**
 * Produces a signMessage callback compatible with PostComposer.onSignMessage
 * for the signed images.hive.blog fallback.
 *
 * The fallback sends a JSON-stringified Node Buffer
 * (`{"type":"Buffer","data":[...]}`) so that Hive Keychain (and a few other
 * wallets) can reconstruct the raw bytes before hashing — matching what
 * images.hive.blog verifies against. Providers that hash the payload as a
 * UTF-8 string instead (e.g. Aioha's custom/plaintext posting-key provider,
 * HiveAuth, HiveSigner) would produce a signature that doesn't verify.
 *
 * This hook branches accordingly:
 *
 * - If the caller's user carries a `privatePostingKey` (plaintext login), the
 *   hook reconstructs the buffer, SHA-256s it, and signs with `@hiveio/dhive`
 *   directly — bypassing the wallet entirely.
 * - If the provider is known to reconstruct the Buffer JSON shape (Keychain,
 *   PeakVault), the hook delegates to `signer.signMessage(...)` and shows a
 *   pulsing `toast.loading(...)` while waiting for wallet approval.
 * - Otherwise (HiveAuth, HiveSigner, Ledger, unknown), it throws with a clear
 *   "not supported" message so the uploader bubbles that up cleanly.
 *
 * Consumers pass their own Aioha instance and user via duck-typed objects,
 * so the kit does not take a hard dependency on aioha/hive-authentication.
 */
import { useCallback } from 'react'
import { PrivateKey } from '@hiveio/dhive'
import type { PostingSignMessageFn } from '../services/hiveImageUpload'

export interface HiveImageSignUser {
  provider?: string | null
  privatePostingKey?: string
}

export interface HiveImageSignSignerResult {
  success: boolean
  result?: string
  error?: string
  errorCode?: number | string
}

export interface HiveImageSignSigner {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signMessage: (message: string, keyType: any) => Promise<HiveImageSignSignerResult>
}

export interface UseHiveImageSignOptions {
  signer?: HiveImageSignSigner | null
  user?: HiveImageSignUser | null
  /** Providers whose signMessage preserves the Buffer-JSON shape. Override to include more. */
  walletSupportedProviders?: Set<string>
}

// Providers whose PKSA/wallet preserves the Buffer-JSON payload shape
// (`{"type":"Buffer","data":[...]}`) before hashing, so images.hive.blog can
// verify the signature.
// - keychain: browser extension — reconstructs and works.
// - peakvault: same family as keychain — reconstructs.
// - hiveauth: relies on the PKSA app (typically Keychain-mobile, which
//   reconstructs). If a user's PKSA doesn't, images.hive.blog will return
//   invalid_signature at runtime and the caller will surface that.
const DEFAULT_WALLET_SUPPORTED = new Set(['keychain', 'peakvault', 'hiveauth'])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stringifySignError(err: any): string {
  if (err == null) return ''
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  if (typeof err === 'object') {
    // Common shapes from Keychain / Aioha: { message }, { error }, { data: { msg } }, nested strings.
    if (typeof err.message === 'string') return err.message
    if (typeof err.error === 'string') return err.error
    if (err.data && typeof err.data.msg === 'string') return err.data.msg
    try { return JSON.stringify(err) } catch { /* fallthrough */ }
  }
  return String(err)
}

/** Map raw Keychain/HiveAuth error strings to user-friendly messages. */
function friendlySignError(raw: string): string {
  const lower = raw.toLowerCase()
  if (
    lower === 'user_cancel' ||
    lower === '[object object]' ||
    lower.includes('cancelled') ||
    lower.includes('canceled') ||
    lower.includes('rejected')
  ) {
    return 'Image signing was cancelled'
  }
  if (lower.includes('expired')) return 'Wallet request expired. Please try again.'
  if (lower.includes('not installed')) return 'Wallet extension is not installed'
  if (lower === 'incomplete') return 'Wallet request was incomplete'
  return raw
}

export function useHiveImageSign(options: UseHiveImageSignOptions = {}): PostingSignMessageFn {
  const {
    signer,
    user,
    walletSupportedProviders = DEFAULT_WALLET_SUPPORTED,
  } = options

  return useCallback(async (message: string): Promise<string> => {
    // 1) Plaintext / posting-key login — sign the reconstructed hash directly.
    const wif = user?.privatePostingKey
    if (wif) {
      const parsed = JSON.parse(message) as { type?: string; data?: number[] }
      if (parsed?.type !== 'Buffer' || !Array.isArray(parsed.data)) {
        throw new Error('Unexpected signing payload shape')
      }
      const bytes = new Uint8Array(parsed.data)
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
      const key = PrivateKey.fromString(wif)
      // dhive's sign() is typed Buffer; internally it uses Buffer.concat + secp256k1.
      // secp256k1 validates with `Buffer.isBuffer(msg)`, so we must pass a real Buffer
      // from the same polyfill instance the consumer app has installed on globalThis.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const GlobalBuffer = (globalThis as any).Buffer as typeof Buffer | undefined
      if (!GlobalBuffer) {
        throw new Error('Buffer polyfill is not available — import buffer in your app entry')
      }
      return key.sign(GlobalBuffer.from(new Uint8Array(hashBuffer))).toString()
    }

    // 2) Wallet provider — only attempt the ones known to reconstruct the Buffer JSON.
    const provider = (user?.provider || '').toLowerCase()
    if (!walletSupportedProviders.has(provider)) {
      throw new Error(
        `Signed image upload is not supported for provider "${provider || 'unknown'}".`,
      )
    }
    if (!signer) throw new Error('Wallet signer is not ready')

    // Aioha's KeyTypes enum values are lowercase ('posting', 'active', 'memo').
    // The provider's internal roleMap keys off these values, so PascalCase would
    // resolve to undefined and Keychain would reject with "incomplete".
    let res: HiveImageSignSignerResult
    try {
      res = await signer.signMessage(message, 'posting' as unknown as never)
    } catch (thrown) {
      // Some providers throw instead of returning { success: false }.
      throw new Error(friendlySignError(stringifySignError(thrown) || 'signMessage failed'))
    }
    if (!res.success) {
      throw new Error(friendlySignError(stringifySignError(res.error) || 'signMessage failed'))
    }
    if (!res.result) throw new Error('signMessage returned empty result')
    return res.result
  }, [signer, user, walletSupportedProviders])
}
