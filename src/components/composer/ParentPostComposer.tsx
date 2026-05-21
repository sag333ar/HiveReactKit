/**
 * ParentPostComposer — full-screen composer for top-level Hive posts (blogs /
 * articles). Shares the same upload/picker infrastructure as PostComposer
 * (image, audio, video, GIF, emoji, template, poll, beneficiaries) and
 * always renders a side-by-side markdown preview on desktop / stacked
 * preview on mobile. The preview is permanent — no toggle.
 *
 * The composer itself does not broadcast. It surfaces the user's choices via
 * `onSubmit({ title, description, body, tags, reward, beneficiaries, poll })`
 * and the consumer is responsible for assembling the Hive `comment` op.
 */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { WorldMappinMap } from '../WorldMappinMap';
import {
  ArrowLeft,
  AtSign,
  BarChart3,
  Bold,
  Check,
  Code,
  Coins,
  FileText,
  Italic,
  Link as LinkIcon,
  Lock,
  Play,
  Save,
  Send,
  Smile,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { createHiveRenderer } from '@snapie/renderer';
import { ThreeSpeakPlayer } from '../ThreeSpeakPlayer';
import { TranslatedBody } from '../TranslatedBody';
import {
  REWARD_OPTIONS,
  REWARD_OPTION_LABELS,
  type RewardOption,
} from '../../utils/commentOptions';
import {
  THREESPEAK_FUND_ACCOUNT,
  bodyHasVideo,
  enforceVideoBeneficiaries,
  type Beneficiary,
} from '../../utils/beneficiaries';
import ImageUploader from './ImageUploader';
import AudioUploader from './AudioUploader';
import VideoUploader, { type VideoUploadDetails } from './VideoUploader';
import GiphyPicker from './GiphyPicker';
import YoutubePicker from './YoutubePicker';
import MemePicker from './MemePicker';
import DecentMemesPicker from './DecentMemesPicker';
import type { DecentMemesMeme } from '../../utils/decentmemes';
import EmojiPicker from './EmojiPicker';
import PostTemplatesPanel, {
  type PostTemplate,
  type PostTemplatePayload,
} from './PostTemplatesPanel';
import TemplatePicker from './TemplatePicker';
import PollCreator from './PollCreator';
import BeneficiariesEditor from './BeneficiariesEditor';
import type { PollData } from './PollCreator';
import { TemplateModel, templateService } from '../../services/templateService';
import {
  uploadToHiveImages,
  type PostingSignMessageFn,
} from '../../services/hiveImageUpload';

const DESCRIPTION_MAX = 120;
const TITLE_MAX = 120;

export interface ParentPostSubmitPayload {
  title: string;
  description: string;
  body: string;
  tags: string[];
  reward: RewardOption;
  beneficiaries: Beneficiary[];
  poll: PollData | null;
  /** When the host exposes the app picker (`apps` prop), this carries
   *  the id the user selected at publish time — e.g. `'blog'`,
   *  `'snaps'`, `'waves'`, `'threads'`, `'moments'`. Hosts branch their
   *  broadcast path on this so the same composer can publish either a
   *  top-level blog post or a snap-style comment under the right
   *  container account. `undefined` when `apps` is not provided. */
  appId?: string;
  audioEmbedUrl: string | null;
  videoEmbedUrl: string | null;
  videoUploadUrl: string | null;
  videoAspectRatio: string | null;
  /** True when the consumer enabled the reblog toggle AND the user
   *  left it on — host should fire a second `reblog` custom_json with
   *  `(author=currentUser, permlink=<new post permlink>)` after the
   *  post broadcast succeeds. Only meaningful when the post was sent
   *  to a community (`reblogToggle` is auto-hidden otherwise). */
  reblog: boolean;
  /**
   * Full 3Speak upload metadata when the user attached a video — populated
   * by the kit's `<VideoUploader>` after a successful TUS upload. Consumers
   * publishing via 3Speak Studio's `/upload_info` + `/update_info` APIs
   * (the "Save" flow) need every field. `null` when the post has no video.
   */
  videoUploadDetails: VideoUploadDetails | null;
  /** Convenience flag — `true` whenever `videoUploadDetails` is non-null. */
  hasVideo: boolean;
  /**
   * NSFW flag, surfaced by the composer's NSFW toggle. 3Speak's
   * `/update_info` accepts `isNsfwContent`; consumers publishing as a Hive
   * post can fold it into `json_metadata` if they want.
   */
  isNsfw: boolean;
}

export interface ParentPostComposerProps {
  /**
   * Called when the user clicks Publish. Receive everything the composer
   * gathered. Return `false` to indicate the broadcast was cancelled — the
   * composer will preserve its state. Throw to surface an error.
   */
  onSubmit: (
    payload: ParentPostSubmitPayload,
  ) => void | boolean | Promise<void | boolean>;
  /** Called when the user clicks the back/close button. Typically `navigate(-1)` or close the modal. */
  onCancel?: () => void;
  /** Logged-in Hive username — shown in the author chip and used for media uploads. */
  currentUser?: string;

  /** Initial values (uncontrolled). */
  initialTitle?: string;
  initialDescription?: string;
  initialBody?: string;
  initialTags?: string[];

  /** Locked tags shown with a lock icon — e.g. an app identifier. Prepended to the merged tag list. */
  lockedTags?: string[];
  /** Total tag cap including locked entries. Default 10. */
  maxTags?: number;

  /** Reward routing default + favorites for the beneficiary editor. */
  defaultReward?: RewardOption;
  defaultBeneficiaries?: Beneficiary[];
  beneficiaryFavorites?: Beneficiary[];

  /** Upload tokens — same plumbing the kit's PostComposer uses. */
  ecencyToken?: string;
  onSignMessage?: PostingSignMessageFn;
  signingUsername?: string;
  threeSpeakApiKey?: string;
  giphyApiKey?: string;
  /** YouTube Data API v3 key — enables the YouTube video picker */
  youtubeApiKey?: string;
  templateToken?: string;
  templateApiBaseUrl?: string;

  /** Optional "publish to" picker. When provided, a small pill row
   *  appears at the top of the composer letting the user pick which
   *  front-end ecosystem the post should broadcast to (e.g. Blog,
   *  Snaps, Ecency Waves, Threads, LikeTu Moments). The kit only
   *  renders the picker and threads the selection through
   *  `ParentPostSubmitPayload.appId`; the host's `onSubmit` decides
   *  what each id does (community post, snap-style comment, etc.). */
  apps?: { id: string; label: string; avatarUrl?: string }[];
  /** Controlled selected app id. Falls back to the first entry of
   *  `apps` when undefined. Pair with `onAppChange`. */
  selectedApp?: string;
  /** Fired when the user taps a different app pill. */
  onAppChange?: (id: string) => void;

  /** Save-draft callback — when set, a "Save draft" button appears in the
   *  header. The kit passes the current form snapshot; the host writes it
   *  to whatever store it owns (e.g. POST /data/v2/drafts). */
  onSaveDraft?: (payload: PostTemplatePayload) => Promise<unknown> | unknown;
  /** Named, reusable post templates (e.g. fetched from
   *  /data/v2/post-templates). When this prop is provided, a "Templates"
   *  button appears next to Save draft. Empty array still shows the
   *  button — users need somewhere to save the first template. */
  postTemplates?: PostTemplate[];
  /** Host stores a new template under the user-supplied name. */
  onSavePostTemplate?: (name: string, payload: PostTemplatePayload) => Promise<unknown> | unknown;
  /** Host removes the named template. */
  onDeletePostTemplate?: (name: string) => Promise<unknown> | unknown;
  /** Hook fired AFTER the user has confirmed they want to replace the
   *  composer with a template. The kit refills its own title / description
   *  / body / tags before this fires; the host can use this to mirror the
   *  community in its external picker. */
  onApplyPostTemplate?: (template: PostTemplate) => void;

  /** Toolbar visibility flags — mirror PostComposer for consistency. */
  hideAudio?: boolean;
  hideVideo?: boolean;
  hideGif?: boolean;
  /** Hide the YouTube search/embed button. */
  hideYoutube?: boolean;
  hideEmoji?: boolean;
  hideTemplate?: boolean;
  hidePoll?: boolean;
  /** Hide the meme-editor button (defaults to showing it when an image
   *  upload path is configured). The picker fetches free templates from
   *  memegen.link and renders + uploads the captioned PNG client-side. */
  hideMeme?: boolean;
  /** Hide the DecentMemes picker (defaults to showing it when an image
   *  upload path is configured). Opens the embedded DecentMemes widget
   *  so users can build there and re-upload the downloaded file. */
  hideDecentMeme?: boolean;
  /** Forwarded to DecentMemes as `frontendInit.account`. PeakD opted out
   *  per spec; pass your own Hive account to claim the 1% frontend slot. */
  decentMemesAppAccount?: string;
  /** Forwarded to DecentMemes as `frontendInit.theme` / `setTheme`. */
  decentMemesTheme?: 'light' | 'dark';
  /** Called whenever a DecentMemes meme is attached. Receives the
   *  cumulative list (one entry per `memeCreated`). Use with
   *  `aggregateDecentMemesBeneficiaries` and `buildDecentMemesMetadata`
   *  from `utils/decentmemes` to build the broadcast payload. */
  onDecentMemesChange?: (memes: DecentMemesMeme[]) => void;
  hideTags?: boolean;
  hideReward?: boolean;
  hideBeneficiaries?: boolean;
  /** Force the publisher to attach a poll. When `true`, Publish stays
   *  disabled with a "poll required" hint until `pollData` is set, and an
   *  inline warning banner appears above the toolbar. Use this when the
   *  composer is dedicated to poll creation (e.g. the Polls screen) so
   *  users can't accidentally publish a regular parent post. */
  requirePoll?: boolean;

  /** Allow landscape videos (default true on the parent post composer). */
  allowLandscapeVideos?: boolean;

  /**
   * When set, the composer auto-saves its state to `localStorage[draftKey]`
   * (debounced, ~500 ms after the last change) and rehydrates from it on
   * mount. Cleared automatically after a successful submit (i.e. when
   * `onSubmit` returns anything other than `false`). Pass a per-user key so
   * accounts on a shared device don't trample each other's drafts —
   * e.g. `hivesuite-blog-draft-${username}`.
   */
  draftKey?: string;

  /**
   * Async pre-flight gate run after a video file is picked & validated, but
   * before the TUS upload starts. Use it to check that the logged-in user
   * has granted `threespeak` posting authority (3Speak's API requires it)
   * and surface a "Grant Permission" modal when missing. Resolve `true` to
   * let the upload proceed, `false` to abort. Errors are surfaced as the
   * upload error message.
   */
  beforeVideoUpload?: () => Promise<boolean>;

  /**
   * Forwarded to the embedded `<VideoUploader/>`. When true, the TUS upload
   * goes to `https://video.3speak.tv/files/` with the v2 metadata
   * (`upload_id`, `owner`, `filename`, `filetype`) and the resulting
   * `uploadId` is surfaced via `ParentPostSubmitPayload.videoUploadDetails`.
   * Consumers running the v2 publish flow (`/api/upload/finalize`) need
   * this to be `true`.
   */
  useThreeSpeakV2?: boolean;

  /** Submit button label (default "Publish"). */
  submitLabel?: string;
  /**
   * Submit button label used when the post has a 3Speak video attached
   * (default "Save"). 3Speak's flow registers the video via its Studio
   * API rather than broadcasting a Hive `comment` op, so calling the
   * action "Save" is more accurate than "Publish".
   */
  submitLabelWithVideo?: string;
  /** Page title shown in the sticky header (default "Create post"). */
  title?: string;
  /** Hint shown when the wallet is awaiting approval during the broadcast. */
  walletApprovalLabel?: string;
  /** When true, the composer renders a blinking "approve in wallet" banner. */
  awaitingWalletApproval?: boolean;
  /**
   * Optional content rendered at the very top of the composer body, above the
   * title input. Use this to plug in a community picker or any other
   * post-routing UI without forking the composer. Receives no props — the
   * consumer owns the state.
   */
  communitySlot?: React.ReactNode;

  /**
   * Optional content rendered between the title input and the markdown
   * toolbar. Use this to plug in a consumer-owned video picker (e.g. the
   * hivesuite video-encoder uploader) without the kit needing to know
   * about the upload backend. When set, you'll typically also want
   * `hideVideo` true so the kit's own 3Speak video button doesn't appear.
   */
  videoSlot?: React.ReactNode;

  /** When true, render an inline "Reblog after publish" toggle next to
   *  the community pill. Typical use: host app flips this on when a
   *  community is selected, so users can also reblog the post into
   *  their own feed after the parent broadcast succeeds. The toggle
   *  state is emitted via `ParentPostSubmitPayload.reblog`; the host
   *  is responsible for the second broadcast. */
  reblogToggle?: boolean;
  /** Initial state of the reblog toggle when `reblogToggle` is shown.
   *  Defaults to `true` to match the screenshot UX (toggle on by
   *  default whenever it's offered). */
  reblogToggleDefault?: boolean;
  /** Label rendered next to the toggle. Defaults to "Reblog". */
  reblogToggleLabel?: string;
  /**
   * Optional raw markdown appended to the body for preview rendering
   * only. Doesn't end up in the editor and isn't returned via
   * `onSubmit`. Use this for transient previews like a picked
   * WorldMapPin location that you haven't committed to the body yet.
   */
  previewExtras?: string;
}

/**
 * WorldMapPin marker → dedicated Leaflet map section below the
 * preview body.
 *
 * The marker line is a markdown comment
 *   `[//]:# (!worldmappin LAT lat LON long DESC d3scr)`
 * that's stripped by markdown-it (it parses `[//]:#` as a link-reference
 * definition and drops it). Static-map image services are flaky /
 * region-blocked, and the Hive markdown renderer's iframe allowlist
 * rejects map embeds. So instead of inlining the map within the rendered
 * body, we:
 *
 *   1. Strip the marker from the markdown stream so nothing related
 *      shows up in the rendered HTML.
 *   2. Extract every marker's `{lat, lng, description}` separately.
 *   3. Render a `<WorldMappinMap>` (Leaflet + OSM tiles) for each one
 *      as a dedicated section below the rendered body in the preview
 *      pane.
 */
const WORLDMAPPIN_MARKER_REGEX =
  /\[\/\/\]:#\s*\(\s*!worldmappin\s+(-?\d+(?:\.\d+)?)\s+lat\s+(-?\d+(?:\.\d+)?)\s+long\s+(.*?)\s+d3scr\s*\)/gi;

interface ParsedWorldMapPin {
  lat: number;
  lng: number;
  description: string;
}

/** Strip WorldMapPin markers from the markdown stream — the map gets
 *  rendered as a dedicated section below the rendered body, so the
 *  marker shouldn't appear inline in the preview. */
function stripWorldMapPinMarkers(md: string): string {
  return md.replace(WORLDMAPPIN_MARKER_REGEX, '');
}

/** Extract every WorldMapPin marker from a body / previewExtras source. */
function extractWorldMapPins(src: string): ParsedWorldMapPin[] {
  if (!src) return [];
  const re = new RegExp(WORLDMAPPIN_MARKER_REGEX.source, 'gi');
  const out: ParsedWorldMapPin[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const description = (m[3] || '').trim();
    out.push({
      lat,
      lng,
      description: description.toUpperCase() === 'DESCRIPTION GOES HERE' ? '' : description,
    });
  }
  return out;
}

/** Small Hive avatar with a UI Avatars fallback — matches other kit components. */
const Avatar: React.FC<{ account: string; size?: number; className?: string }> = ({
  account,
  size = 28,
  className = '',
}) => (
  <img
    src={`https://images.hive.blog/u/${account}/avatar`}
    alt={`@${account}`}
    width={size}
    height={size}
    style={{ width: size, height: size }}
    className={`rounded-full bg-[var(--hrk-bg-surface-raised)] border border-[var(--hrk-border-default)] object-cover shrink-0 ${className}`}
    onError={(e) => {
      const img = e.target as HTMLImageElement;
      if (!img.dataset.fallback) {
        img.dataset.fallback = '1';
        img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(account)}&background=random&size=64`;
      }
    }}
  />
);

const ParentPostComposer: React.FC<ParentPostComposerProps> = ({
  onSubmit,
  onCancel,
  currentUser,
  initialTitle = '',
  initialDescription = '',
  initialBody = '',
  initialTags = [],
  lockedTags,
  maxTags = 10,
  defaultReward = 'default',
  defaultBeneficiaries,
  beneficiaryFavorites,
  ecencyToken,
  onSignMessage,
  signingUsername,
  threeSpeakApiKey,
  giphyApiKey,
  youtubeApiKey,
  templateToken,
  templateApiBaseUrl,
  apps,
  selectedApp,
  onAppChange,
  onSaveDraft,
  postTemplates,
  onSavePostTemplate,
  onDeletePostTemplate,
  onApplyPostTemplate,
  hideAudio,
  hideVideo,
  hideGif,
  hideYoutube,
  hideEmoji,
  hideTemplate,
  hidePoll,
  hideMeme,
  hideDecentMeme,
  decentMemesAppAccount,
  decentMemesTheme,
  onDecentMemesChange,
  hideTags,
  hideReward,
  hideBeneficiaries,
  requirePoll,
  allowLandscapeVideos = true,
  submitLabel = 'Publish',
  submitLabelWithVideo = 'Save',
  title: pageTitle = 'Create post',
  walletApprovalLabel = 'Open Keychain App & Approve',
  awaitingWalletApproval = false,
  draftKey,
  beforeVideoUpload,
  useThreeSpeakV2 = false,
  communitySlot,
  videoSlot,
  reblogToggle = false,
  reblogToggleDefault = false,
  reblogToggleLabel = 'Reblog',
  previewExtras = '',
}) => {
  // ── Form state ────────────────────────────────────────────────────────────
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [body, setBody] = useState(initialBody);
  // Reblog toggle (only meaningful when the host enabled `reblogToggle`).
  // Tracking the host-controlled default lets the toggle flip on/off as
  // the host shows/hides it (e.g. user selects then clears the community).
  const [reblog, setReblog] = useState<boolean>(reblogToggle ? reblogToggleDefault : false);
  useEffect(() => {
    setReblog(reblogToggle ? reblogToggleDefault : false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reblogToggle, reblogToggleDefault]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDisabled = isSubmitting;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Tags ──────────────────────────────────────────────────────────────────
  const lockedTagList = useMemo(
    () => (lockedTags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
    [lockedTags],
  );
  const [userTags, setUserTags] = useState<string[]>(() =>
    (initialTags ?? [])
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t && !lockedTagList.includes(t)),
  );
  const [tagDraft, setTagDraft] = useState('');
  const mergedTags = useMemo(
    () => [...lockedTagList, ...userTags],
    [lockedTagList, userTags],
  );
  const remainingTagSlots = Math.max(0, maxTags - mergedTags.length);
  const addUserTag = useCallback(
    (raw: string) => {
      const tag = raw
        .trim()
        .toLowerCase()
        .replace(/^#+/, '')
        .replace(/\s+/g, '-');
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

  // ── Reward routing ────────────────────────────────────────────────────────
  const [reward, setReward] = useState<RewardOption>(defaultReward);
  const [isRewardOpen, setIsRewardOpen] = useState(false);
  // Internal app-picker state. When the host passes `selectedApp` we
  // honour it (controlled mode); otherwise we track the picked id
  // ourselves and surface changes via `onAppChange`. Default to the
  // first entry in `apps` so the picker always has a selected pill.
  const [internalAppId, setInternalAppId] = useState<string>(
    () => selectedApp ?? apps?.[0]?.id ?? '',
  );
  // Keep internal state in sync if the host swaps the controlled value
  // out from under us.
  useEffect(() => {
    if (selectedApp !== undefined && selectedApp !== internalAppId) {
      setInternalAppId(selectedApp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApp]);
  const activeAppId = selectedApp ?? internalAppId;
  const handleAppPick = (id: string) => {
    if (selectedApp === undefined) setInternalAppId(id);
    onAppChange?.(id);
  };
  const rewardBtnRef = useRef<HTMLButtonElement>(null);
  const rewardPopoverRef = useRef<HTMLDivElement>(null);
  const [rewardAnchor, setRewardAnchor] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const REWARD_POPOVER_WIDTH = 224;
  const VIEWPORT_MARGIN = 8;
  const readAnchor = (btn: HTMLButtonElement | null, preferredWidth: number) => {
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.min(preferredWidth, Math.max(0, vw - VIEWPORT_MARGIN * 2));
    const left = Math.max(VIEWPORT_MARGIN, Math.round((vw - width) / 2));
    return { top: r.bottom + 4, left, width };
  };
  const toggleRewardOpen = useCallback(() => {
    setIsRewardOpen((prev) => {
      const next = !prev;
      setRewardAnchor(next ? readAnchor(rewardBtnRef.current, REWARD_POPOVER_WIDTH) : null);
      return next;
    });
  }, []);
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

  // ── Media attachments ─────────────────────────────────────────────────────
  const [audioEmbedUrl, setAudioEmbedUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [videoEmbedUrl, setVideoEmbedUrl] = useState<string | null>(null);
  const [videoUploadUrl, setVideoUploadUrl] = useState<string | null>(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  // Controlled `isOpen` for the inline VideoUploader card so we can hide
  // it on close-without-cancel and re-open it from the top-of-editor
  // progress chip. `videoUploadProgress` mirrors the live TUS bytes.
  const [isVideoUploaderOpen, setIsVideoUploaderOpen] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState<{
    percentage: number;
    bytesUploaded: number;
    bytesTotal: number;
  } | null>(null);
  // Full 3Speak upload metadata — emitted by VideoUploader once the TUS
  // upload completes. Consumers route this into 3Speak Studio's API when
  // they want the "Save" path instead of a Hive broadcast.
  const [videoUploadDetails, setVideoUploadDetails] =
    useState<VideoUploadDetails | null>(null);
  // NSFW toggle — only shown when a video is present. Mirrors the
  // `isNsfwContent` field on 3Speak's `/update_info` API.
  const [isNsfw, setIsNsfw] = useState(false);
  const [pollData, setPollData] = useState<PollData | null>(null);
  const [isPollOpen, setIsPollOpen] = useState(false);
  const [isGiphyOpen, setIsGiphyOpen] = useState(false);
  const [isYoutubeOpen, setIsYoutubeOpen] = useState(false);
  const [isMemeOpen, setIsMemeOpen] = useState(false);
  const [isDecentMemeOpen, setIsDecentMemeOpen] = useState(false);
  // Per-composer-session list of DecentMemes attachments.
  const [decentMemes, setDecentMemes] = useState<DecentMemesMeme[]>([]);
  useEffect(() => {
    onDecentMemesChange?.(decentMemes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decentMemes]);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  // Save-draft + post-templates UI state — additive, opted into by hosts
  // that provide the corresponding callbacks. `isPostTemplatesBusy` reflects
  // an in-flight save/delete from the panel.
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPostTemplatesOpen, setIsPostTemplatesOpen] = useState(false);
  const [isPostTemplatesBusy, setIsPostTemplatesBusy] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateModel[]>([]);
  useEffect(() => {
    if (!templateToken) {
      setTemplates([]);
      return;
    }
    templateService
      .getTemplates(templateToken, templateApiBaseUrl)
      .then(setTemplates)
      .catch((err) => console.error('Failed to fetch templates:', err));
  }, [templateToken, templateApiBaseUrl]);

  // ── Beneficiaries (with auto threespeakfund lock when video is attached) ──
  // The v2 TUS endpoint hands back an empty `videoEmbedUrl` (the embed URL
  // only becomes available after `/api/upload/finalize` runs at submit
  // time), so the legacy `Boolean(videoEmbedUrl)` check would miss video
  // posts uploaded via v2. We also key off `videoUploadDetails` to keep
  // the threespeakfund 10% lock honest in both flows.
  const hasVideo = useMemo(
    () => Boolean(videoEmbedUrl) || Boolean(videoUploadDetails) || bodyHasVideo(body),
    [videoEmbedUrl, videoUploadDetails, body],
  );
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>(() =>
    enforceVideoBeneficiaries(defaultBeneficiaries, false),
  );
  useEffect(() => {
    setBeneficiaries((prev) => enforceVideoBeneficiaries(prev, hasVideo));
  }, [hasVideo]);
  const [isBeneficiariesOpen, setIsBeneficiariesOpen] = useState(false);
  const handleBeneficiariesSave = useCallback(
    (next: Beneficiary[]) => {
      setBeneficiaries(enforceVideoBeneficiaries(next, hasVideo));
    },
    [hasVideo],
  );

  // ── Image upload (same Ecency-then-Hive-fallback pattern as PostComposer) ─
  const canHiveFallback = Boolean(onSignMessage && signingUsername);
  const canUploadImages = Boolean(ecencyToken) || canHiveFallback;
  const pasteAbortRef = useRef<AbortController | null>(null);
  const [isAwaitingApproval, setIsAwaitingApproval] = useState(false);
  const [uploadingPaste, setUploadingPaste] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
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
            return await uploadToHiveImages(
              onSignMessage!,
              signingUsername!,
              file,
              undefined,
              {
                onSignStart: () => {
                  if (!signal.aborted) setIsAwaitingApproval(true);
                },
                onSignEnd: () => setIsAwaitingApproval(false),
                signal,
              },
            );
          } catch (hiveErr) {
            if (signal.aborted) return null;
            console.error('Image upload failed (hive fallback):', hiveErr);
            return null;
          }
        }
      } finally {
        if (pasteAbortRef.current === controller) pasteAbortRef.current = null;
      }
    },
    [ecencyToken, canHiveFallback, onSignMessage, signingUsername],
  );

  /**
   * Insert text into the body textarea while preserving the browser's native
   * undo/redo stack. Native typing is already tracked by the browser, but
   * programmatic edits via React state (`setBody`) bypass the input pipeline
   * and wipe the undo history. `document.execCommand('insertText', …)`
   * dispatches a real `InputEvent` against the focused element, so each
   * toolbar action (bold, italic, code, mention, paste image, GIF, emoji,
   * template) lands as one undoable step. The caller doesn't need to call
   * `setBody` afterwards — the textarea's `onChange` fires from the
   * synthetic `InputEvent` and React state stays in sync.
   *
   * Falls back to direct `setBody` when execCommand isn't available (Firefox
   * with `dom.execCommand` disabled, some sandboxed iframes) — undo will
   * still work for native typing in that case, just not for toolbar edits.
   */
  const execInsertText = useCallback(
    (el: HTMLTextAreaElement, replacement: string): boolean => {
      try {
        el.focus();
        if (typeof document.execCommand === 'function') {
          // execCommand returns true on success. Some browsers may report
          // success but not actually insert when the document is contenteditable;
          // for plain textareas it's reliable on Chromium, Safari and Firefox.
          const ok = document.execCommand('insertText', false, replacement);
          if (ok) return true;
        }
      } catch {
        /* fall through */
      }
      return false;
    },
    [],
  );

  const insertText = useCallback(
    (text: string) => {
      const el = textareaRef.current;
      if (!el) {
        setBody((prev) => prev + text);
        return;
      }
      const start = el.selectionStart;
      const end = el.selectionEnd;
      // execCommand replaces the current selection with `text` — for a plain
      // insert at the cursor, the selection is collapsed (start === end) so
      // nothing gets removed.
      if (execInsertText(el, text)) return;
      // Fallback: direct state mutation.
      setBody((prev) => prev.slice(0, start) + text + prev.slice(end));
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + text.length, start + text.length);
      }, 0);
    },
    [execInsertText],
  );

  const insertAtCursor = useCallback(
    (before: string, after = '') => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = el.value.slice(start, end);
      const replacement = before + selected + after;
      if (execInsertText(el, replacement)) {
        // Re-select the original portion so subsequent typing extends inside
        // the wrapper — same UX as the snap composer.
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(
            start + before.length,
            start + before.length + selected.length,
          );
        }, 0);
        return;
      }
      // Fallback: direct state mutation.
      setBody((prev) => prev.slice(0, start) + replacement + prev.slice(end));
      setTimeout(() => {
        el.focus();
        const selectedLength = end - start;
        el.setSelectionRange(start + before.length, start + before.length + selectedLength);
      }, 0);
    },
    [execInsertText],
  );

  // Always insert a fenced block — parent posts use code blocks more than
  // inline code so we don't bother with the `\`` fallback the snap composer has.
  const insertCodeBlock = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.slice(start, end);
    const codeBlock = '```\n' + (selected || 'code here') + '\n```';
    if (execInsertText(el, codeBlock)) {
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + 4, start + 4 + (selected.length || 9));
      }, 0);
      return;
    }
    setBody(body.slice(0, start) + codeBlock + body.slice(end));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + 4, start + 4 + (selected.length || 9));
    }, 0);
  }, [body, execInsertText]);

  const insertMention = useCallback(() => insertText('@'), [insertText]);

  // ── Paste / drag-drop image upload ────────────────────────────────────────
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
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
    },
    [canUploadImages, uploadImage, insertText],
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!canUploadImages) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;
      if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
    },
    [canUploadImages],
  );
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
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
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
    },
    [canUploadImages, uploadImage, insertText],
  );

  const cancelPasteUpload = useCallback(() => {
    if (pasteAbortRef.current) {
      pasteAbortRef.current.abort();
      pasteAbortRef.current = null;
    }
    setIsAwaitingApproval(false);
    setUploadingPaste(false);
  }, []);

  // ── Markdown renderer ─────────────────────────────────────────────────────
  // Mirrors `HiveDetailPost`'s renderer config so the draft preview matches
  // exactly what the post will look like on PeakD/hive.blog after broadcast.
  const renderMarkdown = useMemo(() => {
    try {
      return createHiveRenderer({
        baseUrl: 'https://peakd.com/',
        ipfsGateway: 'https://ipfs.3speak.tv',
        assetsWidth: 640,
        assetsHeight: 480,
        usertagUrlFn: (user: string) => `https://peakd.com/@${user}`,
        hashtagUrlFn: (tag: string) => `https://peakd.com/created/${tag}`,
        convertHiveUrls: true,
      });
    } catch {
      return null;
    }
  }, []);

  // The preview body includes appended audio/video URLs so the renderer
  // embeds them inline (matches what we'll broadcast). `previewExtras`
  // is host-supplied raw markdown that we want rendered alongside the
  // body but not stored in the editor (e.g. a transient WorldMapPin
  // marker the host hasn't committed yet). WorldMapPin markers are
  // stripped from the markdown stream — they're surfaced as a dedicated
  // map section below the rendered body instead of inline.
  const previewBody = useMemo(() => {
    let out = body;
    if (audioEmbedUrl) out += `\n${audioEmbedUrl}`;
    if (videoEmbedUrl) out += `\n${videoEmbedUrl}`;
    if (previewExtras) out += `\n\n${previewExtras}`;
    out = stripWorldMapPinMarkers(out);
    return out;
  }, [body, audioEmbedUrl, videoEmbedUrl, previewExtras]);

  // Locations to render as Leaflet previews below the rendered body.
  // Drawn from the actual body (committed markers) AND `previewExtras`
  // (transient host-supplied marker the host hasn't merged yet).
  const previewLocations = useMemo<ParsedWorldMapPin[]>(() => {
    const fromBody = extractWorldMapPins(body);
    const fromExtras = extractWorldMapPins(previewExtras);
    // Dedupe on rounded lat/lng so a host that streams previewExtras
    // alongside an existing in-body marker doesn't draw the same pin
    // twice.
    const seen = new Set<string>();
    const merged: ParsedWorldMapPin[] = [];
    for (const p of [...fromBody, ...fromExtras]) {
      const key = `${p.lat.toFixed(6)}|${p.lng.toFixed(6)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(p);
    }
    return merged;
  }, [body, previewExtras]);

  // When the user attaches a video via the toolbar, we render a single
  // `<ThreeSpeakPlayer/>` above the body and strip any 3Speak embeds out of
  // the body so the same clip doesn't render twice. Same trick HiveDetailPost
  // uses when `json_metadata.video` pins a clip.
  const threeSpeakRef = useMemo<{ author: string; permlink: string } | null>(() => {
    if (!videoEmbedUrl) return null;
    const m = videoEmbedUrl.match(/[?&]v=([^&\s/?#]+)\/([^&\s/?#]+)/);
    return m ? { author: m[1], permlink: m[2] } : null;
  }, [videoEmbedUrl]);

  // Run the same regex post-processing HiveDetailPost runs on its rendered
  // body so 3Speak iframes turn into `<ThreeSpeakPlayer/>` placeholders, audio
  // iframes get cropped to just their player chrome, and `<img alt>` tags get
  // wrapped in `<figure><figcaption>`. The `useLayoutEffect` below mounts
  // React players into those placeholders before paint.
  const renderedBody = useMemo(() => {
    if (!previewBody.trim() || !renderMarkdown) return '';
    try {
      let html = renderMarkdown(previewBody);

      const stripOnly = !!threeSpeakRef;
      const replaceWithPlaceholder = (v: string) => {
        if (stripOnly) return '';
        const slash = v.indexOf('/');
        if (slash < 1) return '';
        const author = v.slice(0, slash);
        const permlink = v.slice(slash + 1);
        return `<div class="threeSpeakEmbed" data-author="${author}" data-permlink="${permlink}"></div>`;
      };
      html = html.replace(
        /<iframe\s[^>]*src="https:\/\/(?:play\.)?3speak\.tv\/embed\?v=([^"&]+\/[^"&]+)[^"]*"[^>]*>(?:<\/iframe>)?/gi,
        (_m: string, v: string) => replaceWithPlaceholder(v),
      );
      html = html.replace(
        /<a\s[^>]*href="https:\/\/(?:play\.)?3speak\.tv\/embed\?v=([^"&]+\/[^"&]+)[^"]*"[^>]*>[^<]*<\/a>/gi,
        (_m: string, v: string) => replaceWithPlaceholder(v),
      );

      // Wrap 3Speak audio iframes in `.audioWrapper` and force the minimal
      // player chrome, matching HiveDetailPost.
      html = html.replace(
        /<iframe\s[^>]*src="(https:\/\/audio\.3speak\.tv\/play\?[^"]*)"[^>]*>(?:<\/iframe>)?/gi,
        (_m: string, url: string) => {
          let cleanUrl = url;
          if (!cleanUrl.includes('mode=minimal')) cleanUrl += '&mode=minimal';
          if (!cleanUrl.includes('iframe=1')) cleanUrl += '&iframe=1';
          return `<div class="audioWrapper"><iframe src="${cleanUrl}" scrolling="no" frameborder="0" allow="autoplay"></iframe></div>`;
        },
      );

      // Caption images that ship a non-empty alt attribute.
      html = html.replace(
        /<img\s([^>]*?)alt="([^"]+)"([^>]*?)\/?\s*>/gi,
        (_match: string, before: string, alt: string, after: string) => {
          const imgTag = `<img ${before}alt="${alt}"${after}>`;
          return `<figure class="hive-img-figure">${imgTag}<figcaption>${alt}</figcaption></figure>`;
        },
      );

      return html;
    } catch {
      return '';
    }
  }, [previewBody, renderMarkdown, threeSpeakRef]);

  const postBodyRef = useRef<HTMLDivElement>(null);

  // Broken-image fallback: strip known proxy/gateway prefixes and retry.
  useEffect(() => {
    const container = postBodyRef.current;
    if (!container) return;
    const handleError = (e: Event) => {
      const img = e.target as HTMLImageElement;
      if (img.tagName !== 'IMG' || img.dataset.fallbackAttempted) return;
      img.dataset.fallbackAttempted = 'true';
      const src = img.getAttribute('src') || '';
      const proxyPatterns = [
        /^https:\/\/images\.hive\.blog\/\d+x\d+\//,
        /^https:\/\/images\.hive\.blog\/DQm[^/]*\//,
        /^https:\/\/images\.ecency\.com\/\d+x\d+\//,
        /^https:\/\/ipfs\.io\/ipfs\//,
        /^https:\/\/ipfs\.3speak\.tv\/ipfs\//,
      ];
      for (const pattern of proxyPatterns) {
        if (pattern.test(src)) {
          const original = src.replace(pattern, '');
          if (original.startsWith('http')) {
            img.src = original;
            return;
          }
        }
      }
      img.style.display = 'none';
      const figcaption = img.closest('figure')?.querySelector('figcaption') as HTMLElement | null;
      if (figcaption) figcaption.style.display = 'none';
    };
    container.addEventListener('error', handleError, true);
    return () => container.removeEventListener('error', handleError, true);
  }, [renderedBody]);

  // Mount a `<ThreeSpeakPlayer/>` into every 3Speak embed shape the renderer
  // can produce (placeholder div, iframe, autolinked anchor, watch-URL
  // anchor). Mirrors HiveDetailPost. When `threeSpeakRef` is pinned by an
  // attached video we strip these instead so the single player above the
  // body is the only one shown.
  useLayoutEffect(() => {
    const container = postBodyRef.current;
    if (!container) return;
    const stripOnly = !!threeSpeakRef;
    const extractIds = (url: string | null): { author: string; permlink: string } | null => {
      if (!url) return null;
      const m = url.match(/[?&]v=([^&\s/?#]+)\/([^&\s/?#]+)/i);
      return m ? { author: m[1], permlink: m[2] } : null;
    };
    const isThreeSpeakEmbedUrl = (url: string | null): boolean => {
      if (!url) return false;
      return /https?:\/\/(?:play\.)?3speak\.tv\/(?:embed|watch)\?/i.test(url);
    };

    const targets: { el: HTMLElement; author: string; permlink: string }[] = [];

    container
      .querySelectorAll<HTMLElement>('.threeSpeakEmbed:not([data-mounted="1"])')
      .forEach((el) => {
        if (stripOnly) {
          el.remove();
          return;
        }
        const { author, permlink } = el.dataset;
        if (author && permlink) targets.push({ el, author, permlink });
      });

    container.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
      const src = iframe.getAttribute('src');
      if (!isThreeSpeakEmbedUrl(src)) return;
      if (stripOnly) {
        iframe.remove();
        return;
      }
      const ids = extractIds(src);
      if (!ids) return;
      const div = document.createElement('div');
      div.className = 'threeSpeakEmbed';
      div.dataset.author = ids.author;
      div.dataset.permlink = ids.permlink;
      iframe.replaceWith(div);
      targets.push({ el: div, ...ids });
    });

    container.querySelectorAll<HTMLAnchorElement>('a').forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (!isThreeSpeakEmbedUrl(href)) return;
      if (stripOnly) {
        anchor.remove();
        return;
      }
      const ids = extractIds(href);
      if (!ids) return;
      const div = document.createElement('div');
      div.className = 'threeSpeakEmbed';
      div.dataset.author = ids.author;
      div.dataset.permlink = ids.permlink;
      anchor.replaceWith(div);
      targets.push({ el: div, ...ids });
    });

    if (targets.length === 0) return;
    const roots: { unmount: () => void }[] = [];
    targets.forEach(({ el, author, permlink }) => {
      el.dataset.mounted = '1';
      const root = createRoot(el);
      root.render(<ThreeSpeakPlayer author={author} permlink={permlink} hideThumbnail />);
      roots.push(root);
    });
    return () => {
      // Unmount past the commit boundary — React forbids unmounting roots
      // synchronously inside a render-phase cleanup.
      queueMicrotask(() => {
        roots.forEach((r) => {
          try {
            r.unmount();
          } catch {
            /* swallow */
          }
        });
      });
    };
  }, [renderedBody, threeSpeakRef]);

  // ── Read time + word count for the preview header chips ──────────────────
  const wordCount = useMemo(
    () => previewBody.trim().split(/\s+/).filter(Boolean).length,
    [previewBody],
  );
  const readMinutes = Math.max(1, Math.round(wordCount / 220));

  // ── Local draft persistence (opt-in via `draftKey`) ───────────────────────
  // Hydrate once on mount, then debounce-save every change to localStorage so
  // the user doesn't lose work if they refresh or close the tab. On a
  // successful submit `clearDraftAndReset()` wipes the entry and zeroes the
  // in-memory state.
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const initialBeneficiariesRef = useRef(defaultBeneficiaries);

  useEffect(() => {
    if (!draftKey || draftHydrated) {
      if (!draftKey) setDraftHydrated(true);
      return;
    }
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<{
          title: string;
          description: string;
          body: string;
          userTags: string[];
          reward: RewardOption;
          beneficiaries: Beneficiary[];
          audioEmbedUrl: string | null;
          audioDuration: number;
          videoEmbedUrl: string | null;
          videoUploadUrl: string | null;
          videoAspectRatio: string | null;
          pollData: PollData | null;
        }>;
        if (typeof draft.title === 'string') setTitle(draft.title);
        if (typeof draft.description === 'string') setDescription(draft.description);
        if (typeof draft.body === 'string') setBody(draft.body);
        if (Array.isArray(draft.userTags)) {
          // Merge with current `initialTags` so user defaults added in
          // Settings after the draft was saved still appear pre-filled.
          // The locked tag list is excluded because it's prepended
          // separately when computing `mergedTags`.
          const seen = new Set<string>();
          const merged: string[] = [];
          const push = (raw: string) => {
            const t = raw.trim().toLowerCase();
            if (!t || seen.has(t) || lockedTagList.includes(t)) return;
            seen.add(t);
            merged.push(t);
          };
          for (const t of initialTags ?? []) push(t);
          for (const t of draft.userTags) push(t);
          setUserTags(merged);
        }
        if (draft.reward) setReward(draft.reward);
        if (Array.isArray(draft.beneficiaries)) setBeneficiaries(draft.beneficiaries);
        if (draft.audioEmbedUrl !== undefined) setAudioEmbedUrl(draft.audioEmbedUrl);
        if (typeof draft.audioDuration === 'number') setAudioDuration(draft.audioDuration);
        if (draft.videoEmbedUrl !== undefined) setVideoEmbedUrl(draft.videoEmbedUrl);
        if (draft.videoUploadUrl !== undefined) setVideoUploadUrl(draft.videoUploadUrl);
        if (draft.videoAspectRatio !== undefined) setVideoAspectRatio(draft.videoAspectRatio);
        if (draft.pollData !== undefined) setPollData(draft.pollData);
      }
    } catch {
      /* swallow malformed draft */
    }
    setDraftHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || !draftHydrated) return;
    const isEmpty =
      !title.trim() &&
      !description.trim() &&
      !body.trim() &&
      userTags.length === 0 &&
      !audioEmbedUrl &&
      !videoEmbedUrl &&
      !pollData &&
      beneficiaries.length === 0;
    const timer = setTimeout(() => {
      try {
        if (isEmpty) {
          localStorage.removeItem(draftKey);
          setDraftSavedAt(null);
        } else {
          const draft = {
            title,
            description,
            body,
            userTags,
            reward,
            beneficiaries,
            audioEmbedUrl,
            audioDuration,
            videoEmbedUrl,
            videoUploadUrl,
            videoAspectRatio,
            pollData,
          };
          localStorage.setItem(draftKey, JSON.stringify(draft));
          setDraftSavedAt(Date.now());
        }
      } catch {
        /* localStorage may be unavailable (privacy mode, quota) */
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [
    draftKey,
    draftHydrated,
    title,
    description,
    body,
    userTags,
    reward,
    beneficiaries,
    audioEmbedUrl,
    audioDuration,
    videoEmbedUrl,
    videoUploadUrl,
    videoAspectRatio,
    pollData,
  ]);

  const clearDraftAndReset = useCallback(() => {
    if (draftKey) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    }
    setTitle('');
    setDescription('');
    setBody('');
    setUserTags([]);
    setTagDraft('');
    setReward(defaultReward);
    setBeneficiaries(enforceVideoBeneficiaries(initialBeneficiariesRef.current, false));
    setAudioEmbedUrl(null);
    setAudioDuration(0);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoEmbedUrl(null);
    setVideoUploadUrl(null);
    setVideoAspectRatio(null);
    setVideoPreviewUrl(null);
    setVideoUploadDetails(null);
    setIsNsfw(false);
    setPollData(null);
    setDecentMemes([]);
    setDraftSavedAt(null);
  }, [draftKey, defaultReward, videoPreviewUrl]);

  const clearDraftManually = useCallback(() => {
    clearDraftAndReset();
  }, [clearDraftAndReset]);

  // ── Submit ────────────────────────────────────────────────────────────────
  // When `requirePoll` is on, withhold submission until a poll is attached.
  // The Publish button is disabled and an inline banner explains why.
  const canSubmit =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    !isSubmitting &&
    (!requirePoll || !!pollData);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const payload: ParentPostSubmitPayload = {
        title: title.trim(),
        description: description.trim().slice(0, DESCRIPTION_MAX),
        body: previewBody.trim(),
        tags: mergedTags,
        reward,
        beneficiaries: enforceVideoBeneficiaries(beneficiaries, hasVideo),
        poll: pollData,
        audioEmbedUrl,
        videoEmbedUrl,
        videoUploadUrl,
        videoAspectRatio,
        videoUploadDetails,
        hasVideo: Boolean(videoUploadDetails),
        isNsfw,
        reblog: reblogToggle ? reblog : false,
        // Pass the picked app through to the host so it can route
        // the broadcast appropriately (blog vs snap-style comment).
        appId: apps && apps.length > 0 ? activeAppId : undefined,
      };
      const result = await Promise.resolve(onSubmit(payload));
      if (result === false) return; // cancelled — preserve draft
      // Successful publish — wipe local draft + reset every field so the user
      // returning to the page lands on a clean slate.
      clearDraftAndReset();
    } catch (err) {
      console.error('[ParentPostComposer] submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canSubmit,
    title,
    description,
    previewBody,
    mergedTags,
    reward,
    beneficiaries,
    hasVideo,
    pollData,
    audioEmbedUrl,
    videoEmbedUrl,
    videoUploadUrl,
    videoAspectRatio,
    videoUploadDetails,
    isNsfw,
    onSubmit,
    clearDraftAndReset,
    reblog,
    reblogToggle,
  ]);

  // ── Save Draft / Post Templates ──────────────────────────────────────────
  // Shared snapshot — both Save Draft and Save-as-Template need the same
  // shape. Computed at call time so the latest field values flow through.
  const currentPostPayload: PostTemplatePayload = {
    title: title.trim(),
    description: description.trim().slice(0, DESCRIPTION_MAX),
    body: body,
    tags: mergedTags,
  };

  const handleSaveDraft = useCallback(async () => {
    if (!onSaveDraft || isSavingDraft) return;
    setIsSavingDraft(true);
    try {
      await Promise.resolve(
        onSaveDraft({
          title: title.trim(),
          description: description.trim().slice(0, DESCRIPTION_MAX),
          body,
          tags: mergedTags,
        }),
      );
    } catch (err) {
      console.error('[ParentPostComposer] save draft error:', err);
    } finally {
      setIsSavingDraft(false);
    }
  }, [onSaveDraft, isSavingDraft, title, description, body, mergedTags]);

  const handleSavePostTemplate = useCallback(
    async (name: string, payload: PostTemplatePayload) => {
      if (!onSavePostTemplate) return;
      setIsPostTemplatesBusy(true);
      try {
        await Promise.resolve(onSavePostTemplate(name, payload));
      } finally {
        setIsPostTemplatesBusy(false);
      }
    },
    [onSavePostTemplate],
  );

  const handleDeletePostTemplate = useCallback(
    async (name: string) => {
      if (!onDeletePostTemplate) return;
      setIsPostTemplatesBusy(true);
      try {
        await Promise.resolve(onDeletePostTemplate(name));
      } finally {
        setIsPostTemplatesBusy(false);
      }
    },
    [onDeletePostTemplate],
  );

  /** User confirmed they want to replace the composer with a template's
   *  contents. We refill the form locally and ALSO notify the host so its
   *  own state (e.g. community picker) can mirror the template. */
  const handleApplyPostTemplate = useCallback(
    (template: PostTemplate) => {
      setTitle(template.title || '');
      setDescription(template.description || '');
      setBody(template.body || '');
      const normalised = (template.tags || [])
        .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
        .filter((t): t is string => Boolean(t) && !lockedTagList.includes(t));
      setUserTags(normalised);
      setTagDraft('');
      onApplyPostTemplate?.(template);
    },
    [lockedTagList, onApplyPostTemplate],
  );

  const removeAudio = () => {
    setAudioEmbedUrl(null);
    setAudioDuration(0);
  };
  const removeVideo = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoEmbedUrl(null);
    setVideoUploadUrl(null);
    setVideoAspectRatio(null);
    setVideoPreviewUrl(null);
    setVideoUploadDetails(null);
    setIsNsfw(false);
  };

  const toolbarBtnClass =
    'p-2 rounded-lg hover:bg-[var(--hrk-bg-surface-raised)] text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-text-primary)] transition-colors disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--hrk-bg-surface-sunken)] text-white">
      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface-sunken)]">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-2 sm:gap-3 px-3 sm:px-6 py-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDisabled}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--hrk-text-tertiary)] hover:bg-[var(--hrk-bg-surface)] hover:text-[var(--hrk-text-primary)] disabled:opacity-50 shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-white truncate">
              {pageTitle}
            </h1>
            <p className="text-[11px] text-[var(--hrk-text-tertiary)] truncate flex items-center gap-2">
              {currentUser && <span>Posting as @{currentUser}</span>}
              {draftKey && draftSavedAt && (
                <>
                  <span aria-hidden className="text-[var(--hrk-text-tertiary)]">•</span>
                  <span className="inline-flex items-center gap-1 text-[var(--hrk-success)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--hrk-success)]" />
                    Draft saved
                  </span>
                  <button
                    type="button"
                    onClick={clearDraftManually}
                    className="text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-danger)] underline-offset-2 hover:underline"
                  >
                    Clear
                  </button>
                </>
              )}
            </p>
          </div>
          {currentUser && <Avatar account={currentUser} size={32} className="hidden sm:block" />}
          {/* Save draft — opt-in via `onSaveDraft`. Sits beside Publish so
              users always have a "keep working on this later" path. The
              snapshot includes title / description / body / tags; community
              is the host's responsibility because it's owned outside the
              kit. */}
          {onSaveDraft && (
            <button
              type="button"
              onClick={() => void handleSaveDraft()}
              disabled={isSavingDraft || isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface-raised)] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              title="Save as draft"
              aria-label="Save as draft"
            >
              {isSavingDraft ? (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{isSavingDraft ? 'Saving…' : 'Save draft'}</span>
            </button>
          )}
          {/* Templates — opt-in via `postTemplates`. Opens the panel that
              lists existing templates and lets the user save the current
              post as a new template. Apply asks for confirmation before
              overwriting the in-flight post. */}
          {postTemplates !== undefined && (
            <button
              type="button"
              onClick={() => setIsPostTemplatesOpen(true)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface-raised)] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              title="Browse or save post templates"
              aria-label="Open post templates"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Templates</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--hrk-brand)] px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-semibold text-white hover:bg-[var(--hrk-brand-active)] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {isSubmitting ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>{videoUploadDetails ? 'Saving…' : 'Posting…'}</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                {/* When the post has a 3Speak video the publish path goes
                    through 3Speak Studio's API rather than a direct Hive
                    `comment` broadcast — say "Save" to reflect that. */}
                <span>{videoUploadDetails ? submitLabelWithVideo : submitLabel}</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* App picker — shown when the host exposed `apps`. Lets the
          user pick which front-end ecosystem to publish to (Blog,
          Snaps, Ecency, Threads, LikeTu). The kit only renders the
          row; the selected id flows to `onSubmit` via the payload's
          `appId` so the host's handler can pick the right broadcast
          path. */}
      {apps && apps.length > 0 && (
        <div className="shrink-0 border-b border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface-sunken)] px-4 py-2">
          <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--hrk-text-tertiary)]">
              Publish to
            </span>
            <div className="inline-flex flex-wrap gap-1.5">
              {apps.map((opt) => {
                const isActive = activeAppId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleAppPick(opt.id)}
                    aria-pressed={isActive}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? 'border-[var(--hrk-brand)] bg-[var(--hrk-brand)] text-white'
                        : 'border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)] text-[var(--hrk-text-secondary)] hover:border-[var(--hrk-brand)]/60'
                    }`}
                  >
                    {opt.avatarUrl && (
                      <img
                        src={opt.avatarUrl}
                        alt=""
                        className="h-4 w-4 shrink-0 rounded-full object-cover"
                      />
                    )}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {(isAwaitingApproval || awaitingWalletApproval) && (
        <div className="shrink-0 border-b border-[var(--hrk-warning)]/40 bg-[var(--hrk-warning-soft)] px-4 py-1.5 text-center">
          <span className="text-xs font-medium text-[var(--hrk-warning)] animate-pulse">
            {walletApprovalLabel}
          </span>
        </div>
      )}

      {/* ── Two-pane body. Editor on top (mobile) / left (desktop), preview
            below / on the right. The preview is permanent — no toggle.
            On mobile the OUTER container scrolls so the editor and preview
            both expand to their natural heights and the user can scroll
            the whole page from one to the other. On `lg:` we switch to two
            independently-scrolling columns so the side-by-side layout
            doesn't make the page absurdly tall. ── */}
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        <div className="mx-auto max-w-screen-2xl flex flex-col lg:flex-row lg:h-full">
          {/* Editor pane — the entire pane is a drop target so the user can
              release an image anywhere over the editor (not just on top of
              the textarea). The overlay below is sticky-positioned inside
              the scroll container so it stays visible while the user drags. */}
          <section
            className="relative flex flex-col border-b lg:border-b-0 lg:border-r border-[var(--hrk-border-subtle)] lg:flex-1 lg:min-h-0 lg:overflow-y-auto"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {isDragging && canUploadImages && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-[var(--hrk-info)] bg-[var(--hrk-info-soft)]">
                <div className="rounded-[10px] bg-[var(--hrk-bg-surface-sunken)] px-4 py-2 text-sm text-[var(--hrk-info)] shadow-lg">
                  Drop image to upload
                </div>
              </div>
            )}

            {/* Sticky video-upload progress chip — only renders when a TUS
                upload is in flight AND the floating panel is currently
                hidden (user clicked X on the floating card to keep editing).
                Clicking the chip pops the panel back open so the user can
                cancel or watch the upload finish. */}
            {videoUploadProgress && !isVideoUploaderOpen && (
              <button
                type="button"
                onClick={() => setIsVideoUploaderOpen(true)}
                className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--hrk-info)]/30 bg-[var(--hrk-bg-app)] px-3 sm:px-6 py-2 text-left text-xs text-[var(--hrk-text-primary)] transition-colors hover:bg-[var(--hrk-bg-surface)]"
              >
                <span className="flex items-center gap-2 shrink-0 text-[var(--hrk-info)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--hrk-info)] animate-pulse" />
                  Uploading video
                </span>
                <div className="flex-1 min-w-0">
                  <div className="h-1.5 w-full rounded-full bg-[var(--hrk-bg-surface-raised)]/70 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--hrk-info)] transition-all duration-300"
                      style={{ width: `${videoUploadProgress.percentage}%` }}
                    />
                  </div>
                </div>
                <span className="shrink-0 tabular-nums text-blue-200">
                  {videoUploadProgress.percentage.toFixed(0)}%
                </span>
                <span className="shrink-0 text-[var(--hrk-text-tertiary)] underline-offset-2 hover:underline">
                  Show
                </span>
              </button>
            )}

            <div className="px-3 sm:px-6 py-4 space-y-3">
              {/* Consumer-rendered slot (e.g. community picker) + optional
                  Reblog toggle on the right. Sits at the very top so
                  post-routing decisions happen before the user starts
                  typing. */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">{communitySlot}</div>
                {reblogToggle && (
                  <div className="inline-flex shrink-0 items-center gap-1.5 text-xs text-[var(--hrk-text-secondary)]">
                    <span>{reblogToggleLabel}:</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={reblog}
                      aria-label={`${reblogToggleLabel} ${reblog ? 'on' : 'off'}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setReblog((v) => !v);
                      }}
                      disabled={isDisabled}
                      className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors ${
                        reblog ? 'bg-[var(--hrk-info)]' : 'bg-[var(--hrk-bg-hover)]'
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          reblog ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                    <span className={`font-medium ${reblog ? 'text-[var(--hrk-info)]' : 'text-[var(--hrk-text-tertiary)]'}`}>
                      {reblog ? 'yes' : 'no'}
                    </span>
                  </div>
                )}
              </div>

              {/* Title */}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                placeholder="Title"
                disabled={isDisabled}
                className="w-full bg-transparent text-2xl sm:text-3xl font-semibold text-white placeholder-[var(--hrk-text-tertiary)] outline-none border-b border-[var(--hrk-border-subtle)] pb-2 focus:border-[var(--hrk-info)] transition-colors"
              />

              {/* Consumer-rendered video slot (e.g. video-encoder uploader).
                  Sits right under the title because attaching a video
                  changes the nature of the post — picking it should be a
                  prominent step before writing the body. */}
              {videoSlot}

              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--hrk-border-subtle)] pb-2">
                <button
                  type="button"
                  onClick={() => insertAtCursor('**', '**')}
                  className={toolbarBtnClass}
                  title="Bold"
                  disabled={isDisabled}
                >
                  <Bold className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertAtCursor('*', '*')}
                  className={toolbarBtnClass}
                  title="Italic"
                  disabled={isDisabled}
                >
                  <Italic className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertAtCursor('[', '](url)')}
                  className={toolbarBtnClass}
                  title="Link"
                  disabled={isDisabled}
                >
                  <LinkIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={insertCodeBlock}
                  className={toolbarBtnClass}
                  title="Code block"
                  disabled={isDisabled}
                >
                  <Code className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={insertMention}
                  className={toolbarBtnClass}
                  title="Mention"
                  disabled={isDisabled}
                >
                  <AtSign className="h-4 w-4" />
                </button>

                <div className="w-px h-5 bg-[var(--hrk-bg-surface-raised)] mx-1" />

                {canUploadImages && (
                  <ImageUploader
                    onImageUploaded={(url) => insertText(`![Image](${url})\n`)}
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
                    onAudioUploaded={(url, duration) => {
                      setAudioEmbedUrl(url);
                      setAudioDuration(duration);
                    }}
                    username={currentUser}
                    threeSpeakApiKey={threeSpeakApiKey}
                    disabled={isDisabled || !!audioEmbedUrl}
                  />
                )}
                {/* Video upload toolbar entry — temporarily disabled while
                    the 3Speak v2 publish flow is being finalized. The kit
                    keeps the snap composer's video icon untouched (this
                    block is local to <ParentPostComposer/>); flip back on
                    by uncommenting once the API integration is verified. */}
                {/* {!hideVideo && threeSpeakApiKey && (
                  <VideoUploader
                    onVideoUploaded={(embedUrl, uploadUrl, aspectRatio, localFile) => {
                      setVideoEmbedUrl(embedUrl);
                      setVideoUploadUrl(uploadUrl);
                      setVideoAspectRatio(aspectRatio);
                      if (localFile) setVideoPreviewUrl(URL.createObjectURL(localFile));
                      setVideoUploadProgress(null);
                      setIsVideoUploaderOpen(false);
                    }}
                    onVideoUploadDetails={setVideoUploadDetails}
                    username={currentUser}
                    ecencyToken={ecencyToken}
                    onSignMessage={onSignMessage}
                    threeSpeakApiKey={threeSpeakApiKey}
                    disabled={isDisabled || !!videoEmbedUrl}
                    allowLandscape={allowLandscapeVideos}
                    inline
                    isOpen={isVideoUploaderOpen}
                    onIsOpenChange={setIsVideoUploaderOpen}
                    onUploadProgress={setVideoUploadProgress}
                    beforeUpload={beforeVideoUpload}
                    useThreeSpeakV2={useThreeSpeakV2}
                  />
                )} */}
                {!hideEmoji && (
                  <button
                    type="button"
                    onClick={() => setIsEmojiOpen(true)}
                    className={toolbarBtnClass}
                    title="Emoji"
                    disabled={isDisabled}
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                )}
                {!hideGif && giphyApiKey && (
                  <button
                    type="button"
                    onClick={() => setIsGiphyOpen(true)}
                    className={`${toolbarBtnClass} text-xs font-bold px-2`}
                    title="GIF"
                    disabled={isDisabled}
                  >
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
                {/* Meme picker — visible when the composer has any image
                    upload path configured (ecency token or hive signer).
                    Sits beside the GIF button so users discover both. */}
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
                {!hideDecentMeme && (ecencyToken || (onSignMessage && signingUsername)) && (
                  <button
                    type="button"
                    onClick={() => setIsDecentMemeOpen(true)}
                    className={toolbarBtnClass}
                    title="DecentMemes"
                    disabled={isDisabled}
                  >
                    <img
                      src="https://decentmemes.com/svg/DM.svg"
                      alt="DecentMemes"
                      className="h-4 w-4"
                      draggable={false}
                    />
                  </button>
                )}
                {!hideTemplate && templateToken && templates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsTemplateOpen(true)}
                    className={toolbarBtnClass}
                    title="Insert template"
                    disabled={isDisabled}
                  >
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

                <div className="w-px h-5 bg-[var(--hrk-bg-surface-raised)] mx-1" />

                {!hideTags && (
                  <span className="text-xs text-[var(--hrk-text-tertiary)] ml-1 hidden sm:inline">
                    {mergedTags.length}/{maxTags}
                  </span>
                )}
                {!hideReward && (
                  <button
                    ref={rewardBtnRef}
                    type="button"
                    onClick={toggleRewardOpen}
                    className={`${toolbarBtnClass} ${reward !== 'default' ? 'text-[var(--hrk-info)]' : ''}`}
                    title={`Rewards: ${REWARD_OPTION_LABELS[reward]}`}
                    disabled={isDisabled}
                  >
                    <Coins className="h-4 w-4" />
                  </button>
                )}
                {!hideBeneficiaries && (
                  <button
                    type="button"
                    onClick={() => setIsBeneficiariesOpen(true)}
                    className={`${toolbarBtnClass} ${beneficiaries.length > 0 ? 'text-[var(--hrk-info)]' : ''}`}
                    title={
                      beneficiaries.length > 0
                        ? `Beneficiaries (${beneficiaries.length})`
                        : 'Add beneficiaries'
                    }
                    disabled={isDisabled}
                  >
                    <Users className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Audio preview */}
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
                      Audio attached
                      {audioDuration > 0 &&
                        ` (${Math.floor(audioDuration / 60)}:${String(audioDuration % 60).padStart(2, '0')})`}
                    </span>
                    <button
                      type="button"
                      onClick={removeAudio}
                      className="shrink-0 rounded p-1.5 text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-danger)] hover:bg-[var(--hrk-bg-surface-raised)]"
                      title="Remove audio"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Video preview — rendered whenever a TUS upload has produced
                  details (legacy mode) OR an embed URL (v2 mode). The v2
                  endpoint hands back an empty `videoEmbedUrl`, so keying
                  the block on `videoEmbedUrl` alone hid the preview the
                  moment the upload finished. */}
              {(videoEmbedUrl || videoUploadDetails) && (
                <div className="rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] overflow-hidden">
                  {videoPreviewUrl ? (
                    <video
                      src={videoPreviewUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full"
                      style={{ maxHeight: '240px' }}
                    />
                  ) : (
                    <div className="h-20 flex items-center justify-center text-[var(--hrk-text-tertiary)] text-xs">
                      Video attached
                    </div>
                  )}
                  <div className="flex items-center gap-2 border-t border-[var(--hrk-border-subtle)] px-3 py-1.5">
                    <span className="flex-1 truncate text-xs text-[var(--hrk-text-tertiary)]">
                      {videoUploadDetails ? (
                        <>
                          {videoUploadDetails.originalFilename} ·{' '}
                          {(videoUploadDetails.fileSize / (1024 * 1024)).toFixed(1)} MB
                          {videoUploadDetails.videoDuration > 0 && (
                            <>
                              {' · '}
                              {Math.floor(videoUploadDetails.videoDuration / 60)}:
                              {String(videoUploadDetails.videoDuration % 60).padStart(2, '0')}
                            </>
                          )}
                        </>
                      ) : (
                        'Video attached'
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={removeVideo}
                      className="shrink-0 rounded p-1 text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-danger)]"
                      title="Remove video"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {/* NSFW toggle — surfaced only when a video is present.
                      3Speak's `/update_info` API takes an `isNsfwContent`
                      boolean; we pass it through in the submit payload. */}
                  <label className="flex items-start gap-2 border-t border-[var(--hrk-border-subtle)] px-3 py-2 text-xs text-[var(--hrk-text-secondary)] cursor-pointer hover:bg-[var(--hrk-bg-surface)]/40">
                    <input
                      type="checkbox"
                      checked={isNsfw}
                      onChange={(e) => setIsNsfw(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-[var(--hrk-border-default)] bg-[var(--hrk-bg-app)] text-[var(--hrk-brand)] focus:ring-[var(--hrk-brand)]"
                    />
                    <span>
                      Mark this video as <span className="text-[var(--hrk-danger)] font-medium">NSFW</span>
                      <span className="block text-[10px] text-[var(--hrk-text-tertiary)]">
                        Hidden behind a content warning on 3Speak.
                      </span>
                    </span>
                  </label>
                </div>
              )}

              {/* Poll-required warning — shown only when the consumer has
                  set `requirePoll` (e.g. the Polls screen) and the user
                  hasn't attached one yet. Tapping it opens the poll editor
                  so the publisher can fix it in one step. */}
              {requirePoll && !pollData && (
                <button
                  type="button"
                  onClick={() => setIsPollOpen(true)}
                  className="w-full flex items-center justify-between gap-2 rounded-lg border border-[var(--hrk-warning)]/40 bg-[var(--hrk-warning-soft)] px-3 py-2 text-left text-xs text-[var(--hrk-warning)] hover:bg-[var(--hrk-warning-soft)]"
                >
                  <span className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 shrink-0" />
                    A poll is required for this post — tap to add one.
                  </span>
                  <span className="rounded bg-[var(--hrk-warning-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    Required
                  </span>
                </button>
              )}

              {/* Poll preview */}
              {pollData && (
                <div className="rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] overflow-hidden">
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <BarChart3 className="h-3.5 w-3.5 shrink-0 text-[var(--hrk-info)]" />
                      <span className="flex-1 truncate text-xs font-medium text-white">
                        {pollData.question}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsPollOpen(true)}
                        className="shrink-0 rounded p-0.5 text-[var(--hrk-text-tertiary)] hover:bg-[var(--hrk-bg-surface-raised)] hover:text-[var(--hrk-text-primary)]"
                        title="Edit poll"
                      >
                        <Code className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPollData(null)}
                        className="shrink-0 rounded p-0.5 text-[var(--hrk-text-tertiary)] hover:bg-[var(--hrk-bg-surface-raised)] hover:text-[var(--hrk-danger)]"
                        title="Remove poll"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {pollData.description && (
                      <p className="mb-1.5 text-[11px] text-[var(--hrk-text-tertiary)] italic line-clamp-2">
                        {pollData.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {pollData.choices.map((c, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-[var(--hrk-bg-surface-raised)] px-2 py-0.5 text-xs text-[var(--hrk-text-secondary)]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                    {/* Vote-engine + community badges so the publisher can
                        confirm at-a-glance what they attached without
                        re-opening the editor. */}
                    {(pollData.preferred_interpretation ||
                      pollData.community_restricted ||
                      pollData.max_choices_voted > 1) && (
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                        {pollData.preferred_interpretation && (
                          <span className="rounded bg-[var(--hrk-info)]/15 px-1.5 py-0.5 text-[var(--hrk-info)]">
                            {pollData.preferred_interpretation.replace(/_/g, ' ')}
                          </span>
                        )}
                        {pollData.max_choices_voted > 1 && (
                          <span className="rounded bg-[var(--hrk-success-soft)] px-1.5 py-0.5 text-[var(--hrk-success)]">
                            multi-choice ×{pollData.max_choices_voted}
                          </span>
                        )}
                        {pollData.community_restricted && (
                          <span className="rounded bg-[var(--hrk-warning-soft)] px-1.5 py-0.5 text-[var(--hrk-warning)]">
                            community-restricted
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Body textarea — the pane-level drop overlay handles the
                  drag visual; this wrapper only needs the paste/upload spinner. */}
              <div className="relative">
                {uploadingPaste && (
                  <div className="absolute inset-0 z-10 bg-[var(--hrk-bg-app)]/80 rounded-lg flex flex-col items-center justify-center gap-3 p-4 text-center">
                    {isAwaitingApproval ? (
                      <span className="text-sm text-[var(--hrk-warning)] animate-pulse">
                        {walletApprovalLabel}
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 text-[var(--hrk-info)] text-sm">
                        <span className="h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
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
                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onPaste={handlePaste}
                  placeholder={
                    canUploadImages
                      ? 'Write your post in Markdown…\n(Paste or drag & drop images)'
                      : 'Write your post in Markdown…'
                  }
                  disabled={isDisabled}
                  rows={20}
                  // Fixed height — `resize-none` removes the browser's drag
                  // handle so the editor never collapses or grows under the
                  // user's hand. Height steps up at `sm:` and `lg:` so the
                  // editor feels generous on tablet/desktop without crowding
                  // the screen on phones.
                  className="block w-full h-[480px] sm:h-[560px] lg:h-[640px] p-3 border border-[var(--hrk-border-subtle)] rounded-lg resize-none focus:ring-2 focus:ring-[var(--hrk-info)] focus:border-[var(--hrk-info)] bg-[var(--hrk-bg-surface)] text-white placeholder-[var(--hrk-text-tertiary)] disabled:opacity-50 text-sm font-mono leading-relaxed overflow-y-auto"
                />
              </div>

              {/* Tag manager */}
              {!hideTags && (
                <div className="rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-app)]/40 p-2.5">
                  <div className="flex items-center gap-2 mb-2 text-xs text-[var(--hrk-text-tertiary)]">
                    <Tag className="h-3.5 w-3.5 text-[var(--hrk-text-tertiary)]" />
                    <span className="font-semibold uppercase tracking-wide">Tags</span>
                    <span className="ml-auto">
                      {mergedTags.length} / {maxTags}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mb-2">
                    {lockedTagList.map((t) => (
                      <span
                        key={`locked-${t}`}
                        className="inline-flex items-center gap-1 rounded-full bg-[var(--hrk-bg-surface-raised)]/70 px-2 py-0.5 text-[11px] text-[var(--hrk-text-primary)]"
                        title="Default tag — cannot be removed"
                      >
                        <Lock className="h-2.5 w-2.5 text-[var(--hrk-text-tertiary)]" />
                        {t}
                      </span>
                    ))}
                    {userTags.map((t) => (
                      <span
                        key={`user-${t}`}
                        className="inline-flex items-center gap-1 rounded-full bg-[var(--hrk-brand)]/20 px-2 py-0.5 text-[11px] text-blue-200"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() => removeUserTag(t)}
                          className="rounded-full p-0.5 text-blue-200 hover:bg-[var(--hrk-brand)]/40 hover:text-[var(--hrk-text-primary)]"
                          disabled={isDisabled}
                          aria-label={`Remove ${t}`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={tagDraft}
                      // Comma OR whitespace commits the previous fragment as a
                      // tag. Catches both typed separators and pastes like
                      // "hive dev hiveproject reactjs witness" or
                      // "hive,dev,hiveproject" — each completed token gets
                      // pushed via `addUserTag` (which lowercases, strips
                      // leading `#` and replaces internal whitespace with `-`).
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/[,\s]/.test(value)) {
                          const parts = value.split(/[,\s]+/);
                          const trailing = parts.pop() ?? '';
                          parts.forEach((p) => p && addUserTag(p));
                          setTagDraft(trailing);
                          return;
                        }
                        setTagDraft(value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addUserTag(tagDraft);
                          setTagDraft('');
                        }
                      }}
                      placeholder={
                        remainingTagSlots > 0
                          ? 'Add tags (space, comma or Enter)'
                          : 'Max tags reached'
                      }
                      disabled={remainingTagSlots === 0 || isDisabled}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="flex-1 rounded border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] px-2 py-1 text-xs text-[var(--hrk-text-primary)] placeholder-[var(--hrk-text-tertiary)] outline-none focus:border-[var(--hrk-info)] disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        addUserTag(tagDraft);
                        setTagDraft('');
                      }}
                      disabled={remainingTagSlots === 0 || !tagDraft.trim() || isDisabled}
                      className="rounded border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] px-3 py-1 text-xs text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-surface-raised)] disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Description (max 120 chars). Lives below tags so the user
                  finishes long-form first; the short summary that appears in
                  feed cards is a refinement step at the end. */}
              <div>
                <textarea
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value.slice(0, DESCRIPTION_MAX))
                  }
                  placeholder="Short description (shown in feeds, max 120 chars)"
                  rows={2}
                  disabled={isDisabled}
                  className="w-full bg-transparent text-sm text-[var(--hrk-text-primary)] placeholder-[var(--hrk-text-tertiary)] outline-none border-b border-[var(--hrk-border-subtle)] py-2 focus:border-[var(--hrk-info)] transition-colors resize-none"
                />
                <div className="flex items-center justify-end">
                  <span
                    className={`text-[11px] ${
                      description.length >= DESCRIPTION_MAX
                        ? 'text-[var(--hrk-danger)]'
                        : description.length > DESCRIPTION_MAX * 0.85
                          ? 'text-[var(--hrk-warning)]'
                          : 'text-[var(--hrk-text-tertiary)]'
                    }`}
                  >
                    {description.length} / {DESCRIPTION_MAX}
                  </span>
                </div>
              </div>

              {/* Beneficiary strip */}
              {!hideBeneficiaries && beneficiaries.length > 0 && (
                <div className="rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-app)]/40 p-2.5">
                  <div className="flex items-center gap-2 mb-2 text-xs text-[var(--hrk-text-tertiary)]">
                    <Users className="h-3.5 w-3.5 text-[var(--hrk-text-tertiary)]" />
                    <span className="font-semibold uppercase tracking-wide">
                      Beneficiaries
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsBeneficiariesOpen(true)}
                      className="ml-auto rounded border border-[var(--hrk-border-subtle)] px-2 py-0.5 text-[11px] text-[var(--hrk-text-secondary)] hover:bg-[var(--hrk-bg-surface)] hover:text-[var(--hrk-info)]"
                      disabled={isDisabled}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {beneficiaries.map((b) => {
                      const locked = hasVideo && b.account === THREESPEAK_FUND_ACCOUNT;
                      return (
                        <span
                          key={`bene-${b.account}`}
                          className={`inline-flex items-center gap-1 rounded-full pl-0.5 pr-2 py-0.5 text-[11px] ${
                            locked
                              ? 'bg-[var(--hrk-warning-soft)] text-[var(--hrk-warning)] border border-[var(--hrk-warning)]/40'
                              : 'bg-[var(--hrk-brand)]/20 text-blue-200 border border-[var(--hrk-info)]/30'
                          }`}
                        >
                          <Avatar account={b.account} size={16} />
                          {locked && <Lock className="h-2.5 w-2.5" />}
                          @{b.account}
                          <span className="opacity-80">{b.weight}%</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Preview pane — always visible. Independent scroll only on `lg:`;
              on mobile it expands to its full height inside the outer scroll. */}
          <section className="bg-[var(--hrk-bg-surface-sunken)] lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
            <div className="px-3 sm:px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-[var(--hrk-text-tertiary)]">
                  <Check className="h-3 w-3 text-[var(--hrk-success)]" />
                  Live preview
                </span>
                <div className="flex items-center gap-2 text-[11px] text-[var(--hrk-text-tertiary)]">
                  <span className="rounded-md border border-[var(--hrk-border-subtle)] px-2 py-0.5">
                    {readMinutes} min read
                  </span>
                  <span className="rounded-md border border-[var(--hrk-border-subtle)] px-2 py-0.5">
                    {wordCount} words
                  </span>
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl sm:text-3xl font-semibold text-white leading-tight">
                {title.trim() || 'Untitled post'}
              </h2>
              {description.trim() && (
                <p className="mt-2 text-sm text-[var(--hrk-text-tertiary)] italic">
                  {description.trim()}
                </p>
              )}
              {currentUser && (
                <div className="mt-3 flex items-center gap-2 text-xs text-[var(--hrk-text-tertiary)]">
                  <Avatar account={currentUser} size={20} />
                  <span>@{currentUser}</span>
                  {mergedTags.length > 0 && (
                    <span className="ml-auto flex flex-wrap gap-1 justify-end">
                      {mergedTags.slice(0, 5).map((t) => (
                        <span
                          key={`prev-tag-${t}`}
                          className="rounded-full bg-[var(--hrk-info-soft)] text-[var(--hrk-info)] px-2 py-0.5 text-[10px]"
                        >
                          #{t}
                        </span>
                      ))}
                      {mergedTags.length > 5 && (
                        <span className="text-[10px] text-[var(--hrk-text-tertiary)]">
                          +{mergedTags.length - 5}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-4 border-t border-[var(--hrk-border-subtle)] pt-4">
                {/* Metadata-pinned 3Speak player — same single-player
                    treatment HiveDetailPost uses when `json_metadata.video`
                    is set, so the preview matches the published surface
                    exactly. The body's inline embed is stripped above to
                    avoid double playback. */}
                {threeSpeakRef && (
                  <div className="flex justify-center pb-3">
                    <ThreeSpeakPlayer
                      author={threeSpeakRef.author}
                      permlink={threeSpeakRef.permlink}
                      hideThumbnail
                    />
                  </div>
                )}
                {/* v2 fallback — the v2 TUS upload doesn't return a
                    `permlink` until `/api/upload/finalize` runs at submit
                    time, so we can't construct a 3Speak embed URL yet.
                    Show the local `<video>` blob the kit captured during
                    upload so the preview pane isn't empty while the user
                    is still editing copy. */}
                {!threeSpeakRef && videoUploadDetails?.isV2 && videoPreviewUrl && (
                  <div className="flex justify-center pb-3">
                    <video
                      src={videoPreviewUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full max-w-xl rounded-lg bg-black"
                      style={{ maxHeight: '360px' }}
                    />
                  </div>
                )}
                {/* Rendered body — full width. Mirrors the HiveDetailPost
                    layout exactly: <TranslatedBody className="hive-post-body" />
                    inside a `pb-6` block. The kit's `hive-post-body` CSS
                    class handles every markdown element (headings, blockquotes,
                    lists, code, images via `.hive-img-figure`, audio via
                    `.audioWrapper`, links). The `useLayoutEffect` above
                    upgrades any 3Speak embed in the rendered HTML to a
                    real <ThreeSpeakPlayer/>. */}
                <div className="pb-6">
                  {renderedBody ? (
                    <TranslatedBody
                      ref={postBodyRef}
                      className="hive-post-body"
                      html={renderedBody}
                    />
                  ) : (
                    <p className="text-[var(--hrk-text-tertiary)] text-sm italic">
                      Your post preview will appear here as you type. Markdown,
                      images, audio and video embeds all render live.
                    </p>
                  )}

                  {/* WorldMapPin maps render as a dedicated section
                      attached below the rendered body — the marker
                      itself is stripped from inline preview so the
                      coords don't show up mid-paragraph. */}
                  {previewLocations.length > 0 && (
                    <div className="mt-4 flex flex-col gap-3">
                      {previewLocations.map((loc, i) => (
                        <WorldMappinMap
                          key={`${loc.lat.toFixed(6)}|${loc.lng.toFixed(6)}|${i}`}
                          lat={loc.lat}
                          lng={loc.lng}
                          description={loc.description}
                          height={320}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      <GiphyPicker
        isOpen={isGiphyOpen}
        onClose={() => setIsGiphyOpen(false)}
        onSelectGif={(url) => {
          insertText(`![GIF](${url})`);
          setIsGiphyOpen(false);
        }}
        giphyApiKey={giphyApiKey}
      />
      <YoutubePicker
        isOpen={isYoutubeOpen}
        onClose={() => setIsYoutubeOpen(false)}
        onSelectVideo={(url) => {
          insertText(`\n${url}\n`);
          setIsYoutubeOpen(false);
        }}
        youtubeApiKey={youtubeApiKey}
      />
      <MemePicker
        isOpen={isMemeOpen}
        onClose={() => setIsMemeOpen(false)}
        onSelectMeme={(url) => {
          insertText(`![Meme](${url})`);
          setIsMemeOpen(false);
        }}
        ecencyToken={ecencyToken}
        onSignMessage={onSignMessage}
        signingUsername={signingUsername}
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
        appAccount={decentMemesAppAccount}
        theme={decentMemesTheme}
      />
      <EmojiPicker
        isOpen={isEmojiOpen}
        onClose={() => setIsEmojiOpen(false)}
        onSelectEmoji={(emoji) => {
          insertText(emoji);
          setIsEmojiOpen(false);
        }}
      />
      <TemplatePicker
        isOpen={isTemplateOpen}
        onClose={() => setIsTemplateOpen(false)}
        onSelectTemplate={insertText}
        templates={templates}
      />
      {postTemplates !== undefined && (
        <PostTemplatesPanel
          isOpen={isPostTemplatesOpen}
          onClose={() => setIsPostTemplatesOpen(false)}
          templates={postTemplates}
          currentPayload={currentPostPayload}
          busy={isPostTemplatesBusy}
          onSaveTemplate={handleSavePostTemplate}
          onDeleteTemplate={handleDeletePostTemplate}
          onApplyTemplate={handleApplyPostTemplate}
        />
      )}
      <PollCreator
        isOpen={isPollOpen}
        onClose={() => setIsPollOpen(false)}
        onSave={(poll) => setPollData(poll)}
        initialData={pollData}
      />
      <BeneficiariesEditor
        isOpen={isBeneficiariesOpen}
        onClose={() => setIsBeneficiariesOpen(false)}
        onSave={handleBeneficiariesSave}
        initialBeneficiaries={beneficiaries}
        hasVideo={hasVideo}
        favorites={beneficiaryFavorites}
      />

      {/* Reward popover — portalled so ancestor overflow can't clip it. */}
      {isRewardOpen &&
        rewardAnchor &&
        createPortal(
          <div
            ref={rewardPopoverRef}
            style={{
              position: 'fixed',
              top: rewardAnchor.top,
              left: rewardAnchor.left,
              width: rewardAnchor.width,
            }}
            className="z-[9999] rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-app)] py-1 shadow-xl"
          >
            {REWARD_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setReward(opt);
                  setIsRewardOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[var(--hrk-text-primary)] hover:bg-[var(--hrk-bg-surface)]"
              >
                <span>{REWARD_OPTION_LABELS[opt]}</span>
                {reward === opt && <Check className="h-4 w-4 text-[var(--hrk-info)]" />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default ParentPostComposer;
