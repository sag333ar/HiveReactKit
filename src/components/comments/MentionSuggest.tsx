/**
 * Mention autocomplete for the composer textarea.
 *
 *  - `useMentionAutocomplete` watches the textarea's value + caret and
 *    detects when the user is typing inside an `@…` token. Returns the
 *    active query, the candidate list (seed → API), and helpers to
 *    apply / dismiss a selection.
 *
 *  - `<MentionSuggest/>` is the dropdown UI that consumes that hook's
 *    state, listing the candidates with avatar + handle. Arrow keys
 *    navigate, Enter / Tab / click selects, Escape dismisses.
 *
 * Behaviour mirrors peakd:
 *   1. Right after `@` (empty query): show the seed list verbatim —
 *      typically the post author first, then every `@account` mentioned
 *      in the post body, deduped.
 *   2. Query length 1–2 chars: filter the seed list locally.
 *   3. Query length ≥ 3 chars: call `condenser_api.get_account_reputations`
 *      via mentionService and append API matches under the seed list.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { searchHiveAccounts } from "../../services/mentionService";

const USERNAME_CHAR_RE = /[a-z0-9._-]/i;

export interface MentionMatch {
  /** The active query (lowercased, no leading @). */
  query: string;
  /** Caret column of the `@`. */
  start: number;
  /** Caret column right after the active token. */
  end: number;
}

/** Find the active `@…` token at the caret position, or null. */
export function findMentionAtCaret(
  value: string,
  caret: number,
): MentionMatch | null {
  if (caret < 0 || caret > value.length) return null;
  // Walk backwards from caret until we hit a non-username char.
  let i = caret;
  while (i > 0 && USERNAME_CHAR_RE.test(value[i - 1] ?? "")) {
    i -= 1;
  }
  if (i === 0 || value[i - 1] !== "@") return null;
  // Boundary char immediately before `@` must be whitespace or start
  // of input — otherwise we're in the middle of an email-ish token.
  if (i - 1 > 0) {
    const prev = value[i - 2] ?? "";
    if (prev && !/\s/.test(prev)) return null;
  }
  const start = i - 1;
  const end = caret;
  return { query: value.slice(i, end).toLowerCase(), start, end };
}

export interface UseMentionAutocompleteOptions {
  /** Seed list — typically `[parentAuthor, ...mentionsFromBody]`, deduped.
   *  Shown verbatim before the user types anything, filtered locally
   *  while they type 1–2 chars, then merged ahead of API results. */
  seedAccounts?: string[];
  /** How many API rows to fetch when query length ≥ 3. */
  apiLimit?: number;
}

export interface UseMentionAutocompleteResult {
  active: boolean;
  match: MentionMatch | null;
  candidates: string[];
  highlightedIndex: number;
  setHighlightedIndex: (i: number) => void;
  onValueChange: (value: string, caret: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
  /** Apply the selected username — returns the new value + new caret. */
  apply: (selection?: string) => { value: string; caret: number } | null;
  dismiss: () => void;
}

export function useMentionAutocomplete(
  value: string,
  options: UseMentionAutocompleteOptions = {},
): UseMentionAutocompleteResult {
  const { seedAccounts = [], apiLimit = 10 } = options;
  const [match, setMatch] = useState<MentionMatch | null>(null);
  const [apiCandidates, setApiCandidates] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  // Latest value + cursor are read by `apply` so the caller doesn't
  // have to pass them again.
  const valueRef = useRef(value);
  valueRef.current = value;

  // Local seed filter — case-insensitive prefix on the *current* query.
  const seed = useMemo(() => {
    const lower = (seedAccounts ?? []).map((a) => a.toLowerCase());
    const seen = new Set<string>();
    return lower.filter((a) => {
      if (seen.has(a)) return false;
      seen.add(a);
      return true;
    });
  }, [seedAccounts]);

  const candidates = useMemo(() => {
    if (!match) return [];
    const q = match.query;
    const filteredSeed = q
      ? seed.filter((a) => a.startsWith(q) || a.includes(q))
      : seed;
    const seen = new Set(filteredSeed);
    const apiTail = apiCandidates.filter((a) => !seen.has(a));
    return [...filteredSeed, ...apiTail];
  }, [match, seed, apiCandidates]);

  // Reset highlight whenever the candidate list changes shape.
  useEffect(() => {
    setHighlightedIndex(0);
  }, [match?.query, candidates.length]);

  // Fire the API search when the query is long enough — debounced via a
  // tiny setTimeout window so a fast typer doesn't pile up requests.
  useEffect(() => {
    if (!match) {
      setApiCandidates([]);
      return;
    }
    const q = match.query;
    if (q.length < 3) {
      setApiCandidates([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchHiveAccounts(q, apiLimit).then((rows) => {
        if (cancelled) return;
        setApiCandidates(rows);
      });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [match, apiLimit]);

  const onValueChange = useCallback(
    (next: string, caret: number) => {
      valueRef.current = next;
      const m = findMentionAtCaret(next, caret);
      setMatch(m);
    },
    [],
  );

  const apply = useCallback(
    (override?: string): { value: string; caret: number } | null => {
      const m = match;
      if (!m) return null;
      const choice = (override ?? candidates[highlightedIndex] ?? "")
        .toLowerCase();
      if (!choice) return null;
      const v = valueRef.current;
      const prefix = v.slice(0, m.start); // up to but not including `@`
      const suffix = v.slice(m.end);
      // Replace `@oldQuery` with `@username `. Append a space only if the
      // next char isn't already whitespace, so the caret lands cleanly.
      const needsSpace = !/^\s/.test(suffix);
      const insert = `@${choice}${needsSpace ? " " : ""}`;
      const next = prefix + insert + suffix;
      const caret = (prefix + insert).length;
      setMatch(null);
      setApiCandidates([]);
      return { value: next, caret };
    },
    [match, candidates, highlightedIndex],
  );

  const dismiss = useCallback(() => {
    setMatch(null);
    setApiCandidates([]);
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!match || candidates.length === 0) return false;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % candidates.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => (i - 1 + candidates.length) % candidates.length);
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        // Caller will read `apply()` after this returns true.
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
        return true;
      }
      return false;
    },
    [match, candidates, dismiss],
  );

  return {
    active: !!match && candidates.length > 0,
    match,
    candidates,
    highlightedIndex,
    setHighlightedIndex,
    onValueChange,
    onKeyDown,
    apply,
    dismiss,
  };
}

/** Approximate the caret's pixel offset inside a textarea so the
 *  mention dropdown can dock right under the current line instead of
 *  covering the typed text. Reads computed line-height + padding from
 *  the live element; accounts for the textarea's own scrollTop so the
 *  position stays correct when the body has scrolled. */
export function caretOffsetInTextarea(
  textarea: HTMLTextAreaElement | null,
  caret: number,
): { top: number; left: number } {
  if (!textarea) return { top: 0, left: 0 };
  const style = window.getComputedStyle(textarea);
  const lineHeight = parseFloat(style.lineHeight) || 20;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const before = textarea.value.slice(0, caret);
  const lineIndex = (before.match(/\n/g) || []).length;
  // `+1` lineHeight so the dropdown lands on the line BELOW the caret.
  const top = paddingTop + (lineIndex + 1) * lineHeight - textarea.scrollTop;
  return { top, left: paddingLeft };
}

export interface MentionSuggestProps {
  candidates: string[];
  highlightedIndex: number;
  onHover: (index: number) => void;
  onSelect: (account: string) => void;
  className?: string;
}

/** Floating panel that lists the candidate accounts. Position it via the
 *  containing element's CSS — `MentionSuggest` itself just paints the
 *  list with a `absolute`-friendly layout. */
export const MentionSuggest: React.FC<MentionSuggestProps> = ({
  candidates,
  highlightedIndex,
  onHover,
  onSelect,
  className,
}) => {
  if (candidates.length === 0) return null;
  return (
    <div
      role="listbox"
      aria-label="Mention suggestions"
      className={[
        "max-h-64 w-56 overflow-y-auto rounded-lg border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] shadow-2xl",
        className ?? "",
      ].join(" ")}
    >
      {candidates.map((account, i) => {
        const selected = i === highlightedIndex;
        return (
          <button
            key={account}
            type="button"
            role="option"
            aria-selected={selected}
            onMouseDown={(e) => {
              // Use mousedown so the textarea doesn't lose focus before
              // the select fires (click would blur first).
              e.preventDefault();
              onSelect(account);
            }}
            onMouseEnter={() => onHover(i)}
            className={[
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
              selected
                ? "bg-[var(--hrk-bg-hover)] text-[var(--hrk-text-primary)]"
                : "text-[var(--hrk-text-secondary)] hover:bg-[var(--hrk-bg-hover)]",
            ].join(" ")}
          >
            <img
              src={`https://images.hive.blog/u/${account}/avatar`}
              alt=""
              loading="lazy"
              className="h-6 w-6 shrink-0 rounded-full bg-[var(--hrk-bg-hover)] object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "https://images.hive.blog/u/null/avatar";
              }}
            />
            <span className="truncate">{account}</span>
          </button>
        );
      })}
    </div>
  );
};

export default MentionSuggest;
