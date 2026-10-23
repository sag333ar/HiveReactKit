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
}

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

/**
 * Background autosave for a reply/comment composer.
 *
 *  - When enabled for a parent, loads the newest saved draft and restores it
 *    if the composer is still empty (reusing its `draftId`).
 *  - Every `intervalMs` (10 s), saves the text if it changed and is
 *    non-empty; if the user cleared a previously-saved text, deletes it.
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

  const active = Boolean(enabled && adapter && parentAuthor && parentPermlink);

  useEffect(() => {
    if (!active || !adapter || !parentAuthor || !parentPermlink) {
      sessionRef.current = null;
      setStatus('idle');
      return;
    }
    const session: DraftSession = { parentAuthor, parentPermlink, draftId: null, lastSaved: '', loaded: false, sentBody: null };
    sessionRef.current = session;
    lastSessionRef.current = session;
    setStatus('idle');
    setLastSavedAt(null);

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    adapter
      .load(parentAuthor, parentPermlink, controller?.signal)
      .then((draft) => {
        if (sessionRef.current !== session) return;
        if (draft && draft.draftId) {
          session.draftId = draft.draftId;
          session.lastSaved = draft.body || '';
          if (draft.body && draft.body.trim() && !bodyRef.current.trim()) {
            setBodyRef.current(draft.body);
            bodyRef.current = draft.body;
            if (mountedRef.current) setStatus('restored');
          }
        }
      })
      .catch((err) => {
        if (controller?.signal.aborted) return;
        log('load failed', err);
      })
      .finally(() => {
        if (sessionRef.current === session) session.loaded = true;
      });

    const timer = setInterval(() => flush(session), intervalMs);
    return () => {
      clearInterval(timer);
      controller?.abort();
      // Best-effort final save on close / parent switch — never a delete.
      if (session.loaded && !sendingRef.current && bodyRef.current.trim()) {
        flush(session); // no-op if unchanged or just sent
      }
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [active, adapter, parentAuthor, parentPermlink, intervalMs, flush]);

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

  return { status, lastSavedAt, beginSend, endSend };
}
