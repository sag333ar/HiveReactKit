/**
 * Runtime-configurable Hive RPC endpoint.
 *
 * Every dhive Client and every direct JSON-RPC fetch inside the kit reads
 * the URL from `getHiveApiEndpoint()` (or shares the singleton returned by
 * `getHiveClient()`), so callers can switch nodes at runtime via
 * `setHiveApiEndpoint(url)` and have the change picked up immediately —
 * without re-importing modules or rebuilding clients.
 */
import { Client, ClientOptions } from '@hiveio/dhive';

const DEFAULT_ENDPOINT = 'https://api.hive.blog';

let currentEndpoint = DEFAULT_ENDPOINT;
const listeners = new Set<(url: string) => void>();
let sharedClient: Client | null = null;

/**
 * When `endpointLocked` is true, `setHiveApiEndpoint(url)` becomes a
 * no-op — the kit refuses to point its dhive Client at any URL other
 * than the one currently active. Consumer apps that don't want any
 * vendor-side / interceptor-side rotation to leak through to kit
 * components (UserDetailProfile, HiveDetailPost, etc.) flip this on
 * via `lockHiveApiEndpoint(true)` to enforce a single-node policy.
 *
 * `lockHiveApiEndpoint(true, url)` can also be passed an explicit URL
 * to pin to immediately before the lock takes effect — useful when
 * the consumer wants to undo a prior rotation in the same call.
 */
let endpointLocked = false;

export function getHiveApiEndpoint(): string {
  return currentEndpoint;
}

export function isHiveApiEndpointLocked(): boolean {
  return endpointLocked;
}

/**
 * Lock or unlock the kit's RPC endpoint against future
 * `setHiveApiEndpoint()` calls. When locked, the kit's dhive
 * Client and all internal direct-fetch services keep using whatever
 * URL was active at the time of the lock — even if a vendor package
 * (e.g. hive-authentication's hardcoded multi-URL dhive Client) or
 * a network-level failover wrap tries to swap it.
 *
 * @param locked — `true` to freeze the endpoint, `false` to release.
 * @param pinTo — Optional URL to apply BEFORE locking. Convenient for
 *   "undo any rotation that happened, then freeze" in one call.
 */
export function lockHiveApiEndpoint(locked: boolean, pinTo?: string): void {
  if (pinTo) {
    // Unlock briefly so the pin actually applies, then re-lock.
    endpointLocked = false;
    setHiveApiEndpoint(pinTo);
  }
  endpointLocked = locked;
}

export function setHiveApiEndpoint(url: string): void {
  if (!url || typeof url !== 'string') return;
  // Refuse the change when the consumer app has locked the endpoint.
  // The kit's dhive Client and userService keep talking to whatever
  // node was active at the time of the lock.
  if (endpointLocked) return;
  const trimmed = url.replace(/\/+$/, '');
  if (trimmed === currentEndpoint) return;
  currentEndpoint = trimmed;
  if (sharedClient) {
    sharedClient.address = trimmed;
    sharedClient.currentAddress = trimmed;
  }
  listeners.forEach((cb) => {
    try { cb(trimmed); } catch { /* ignore */ }
  });
}

export function subscribeHiveApiEndpoint(cb: (url: string) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/**
 * Returns the kit-wide dhive Client. The same instance is returned on every
 * call; its `address` / `currentAddress` are updated when
 * `setHiveApiEndpoint()` is called, so existing references continue to use
 * the latest node without reconstruction.
 */
export function getHiveClient(options?: ClientOptions): Client {
  if (!sharedClient) {
    sharedClient = new Client(currentEndpoint, options);
  }
  return sharedClient;
}
