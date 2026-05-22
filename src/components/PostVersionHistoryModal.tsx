/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { X, History, Loader2 } from 'lucide-react';

/**
 * Modal showing the edit history of a Hive post. Versions come from
 * Ecency's `private-api/comment-history` endpoint, which records the
 * full title/body for every create + edit of the comment.
 *
 * Endpoint shape (Ecency typically wraps in `{ list: [...] }`):
 *   [{ v, title, body, tags, timestamp }]
 *
 * `v` is a per-edit version counter (0 = original). We sort newest-
 * first and tag the lowest `v` entry "Original"; everything else is
 * an "Edit".
 */
export interface PostVersion {
  /** Per-comment version counter from Ecency (0 = original). Treated as
   *  the row's stable identity since the API doesn't ship a tx id. */
  v: number;
  timestamp: string;
  title?: string;
  body?: string;
  tags?: string[];
}

export interface PostVersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  author: string;
  permlink: string;
}

function formatRelative(timestamp: string): string {
  try {
    const iso = /Z|[+-]\d{2}:?\d{2}$/.test(timestamp) ? timestamp : `${timestamp}Z`;
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return timestamp;
    const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(days / 365);
    return `${years} year${years === 1 ? '' : 's'} ago`;
  } catch {
    return timestamp;
  }
}

export function PostVersionHistoryModal({
  isOpen,
  onClose,
  author,
  permlink,
}: PostVersionHistoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<PostVersion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch('https://ecency.com/private-api/comment-history', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({ author, permlink, onlyMeta: '' }),
        });
        if (!resp.ok) throw new Error(`Failed to load history (${resp.status})`);
        const data = (await resp.json()) as { list?: PostVersion[] } | PostVersion[];
        if (cancelled) return;
        // Ecency wraps results in `{ list: [...] }` but occasionally returns
        // a bare array. Handle both.
        const raw: PostVersion[] = Array.isArray(data)
          ? (data as PostVersion[])
          : Array.isArray(data?.list)
            ? (data.list as PostVersion[])
            : [];
        // Newest first. `v` is monotonically increasing per edit, so we
        // sort on that and fall back to timestamp if `v` is missing.
        const sorted = [...raw].sort((a, b) => {
          const av = typeof a.v === 'number' ? a.v : 0;
          const bv = typeof b.v === 'number' ? b.v : 0;
          if (av !== bv) return bv - av;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
        setVersions(sorted);
        setSelectedIndex(0);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load history');
        setVersions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, author, permlink]);

  const selected = useMemo(() => versions[selectedIndex] ?? null, [versions, selectedIndex]);
  // The lowest `v` is the original create_comment; everything after is
  // an edit. Sorted newest-first above, so the last entry is the
  // original.
  const originalV = versions.length > 0 ? versions[versions.length - 1].v : null;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--hrk-bg-surface)] text-[var(--hrk-text-primary)] rounded-xl shadow-xl w-full max-w-5xl h-[80vh] flex flex-col border border-[var(--hrk-border-default)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-[var(--hrk-border-default)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-[var(--hrk-text-secondary)]" />
            <h3 className="text-base font-semibold">Post Version History</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 hover:bg-[var(--hrk-bg-hover)] rounded transition-colors"
          >
            <X className="h-5 w-5 text-[var(--hrk-text-secondary)]" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex">
          <div className="w-56 shrink-0 border-r border-[var(--hrk-border-default)] flex flex-col">
            <div className="px-4 py-3 text-xs uppercase tracking-wide text-[var(--hrk-text-tertiary)]">
              Versions:
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
              {loading && (
                <div className="flex items-center gap-2 text-sm text-[var(--hrk-text-secondary)] px-2 py-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              )}
              {!loading && error && (
                <div className="text-xs text-red-400 px-2 py-3">{error}</div>
              )}
              {!loading && !error && versions.length === 0 && (
                <div className="text-xs text-[var(--hrk-text-tertiary)] px-2 py-3">
                  No history found.
                </div>
              )}
              {versions.map((v, i) => {
                const isActive = i === selectedIndex;
                const isOriginal = v.v === originalV;
                return (
                  <button
                    key={`v-${v.v}-${v.timestamp}`}
                    type="button"
                    onClick={() => setSelectedIndex(i)}
                    className={
                      'w-full text-left rounded-lg border px-3 py-2 transition-colors ' +
                      (isActive
                        ? 'border-[var(--hrk-brand)] bg-[var(--hrk-brand-soft)]'
                        : 'border-[var(--hrk-border-subtle)] hover:bg-[var(--hrk-bg-hover)]')
                    }
                  >
                    <div className="text-sm text-[var(--hrk-text-primary)]">
                      {formatRelative(v.timestamp)}
                    </div>
                    <div className="mt-1">
                      <span
                        className={
                          'inline-block text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ' +
                          (isOriginal
                            ? 'bg-[var(--hrk-brand)] text-black'
                            : 'bg-[var(--hrk-bg-surface-raised)] text-[var(--hrk-text-secondary)]')
                        }
                      >
                        {isOriginal ? 'Original' : 'Edit'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            {selected && (
              <>
                <div>
                  <div className="text-xs uppercase tracking-wide text-[var(--hrk-text-tertiary)] mb-1">
                    Title:
                  </div>
                  <div className="rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface-sunken)] px-3 py-2 text-sm">
                    {selected.title || <span className="text-[var(--hrk-text-tertiary)]">(no title)</span>}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-[var(--hrk-text-tertiary)] mb-1">
                    Content:
                  </div>
                  <pre className="rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface-sunken)] px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words font-mono max-h-[55vh] overflow-y-auto">
                    {selected.body || ''}
                  </pre>
                </div>
              </>
            )}
            {!selected && !loading && !error && (
              <div className="text-sm text-[var(--hrk-text-tertiary)]">
                Pick a version on the left to view its title and content.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PostVersionHistoryModal;
