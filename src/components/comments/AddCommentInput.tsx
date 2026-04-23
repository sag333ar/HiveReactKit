/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Send, X, User, Bold, Italic, Link, Smile, Code, Copy, Check, AtSign, FileText, Eye, EyeOff, BarChart3, Tag, Coins, Lock, ThumbsUp } from 'lucide-react';
import { REWARD_OPTIONS, REWARD_OPTION_LABELS, type RewardOption } from '../../utils/commentOptions';
import ImageUploader from '../composer/ImageUploader';
import AudioUploader from '../composer/AudioUploader';
import VideoUploader from '../composer/VideoUploader';
import GiphyPicker from '../composer/GiphyPicker';
import EmojiPicker from '../composer/EmojiPicker';
import TemplatePicker from '../composer/TemplatePicker';
import PollCreator from '../composer/PollCreator';
import type { PollData } from '../composer/PollCreator';
import { TemplateModel, templateService } from '../../services/templateService';
import { uploadToHiveImages, type PostingSignMessageFn } from '../../services/hiveImageUpload';
import { createHiveRenderer } from '@snapie/renderer';

export interface PostComposerProps {
  onSubmit: (body: string) => void | boolean | Promise<void | boolean>;
  onCancel?: () => void;
  currentUser?: string;
  placeholder?: string;
  parentAuthor?: string;
  parentPermlink?: string;

  /** Ecency image hosting token — enables image/video thumbnail upload and paste/drag upload */
  ecencyToken?: string;
  /** Optional signer used when Ecency image uploads fail. Signs a posting-key message for images.hive.blog. */
  onSignMessage?: PostingSignMessageFn;
  /** Hive username used for the signed images.hive.blog fallback upload. */
  signingUsername?: string;
  /** 3Speak API key — enables audio and video upload */
  threeSpeakApiKey?: string;
  /** GIPHY API key — enables GIF search */
  giphyApiKey?: string;
  /** HReplier API token — enables template picker */
  templateToken?: string;
  /** Custom template API endpoint (defaults to https://hreplier-api.sagarkothari88.one/data/templates) */
  templateApiBaseUrl?: string;

  /** Hide individual toolbar features */
  hideBold?: boolean;
  hideItalic?: boolean;
  hideLink?: boolean;
  hideImage?: boolean;
  hideAudio?: boolean;
  hideVideo?: boolean;
  hideEmoji?: boolean;
  hideGif?: boolean;
  hideCode?: boolean;
  hideMention?: boolean;
  hideTemplate?: boolean;
  hidePreview?: boolean;
  hidePoll?: boolean;

  /** Called when a poll is attached/updated. Receives PollData or null when removed */
  onPollChange?: (poll: import('../composer/PollCreator').PollData | null) => void;

  /**
   * Locked default tags. Shown in the tag manager with a lock icon and
   * cannot be edited or removed. Forwarded on every `onTagsChange` call as
   * the leading entries in the merged list. Capped at 10 total.
   */
  defaultTags?: string[];
  /** Max total tags including defaults (default 10). */
  maxTags?: number;
  /** Called whenever the user-added tags change. Receives the full merged list (defaults first). */
  onTagsChange?: (tags: string[]) => void;
  /** Hide the tag manager toolbar button. */
  hideTags?: boolean;

  /**
   * Reward routing selection (default `'default'` = 50% HBD / 50% HP).
   * Controlled or uncontrolled — if omitted, the composer manages its own state.
   */
  reward?: RewardOption;
  /** Initial reward option when uncontrolled (default `'default'`). */
  defaultReward?: RewardOption;
  /** Called when the reward routing changes. Pair with `buildCommentOptions(...)` at broadcast time. */
  onRewardChange?: (reward: RewardOption) => void;
  /** Hide the reward routing toolbar button. */
  hideReward?: boolean;

  /**
   * Show the "upvote on publish" toggle in the toolbar (default false — opt-in).
   * Set this to `!alreadyVoted` so the button hides once the user has voted on the parent.
   */
  showVoteButton?: boolean;
  /** Initial toggle state for upvote-on-publish (default false). */
  defaultVoteEnabled?: boolean;
  /** Initial slider percent (1–100, step 0.25, default 100). */
  defaultVotePercent?: number;
  /**
   * Called whenever the upvote-on-publish toggle or percent changes.
   * `enabled=false` => consumer should post a plain comment.
   * `enabled=true`  => consumer should broadcast vote+comment together at `percent`.
   */
  onVoteChange?: (enabled: boolean, percent: number) => void;
  /** Label shown next to the slider (default "Upvote parent on publish"). */
  voteLabel?: string;

  /** Show cancel button (default true) */
  showCancel?: boolean;
  /** Submit button label (default "Post") */
  submitLabel?: string;
  /** Title text above composer (optional) */
  title?: string;
  /** Enable preview by default (default false) */
  defaultPreviewOn?: boolean;
  /** Controlled mode: external value */
  value?: string;
  /** Controlled mode: called when body changes */
  onChange?: (value: string) => void;
  /** Disable the entire composer */
  disabled?: boolean;
  /** Hide the built-in submit button and keyboard hint footer (default false). Use when providing external submit buttons */
  hideSubmitArea?: boolean;
  /** Ref that receives a { submit(), getFinalBody(), clear() } handle. Call submit() from external buttons to trigger the full submit flow. Call getFinalBody() to get body with audio/video URLs appended without submitting. Call clear() to reset all state. */
  submitRef?: React.MutableRefObject<{ submit: () => Promise<void>; getFinalBody: () => string; clear: () => void } | null>;
  /** Hide the avatar and username header (default false) */
  hideUserHeader?: boolean;
  /** Custom background color for the composer container (e.g. "#262b30", "transparent") */
  bgColor?: string;
  /** Custom border color for the composer container (e.g. "#3a424a", "transparent") */
  borderColor?: string;
  /** Disable auto-focus on mount (default false). Use when the composer is always visible and shouldn't steal scroll. */
  disableAutoFocus?: boolean;
  /** Text shown in blinking amber while waiting for wallet approval during the hive image fallback. */
  walletApprovalLabel?: string;
  /** When true, force the blinking wallet-approval banner on (e.g. during a post/reply broadcast). */
  awaitingWalletApproval?: boolean;
}

/** @deprecated Use PostComposerProps instead */
export type AddCommentInputProps = PostComposerProps;

const PostComposer = ({
  onSubmit,
  onCancel,
  currentUser,
  placeholder = "Write in Markdown...",
  parentAuthor,
  parentPermlink,
  ecencyToken,
  onSignMessage,
  signingUsername,
  threeSpeakApiKey,
  giphyApiKey,
  templateToken,
  templateApiBaseUrl,
  hideBold,
  hideItalic,
  hideLink,
  hideImage,
  hideAudio,
  hideVideo,
  hideEmoji,
  hideGif,
  hideCode,
  hideMention,
  hideTemplate,
  hidePreview,
  hidePoll,
  onPollChange,
  defaultTags,
  maxTags = 10,
  onTagsChange,
  hideTags,
  reward,
  defaultReward = 'default',
  onRewardChange,
  hideReward,
  showVoteButton = false,
  defaultVoteEnabled = false,
  defaultVotePercent = 100,
  onVoteChange,
  voteLabel = 'Upvote parent on publish',
  showCancel = true,
  submitLabel = "Post",
  title,
  defaultPreviewOn = false,
  value,
  onChange,
  disabled = false,
  hideSubmitArea = false,
  submitRef,
  hideUserHeader = false,
  bgColor,
  borderColor,
  disableAutoFocus = false,
  walletApprovalLabel = 'Open Keychain App & Approve',
  awaitingWalletApproval = false,
}: PostComposerProps) => {
  const [internalBody, setInternalBody] = useState('');
  const body = value !== undefined ? value : internalBody;
  const setBody = (v: string) => {
    if (onChange) onChange(v);
    else setInternalBody(v);
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDisabled = disabled || isSubmitting;
  const [isGiphyOpen, setIsGiphyOpen] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(defaultPreviewOn);
  const [audioEmbedUrl, setAudioEmbedUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [videoEmbedUrl, setVideoEmbedUrl] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);
  const [templates, setTemplates] = useState<TemplateModel[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingPaste, setUploadingPaste] = useState(false);
  const [isAwaitingApproval, setIsAwaitingApproval] = useState(false);
  const pasteAbortRef = useRef<AbortController | null>(null);
  const [pollData, setPollData] = useState<PollData | null>(null);
  const [isPollOpen, setIsPollOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragCounterRef = useRef(0);

  // Tag manager — default tags are locked, user-added tags are editable.
  const lockedTags = useMemo(
    () => (defaultTags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
    [defaultTags],
  );
  const [userTags, setUserTags] = useState<string[]>([]);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const mergedTags = useMemo(() => [...lockedTags, ...userTags], [lockedTags, userTags]);
  const remainingTagSlots = Math.max(0, maxTags - mergedTags.length);
  // Notify parent whenever the merged list changes.
  useEffect(() => {
    onTagsChange?.(mergedTags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedTags.join('|')]);

  const addUserTag = useCallback(
    (raw: string) => {
      const tag = raw.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '-');
      if (!tag) return;
      if (mergedTags.includes(tag)) return;
      if (mergedTags.length >= maxTags) return;
      setUserTags((prev) => [...prev, tag]);
    },
    [mergedTags, maxTags],
  );
  const removeUserTag = useCallback((tag: string) => {
    setUserTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  // Upvote-on-publish toggle + slider. The composer owns the UI; the consumer owns the broadcast.
  // Slider step is 0.25%; clamp rounds to the nearest 0.25 within [0.25, 100].
  const clampPercent = (n: number) => {
    const snapped = Math.round(n * 4) / 4;
    return Math.max(0.25, Math.min(100, snapped));
  };
  const formatPercent = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
  const [voteEnabled, setVoteEnabled] = useState<boolean>(defaultVoteEnabled);
  const [votePercent, setVotePercent] = useState<number>(clampPercent(defaultVotePercent));
  useEffect(() => {
    onVoteChange?.(voteEnabled, votePercent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voteEnabled, votePercent]);

  // Reward routing — controlled or uncontrolled.
  const [internalReward, setInternalReward] = useState<RewardOption>(defaultReward);
  const currentReward = reward ?? internalReward;
  const [isRewardOpen, setIsRewardOpen] = useState(false);
  const selectReward = useCallback(
    (next: RewardOption) => {
      if (reward === undefined) setInternalReward(next);
      onRewardChange?.(next);
      setIsRewardOpen(false);
    },
    [reward, onRewardChange],
  );

  // Popover anchoring — render through a portal so ancestor `overflow-hidden`
  // (e.g. modals wrapping the composer) cannot clip the dropdowns.
  const tagsBtnRef = useRef<HTMLButtonElement>(null);
  const rewardBtnRef = useRef<HTMLButtonElement>(null);
  const tagsPopoverRef = useRef<HTMLDivElement>(null);
  const rewardPopoverRef = useRef<HTMLDivElement>(null);
  const [tagsAnchor, setTagsAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const [rewardAnchor, setRewardAnchor] = useState<{ top: number; left: number; width: number } | null>(null);

  // Popover widths (px) — kept in sync with the content's max widths.
  const TAGS_POPOVER_WIDTH = 288; // w-72
  const REWARD_POPOVER_WIDTH = 224; // w-56
  const VIEWPORT_MARGIN = 8;

  // Center the popover horizontally in the viewport; vertical position stays anchored
  // just below the button so the user sees the connection. Width is clamped to the viewport.
  const readAnchor = (btn: HTMLButtonElement | null, preferredWidth: number) => {
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.min(preferredWidth, Math.max(0, vw - VIEWPORT_MARGIN * 2));
    const left = Math.max(VIEWPORT_MARGIN, Math.round((vw - width) / 2));
    return { top: r.bottom + 4, left, width };
  };

  const toggleTagsOpen = useCallback(() => {
    setIsRewardOpen(false);
    setIsTagsOpen((prev) => {
      const next = !prev;
      setTagsAnchor(next ? readAnchor(tagsBtnRef.current, TAGS_POPOVER_WIDTH) : null);
      return next;
    });
  }, []);
  const toggleRewardOpen = useCallback(() => {
    setIsTagsOpen(false);
    setIsRewardOpen((prev) => {
      const next = !prev;
      setRewardAnchor(next ? readAnchor(rewardBtnRef.current, REWARD_POPOVER_WIDTH) : null);
      return next;
    });
  }, []);

  // Close either popover on outside click and on window resize/scroll.
  useEffect(() => {
    if (!isTagsOpen && !isRewardOpen) return;
    const closeAll = () => { setIsTagsOpen(false); setIsRewardOpen(false); };
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      const inTagsBtn = tagsBtnRef.current?.contains(t);
      const inRewardBtn = rewardBtnRef.current?.contains(t);
      const inTagsPop = tagsPopoverRef.current?.contains(t);
      const inRewardPop = rewardPopoverRef.current?.contains(t);
      if (inTagsBtn || inRewardBtn || inTagsPop || inRewardPop) return;
      closeAll();
    };
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('resize', closeAll);
    window.addEventListener('scroll', closeAll, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('resize', closeAll);
      window.removeEventListener('scroll', closeAll, true);
    };
  }, [isTagsOpen, isRewardOpen]);

  // Hive content renderer using @snapie/renderer
  const renderMarkdown = useMemo(() => {
    try {
      return createHiveRenderer({
        baseUrl: 'https://hive.blog/',
        ipfsGateway: 'https://ipfs.3speak.tv',
        assetsWidth: 640,
        assetsHeight: 390,
        usertagUrlFn: (user: string) => `https://peakd.com/@${user}`,
        hashtagUrlFn: (tag: string) => `https://peakd.com/created/${tag}`,
        convertHiveUrls: true,
      });
    } catch (_e) {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!disableAutoFocus && textareaRef.current) textareaRef.current.focus();
  }, [disableAutoFocus]);

  // Clear media attachments when controlled value is reset to empty (external submit)
  // Note: pollData is NOT cleared here — polls are independent of text content.
  // Polls are cleared only on successful internal submit or via the remove button.
  useEffect(() => {
    if (value !== undefined && value === '') {
      setAudioEmbedUrl(null);
      setAudioDuration(0);
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      setVideoEmbedUrl(null);
      setVideoPreviewUrl(null);
    }
  }, [value]);

  // Fetch templates when templateToken is provided
  useEffect(() => {
    if (!templateToken) { setTemplates([]); return; }
    templateService.getTemplates(templateToken, templateApiBaseUrl)
      .then(setTemplates)
      .catch((err) => console.error('Failed to fetch templates:', err));
  }, [templateToken, templateApiBaseUrl]);

  const insertAtCursor = useCallback((before: string, after = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end);
    const newBody = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(newBody);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  }, [body]);

  const insertText = useCallback((text: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    setBody(body.slice(0, start) + text + body.slice(start));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  }, [body]);

  const insertCodeBlock = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end);
    if (selected.includes('\n') || selected.length === 0) {
      const codeBlock = '```\n' + (selected || 'code here') + '\n```';
      const newBody = body.slice(0, start) + codeBlock + body.slice(end);
      setBody(newBody);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + 4, start + 4 + (selected.length || 9));
      }, 0);
    } else {
      insertAtCursor('`', '`');
    }
  }, [body, insertAtCursor]);

  const insertMention = useCallback(() => {
    if (parentAuthor) {
      insertText(`@${parentAuthor} `);
    } else {
      insertText('@');
    }
  }, [parentAuthor, insertText]);

  const handleCopyCode = useCallback((code: string, blockIndex: number) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedBlock(blockIndex);
      setTimeout(() => setCopiedBlock(null), 2000);
    });
  }, []);

  const canHiveFallback = Boolean(onSignMessage && signingUsername);
  const canUploadImages = Boolean(ecencyToken) || canHiveFallback;

  // Try Ecency first, then signed images.hive.blog fallback if configured.
  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    if (!file.type.startsWith('image/')) return null;
    if (file.size > 10 * 1024 * 1024) {
      console.error('Image too large (max 10MB)');
      return null;
    }

    const controller = new AbortController();
    pasteAbortRef.current = controller;
    const signal = controller.signal;

    const tryEcency = async (): Promise<string> => {
      if (!ecencyToken) throw new Error('Ecency token not provided');
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`https://images.ecency.com/hs/${ecencyToken}`, {
        method: 'POST',
        body: formData,
        signal,
      });
      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
      const data = await response.json();
      if (!data.url) throw new Error('No URL from ecency');
      return data.url as string;
    };

    try {
      try {
        return await tryEcency();
      } catch (ecencyErr) {
        if (signal.aborted) return null;
        if (!canHiveFallback) {
          console.error('Image upload failed:', ecencyErr);
          return null;
        }
        try {
          return await uploadToHiveImages(onSignMessage!, signingUsername!, file, undefined, {
            onSignStart: () => { if (!signal.aborted) setIsAwaitingApproval(true); },
            onSignEnd: () => setIsAwaitingApproval(false),
            signal,
          });
        } catch (hiveErr) {
          if (signal.aborted) return null;
          console.error('Image upload failed (hive fallback):', hiveErr);
          return null;
        }
      }
    } finally {
      if (pasteAbortRef.current === controller) pasteAbortRef.current = null;
    }
  }, [ecencyToken, canHiveFallback, onSignMessage, signingUsername]);

  const cancelPasteUpload = useCallback(() => {
    if (pasteAbortRef.current) {
      pasteAbortRef.current.abort();
      pasteAbortRef.current = null;
    }
    setIsAwaitingApproval(false);
    setUploadingPaste(false);
  }, []);

  // Handle paste with image
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!canUploadImages) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;
        setUploadingPaste(true);
        const url = await uploadImage(file);
        setUploadingPaste(false);
        if (url) insertText(`![Image](${url})\n`);
        return;
      }
    }
  }, [canUploadImages, uploadImage, insertText]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!canUploadImages) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, [canUploadImages]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    if (!canUploadImages) return;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        setUploadingPaste(true);
        const url = await uploadImage(file);
        setUploadingPaste(false);
        if (url) insertText(`![Image](${url})\n`);
      }
    }
  }, [canUploadImages, uploadImage, insertText]);

  const handleSubmit = async () => {
    if (!body.trim() || isDisabled) return;
    setIsSubmitting(true);
    try {
      let finalBody = body.trim();
      if (audioEmbedUrl) finalBody += `\n${audioEmbedUrl}`;
      if (videoEmbedUrl) finalBody += `\n${videoEmbedUrl}`;
      const result = await Promise.resolve(onSubmit(finalBody));
      // If onSubmit returns false, the operation was cancelled — preserve text and attachments
      if (result === false) return;
      setBody('');
      setAudioEmbedUrl(null);
      setAudioDuration(0);
      setVideoEmbedUrl(null);
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
      setPollData(null);
      onPollChange?.(null);
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Expose submit, getFinalBody, clear to external buttons via ref
  useEffect(() => {
    if (submitRef) submitRef.current = {
      submit: handleSubmit,
      getFinalBody: () => {
        let finalBody = body.trim();
        if (audioEmbedUrl) finalBody += `\n${audioEmbedUrl}`;
        if (videoEmbedUrl) finalBody += `\n${videoEmbedUrl}`;
        return finalBody;
      },
      clear: () => {
        setBody('');
        setAudioEmbedUrl(null);
        setAudioDuration(0);
        setVideoEmbedUrl(null);
        if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
        setVideoPreviewUrl(null);
        setPollData(null);
        onPollChange?.(null);
      },
    };
    return () => { if (submitRef) submitRef.current = null; };
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape' && onCancel) onCancel();
  };

  const removeAudio = () => { setAudioEmbedUrl(null); setAudioDuration(0); };
  const removeVideo = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoEmbedUrl(null); setVideoPreviewUrl(null);
  };

  // Preview rendering with code block copy buttons
  const renderCodePreview = useCallback(() => {
    if (!body.trim()) return null;
    const parts = body.split(/(```[\s\S]*?```)/g);
    let codeBlockIdx = 0;
    return (
      <div className="space-y-2">
        {parts.map((part, i) => {
          if (part.startsWith('```') && part.endsWith('```')) {
            const code = part.slice(3, -3).replace(/^\w*\n?/, '');
            const blockIdx = codeBlockIdx++;
            return (
              <div key={i} className="relative group rounded-lg overflow-hidden">
                <pre className="bg-gray-950 text-green-400 p-3 rounded-lg text-xs overflow-x-auto font-mono">
                  <code>{code.trim() || ' '}</code>
                </pre>
                <button
                  type="button"
                  onClick={() => handleCopyCode(code.trim(), blockIdx)}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                  title="Copy code"
                >
                  {copiedBlock === blockIdx ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            );
          }
          const inlineParts = part.split(/(`[^`]+`)/g);
          return (
            <span key={i}>
              {inlineParts.map((ip, j) => {
                if (ip.startsWith('`') && ip.endsWith('`')) {
                  const code = ip.slice(1, -1);
                  return (
                    <code
                      key={j}
                      className="bg-gray-800 text-amber-400 px-1.5 py-0.5 rounded text-xs font-mono cursor-pointer hover:bg-gray-700 transition-colors"
                      title="Click to copy"
                      onClick={() => navigator.clipboard.writeText(code)}
                    >
                      {code}
                    </code>
                  );
                }
                return ip.trim() ? <span key={j} className="text-gray-300 text-sm">{ip}</span> : null;
              })}
            </span>
          );
        })}
      </div>
    );
  }, [body, copiedBlock, handleCopyCode]);

  const toolbarBtnClass = "p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-50";

  return (
    <div
      className={`p-4 md:p-6 space-y-3 rounded-xl border transition-colors ${isDragging ? 'border-blue-500 bg-blue-900/10' : ''}`}
      style={{
        backgroundColor: isDragging ? undefined : (bgColor || '#111827'),
        borderColor: isDragging ? undefined : (borderColor || '#374151'),
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Title (optional) */}
      {title && <h3 className="text-white font-semibold text-base">{title}</h3>}

      {/* Header with user info */}
      {!hideUserHeader && (
        <div className="flex items-center justify-start space-x-3 text-left">
          <div className="flex-shrink-0">
            {currentUser ? (
              <img
                src={`https://images.hive.blog/u/${currentUser}/avatar`}
                alt={currentUser}
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-600"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${currentUser}&background=random`; }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                <User className="w-6 h-6 text-gray-400" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm text-white font-medium">{currentUser ? `@${currentUser}` : 'Anonymous'}</div>
            {parentAuthor && <div className="text-xs text-gray-400">Replying to @{parentAuthor}</div>}
          </div>
        </div>
      )}

      {/* Hive Content Renderer Preview — above everything */}
      {showPreview && body.trim() && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 overflow-hidden max-h-[300px] flex flex-col">
          <div className="px-3 py-2 text-xs uppercase tracking-wide text-gray-400 bg-gray-800 border-b border-gray-700 flex items-center justify-between shrink-0">
            <span>Preview</span>
            {(body.includes('```') || /`[^`]+`/.test(body)) && (
              <span className="text-[10px] text-gray-500 normal-case">Hover code blocks to copy</span>
            )}
          </div>
          <div className="p-3 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {renderMarkdown ? (
              <div
                className="rendered-body text-white text-sm overflow-x-auto prose prose-invert prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
              />
            ) : (
              renderCodePreview()
            )}
          </div>
        </div>
      )}

      {/* Audio attachment preview */}
      {audioEmbedUrl && (
        <div className="rounded-lg border border-gray-700 bg-gray-800 overflow-hidden">
          <div className="relative" style={{ height: '60px', overflow: 'hidden' }}>
            <iframe
              src={audioEmbedUrl}
              title="Audio preview"
              className="w-full border-0 absolute top-0 left-0"
              style={{ height: '200px' }}
              allow="autoplay; encrypted-media"
              loading="lazy"
            />
          </div>
          <div className="flex items-center gap-2 border-t border-gray-700 px-3 py-1.5">
            <span className="flex-1 truncate text-xs text-gray-400">
              Audio attached{audioDuration > 0 ? ` (${Math.floor(audioDuration / 60)}:${String(audioDuration % 60).padStart(2, '0')})` : ''}
            </span>
            <button type="button" onClick={removeAudio} className="shrink-0 rounded p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors" title="Remove audio">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Video attachment preview */}
      {videoEmbedUrl && (
        <div className="rounded-lg border border-gray-700 bg-gray-800 overflow-hidden">
          {videoPreviewUrl ? (
            <video src={videoPreviewUrl} controls playsInline preload="metadata" className="w-full" style={{ maxHeight: '200px' }} />
          ) : (
            <div className="h-20 flex items-center justify-center text-gray-400 text-xs">Video attached</div>
          )}
          <div className="flex items-center gap-2 border-t border-gray-700 px-3 py-1.5">
            <span className="flex-1 truncate text-xs text-gray-400">Video attached</span>
            <button type="button" onClick={removeVideo} className="shrink-0 rounded p-0.5 text-gray-400 hover:text-red-400" title="Remove video">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Poll preview */}
      {pollData && (
        <div className="rounded-lg border border-gray-700 bg-gray-800 overflow-hidden">
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 mb-1.5">
              <BarChart3 className="h-3.5 w-3.5 shrink-0 text-blue-400" />
              <span className="flex-1 truncate text-xs font-medium text-white">{pollData.question}</span>
              <button type="button" onClick={() => setIsPollOpen(true)} className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-700 hover:text-white" title="Edit poll">
                <Code className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => { setPollData(null); onPollChange?.(null); }}
                className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-700 hover:text-red-400"
                title="Remove poll"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {pollData.choices.map((c, i) => (
                <span key={i} className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-300">{c}</span>
              ))}
            </div>
            <div className="mt-1.5 text-[10px] text-gray-500">
              Ends {new Date(pollData.end_time * 1000).toLocaleDateString()} &middot; Max {pollData.max_choices_voted} choice{pollData.max_choices_voted > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-700 pb-2">
        {/* Preview toggle */}
        {!hidePreview && (
          <button
            type="button"
            onClick={() => setShowPreview(v => !v)}
            className={`${toolbarBtnClass} ${showPreview ? 'bg-gray-700 text-blue-400' : ''}`}
            title={showPreview ? 'Hide preview' : 'Show preview'}
            disabled={isDisabled}
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {!hideBold && (
          <button type="button" onClick={() => insertAtCursor('**', '**')} className={toolbarBtnClass} title="Bold" disabled={isDisabled}>
            <Bold className="h-4 w-4" />
          </button>
        )}
        {!hideItalic && (
          <button type="button" onClick={() => insertAtCursor('*', '*')} className={toolbarBtnClass} title="Italic" disabled={isDisabled}>
            <Italic className="h-4 w-4" />
          </button>
        )}
        {!hideLink && (
          <button type="button" onClick={() => insertAtCursor('[', '](url)')} className={toolbarBtnClass} title="Link" disabled={isDisabled}>
            <Link className="h-4 w-4" />
          </button>
        )}
        {!hideCode && (
          <button type="button" onClick={insertCodeBlock} className={toolbarBtnClass} title="Code block" disabled={isDisabled}>
            <Code className="h-4 w-4" />
          </button>
        )}
        {!hideMention && (
          <button type="button" onClick={insertMention} className={toolbarBtnClass} title={parentAuthor ? `Mention @${parentAuthor}` : 'Mention'} disabled={isDisabled}>
            <AtSign className="h-4 w-4" />
          </button>
        )}

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {!hideImage && canUploadImages && (
          <ImageUploader
            onImageUploaded={(url) => insertText(`![Image](${url})`)}
            ecencyToken={ecencyToken}
            onSignMessage={onSignMessage}
            signingUsername={signingUsername}
            onSigningStateChange={setIsAwaitingApproval}
            walletApprovalLabel={walletApprovalLabel}
            disabled={isDisabled}
          />
        )}
        {!hideAudio && threeSpeakApiKey && (
          <AudioUploader
            onAudioUploaded={(url, duration) => { setAudioEmbedUrl(url); setAudioDuration(duration); }}
            username={currentUser}
            threeSpeakApiKey={threeSpeakApiKey}
            disabled={isSubmitting || !!audioEmbedUrl}
          />
        )}
        {!hideVideo && threeSpeakApiKey && (
          <VideoUploader
            onVideoUploaded={(embedUrl, _uploadUrl, _aspectRatio, localFile) => {
              setVideoEmbedUrl(embedUrl);
              if (localFile) setVideoPreviewUrl(URL.createObjectURL(localFile));
            }}
            username={currentUser}
            ecencyToken={ecencyToken}
            onSignMessage={onSignMessage}
            threeSpeakApiKey={threeSpeakApiKey}
            disabled={isSubmitting || !!videoEmbedUrl}
          />
        )}
        {!hideEmoji && (
          <button type="button" onClick={() => setIsEmojiOpen(true)} className={toolbarBtnClass} title="Emoji" disabled={isDisabled}>
            <Smile className="h-4 w-4" />
          </button>
        )}
        {!hideGif && giphyApiKey && (
          <button type="button" onClick={() => setIsGiphyOpen(true)} className={`${toolbarBtnClass} text-xs font-bold px-2`} title="GIF" disabled={isDisabled}>
            GIF
          </button>
        )}
        {!hideTemplate && templateToken && templates.length > 0 && (
          <button type="button" onClick={() => setIsTemplateOpen(true)} className={toolbarBtnClass} title="Insert template" disabled={isDisabled}>
            <FileText className="h-4 w-4" />
          </button>
        )}
        {!hidePoll && (
          <button
            type="button"
            onClick={() => setIsPollOpen(true)}
            className={`${toolbarBtnClass} ${pollData ? 'text-blue-400' : ''}`}
            title={pollData ? 'Edit poll' : 'Create poll'}
            disabled={isDisabled}
          >
            <BarChart3 className="h-4 w-4" />
          </button>
        )}

        {!hideTags && (
          <button
            ref={tagsBtnRef}
            type="button"
            onClick={toggleTagsOpen}
            className={`${toolbarBtnClass} ${userTags.length > 0 ? 'text-blue-400' : ''}`}
            title={`Tags (${mergedTags.length}/${maxTags})`}
            disabled={isDisabled}
          >
            <Tag className="h-4 w-4" />
          </button>
        )}

        {!hideReward && (
          <button
            ref={rewardBtnRef}
            type="button"
            onClick={toggleRewardOpen}
            className={`${toolbarBtnClass} ${currentReward !== 'default' ? 'text-blue-400' : ''}`}
            title={`Rewards: ${REWARD_OPTION_LABELS[currentReward]}`}
            disabled={isDisabled}
          >
            <Coins className="h-4 w-4" />
          </button>
        )}

        {showVoteButton && (
          <button
            type="button"
            onClick={() => setVoteEnabled(v => !v)}
            className={`${toolbarBtnClass} ${voteEnabled ? 'text-blue-400' : ''}`}
            title={voteEnabled ? `Upvote on publish: ${formatPercent(votePercent)}%` : 'Upvote parent on publish'}
            disabled={isDisabled}
          >
            <ThumbsUp className="h-4 w-4" fill={voteEnabled ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      {/* Inline upvote slider — visible only when the toggle is on. */}
      {showVoteButton && voteEnabled && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/60 px-3 pt-4 pb-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-gray-300">{voteLabel}</span>
            <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">
              {formatPercent(votePercent)}%
            </span>
          </div>
          <input
            type="range"
            min={0.25}
            max={100}
            step={0.25}
            value={votePercent}
            onChange={(e) => setVotePercent(clampPercent(Number(e.target.value)))}
            disabled={isDisabled}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600 [&::-webkit-slider-runnable-track]:rounded-lg [&::-webkit-slider-runnable-track]:h-2 [&::-moz-range-track]:rounded-lg [&::-moz-range-track]:h-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:-mt-1 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white disabled:opacity-50"
            style={{ background: `linear-gradient(to right, #2563eb ${votePercent}%, #374151 ${votePercent}%)` }}
          />
          <div className="mt-1 flex justify-between text-[10px] text-gray-400">
            {[1, 25, 50, 75, 100].map((stop) => (
              <button
                key={stop}
                type="button"
                onClick={() => setVotePercent(stop)}
                disabled={isDisabled}
                className={`rounded px-1 transition hover:text-blue-300 disabled:opacity-50 ${votePercent === stop ? 'font-bold text-blue-400' : ''}`}
              >
                {stop}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Wallet approval indicator (blinking amber) — shown during image signing OR broadcast. */}
      {(isAwaitingApproval || awaitingWalletApproval) && (
        <div className="px-1 py-0.5">
          <span className="text-sm text-amber-400 animate-pulse">{walletApprovalLabel}</span>
        </div>
      )}

      {/* Textarea with drag-drop overlay */}
      <div className="relative">
        {isDragging && (
          <div className="absolute inset-0 z-10 bg-blue-900/30 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-blue-300 font-medium text-sm">Drop image to upload</span>
          </div>
        )}
        {uploadingPaste && (
          <div className="absolute inset-0 z-10 bg-gray-900/80 rounded-lg flex flex-col items-center justify-center gap-3 p-4 text-center">
            {isAwaitingApproval ? (
              <span className="text-sm text-amber-400 animate-pulse">{walletApprovalLabel}</span>
            ) : (
              <div className="flex items-center gap-2 text-blue-400 text-sm">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                Uploading image...
              </div>
            )}
            <button
              type="button"
              onClick={cancelPasteUpload}
              className="px-3 py-1 rounded border border-gray-600 text-gray-300 hover:bg-gray-800 text-xs"
            >
              Cancel
            </button>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={canUploadImages ? `${placeholder}\n(Paste or drag & drop images here)` : placeholder}
          disabled={isDisabled}
          rows={4}
          className="w-full min-h-[100px] max-h-[300px] p-3 border border-gray-700 rounded-lg resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 text-white placeholder-gray-500 transition-colors duration-200 disabled:opacity-50 text-sm font-mono"
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = target.scrollHeight + 'px';
          }}
        />

        {/* Tag strip — mirrors the tag manager; tap the Tag toolbar icon to add/remove. */}
        {!hideTags && mergedTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 px-0.5">
            {lockedTags.map((t) => (
              <span
                key={`strip-locked-${t}`}
                className="inline-flex items-center gap-1 rounded-full bg-gray-700/70 px-2 py-0.5 text-[11px] text-gray-200"
                title="Default tag — cannot be removed"
              >
                <Lock className="h-2.5 w-2.5 text-gray-400" />
                {t}
              </span>
            ))}
            {userTags.map((t) => (
              <span
                key={`strip-user-${t}`}
                className="inline-flex items-center gap-1 rounded-full bg-blue-600/20 px-2 py-0.5 text-[11px] text-blue-200"
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeUserTag(t)}
                  className="rounded-full p-0.5 text-blue-200 hover:bg-blue-600/40 hover:text-white disabled:opacity-50"
                  title={`Remove ${t}`}
                  disabled={isDisabled}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            <span className="ml-auto text-[10px] text-gray-500">{mergedTags.length}/{maxTags}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {!hideSubmitArea && (
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-gray-500">
            {navigator.platform?.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter to post
            {canUploadImages && <span className="ml-2">| Paste/drop images</span>}
          </div>
          <div className="flex items-center space-x-3">
            {showCancel && onCancel && (
              <button onClick={onCancel} disabled={isDisabled} className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50">
                Cancel
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={isDisabled || !body.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Posting...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{submitLabel}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <GiphyPicker
        isOpen={isGiphyOpen}
        onClose={() => setIsGiphyOpen(false)}
        onSelectGif={(url) => { insertText(`![GIF](${url})`); setIsGiphyOpen(false); }}
        giphyApiKey={giphyApiKey}
      />
      <EmojiPicker
        isOpen={isEmojiOpen}
        onClose={() => setIsEmojiOpen(false)}
        onSelectEmoji={(emoji) => { insertText(emoji); setIsEmojiOpen(false); }}
      />
      <TemplatePicker
        isOpen={isTemplateOpen}
        onClose={() => setIsTemplateOpen(false)}
        onSelectTemplate={insertText}
        templates={templates}
        authorFromUrl={parentAuthor}
      />
      <PollCreator
        isOpen={isPollOpen}
        onClose={() => setIsPollOpen(false)}
        onSave={(poll) => { setPollData(poll); onPollChange?.(poll); }}
        initialData={pollData}
      />

      {/* Tags popover — portalled so ancestor overflow:hidden cannot clip it. */}
      {isTagsOpen && tagsAnchor && createPortal(
        <div
          ref={tagsPopoverRef}
          style={{ position: 'fixed', top: tagsAnchor.top, left: tagsAnchor.left, width: tagsAnchor.width }}
          className="z-[9999] rounded-lg border border-gray-700 bg-gray-900 p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Tags</span>
            <span className="text-[10px] text-gray-500">{mergedTags.length} / {maxTags}</span>
          </div>
          <div className="mb-2 flex flex-wrap gap-1">
            {lockedTags.map((t) => (
              <span
                key={`locked-${t}`}
                className="inline-flex items-center gap-1 rounded-full bg-gray-700/70 px-2 py-0.5 text-xs text-gray-200"
                title="Default tag — cannot be removed"
              >
                <Lock className="h-3 w-3 text-gray-400" />
                {t}
              </span>
            ))}
            {userTags.map((t) => (
              <span
                key={`user-${t}`}
                className="inline-flex items-center gap-1 rounded-full bg-blue-600/20 px-2 py-0.5 text-xs text-blue-200"
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeUserTag(t)}
                  className="rounded-full p-0.5 text-blue-200 hover:bg-blue-600/40 hover:text-white"
                  title={`Remove ${t}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {mergedTags.length === 0 && (
              <span className="text-xs text-gray-500">No tags yet</span>
            )}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addUserTag(tagDraft);
                  setTagDraft('');
                }
              }}
              placeholder={remainingTagSlots > 0 ? 'Add a tag' : 'Max tags reached'}
              disabled={remainingTagSlots === 0}
              className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-100 placeholder-gray-500 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => { addUserTag(tagDraft); setTagDraft(''); }}
              disabled={remainingTagSlots === 0 || !tagDraft.trim()}
              className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-100 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* Reward popover — portalled. */}
      {isRewardOpen && rewardAnchor && createPortal(
        <div
          ref={rewardPopoverRef}
          style={{ position: 'fixed', top: rewardAnchor.top, left: rewardAnchor.left, width: rewardAnchor.width }}
          className="z-[9999] rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-xl"
        >
          {REWARD_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => selectReward(opt)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-800"
            >
              <span>{REWARD_OPTION_LABELS[opt]}</span>
              {currentReward === opt && <Check className="h-4 w-4 text-blue-400" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
};

/** @deprecated Use PostComposer instead */
const AddCommentInput = PostComposer;

export { PostComposer };
export default AddCommentInput;
