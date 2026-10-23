import { createContext, useContext, type ReactNode } from 'react';

/**
 * A saved reply/comment draft as the host app's store returns it. The kit
 * only needs the id (to update/delete the same row) and the text.
 */
export interface ReplyDraftRecord {
  draftId: string;
  body: string;
  updatedAt?: string;
}

/** Payload handed to `ReplyDraftAdapter.save`. */
export interface ReplyDraftSavePayload {
  draftId: string;
  parentAuthor: string;
  parentPermlink: string;
  body: string;
}

/**
 * Storage adapter for reply/comment drafts. The kit never calls a backend
 * itself — the host app implements this (e.g. against hive-inbox
 * `/data/v2/drafts`) and provides it via `<ReplyDraftProvider>` or the
 * composer's `replyDraftAdapter` prop.
 *
 * All methods may reject; the kit logs and carries on (autosave is
 * best-effort and must never block typing or posting).
 */
export interface ReplyDraftAdapter {
  /** Newest saved draft for this parent, or null. */
  load: (parentAuthor: string, parentPermlink: string, signal?: AbortSignal) => Promise<ReplyDraftRecord | null>;
  /** Create or overwrite the draft with `draftId`. */
  save: (draft: ReplyDraftSavePayload) => Promise<unknown>;
  /** Delete the draft with `draftId` (after a successful send, or when the user clears the text). */
  remove: (draftId: string) => Promise<unknown>;
}

const ReplyDraftContext = createContext<ReplyDraftAdapter | null>(null);

/**
 * Makes a reply-draft adapter available to every kit reply composer below
 * it. Composers only use it when they opt in (`replyDraft` prop — the kit's
 * own reply surfaces do), so wrapping the whole app is safe. Pass `null`
 * (e.g. while logged out) to disable drafts entirely.
 */
export function ReplyDraftProvider({ adapter, children }: { adapter: ReplyDraftAdapter | null; children: ReactNode }) {
  return <ReplyDraftContext.Provider value={adapter}>{children}</ReplyDraftContext.Provider>;
}

/** The adapter from the nearest `<ReplyDraftProvider>`, or null. */
export function useReplyDraftAdapter(): ReplyDraftAdapter | null {
  return useContext(ReplyDraftContext);
}
