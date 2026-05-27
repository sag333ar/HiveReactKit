/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Send, X, User, Bold, Italic, Link, Smile, Code, Copy, Check, AtSign, FileText, Eye, EyeOff, BarChart3, Tag, Coins, Lock, ThumbsUp, Users, Play, HelpCircle, Image as ImageIcon, Mic, Video } from 'lucide-react';
import { REWARD_OPTIONS, REWARD_OPTION_LABELS, type RewardOption } from '../../utils/commentOptions';
import {
  THREESPEAK_FUND_ACCOUNT,
  THREESPEAK_FUND_PERCENT,
  bodyHasVideo,
  enforceLockedBeneficiaries,
  type Beneficiary,
} from '../../utils/beneficiaries';
import ImageUploader from '../composer/ImageUploader';
import AudioUploader from '../composer/AudioUploader';
import VideoUploader from '../composer/VideoUploader';
import GiphyPicker from '../composer/GiphyPicker';
import YoutubePicker from '../composer/YoutubePicker';
import EmojiPicker from '../composer/EmojiPicker';
import TemplatePicker from '../composer/TemplatePicker';
import MemePicker from '../composer/MemePicker';
import DecentMemesPicker from '../composer/DecentMemesPicker';
import ToolbarHelpModal, { type ToolbarHelpEntry } from '../composer/ToolbarHelpModal';
import {
  decentMemesAsBeneficiaries,
  getDecentMemesLimit,
  pickDecentMemesKind,
  type DecentMemesMeme,
} from '../../utils/decentmemes';
import PollCreator from '../composer/PollCreator';
import BeneficiariesEditor from '../composer/BeneficiariesEditor';
import type { PollData } from '../composer/PollCreator';
import { TemplateModel, templateService } from '../../services/templateService';
import { uploadToHiveImages, type PostingSignMessageFn } from '../../services/hiveImageUpload';
import { createHiveRenderer } from '@snapie/renderer';
import { caretOffsetInTextarea, MentionSuggest, useMentionAutocomplete } from './MentionSuggest';

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
  /** YouTube Data API v3 key — enables the YouTube video picker */
  youtubeApiKey?: string;
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
  /** Hide the YouTube search/embed button. */
  hideYoutube?: boolean;
  hideCode?: boolean;
  hideMention?: boolean;
  hideTemplate?: boolean;
  /** Hide the meme-maker button. Defaults to showing it whenever the
   *  composer has an image-upload path configured (ecency token or
   *  hive-signer). Pulls templates from memegen.link and renders the
   *  captioned PNG via MemePicker, then inserts it as an image. */
  hideMeme?: boolean;
  /** Hide the DecentMemes-maker button. Same upload-path gate as
   *  `hideMeme`. Opens the embedded DecentMemes widget so users can
   *  build a meme there, then re-upload the downloaded file via the
   *  composer's standard pipeline. */
  hideDecentMeme?: boolean;
  /** Optional. Forwarded to DecentMemes as `frontendInit.account` so the
   *  widget assigns the 1% frontend beneficiary slot. PeakD opted out per
   *  spec; pass your own Hive account here to claim the slot. */
  decentMemesAppAccount?: string;
  /** Optional. Forwarded to DecentMemes as `frontendInit.theme` on load
   *  and via `setTheme` on changes. Defaults to dark widget-side. */
  decentMemesTheme?: 'light' | 'dark';
  /** Called whenever a DecentMemes meme is attached to the composer.
   *  Receives the cumulative list (one entry per `memeCreated`). Use
   *  this list to aggregate beneficiaries (`comment_options`) and stamp
   *  `json_metadata.decentmemes.templateIds` at broadcast time. Cleared
   *  on successful submit. See `src/utils/decentmemes.ts`. */
  onDecentMemesChange?: (memes: DecentMemesMeme[]) => void;
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
  /**
   * Editable tags seeded into the composer on mount — typically the user's
   * personal default tags from app settings. Unlike `defaultTags`, these
   * render as removable chips so the user can take them off per-post.
   * Any value already in `defaultTags` (locked) is filtered out.
   */
  initialUserTags?: string[];
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
   * Beneficiary list (controlled). When provided, the composer mirrors this
   * list and emits changes through `onBeneficiariesChange`. The
   * `threespeakfund` 10% lock is applied automatically while the body
   * contains a 3Speak video URL or the embedded video uploader has produced
   * one — there is no need for the consumer to inject it.
   */
  beneficiaries?: Beneficiary[];
  /**
   * Initial beneficiary list when uncontrolled. Useful for pre-populating the
   * composer from a user's saved defaults.
   */
  defaultBeneficiaries?: Beneficiary[];
  /** Called whenever the beneficiary list changes (after the 3Speak video lock is applied). */
  onBeneficiariesChange?: (beneficiaries: Beneficiary[]) => void;
  /**
   * Suggested beneficiary chips shown inside the editor modal — typically the
   * user's previously-used presets pulled from app settings.
   */
  beneficiaryFavorites?: Beneficiary[];
  /** Hide the beneficiary toolbar button. */
  hideBeneficiaries?: boolean;

  /**
   * Show the "upvote on publish" toggle in the toolbar (default false — opt-in).
   * Set this to `!alreadyVoted` so the button hides once the user has voted on the parent.
   */
  showVoteButton?: boolean;
  /** Initial toggle state for upvote-on-publish (default false). */
  defaultVoteEnabled?: boolean;
  /** Initial slider percent (1–100, default 100). Snapped to `voteWeightStep`. */
  defaultVotePercent?: number;
  /** Slider precision for the upvote-on-publish slider. Use 0.25, 0.5, or 1.
   *  Default 0.25 (back-compat). */
  voteWeightStep?: number;
  /** Allow landscape (horizontal) videos in the embedded VideoUploader.
   *  Default false — only portrait clips, matching the hSnaps Moments contract.
   *  Set true on apps where horizontal video is acceptable (e.g. hivesuite). */
  allowLandscapeVideos?: boolean;
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
  /** Custom background color for the composer container (e.g. "var(--hrk-bg-surface)", "transparent") */
  bgColor?: string;
  /** Custom border color for the composer container (e.g. "var(--hrk-border-default)", "transparent") */
  borderColor?: string;
  /** Disable auto-focus on mount (default false). Use when the composer is always visible and shouldn't steal scroll. */
  disableAutoFocus?: boolean;
  /** Text shown in blinking amber while waiting for wallet approval during the hive image fallback. */
  walletApprovalLabel?: string;
  /** When true, force the blinking wallet-approval banner on (e.g. during a post/reply broadcast). */
  awaitingWalletApproval?: boolean;
  /** Seed list for the `@`-mention autocomplete dropdown. Typically the
   *  parent post's author followed by every `@account` mentioned in the
   *  post body, deduped. These appear at the top of the suggestion list
   *  before the user types anything; once they type 3+ chars the kit
   *  also calls `condenser_api.get_account_reputations` for live
   *  results. Omit to disable autocomplete entirely. */
  mentionSeedAccounts?: string[];
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
  youtubeApiKey,
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
  hideYoutube,
  hideCode,
  hideMention,
  hideTemplate,
  hideMeme,
  hideDecentMeme,
  decentMemesAppAccount,
  decentMemesTheme,
  onDecentMemesChange,
  hidePreview,
  hidePoll,
  onPollChange,
  defaultTags,
  initialUserTags,
  maxTags = 10,
  onTagsChange,
  hideTags,
  reward,
  defaultReward = 'default',
  onRewardChange,
  hideReward,
  beneficiaries,
  defaultBeneficiaries,
  onBeneficiariesChange,
  beneficiaryFavorites,
  hideBeneficiaries,
  showVoteButton = false,
  defaultVoteEnabled = false,
  defaultVotePercent = 100,
  voteWeightStep = 0.25,
  allowLandscapeVideos = false,
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
  mentionSeedAccounts,
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
  const [isYoutubeOpen, setIsYoutubeOpen] = useState(false);
  const [isMemeOpen, setIsMemeOpen] = useState(false);
  const [isDecentMemeOpen, setIsDecentMemeOpen] = useState(false);
  // Per-composer-session list of DecentMemes attachments. The widget sends
  // one `memeCreated` per insertion; we accumulate and let the host
  // aggregate via `aggregateDecentMemesBeneficiaries` at broadcast time.
  // Cleared on successful submit so the next post starts fresh.
  const [decentMemes, setDecentMemes] = useState<DecentMemesMeme[]>([]);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
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

  // Mention autocomplete: parent author first, then any account
  // explicitly mentioned by the consumer via `mentionSeedAccounts`
  // (typically the post body's mentions). Deduped, lowercased.
  const mentionSeed = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    const add = (raw?: string | null) => {
      const v = (raw || '').toLowerCase().trim();
      if (!v || seen.has(v)) return;
      seen.add(v);
      out.push(v);
    };
    add(parentAuthor);
    for (const a of mentionSeedAccounts ?? []) add(a);
    return out;
  }, [parentAuthor, mentionSeedAccounts]);
  const mentions = useMentionAutocomplete(body, { seedAccounts: mentionSeed });

  // Tag manager — default tags are locked, user-added tags are editable.
  const lockedTags = useMemo(
    () => (defaultTags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
    [defaultTags],
  );
  const [userTags, setUserTags] = useState<string[]>(() => {
    // Seed editable tags from the host (e.g. user's Settings defaults),
    // dropping anything that already lives in the locked list so the chip
    // doesn't appear twice.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of initialUserTags ?? []) {
      const t = String(raw).trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '-');
      if (!t || seen.has(t) || lockedTags.includes(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  });
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const mergedTags = useMemo(() => [...lockedTags, ...userTags], [lockedTags, userTags]);
  const remainingTagSlots = Math.max(0, maxTags - mergedTags.length);
  // Notify parent whenever the merged list changes.
  useEffect(() => {
    onTagsChange?.(mergedTags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedTags.join('|')]);

  // Notify parent whenever the DecentMemes attachment list changes.
  useEffect(() => {
    onDecentMemesChange?.(decentMemes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decentMemes]);

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
  // Slider step comes from the `voteWeightStep` prop (0.25 / 0.5 / 1). Snap rounds
  // to the nearest step within [step, 100].
  const clampPercent = (n: number) => {
    const safeStep = voteWeightStep > 0 ? voteWeightStep : 0.25;
    const snapped = Math.round(n / safeStep) * safeStep;
    const min = safeStep;
    return Math.max(min, Math.min(100, parseFloat(snapped.toFixed(4))));
  };
  const decimals = voteWeightStep >= 1 ? 0 : voteWeightStep >= 0.5 ? 1 : 2;
  const formatPercent = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(decimals));
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

  // Beneficiary state. The composer keeps its own working copy and reflects
  // controlled `beneficiaries` when supplied. Two auto-injected locks ride
  // alongside whatever the user chose:
  //   • 3Speak fund — 10% whenever the body has a video.
  //   • DecentMemes — per-meme creator / submitter / frontend entries,
  //     aggregated + capped to 10% (top-level post) or 30% (reply).
  // Both are re-applied any time their source state changes so the chip
  // strip and the broadcast op always agree.
  const hasVideo = useMemo(
    () => Boolean(videoEmbedUrl) || bodyHasVideo(body),
    [videoEmbedUrl, body],
  );
  const decentMemesKind = useMemo(
    () => pickDecentMemesKind(parentAuthor),
    [parentAuthor],
  );
  const lockedBeneficiaries = useMemo<Beneficiary[]>(() => {
    const list: Beneficiary[] = [];
    if (hasVideo) {
      list.push({ account: THREESPEAK_FUND_ACCOUNT, weight: THREESPEAK_FUND_PERCENT });
    }
    list.push(...decentMemesAsBeneficiaries(decentMemes, decentMemesKind));
    return list;
  }, [hasVideo, decentMemes, decentMemesKind]);
  const lockedAccountsList = useMemo(
    () => lockedBeneficiaries.map((b) => b.account),
    [lockedBeneficiaries],
  );
  const lockReasons = useMemo<Record<string, string>>(() => {
    const reasons: Record<string, string> = {};
    if (hasVideo) {
      reasons[THREESPEAK_FUND_ACCOUNT] = '10% to threespeakfund is required for video posts';
    }
    for (const meme of decentMemes) {
      for (const entry of meme.beneficiaries[decentMemesKind] ?? []) {
        const acc = entry.account;
        if (!acc) continue;
        const label = meme.template.name ? `template "${meme.template.name}"` : 'a DecentMemes meme';
        reasons[acc] = `Auto-attached by ${label} (${entry.role ?? 'beneficiary'}) — required by the DecentMemes integration`;
      }
    }
    return reasons;
  }, [hasVideo, decentMemes, decentMemesKind]);

  const [internalBeneficiaries, setInternalBeneficiaries] = useState<Beneficiary[]>(() =>
    enforceLockedBeneficiaries(defaultBeneficiaries, []),
  );
  const currentBeneficiaries = beneficiaries ?? internalBeneficiaries;
  // Whenever the locked-list inputs change, re-enforce so locked rows
  // appear / scale / disappear without the user having to re-open the editor.
  useEffect(() => {
    if (beneficiaries !== undefined) return; // controlled — consumer owns it
    setInternalBeneficiaries((prev) => enforceLockedBeneficiaries(prev, lockedBeneficiaries));
  }, [lockedBeneficiaries, beneficiaries]);
  const [isBeneficiariesOpen, setIsBeneficiariesOpen] = useState(false);
  const handleBeneficiariesSave = useCallback(
    (next: Beneficiary[]) => {
      const enforced = enforceLockedBeneficiaries(next, lockedBeneficiaries);
      if (beneficiaries === undefined) setInternalBeneficiaries(enforced);
      onBeneficiariesChange?.(enforced);
    },
    [lockedBeneficiaries, beneficiaries, onBeneficiariesChange],
  );
  // Notify parent on initial mount + whenever video lock toggles in
  // uncontrolled mode, so the broadcast operations always reflect the lock.
  useEffect(() => {
    if (beneficiaries !== undefined) return;
    onBeneficiariesChange?.(internalBeneficiaries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalBeneficiaries.map((b) => `${b.account}:${b.weight}`).join('|')]);

  // Reward popover anchoring — render through a portal so ancestor `overflow-hidden`
  // (e.g. modals wrapping the composer) cannot clip the dropdown. The Tags panel is
  // inline (see the tag strip below the textarea) so it needs no anchor plumbing.
  const rewardBtnRef = useRef<HTMLButtonElement>(null);
  const rewardPopoverRef = useRef<HTMLDivElement>(null);
  const [rewardAnchor, setRewardAnchor] = useState<{ top: number; left: number; width: number } | null>(null);

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
    setIsTagsOpen((prev) => !prev);
  }, []);
  const toggleRewardOpen = useCallback(() => {
    setIsTagsOpen(false);
    setIsRewardOpen((prev) => {
      const next = !prev;
      setRewardAnchor(next ? readAnchor(rewardBtnRef.current, REWARD_POPOVER_WIDTH) : null);
      return next;
    });
  }, []);

  // Close the reward popover on outside click and on window resize/scroll.
  useEffect(() => {
    if (!isRewardOpen) return;
    const close = () => setIsRewardOpen(false);
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rewardBtnRef.current?.contains(t) || rewardPopoverRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [isRewardOpen]);

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
      setDecentMemes([]);
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
        setDecentMemes([]);
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
                <pre className="bg-gray-950 text-[var(--hrk-success)] p-3 rounded-lg text-xs overflow-x-auto font-mono">
                  <code>{code.trim() || ' '}</code>
                </pre>
                <button
                  type="button"
                  onClick={() => handleCopyCode(code.trim(), blockIdx)}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-[var(--hrk-bg-surface)] hover:bg-[var(--hrk-bg-surface-raised)] text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-text-primary)] transition-colors opacity-0 group-hover:opacity-100"
                  title="Copy code"
                >
                  {copiedBlock === blockIdx ? <Check className="h-3.5 w-3.5 text-[var(--hrk-success)]" /> : <Copy className="h-3.5 w-3.5" />}
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
                      className="bg-[var(--hrk-bg-surface)] text-[var(--hrk-warning)] px-1.5 py-0.5 rounded text-xs font-mono cursor-pointer hover:bg-[var(--hrk-bg-surface-raised)] transition-colors"
                      title="Click to copy"
                      onClick={() => navigator.clipboard.writeText(code)}
                    >
                      {code}
                    </code>
                  );
                }
                return ip.trim() ? <span key={j} className="text-[var(--hrk-text-secondary)] text-sm">{ip}</span> : null;
              })}
            </span>
          );
        })}
      </div>
    );
  }, [body, copiedBlock, handleCopyCode]);

  const toolbarBtnClass = "p-2 rounded-lg hover:bg-[var(--hrk-bg-surface-raised)] text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-text-primary)] transition-colors disabled:opacity-50";

  return (
    <div
      className={`p-4 md:p-6 space-y-3 rounded-[14px] border transition-colors ${isDragging ? 'border-[var(--hrk-info)] bg-[var(--hrk-info-soft)]' : ''}`}
      style={{
        backgroundColor: isDragging ? undefined : (bgColor || 'var(--hrk-bg-surface-sunken)'),
        borderColor: isDragging ? undefined : (borderColor || 'var(--hrk-border-subtle)'),
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
                className="w-10 h-10 rounded-full object-cover border-2 border-[var(--hrk-border-default)]"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${currentUser}&background=random`; }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[var(--hrk-bg-surface-raised)] flex items-center justify-center">
                <User className="w-6 h-6 text-[var(--hrk-text-tertiary)]" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm text-white font-medium">{currentUser ? `@${currentUser}` : 'Anonymous'}</div>
            {parentAuthor && <div className="text-xs text-[var(--hrk-text-tertiary)]">Replying to @{parentAuthor}</div>}
          </div>
        </div>
      )}

      {/* Hive Content Renderer Preview — above everything */}
      {showPreview && body.trim() && (
        <div className="rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)]/50 overflow-hidden max-h-[300px] flex flex-col">
          <div className="px-3 py-2 text-xs uppercase tracking-wide text-[var(--hrk-text-tertiary)] bg-[var(--hrk-bg-surface)] border-b border-[var(--hrk-border-subtle)] flex items-center justify-between shrink-0">
            <span>Preview</span>
            {(body.includes('```') || /`[^`]+`/.test(body)) && (
              <span className="text-[10px] text-[var(--hrk-text-tertiary)] normal-case">Hover code blocks to copy</span>
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
        <div className="rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] overflow-hidden">
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
          <div className="flex items-center gap-2 border-t border-[var(--hrk-border-subtle)] px-3 py-1.5">
            <span className="flex-1 truncate text-xs text-[var(--hrk-text-tertiary)]">
              Audio attached{audioDuration > 0 ? ` (${Math.floor(audioDuration / 60)}:${String(audioDuration % 60).padStart(2, '0')})` : ''}
            </span>
            <button type="button" onClick={removeAudio} className="shrink-0 rounded p-1.5 text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-danger)] hover:bg-[var(--hrk-bg-surface-raised)] transition-colors" title="Remove audio">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Video attachment preview */}
      {videoEmbedUrl && (
        <div className="rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] overflow-hidden">
          {videoPreviewUrl ? (
            <video src={videoPreviewUrl} controls playsInline preload="metadata" className="w-full" style={{ maxHeight: '200px' }} />
          ) : (
            <div className="h-20 flex items-center justify-center text-[var(--hrk-text-tertiary)] text-xs">Video attached</div>
          )}
          <div className="flex items-center gap-2 border-t border-[var(--hrk-border-subtle)] px-3 py-1.5">
            <span className="flex-1 truncate text-xs text-[var(--hrk-text-tertiary)]">Video attached</span>
            <button type="button" onClick={removeVideo} className="shrink-0 rounded p-0.5 text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-danger)]" title="Remove video">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Poll preview */}
      {pollData && (
        <div className="rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] overflow-hidden">
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 mb-1.5">
              <BarChart3 className="h-3.5 w-3.5 shrink-0 text-[var(--hrk-info)]" />
              <span className="flex-1 truncate text-xs font-medium text-white">{pollData.question}</span>
              <button type="button" onClick={() => setIsPollOpen(true)} className="shrink-0 rounded p-0.5 text-[var(--hrk-text-tertiary)] hover:bg-[var(--hrk-bg-surface-raised)] hover:text-[var(--hrk-text-primary)]" title="Edit poll">
                <Code className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => { setPollData(null); onPollChange?.(null); }}
                className="shrink-0 rounded p-0.5 text-[var(--hrk-text-tertiary)] hover:bg-[var(--hrk-bg-surface-raised)] hover:text-[var(--hrk-danger)]"
                title="Remove poll"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {pollData.choices.map((c, i) => (
                <span key={i} className="rounded-full bg-[var(--hrk-bg-surface-raised)] px-2 py-0.5 text-xs text-[var(--hrk-text-secondary)]">{c}</span>
              ))}
            </div>
            <div className="mt-1.5 text-[10px] text-[var(--hrk-text-tertiary)]">
              Ends {new Date(pollData.end_time * 1000).toLocaleDateString()} &middot; Max {pollData.max_choices_voted} choice{pollData.max_choices_voted > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--hrk-border-subtle)] pb-2">
        {/* Preview toggle */}
        {!hidePreview && (
          <button
            type="button"
            onClick={() => setShowPreview(v => !v)}
            className={`${toolbarBtnClass} ${showPreview ? 'bg-[var(--hrk-bg-surface-raised)] text-[var(--hrk-info)]' : ''}`}
            title={showPreview ? 'Hide preview' : 'Show preview'}
            disabled={isDisabled}
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}

        <div className="w-px h-5 bg-[var(--hrk-bg-surface-raised)] mx-1" />

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

        <div className="w-px h-5 bg-[var(--hrk-bg-surface-raised)] mx-1" />

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
            allowLandscape={allowLandscapeVideos}
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
        {!hideYoutube && youtubeApiKey && (
          <button
            type="button"
            onClick={() => setIsYoutubeOpen(true)}
            className={toolbarBtnClass}
            title="Insert YouTube video"
            disabled={isDisabled}
          >
            <span className="inline-flex h-4 w-[22px] items-center justify-center rounded-sm bg-[#ff0000]">
              <Play className="h-2.5 w-2.5 fill-white text-white" />
            </span>
          </button>
        )}
        {/* Meme maker — visible when the composer has any image-upload
            path configured (ecency token or hive-signer). Sits beside
            the GIF button so users discover both. */}
        {!hideMeme && (ecencyToken || (onSignMessage && signingUsername)) && (
          <button
            type="button"
            onClick={() => setIsMemeOpen(true)}
            className={`${toolbarBtnClass} text-xs font-bold px-2`}
            title="Meme"
            disabled={isDisabled}
          >
            MEME
          </button>
        )}
        {/* DecentMemes — sibling meme picker that embeds the DecentMemes
            widget. Same upload-path gate as the built-in meme picker.
            Uses the official DM logo as the toolbar icon. The button is
            disabled (not hidden) once the user hits the per-broadcast
            attachment limit — 3 for posts, 2 for comments — so the cap
            is discoverable rather than mysterious. */}
        {!hideDecentMeme && (ecencyToken || (onSignMessage && signingUsername)) && (() => {
          const decentMemesLimit = getDecentMemesLimit(decentMemesKind);
          const limitReached = decentMemes.length >= decentMemesLimit;
          return (
            <button
              type="button"
              onClick={() => setIsDecentMemeOpen(true)}
              className={toolbarBtnClass}
              title={
                limitReached
                  ? `DecentMemes limit reached (${decentMemes.length}/${decentMemesLimit} for ${decentMemesKind === 'post' ? 'posts' : 'comments'})`
                  : `DecentMemes (${decentMemes.length}/${decentMemesLimit})`
              }
              disabled={isDisabled || limitReached}
            >
              <img
                src="https://decentmemes.com/svg/DM.svg"
                alt="DecentMemes"
                className="h-4 w-4"
                draggable={false}
              />
            </button>
          );
        })()}
        {!hideTemplate && templateToken && templates.length > 0 && (
          <button type="button" onClick={() => setIsTemplateOpen(true)} className={toolbarBtnClass} title="Insert template" disabled={isDisabled}>
            <FileText className="h-4 w-4" />
          </button>
        )}
        {!hidePoll && (
          <button
            type="button"
            onClick={() => setIsPollOpen(true)}
            className={`${toolbarBtnClass} ${pollData ? 'text-[var(--hrk-info)]' : ''}`}
            title={pollData ? 'Edit poll' : 'Create poll'}
            disabled={isDisabled}
          >
            <BarChart3 className="h-4 w-4" />
          </button>
        )}

        {!hideTags && (
          <button
            type="button"
            onClick={toggleTagsOpen}
            className={`${toolbarBtnClass} ${isTagsOpen ? 'bg-[var(--hrk-bg-surface-raised)] text-[var(--hrk-info)]' : userTags.length > 0 ? 'text-[var(--hrk-info)]' : ''}`}
            title={isTagsOpen ? 'Hide tag editor' : `Tags (${mergedTags.length}/${maxTags})`}
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
            className={`${toolbarBtnClass} ${currentReward !== 'default' ? 'text-[var(--hrk-info)]' : ''}`}
            title={`Rewards: ${REWARD_OPTION_LABELS[currentReward]}`}
            disabled={isDisabled}
          >
            <Coins className="h-4 w-4" />
          </button>
        )}

        {!hideBeneficiaries && (
          <button
            type="button"
            onClick={() => setIsBeneficiariesOpen(true)}
            className={`${toolbarBtnClass} ${currentBeneficiaries.length > 0 ? 'text-[var(--hrk-info)]' : ''}`}
            title={
              currentBeneficiaries.length > 0
                ? `Beneficiaries (${currentBeneficiaries.length})`
                : 'Add beneficiaries'
            }
            disabled={isDisabled}
          >
            <Users className="h-4 w-4" />
          </button>
        )}

        {showVoteButton && (
          <button
            type="button"
            onClick={() => setVoteEnabled(v => !v)}
            className={`${toolbarBtnClass} ${voteEnabled ? 'text-[var(--hrk-info)]' : ''}`}
            title={voteEnabled ? `Upvote on publish: ${formatPercent(votePercent)}%` : 'Upvote parent on publish'}
            disabled={isDisabled}
          >
            <ThumbsUp className="h-4 w-4" fill={voteEnabled ? 'currentColor' : 'none'} />
          </button>
        )}

        {/* Help — opens a popup that documents every visible toolbar button.
            Always rendered last so users always know where to look for it. */}
        <button
          type="button"
          onClick={() => setIsHelpOpen(true)}
          className={toolbarBtnClass}
          title="What does each button do?"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>

      {/* Inline upvote slider — visible only when the toggle is on. */}
      {showVoteButton && voteEnabled && (
        <div className="rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)]/60 px-3 pt-4 pb-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-[var(--hrk-text-secondary)]">{voteLabel}</span>
            <span className="rounded-md bg-[var(--hrk-brand)] px-2 py-0.5 text-[11px] font-semibold text-white">
              {formatPercent(votePercent)}%
            </span>
          </div>
          <input
            type="range"
            min={voteWeightStep}
            max={100}
            step={voteWeightStep}
            value={votePercent}
            onChange={(e) => setVotePercent(clampPercent(Number(e.target.value)))}
            disabled={isDisabled}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600 [&::-webkit-slider-runnable-track]:rounded-lg [&::-webkit-slider-runnable-track]:h-2 [&::-moz-range-track]:rounded-lg [&::-moz-range-track]:h-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--hrk-brand)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:-mt-1 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--hrk-brand)] [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white disabled:opacity-50"
            style={{ background: `linear-gradient(to right, var(--hrk-info) ${votePercent}%, var(--hrk-border-default) ${votePercent}%)` }}
          />
          <div className="mt-1 flex justify-between text-[10px] text-[var(--hrk-text-tertiary)]">
            {[1, 25, 50, 75, 100].map((stop) => (
              <button
                key={stop}
                type="button"
                onClick={() => setVotePercent(stop)}
                disabled={isDisabled}
                className={`rounded px-1 transition hover:text-[var(--hrk-info)] disabled:opacity-50 ${votePercent === stop ? 'font-bold text-[var(--hrk-info)]' : ''}`}
              >
                {stop}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Wallet-approval indicator (blinking amber) — shown only while
          a Keychain / HiveAuth / PeakVault popup is active. Two
          triggers:
            • `isAwaitingApproval` — set by the image-signing flow.
            • `awaitingWalletApproval` — set by the host app when the
              logged-in user is on a wallet provider; we gate that on
              `isSubmitting` so the hint only blinks during the
              broadcast, not whenever the composer is open. */}
      {(isAwaitingApproval || (awaitingWalletApproval && isSubmitting)) && (
        <div className="px-1 py-0.5">
          <span className="text-sm text-[var(--hrk-warning)] animate-pulse">{walletApprovalLabel}</span>
        </div>
      )}

      {/* Textarea with drag-drop overlay */}
      <div className="relative">
        {isDragging && (
          <div className="absolute inset-0 z-10 bg-[var(--hrk-info-soft)] border-2 border-dashed border-[var(--hrk-info)] rounded-lg flex items-center justify-center">
            <span className="text-[var(--hrk-info)] font-medium text-sm">Drop image to upload</span>
          </div>
        )}
        {uploadingPaste && (
          <div className="absolute inset-0 z-10 bg-[var(--hrk-bg-app)]/80 rounded-lg flex flex-col items-center justify-center gap-3 p-4 text-center">
            {isAwaitingApproval ? (
              <span className="text-sm text-[var(--hrk-warning)] animate-pulse">{walletApprovalLabel}</span>
            ) : (
              <div className="flex items-center gap-2 text-[var(--hrk-info)] text-sm">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                Uploading image...
              </div>
            )}
            <button
              type="button"
              onClick={cancelPasteUpload}
              className="px-3 py-1 rounded border border-[var(--hrk-border-default)] text-[var(--hrk-text-secondary)] hover:bg-[var(--hrk-bg-surface)] text-xs"
            >
              Cancel
            </button>
          </div>
        )}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              mentions.onValueChange(e.target.value, e.target.selectionStart ?? e.target.value.length);
            }}
            onKeyUp={(e) => {
              // Caret may move via arrow keys / mouse without firing
              // onChange — keep the autocomplete state in sync.
              const t = e.currentTarget;
              mentions.onValueChange(t.value, t.selectionStart ?? t.value.length);
            }}
            onClick={(e) => {
              const t = e.currentTarget;
              mentions.onValueChange(t.value, t.selectionStart ?? t.value.length);
            }}
            onBlur={() => {
              // Defer so a click on a suggestion row can apply before the
              // dropdown unmounts. The dropdown's onMouseDown also calls
              // preventDefault so blur doesn't fire there either.
              window.setTimeout(() => mentions.dismiss(), 100);
            }}
            onKeyDown={(e) => {
              if (mentions.onKeyDown(e)) {
                // If the autocomplete consumed Enter / Tab, apply the
                // current selection and short-circuit the parent handler
                // so we don't also submit / insert a tab character.
                if (e.key === 'Enter' || e.key === 'Tab') {
                  const next = mentions.apply();
                  if (next) {
                    setBody(next.value);
                    // Move caret after the inserted username + space.
                    requestAnimationFrame(() => {
                      const t = textareaRef.current;
                      if (!t) return;
                      t.focus();
                      t.setSelectionRange(next.caret, next.caret);
                    });
                  }
                }
                return;
              }
              handleKeyDown(e);
            }}
            onPaste={handlePaste}
            placeholder={canUploadImages ? `${placeholder}\n(Paste or drag & drop images here)` : placeholder}
            disabled={isDisabled}
            rows={4}
            className="w-full min-h-[100px] max-h-[300px] p-3 border border-[var(--hrk-border-subtle)] rounded-lg resize-y focus:ring-2 focus:ring-[var(--hrk-info)] focus:border-[var(--hrk-info)] bg-[var(--hrk-bg-surface)] text-white placeholder-[var(--hrk-text-tertiary)] transition-colors duration-200 disabled:opacity-50 text-sm font-mono"
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            }}
          />
          {/* Mention autocomplete — anchored just below the line the
              caret is on so the dropdown never covers the user's
              typed `@…` token. `caretOffsetInTextarea` derives the
              offset from the live computed line-height + padding +
              the textarea's scrollTop. */}
          {mentions.active && (
            <div
              className="absolute z-30"
              style={caretOffsetInTextarea(textareaRef.current, mentions.match?.end ?? 0)}
            >
              <MentionSuggest
                candidates={mentions.candidates}
                highlightedIndex={mentions.highlightedIndex}
                onHover={mentions.setHighlightedIndex}
                onSelect={(account) => {
                  const next = mentions.apply(account);
                  if (!next) return;
                  setBody(next.value);
                  requestAnimationFrame(() => {
                    const t = textareaRef.current;
                    if (!t) return;
                    t.focus();
                    t.setSelectionRange(next.caret, next.caret);
                  });
                }}
              />
            </div>
          )}
        </div>

        {/* Tag strip — inline chips + (optional) add-tag input row. */}
        {!hideTags && (mergedTags.length > 0 || isTagsOpen) && (
          <div className="flex flex-col gap-1.5 px-0.5">
            {mergedTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {lockedTags.map((t) => (
                  <span
                    key={`strip-locked-${t}`}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--hrk-bg-surface-raised)]/70 px-2 py-0.5 text-[11px] text-[var(--hrk-text-primary)]"
                    title="Default tag — cannot be removed"
                  >
                    <Lock className="h-2.5 w-2.5 text-[var(--hrk-text-tertiary)]" />
                    {t}
                  </span>
                ))}
                {userTags.map((t) => (
                  <span
                    key={`strip-user-${t}`}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--hrk-brand)]/20 px-2 py-0.5 text-[11px] text-blue-200"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeUserTag(t)}
                      className="rounded-full p-0.5 text-blue-200 hover:bg-[var(--hrk-brand)]/40 hover:text-[var(--hrk-text-primary)] disabled:opacity-50"
                      title={`Remove ${t}`}
                      disabled={isDisabled}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <span className="ml-auto text-[10px] text-[var(--hrk-text-tertiary)]">{mergedTags.length}/{maxTags}</span>
              </div>
            )}
            {isTagsOpen && (
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
                    } else if (e.key === 'Escape') {
                      setIsTagsOpen(false);
                    }
                  }}
                  placeholder={remainingTagSlots > 0 ? 'Add a tag (Enter to save)' : 'Max tags reached'}
                  disabled={remainingTagSlots === 0 || isDisabled}
                  autoFocus
                  className="flex-1 rounded border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] px-2 py-1 text-xs text-[var(--hrk-text-primary)] placeholder-[var(--hrk-text-tertiary)] outline-none focus:border-[var(--hrk-info)] disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => { addUserTag(tagDraft); setTagDraft(''); }}
                  disabled={remainingTagSlots === 0 || !tagDraft.trim() || isDisabled}
                  className="rounded border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] px-2 py-1 text-xs text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        )}

        {/* Beneficiary strip — chips under the tag strip. Click any chip to
            open the editor; auto-attached entries (threespeakfund + DecentMemes
            creator/submitter/frontend) carry a lock icon and a tooltip. */}
        {!hideBeneficiaries && currentBeneficiaries.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1 px-0.5">
            <span className="text-[10px] uppercase tracking-wide text-[var(--hrk-text-tertiary)] mr-1">Beneficiaries</span>
            {currentBeneficiaries.map((b) => {
              const locked = lockedAccountsList.includes(b.account);
              const lockTitle = lockReasons[b.account] ?? `Auto-attached @${b.account}`;
              return (
                <button
                  key={`bene-${b.account}`}
                  type="button"
                  onClick={() => setIsBeneficiariesOpen(true)}
                  className={`inline-flex items-center gap-1 rounded-full pl-0.5 pr-2 py-0.5 text-[11px] ${
                    locked
                      ? 'bg-[var(--hrk-warning-soft)] text-[var(--hrk-warning)] border border-[var(--hrk-warning)]/40'
                      : 'bg-[var(--hrk-brand)]/20 text-blue-200 border border-[var(--hrk-info)]/30'
                  }`}
                  title={locked ? lockTitle : 'Edit beneficiaries'}
                  disabled={isDisabled}
                >
                  <img
                    src={`https://images.hive.blog/u/${b.account}/avatar`}
                    alt={`@${b.account}`}
                    width={16}
                    height={16}
                    className="rounded-full bg-[var(--hrk-bg-surface-raised)] border border-[var(--hrk-border-default)] object-cover shrink-0"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (!img.dataset.fallback) {
                        img.dataset.fallback = '1';
                        img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(b.account)}&background=random&size=64`;
                      }
                    }}
                  />
                  {locked && <Lock className="h-2.5 w-2.5" />}
                  @{b.account} <span className="opacity-80">{b.weight}%</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setIsBeneficiariesOpen(true)}
              className="ml-1 rounded-full border border-dashed border-[var(--hrk-border-default)] px-2 py-0.5 text-[11px] text-[var(--hrk-text-tertiary)] hover:border-blue-400 hover:text-[var(--hrk-info)]"
              disabled={isDisabled}
              title="Edit beneficiaries"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      {!hideSubmitArea && (
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-[var(--hrk-text-tertiary)]">
            {navigator.platform?.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter to post
            {canUploadImages && <span className="ml-2">| Paste/drop images</span>}
          </div>
          <div className="flex items-center space-x-3">
            {showCancel && onCancel && (
              <button onClick={onCancel} disabled={isDisabled} className="px-4 py-2 text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-text-primary)] transition-colors disabled:opacity-50">
                Cancel
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={isDisabled || !body.trim()}
              className="px-6 py-2 bg-[var(--hrk-brand)] hover:bg-[var(--hrk-brand-hover)] disabled:bg-[var(--hrk-bg-surface-raised)] text-white rounded-lg font-medium transition-all disabled:opacity-50 flex items-center space-x-2"
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
      <YoutubePicker
        isOpen={isYoutubeOpen}
        onClose={() => setIsYoutubeOpen(false)}
        onSelectVideo={(url) => { insertText(`\n${url}\n`); setIsYoutubeOpen(false); }}
        youtubeApiKey={youtubeApiKey}
      />
      <MemePicker
        isOpen={isMemeOpen}
        onClose={() => setIsMemeOpen(false)}
        onSelectMeme={(url) => { insertText(`![Meme](${url})`); setIsMemeOpen(false); }}
        ecencyToken={ecencyToken}
        onSignMessage={onSignMessage}
        signingUsername={signingUsername}
        onSigningStateChange={setIsAwaitingApproval}
      />
      <DecentMemesPicker
        isOpen={isDecentMemeOpen}
        onClose={() => setIsDecentMemeOpen(false)}
        onSelectMeme={(url, meta) => {
          insertText(`![Meme](${url})`);
          if (meta) setDecentMemes((prev) => [...prev, meta]);
          setIsDecentMemeOpen(false);
        }}
        ecencyToken={ecencyToken}
        onSignMessage={onSignMessage}
        signingUsername={signingUsername}
        onSigningStateChange={setIsAwaitingApproval}
        appAccount={decentMemesAppAccount}
        theme={decentMemesTheme}
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
      <BeneficiariesEditor
        isOpen={isBeneficiariesOpen}
        onClose={() => setIsBeneficiariesOpen(false)}
        onSave={handleBeneficiariesSave}
        initialBeneficiaries={currentBeneficiaries}
        hasVideo={hasVideo}
        lockedAccounts={lockedAccountsList}
        lockReasons={lockReasons}
        favorites={beneficiaryFavorites}
      />

      <ToolbarHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="Toolbar help"
        entries={(() => {
          // Build the help list to mirror what's actually in the toolbar —
          // skip rows for features the host hid or hasn't configured tokens
          // for. Keep order in sync with the toolbar render above.
          const items: ToolbarHelpEntry[] = [];
          if (!hidePreview) {
            items.push({
              icon: <Eye className="h-4 w-4" />,
              label: 'Preview',
              description: 'Toggle the rendered preview of your post above the textarea.',
            });
          }
          if (!hideBold) {
            items.push({ icon: <Bold className="h-4 w-4" />, label: 'Bold', description: 'Wrap the selected text in ** ** for bold.' });
          }
          if (!hideItalic) {
            items.push({ icon: <Italic className="h-4 w-4" />, label: 'Italic', description: 'Wrap the selected text in * * for italic.' });
          }
          if (!hideLink) {
            items.push({ icon: <Link className="h-4 w-4" />, label: 'Link', description: 'Insert a markdown link — `[text](url)` — around the selection.' });
          }
          if (!hideCode) {
            items.push({ icon: <Code className="h-4 w-4" />, label: 'Code', description: 'Insert an inline `code` span or a fenced ``` block depending on the selection.' });
          }
          if (!hideMention) {
            items.push({ icon: <AtSign className="h-4 w-4" />, label: 'Mention', description: parentAuthor ? `Insert @${parentAuthor} at the cursor.` : 'Insert @ at the cursor to mention a Hive account.' });
          }
          if (!hideImage && canUploadImages) {
            items.push({ icon: <ImageIcon className="h-4 w-4" />, label: 'Image', description: 'Upload an image — also works by drag-and-drop or paste into the textarea.' });
          }
          if (!hideAudio && threeSpeakApiKey) {
            items.push({ icon: <Mic className="h-4 w-4" />, label: 'Audio', description: 'Upload an audio file via 3Speak — embedded as a player when published.' });
          }
          if (!hideVideo && threeSpeakApiKey) {
            items.push({ icon: <Video className="h-4 w-4" />, label: 'Video', description: 'Upload a video via 3Speak — the 10% threespeakfund beneficiary is auto-attached.' });
          }
          if (!hideEmoji) {
            items.push({ icon: <Smile className="h-4 w-4" />, label: 'Emoji', description: 'Open a searchable emoji picker and insert at the cursor.' });
          }
          if (!hideGif && giphyApiKey) {
            items.push({ icon: <span className="text-[10px] font-bold">GIF</span>, label: 'GIF', description: 'Search GIPHY and insert an animated GIF inline.' });
          }
          if (!hideYoutube && youtubeApiKey) {
            items.push({ icon: <Play className="h-3 w-3 fill-current" />, label: 'YouTube', description: 'Search YouTube and insert a video link — auto-embeds when rendered.' });
          }
          if (!hideMeme && (ecencyToken || (onSignMessage && signingUsername))) {
            items.push({ icon: <span className="text-[10px] font-bold">MEME</span>, label: 'Meme', description: 'Build a meme on a memegen.link template with Top/Bottom captions and insert as an image.' });
          }
          if (!hideDecentMeme && (ecencyToken || (onSignMessage && signingUsername))) {
            items.push({
              icon: <img src="https://decentmemes.com/svg/DM.svg" alt="DM" className="h-4 w-4" />,
              label: 'DecentMemes',
              description: `Open the DecentMemes widget — auto-attaches template creator beneficiaries. Limit: ${getDecentMemesLimit(decentMemesKind)} per ${decentMemesKind}.`,
            });
          }
          if (!hideTemplate && templateToken && templates.length > 0) {
            items.push({ icon: <FileText className="h-4 w-4" />, label: 'Template', description: 'Insert a saved reply/post template, with @author placeholders resolved.' });
          }
          if (!hidePoll) {
            items.push({ icon: <BarChart3 className="h-4 w-4" />, label: 'Poll', description: 'Attach a Hive poll (question + choices + end time) to this post.' });
          }
          if (!hideTags) {
            items.push({ icon: <Tag className="h-4 w-4" />, label: 'Tags', description: `Edit the tag list — locked defaults stay first, you can add up to ${maxTags} total.` });
          }
          if (!hideReward) {
            items.push({ icon: <Coins className="h-4 w-4" />, label: 'Reward', description: 'Choose reward routing: 50/50 (default), 100% Hive Power, burn, or decline rewards.' });
          }
          if (!hideBeneficiaries) {
            items.push({ icon: <Users className="h-4 w-4" />, label: 'Beneficiaries', description: 'Send a share of the post rewards to other Hive accounts. Auto-attached entries (threespeakfund, DecentMemes creators) show a lock icon.' });
          }
          if (showVoteButton) {
            items.push({ icon: <ThumbsUp className="h-4 w-4" />, label: 'Upvote on publish', description: 'Cast your upvote on the parent post the moment this comment broadcasts. Slider controls the weight.' });
          }
          return items;
        })()}
      />

      {/* Reward popover — portalled. */}
      {isRewardOpen && rewardAnchor && createPortal(
        <div
          ref={rewardPopoverRef}
          style={{ position: 'fixed', top: rewardAnchor.top, left: rewardAnchor.left, width: rewardAnchor.width }}
          className="z-[9999] rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-app)] py-1 shadow-xl"
        >
          {REWARD_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => selectReward(opt)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-surface)]"
            >
              <span>{REWARD_OPTION_LABELS[opt]}</span>
              {currentReward === opt && <Check className="h-4 w-4 text-[var(--hrk-info)]" />}
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
