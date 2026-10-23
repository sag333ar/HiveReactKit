import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReplyDraftAdapter } from '../context/ReplyDraftContext';

export type ReplyDraftStatus = 'idle' | 'restored' | 'saving' | 'saved';

export interface UseReplyDraftAutosaveOptions {
  /** Storage adapter; null/undefined disables the hook. */
  adapter: ReplyDraftAdapter | null | undefined;
  /** Master switch (e.g. composer opted in + has a parent). */
  enabled: boolean;
  parentAuthor?: string;
  parentPermlink?: string;
  /** Current composer text. */
  body: string;
  /** Used once per parent to restore a saved draft into an EMPTY composer. */
  setBody: (value: string) => void;
  /** Autosave cadence. Default 10 000 ms. */
  intervalMs?: number;
}

export interface UseReplyDraftAutosaveResult {
  status: ReplyDraftStatus;
  lastSavedAt: Date | null;
  /** Call right before broadcasting — pauses autosave so a draft isn't re-saved mid-send. */
  beginSend: () => void;
  /** Call when the send settles. `true` deletes the draft; `false` resumes autosave. */
  endSend: (success: boolean) => void;
  /** Host sent the reply through its own path (e.g. "Upvote & Reply") —
   *  delete the server draft now, same as `endSend(true)`. */
  markSent: () => void;
  /** Re-check the server for a draft (e.g. composer focused / tab visible
   *  again). Only restores into an EMPTY composer; never overwrites text. */
  refresh: () => void;
}

interface DraftSession {
  parentAuthor: string;
  parentPermlink: string;
  draftId: string | null;
  /** Text last persisted (or restored) for this parent; '' = nothing on the server. */
  lastSaved: string;
  /** Initial load finished — don't save before we know whether a draft exists. */
  loaded: boolean;
  /** Text that was just sent successfully. Until the composer text changes
   *  away from it, nothing is saved — otherwise a host that closes the
   *  composer mid-send (unmount runs AFTER endSend, while the old text is
   *  still in state) would re-save the reply that was just posted. */
  sentBody: string | null;
  /** A load request is in flight. */
  loading: boolean;
  /** When the last successful load finished (ms epoch); 0 = never. */
  loadedAt: number;
}

/** Retry delays after a failed initial load (auth not ready yet, network
 *  blip, 5xx…). After the last one saving is allowed anyway so typed text
 *  is never held hostage by a broken GET. */
const LOAD_RETRY_DELAYS_MS = [1_000, 3_000, 8_000];
/** Don't re-check the server more often than this on focus/visibility. */
const REFRESH_MIN_GAP_MS = 2_000;

function newDraftId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return `reply-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

const log = (msg: string, err?: unknown) => {
  // Best-effort feature: never surface to the user, just leave a trace.
  console.warn(`[reply-draft] ${msg}`, err ?? '');
};
const debug = (msg: string) => {
  if (typeof console !== 'undefined' && typeof console.debug === 'function') console.debug(`[reply-draft] ${msg}`);
};
const isAbort = (err: unknown) =>
  Boolean(err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError');

/**
 * Background autosave for a reply/comment composer.
 *
 *  - Restore-on-open: every time the composer opens for a parent it fetches
 *    from the server (`adapter.load` — no local cache, so a draft deleted
 *    after sending is never brought back) and fills the newest draft in ONLY
 *    if the composer text is still empty when that fetch resolves — text the
 *    user typed meanwhile is never overwritten (its `draftId` is adopted so
 *    the next save updates the same row).
 *  - Every `intervalMs` (10 s), saves the text if it changed and is
 *    non-empty; if the user cleared a previously-saved text, deletes it.
 *  - A failed load (auth not ready, network, 5xx) is retried with backoff;
 *    autosave waits for a successful lookup so no duplicate row is created.
 *  - `refresh()` (composer focus) and the tab becoming visible re-check the
 *    server while the composer is empty, so a draft saved on another
 *    device/tab after this page loaded is still picked up.
 *  - On unmount / parent change, does one last best-effort save if the text
 *    changed (never deletes on close).
 *  - `beginSend()` / `endSend(true)` around the broadcast: the draft is
 *    deleted only after a successful send.
 *
 * All adapter calls are serialised (save → delete order is preserved) and
 * failures are logged, never thrown.
 */
export function useReplyDraftAutosave({
  adapter,
  enabled,
  parentAuthor,
  parentPermlink,
  body,
  setBody,
  intervalMs = 10_000,
}: UseReplyDraftAutosaveOptions): UseReplyDraftAutosaveResult {
  const [status, setStatus] = useState<ReplyDraftStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const bodyRef = useRef(body);
  bodyRef.current = body;
  const setBodyRef = useRef(setBody);
  setBodyRef.current = setBody;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const mountedRef = useRef(true);
  const sendingRef = useRef(false);
  const sessionRef = useRef<DraftSession | null>(null);
  // Most recent session, kept after unmount so endSend can still delete the
  // draft when the host closed the composer while the send was in flight.
  const lastSessionRef = useRef<DraftSession | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const enqueue = useCallback((label: string, op: () => Promise<unknown>) => {
    const next = queueRef.current.then(op).catch((err) => log(`${label} failed`, err));
    queueRef.current = next;
    return next;
  }, []);

  const flush = useCallback(
    (session: DraftSession | null) => {
      const a = adapterRef.current;
      if (!a || !session || !session.loaded || sendingRef.current) return;
      const text = bodyRef.current;
      if (session.sentBody !== null) {
        if (text === session.sentBody || !text.trim()) return;
        session.sentBody = null; // user started a new reply
      }
      if (text === session.lastSaved) return;

      if (!text.trim()) {
        // User cleared the composer — drop the saved draft (if any).
        if (session.lastSaved && session.draftId) {
          const id = session.draftId;
          session.lastSaved = '';
          enqueue('delete (cleared)', () => a.remove(id));
          if (mountedRef.current) setStatus('idle');
        }
        return;
      }

      if (!session.draftId) session.draftId = newDraftId();
      const prev = session.lastSaved;
      session.lastSaved = text; // optimistic; rolled back on failure so the next tick retries
      const payload = {
        draftId: session.draftId,
        parentAuthor: session.parentAuthor,
        parentPermlink: session.parentPermlink,
        body: text,
      };
      if (mountedRef.current) setStatus('saving');
      enqueue('save', () =>
        a.save(payload).then(
          () => {
            if (mountedRef.current && sessionRef.current === session) {
              setStatus('saved');
              setLastSavedAt(new Date());
            }
          },
          (err) => {
            if (session.lastSaved === text) session.lastSaved = prev;
            if (mountedRef.current && sessionRef.current === session) setStatus('idle');
            throw err;
          },
        ),
      );
    },
    [enqueue],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshRef = useRef<() => void>(() => {});

  /** Apply a server lookup result. Restores only into an empty composer. */
  const applyServerDraft = useCallback(
    (session: DraftSession, draft: { draftId: string; body: string } | null) => {
      if (draft && draft.draftId) {
        session.draftId = draft.draftId;
        session.lastSaved = draft.body || '';
        if (draft.body && draft.body.trim() && !bodyRef.current.trim() && !sendingRef.current) {
          debug(`restored draft ${draft.draftId} for @${session.parentAuthor}/${session.parentPermlink}`);
          setBodyRef.current(draft.body);
          bodyRef.current = draft.body;
          session.sentBody = null;
          if (mountedRef.current) setStatus('restored');
        } else {
          debug(`draft ${draft.draftId} exists but composer is not empty — kept typed text`);
        }
      } else {
        debug(`no saved draft for @${session.parentAuthor}/${session.parentPermlink}`);
        // Deleted elsewhere (sent from another tab/device): forget the id so
        // the next save starts a fresh draft instead of resurrecting it.
        if (!bodyRef.current.trim()) {
          session.draftId = null;
          session.lastSaved = '';
        }
      }
    },
    [],
  );

  const active = Boolean(enabled && adapter && parentAuthor && parentPermlink);

  useEffect(() => {
    if (!active || !adapter || !parentAuthor || !parentPermlink) {
      sessionRef.current = null;
      setStatus('idle');
      return;
    }
    const session: DraftSession = {
      parentAuthor,
      parentPermlink,
      draftId: null,
      lastSaved: '',
      loaded: false,
      sentBody: null,
      loading: false,
      loadedAt: 0,
    };
    sessionRef.current = session;
    lastSessionRef.current = session;
    setStatus('idle');
    setLastSavedAt(null);

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const controllers = new Set<AbortController>();
    const runLoad = (attempt: number) => {
      if (disposed || session.loading) return;
      session.loading = true;
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      if (controller) controllers.add(controller);
      // Wait for queued save/delete calls so a lookup never sees a draft
      // that is about to be deleted (e.g. reopened right after sending).
      queueRef.current
        .then(() => {
          if (disposed) throw Object.assign(new Error('disposed'), { name: 'AbortError' });
          return adapter.load(parentAuthor, parentPermlink, controller?.signal);
        })
        .then(
          (draft) => {
            if (disposed || sessionRef.current !== session) return;
            session.loaded = true;
            session.loadedAt = Date.now();
            applyServerDraft(session, draft ?? null);
          },
          (err) => {
            if (disposed || controller?.signal.aborted || isAbort(err)) return;
            log(`load failed (attempt ${attempt + 1})`, err);
            if (attempt < LOAD_RETRY_DELAYS_MS.length) {
              retryTimer = setTimeout(() => runLoad(attempt + 1), LOAD_RETRY_DELAYS_MS[attempt]);
            } else if (sessionRef.current === session) {
              // Give up on restoring but let autosave protect new text.
              session.loaded = true;
            }
          },
        )
        .finally(() => {
          session.loading = false;
          if (controller) controllers.delete(controller);
        });
    };
    refreshRef.current = () => {
      if (disposed || sessionRef.current !== session || sendingRef.current) return;
      if (session.loading || bodyRef.current.trim()) return;
      // Known draft + empty box = the user cleared it on purpose; just sent =
      // nothing to bring back. Either way, don't re-fetch it.
      if (session.lastSaved || session.sentBody !== null) return;
      if (session.loadedAt && Date.now() - session.loadedAt < REFRESH_MIN_GAP_MS) return;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      runLoad(0);
    };
    runLoad(0);

    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') refreshRef.current();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);

    const timer = setInterval(() => flush(session), intervalMs);
    return () => {
      disposed = true;
      clearInterval(timer);
      if (retryTimer) clearTimeout(retryTimer);
      controllers.forEach((c) => c.abort());
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
      refreshRef.current = () => {};
      // Best-effort final save on close / parent switch — never a delete.
      if (session.loaded && !sendingRef.current && bodyRef.current.trim()) {
        flush(session); // no-op if unchanged or just sent
      }
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [active, adapter, parentAuthor, parentPermlink, intervalMs, flush, applyServerDraft]);

  const beginSend = useCallback(() => {
    sendingRef.current = true;
  }, []);

  const endSend = useCallback(
    (success: boolean) => {
      sendingRef.current = false;
      if (!success) return;
      const session = sessionRef.current ?? lastSessionRef.current;
      const a = adapterRef.current;
      if (!session || !a) return;
      const id = session.draftId;
      session.draftId = null;
      session.lastSaved = '';
      session.sentBody = bodyRef.current;
      if (mountedRef.current) {
        setStatus('idle');
        setLastSavedAt(null);
      }
      if (id) enqueue('delete (sent)', () => a.remove(id));
    },
    [enqueue],
  );

  const markSent = useCallback(() => {
    sendingRef.current = true;
    endSend(true);
  }, [endSend]);

  const refresh = useCallback(() => refreshRef.current(), []);

  return { status, lastSavedAt, beginSend, endSend, markSent, refresh };
}
