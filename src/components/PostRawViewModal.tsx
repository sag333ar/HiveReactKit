/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react';
import { X, FileCode2, ChevronDown, ChevronRight } from 'lucide-react';
import { Post } from '@/types/post';

// Rows whose serialized value gets very long for typical posts —
// active_votes can balloon to hundreds of entries on big posts and
// body holds the entire markdown source. They render collapsed by
// default with a "show more" toggle so the inspector stays scannable.
const COLLAPSIBLE_ROW_KEYS = new Set(['body', 'active_votes']);

/**
 * Modal that surfaces every field on the loaded `Post` object as a
 * read-only key/value list. Helps power users (curators, devs, witness
 * voters) inspect what the chain actually returned for a post —
 * payout state, beneficiaries, raw json_metadata, the full markdown
 * body, etc.
 *
 * The top row links out to the three major Hive frontends so the same
 * post can be opened anywhere with one click.
 */
export interface PostRawViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
}

interface Row {
  key: string;
  value: any;
}

// Stable display order — mirrors what PeakD's debug panel shows so the
// view feels familiar. Anything not in this list gets appended at the
// end in insertion order (so future Post fields show up automatically).
const PREFERRED_ORDER = [
  'title',
  'author',
  'permlink',
  'url',
  'body',
  'depth',
  'stats',
  'payout',
  'created',
  'reblogs',
  'replies',
  'updated',
  'category',
  'children',
  'community',
  'payout_at',
  'blacklists',
  'is_paidout',
  'author_role',
  'net_rshares',
  'percent_hbd',
  'active_votes',
  'author_title',
  'beneficiaries',
  'json_metadata',
  'community_title',
  'author_reputation',
  'author_payout_value',
  'max_accepted_payout',
  'curator_payout_value',
  'pending_payout_value',
];

function orderRows(post: Post): Row[] {
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const key of PREFERRED_ORDER) {
    if (key in post) {
      rows.push({ key, value: (post as any)[key] });
      seen.add(key);
    }
  }
  for (const key of Object.keys(post)) {
    if (!seen.has(key)) {
      rows.push({ key, value: (post as any)[key] });
    }
  }
  return rows;
}

function renderValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function PostRawViewModal({ isOpen, onClose, post }: PostRawViewModalProps) {
  const rows = useMemo(() => (post ? orderRows(post) : []), [post]);
  // Which collapsible rows the user has expanded. `body` opens by
  // default since it's what most readers actually want to inspect;
  // `active_votes` stays collapsed because it's noisy on big posts.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ body: true });
  const toggleRow = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!isOpen || !post) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--hrk-bg-surface)] text-[var(--hrk-text-primary)] rounded-xl shadow-xl w-full max-w-5xl h-[85vh] flex flex-col border border-[var(--hrk-border-default)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-[var(--hrk-border-default)] flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileCode2 className="h-5 w-5 text-[var(--hrk-text-secondary)] shrink-0" />
            <h3 className="text-base font-semibold truncate">
              {post.title || `@${post.author}/${post.permlink}`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 hover:bg-[var(--hrk-bg-hover)] rounded transition-colors shrink-0"
          >
            <X className="h-5 w-5 text-[var(--hrk-text-secondary)]" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="divide-y divide-[var(--hrk-border-subtle)]">
            {rows.map((row) => {
              const collapsible = COLLAPSIBLE_ROW_KEYS.has(row.key);
              const isExpanded = expanded[row.key] ?? false;
              const rendered = renderValue(row.value);
              const itemCount = Array.isArray(row.value)
                ? row.value.length
                : null;
              return (
                <div
                  key={row.key}
                  className="grid grid-cols-[180px_1fr] gap-4 px-5 py-3"
                >
                  <div className="text-xs font-medium text-[var(--hrk-text-secondary)] break-words">
                    {row.key}
                  </div>
                  <div className="text-xs text-[var(--hrk-text-primary)] font-mono">
                    {collapsible ? (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleRow(row.key)}
                          className="mb-1 inline-flex items-center gap-1 text-[var(--hrk-text-secondary)] hover:text-[var(--hrk-text-primary)] transition-colors"
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          <span>
                            {isExpanded ? 'Collapse' : 'Expand'}
                            {itemCount !== null && ` (${itemCount} ${itemCount === 1 ? 'item' : 'items'})`}
                          </span>
                        </button>
                        {isExpanded && (
                          <pre className="whitespace-pre-wrap break-words rounded border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface-sunken)] p-2 max-h-[50vh] overflow-y-auto">
                            {rendered}
                          </pre>
                        )}
                      </>
                    ) : (
                      <div className="whitespace-pre-wrap break-words">{rendered}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PostRawViewModal;
