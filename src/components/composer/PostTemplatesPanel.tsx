/**
 * PostTemplatesPanel — list / save / apply named templates for top-level
 * posts.
 *
 * Drafts answer "I'll come back to this exact post". Post-templates answer
 * "I write posts like this all the time — give me a starting point". They
 * carry the same payload (title + description + body + tags + optional
 * community), but each one has a user-chosen `name` and is reusable.
 *
 * The kit's existing `TemplatePicker` is unrelated — it inserts free-form
 * markdown snippets into the body for snap replies. This panel replaces
 * the whole post.
 *
 * The host fetches `templates` (e.g. from `/data/v2/post-templates`) and
 * provides three callbacks: save, delete, and confirm-before-apply. Apply
 * itself happens client-side — the kit knows how to refill its own form
 * from a `PostTemplate` payload.
 */
import React, { useState } from 'react';
import { Loader2, X, FileText, Save, Trash2, Wand2, ArrowLeft, AlertTriangle } from 'lucide-react';

export interface PostTemplate {
  /** Unique-per-user template label, surfaced verbatim in the list. */
  name: string;
  title?: string;
  description?: string;
  body?: string;
  tags?: string[];
  /** Optional community id (e.g. `hive-129948`). The host decides whether
   *  to honour this when applying — community pickers usually live outside
   *  the kit, so applying just re-emits the value back via `onApply`. */
  community?: string;
  updatedAt?: string;
}

export interface PostTemplatePayload {
  title: string;
  description: string;
  body: string;
  tags: string[];
  community?: string;
}

export interface PostTemplatesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Template list provided by the host (typically fetched from a backend
   *  like `/data/v2/post-templates`). The kit doesn't fetch — it just
   *  renders what it's given. */
  templates: PostTemplate[];
  /** Snapshot of the composer's current form state. Used to pre-fill the
   *  "Save as new template" form so the user can capture the in-progress
   *  post as a reusable template. */
  currentPayload: PostTemplatePayload;
  /** Whether a save/delete operation is in flight — disables the save form
   *  and surfaces a spinner. */
  busy?: boolean;
  /** Host stores the named template. May return a new `PostTemplate` to
   *  prepend to the local list, or void to let the host re-fetch. */
  onSaveTemplate: (name: string, payload: PostTemplatePayload) => Promise<unknown> | unknown;
  /** Host removes the template. The kit drops the row optimistically. */
  onDeleteTemplate: (name: string) => Promise<unknown> | unknown;
  /** Confirmed-by-user application. The host's callback receives the
   *  template and is expected to wire the data back into the composer
   *  state via the existing `applyTemplate` ref (or by remounting the
   *  composer). */
  onApplyTemplate: (template: PostTemplate) => void;
}

function PostTemplatesPanel({
  isOpen,
  onClose,
  templates,
  currentPayload,
  busy,
  onSaveTemplate,
  onDeleteTemplate,
  onApplyTemplate,
}: PostTemplatesPanelProps): React.JSX.Element | null {
  const [view, setView] = useState<'list' | 'save'>('list');
  const [name, setName] = useState('');
  const [confirmApply, setConfirmApply] = useState<PostTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PostTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setView('list');
    setName('');
    setConfirmApply(null);
    setConfirmDelete(null);
    setError(null);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleSave = async () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the template a name first');
      return;
    }
    // Reject duplicate (case-insensitive) names so users don't shadow an
    // existing template by accident — host enforces this server-side too
    // but the local guard is friendlier.
    const exists = templates.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setError(`A template named "${trimmed}" already exists`);
      return;
    }
    try {
      await onSaveTemplate(trimmed, currentPayload);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save template');
    }
  };

  const handleDelete = async (template: PostTemplate) => {
    try {
      await onDeleteTemplate(template.name);
      setConfirmDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete template');
    }
  };

  const handleApply = (template: PostTemplate) => {
    onApplyTemplate(template);
    close();
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-3 py-6"
      onClick={close}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-[var(--hrk-border-default,#3a424a)] bg-[var(--hrk-bg-surface-raised,#262b30)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[var(--hrk-border-subtle,#3a424a)] px-4 py-3">
          {view === 'save' || confirmApply || confirmDelete ? (
            <button
              type="button"
              onClick={() => {
                setView('list');
                setConfirmApply(null);
                setConfirmDelete(null);
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-[var(--hrk-text-secondary,#cfd3da)] hover:bg-[var(--hrk-bg-hover,#2f353d)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <h3 className="inline-flex items-center gap-2 text-base font-semibold text-[var(--hrk-text-primary,#f0f0f8)]">
              <FileText className="h-4 w-4 text-[var(--hrk-info,#3b82f6)]" />
              Post templates
            </h3>
          )}
          <button
            type="button"
            onClick={close}
            disabled={!!busy}
            className="rounded-lg p-1 text-[var(--hrk-text-tertiary,#9ca3b0)] hover:bg-[var(--hrk-bg-hover,#2f353d)] hover:text-[var(--hrk-text-primary,#f0f0f8)] disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {error && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Confirm apply ─────────────────────────────────────────── */}
        {confirmApply ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            <p className="text-sm text-[var(--hrk-text-secondary,#cfd3da)]">
              Replace the current post content with template{' '}
              <strong className="text-[var(--hrk-text-primary,#f0f0f8)]">
                {confirmApply.name}
              </strong>
              ?
            </p>
            <p className="text-xs text-[var(--hrk-text-tertiary,#9ca3b0)]">
              The current title, body, tags and community will be overwritten. This
              cannot be undone — save the current post as a template first if you
              want to keep it.
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmApply(null)}
                className="rounded-lg border border-[var(--hrk-border-default,#3a424a)] px-3 py-1.5 text-sm font-medium text-[var(--hrk-text-secondary,#cfd3da)] hover:bg-[var(--hrk-bg-hover,#2f353d)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleApply(confirmApply)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--hrk-brand,#e31337)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--hrk-brand-active,#c41030)]"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Replace with template
              </button>
            </div>
          </div>
        ) : confirmDelete ? (
          /* ── Confirm delete ──────────────────────────────────────── */
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            <p className="text-sm text-[var(--hrk-text-secondary,#cfd3da)]">
              Delete template{' '}
              <strong className="text-[var(--hrk-text-primary,#f0f0f8)]">
                {confirmDelete.name}
              </strong>
              ?
            </p>
            <p className="text-xs text-[var(--hrk-text-tertiary,#9ca3b0)]">
              This removes it permanently. Saved drafts are not affected.
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-[var(--hrk-border-default,#3a424a)] px-3 py-1.5 text-sm font-medium text-[var(--hrk-text-secondary,#cfd3da)] hover:bg-[var(--hrk-bg-hover,#2f353d)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDelete)}
                disabled={!!busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete
              </button>
            </div>
          </div>
        ) : view === 'save' ? (
          /* ── Save form ───────────────────────────────────────────── */
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            <p className="text-sm text-[var(--hrk-text-secondary,#cfd3da)]">
              Save the current post as a reusable template. Give it a memorable name
              — you'll use that name to find it later.
            </p>
            <label className="flex flex-col gap-1 text-xs text-[var(--hrk-text-secondary,#cfd3da)]">
              <span className="font-semibold uppercase tracking-wide text-[10px]">Template name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekly recap"
                maxLength={60}
                autoFocus
                className="rounded-lg border border-[var(--hrk-border-default,#3a424a)] bg-[var(--hrk-bg-surface-sunken,#2f353d)] px-3 py-2 text-sm text-[var(--hrk-text-primary,#f0f0f8)] placeholder-[var(--hrk-text-tertiary,#9ca3b0)] focus:outline-none focus:ring-2 focus:ring-[var(--hrk-brand,#e31337)]"
              />
            </label>
            <div className="text-[11px] text-[var(--hrk-text-tertiary,#9ca3b0)]">
              Will store: title ({currentPayload.title ? `${currentPayload.title.length} chars` : 'empty'}),
              {' '}body ({(currentPayload.body || '').length} chars),
              {' '}{currentPayload.tags.length} tag{currentPayload.tags.length === 1 ? '' : 's'}
              {currentPayload.community ? `, community ${currentPayload.community}` : ''}.
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setView('list'); setError(null); }}
                disabled={!!busy}
                className="rounded-lg border border-[var(--hrk-border-default,#3a424a)] px-3 py-1.5 text-sm font-medium text-[var(--hrk-text-secondary,#cfd3da)] hover:bg-[var(--hrk-bg-hover,#2f353d)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!!busy || !name.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--hrk-brand,#e31337)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--hrk-brand-active,#c41030)] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save template
              </button>
            </div>
          </div>
        ) : (
          /* ── List view ───────────────────────────────────────────── */
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--hrk-text-tertiary,#9ca3b0)]">
                {templates.length === 0
                  ? 'No saved templates yet.'
                  : `${templates.length} template${templates.length === 1 ? '' : 's'}`}
              </p>
              <button
                type="button"
                onClick={() => { setView('save'); setName(''); setError(null); }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--hrk-brand,#e31337)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--hrk-brand-active,#c41030)]"
              >
                <Save className="h-3 w-3" />
                Save current post as template
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {templates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--hrk-border-default,#3a424a)] p-6 text-center text-sm text-[var(--hrk-text-tertiary,#9ca3b0)]">
                  Save your current post as a template to start a reusable
                  collection. Templates remember the title, body, tags and
                  community — perfect for recurring posts.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {templates.map((t) => (
                    <li
                      key={t.name}
                      className="flex items-center gap-2 rounded-lg border border-[var(--hrk-border-subtle,#3a424a)] bg-[var(--hrk-bg-surface-sunken,#2f353d)] px-3 py-2"
                    >
                      <button
                        type="button"
                        onClick={() => setConfirmApply(t)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate text-sm font-medium text-[var(--hrk-text-primary,#f0f0f8)]">
                          {t.name}
                        </div>
                        <div className="truncate text-[11px] text-[var(--hrk-text-tertiary,#9ca3b0)]">
                          {(t.title || '(no title)').slice(0, 80)}
                          {t.tags && t.tags.length > 0 ? `  ·  #${t.tags.slice(0, 3).join(' #')}` : ''}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(t)}
                        className="rounded-md p-1.5 text-[var(--hrk-text-tertiary,#9ca3b0)] hover:bg-red-500/15 hover:text-red-400"
                        title={`Delete template "${t.name}"`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PostTemplatesPanel;
