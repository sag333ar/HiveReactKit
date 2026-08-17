/**
 * Utility for detecting network timeouts, offline state, and formatting
 * user-friendly error messages in HiveReactKit.
 */

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function isNetworkError(err: unknown): boolean {
  if (isOffline()) return true;
  const msg = err instanceof Error ? err.message : String(err || '');
  return /failed to fetch|network\s*error|network\s*timeout|net::|abort|load failed|timeout|econnrefused|econnreset|etimedout|offline/i.test(msg);
}

export function formatErrorMessage(err: unknown, fallback = 'Operation failed'): string {
  if (isOffline()) {
    return 'No internet connection. Please check your network and try again.';
  }
  const msg = err instanceof Error ? err.message : String(err || fallback);
  if (isNetworkError(err)) {
    return 'Network timeout or connection lost. Please check your internet connection and try again.';
  }
  return msg || fallback;
}
