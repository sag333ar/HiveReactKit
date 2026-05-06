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

export function getHiveApiEndpoint(): string {
  return currentEndpoint;
}

export function setHiveApiEndpoint(url: string): void {
  if (!url || typeof url !== 'string') return;
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
