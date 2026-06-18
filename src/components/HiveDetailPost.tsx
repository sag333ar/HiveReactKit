/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useLayoutEffect, useState, useMemo, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ThreeSpeakPlayer } from './ThreeSpeakPlayer';
import { apiService } from '@/services/apiService';
import { userService } from '@/services/userService';
import { Post } from '@/types/post';
import { Poll } from '@/types/poll';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Menu,
  User,
  Tag,
  Clock,
  BarChart2,
  CheckCircle2,
  Circle,
  Send,
  Bookmark,
  MoreVertical,
  Share2,
  Flag,
  History,
  FileCode2,
  Pencil,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  X,
  Repeat2,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { PostActionButton } from './actionButtons/PostActionButton';
import { SelectionTranslator } from './SelectionTranslator';
import { LanguagePickerButton } from './LanguagePickerButton';
import { createHiveRenderer } from '@snapie/renderer';
import InlineCommentSection from './inlineComments/InlineCommentSection';
import { parseHiveFrontendUrl, preLinkMentions, preLinkUrls } from '@/utils/hiveLinks';
import { TranslatedBody } from './TranslatedBody';
import { TranslatedText } from './TranslatedText';
import { IPFS_URL_REGEX, IpfsMedia } from './IpfsMedia';
import { HiveLink } from './common/HiveLink';
import ReSnapEmbed from './feed/ReSnapEmbed';
import { ODYSEE_REGEX, buildOdyseeEmbedUrl } from './feed/AttachmentStrip';
import { extractMentionsFromBody } from '../services/mentionService';
import { PostVersionHistoryModal } from './PostVersionHistoryModal';
import { PostRawViewModal } from './PostRawViewModal';
import { WorldMappinMap } from './WorldMappinMap';
import { extractWorldMappinPin } from '../utils/worldMappin';
import { useTranslatedText } from '@/i18n/useTranslatedText';
import { detectHivePostReference, stripHivePostReference } from '@/utils/hivePostReferences';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProfileData {
  username: string;
  name?: string;
  profileImage?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  reputation: number;
}

export interface HiveDetailPostProps {
  author: string;
  permlink: string;
  currentUser?: string;

  // PostActionButton callbacks
  onUpvote?: (percent: number) => void | Promise<void>;
  /**
   * Called when the user submits a comment.
   * Return `false` to indicate the operation was cancelled (e.g. keychain request denied)
   * — the composed text will be preserved and no refresh will occur.
   * `voteWeight` is non-null when the composer's upvote-on-publish toggle is enabled
   * (1–100, step 0.25) — consumer should broadcast vote+comment atomically.
   */
  onSubmitComment?: (
    parentAuthor: string,
    parentPermlink: string,
    body: string,
    voteWeight?: number | null,
    beneficiaries?: import('../utils/beneficiaries').Beneficiary[],
  ) => void | boolean | Promise<void | boolean>;
  /**
   * Show the upvote-on-publish toggle in the post's comment composer. Default false (opt-in).
   * Auto-hidden internally when the current user has already voted the post.
   */
  showVoteButton?: boolean;

  /**
   * Optional pre-render transform for the post body. Lets the consumer strip
   * app-specific footers (e.g. "via Apps from ...") before the markdown
   * renderer runs. Return the (possibly-transformed) body string.
   */
  processBody?: (body: string, tags: string[]) => string;

  /**
   * Default reward routing pre-selected in every comment composer on this
   * detail page (top-level reply + nested sub-comment replies).
   * Typically wired to a user setting.
   */
  defaultReward?: import('../utils/commentOptions').RewardOption;
  /**
   * Beneficiaries pre-populated into every comment composer on this detail
   * page (top-level reply + nested sub-comment replies). Typically wired to
   * the user's app-wide default beneficiaries setting.
   */
  defaultBeneficiaries?: import('../utils/beneficiaries').Beneficiary[];
  /**
   * Suggested beneficiary chips shown inside every comment composer's editor
   * on this detail page — typically the user's previously-used beneficiary
   * presets pulled from local history.
   */
  beneficiaryFavorites?: import('../utils/beneficiaries').Beneficiary[];

  /**
   * Initial percent (1–100) for the post's upvote slider AND every comment
   * composer's "upvote-on-publish" / comment-upvote slider on this page.
   * Default 100. Typically wired to a user setting.
   */
  defaultVotePercent?: number;
  /**
   * Slider precision (0.25, 0.5, or 1) used by every vote slider on this
   * page — the post upvote action, comment upvote actions, and the
   * upvote-on-publish slider in the comment composer. Default 0.25.
   */
  voteWeightStep?: number;

  /**
   * Allow landscape (horizontal) videos in the embedded comment composer's
   * video uploader. Default false — only portrait clips, matching the
   * hSnaps Moments contract. Set true for apps where horizontal video is
   * acceptable (e.g. hivesuite).
   */
  allowLandscapeVideos?: boolean;

  /** When true, the post's vote slider surfaces a blinking
   *  "Open Keychain App & Approve" hint while a broadcast is in
   *  flight. Set this when the logged-in user is on a wallet
   *  provider (Keychain, HiveAuth, PeakVault). */
  awaitingWalletApproval?: boolean;

  /**
   * Override the Hive content renderer's link-generating functions so the
   * rendered `<a>` URLs route into your app instead of an external Hive
   * frontend. The in-body click interceptor already recognises peakd /
   * hive.blog / ecency / inleo URLs plus `#/@user` and `/@user` hash/
   * root-relative hrefs, so any of those formats will be routed internally
   * via `onUserClick` / `onNavigateToPost`. Applies to both the post body
   * and inline comment bodies.
   */
  renderOptions?: {
    /** Replace user-mention URL (e.g. `(u) => '#/@' + u`). */
    userLinkUrlFn?: (username: string) => string;
    /** Replace hashtag URL (e.g. `(t) => '#/tag/' + t`). */
    tagLinkUrlFn?: (tag: string) => string;
    /** Replace the renderer's base URL used when `convertHiveUrls` is on. */
    postBaseUrl?: string;
    /** Replace the IPFS gateway prefix used for ipfs:// embeds. */
    ipfsGateway?: string;
  };
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onReblog?: () => void;
  isReblogged?: boolean;
  onShare?: () => void;
  onTip?: () => void;
  onReport?: () => void;
  /** Called when the post author taps Edit on their own post. Only
   *  rendered as an action when `currentUser === post.author`. The
   *  payload contains everything the consumer needs to open an edit
   *  modal without re-fetching: original body, title, parent refs, and
   *  json_metadata. */
  onEdit?: (data: {
    author: string;
    permlink: string;
    body: string;
    title: string;
    parent_author: string;
    parent_permlink: string;
    json_metadata: string;
  }) => void;
  /** Called when the post author taps Delete on their own post. Only
   *  rendered as an action when `currentUser === post.author`. The
   *  consumer is responsible for confirming and broadcasting the
   *  `delete_comment` operation. */
  onDelete?: (data: { author: string; permlink: string }) => void;

  // Comment-level action callbacks (receive author/permlink of the specific comment)
  onShareComment?: (author: string, permlink: string) => void;
  onTipComment?: (author: string, permlink: string) => void;
  onReportComment?: (author: string, permlink: string) => void;
  /** Bookmark toggle on each inline comment — surfaces a small 3-dot
   *  kebab with a Bookmark item at the end of every comment's action
   *  row. Consumer decides add vs remove based on
   *  `isCommentBookmarked`. */
  onToggleCommentBookmark?: (author: string, permlink: string) => void;
  isCommentBookmarked?: (author: string, permlink: string) => boolean;
  /** Called when the comment author taps Edit on their own comment. Only
   *  rendered as an action on comments whose author matches `currentUser`.
   *  Includes the original body, parent refs, and json_metadata so the
   *  consumer can open an edit modal without re-fetching. */
  onEditComment?: (data: {
    author: string;
    permlink: string;
    body: string;
    parent_author: string;
    parent_permlink: string;
    json_metadata: string;
  }) => void;
  /** Called when the comment author taps Delete on their own comment.
   *  Only rendered on comments whose author matches `currentUser`. The
   *  consumer confirms and broadcasts the `delete_comment` operation. */
  onDeleteComment?: (author: string, permlink: string) => void;

  /**
   * Called when the user submits a poll vote.
   * @param author - post author
   * @param permlink - post permlink
   * @param choiceNums - 1-based choice numbers selected by the user
   */
  /**
   * Called when the user submits a poll vote.
   * Return `false` to indicate the operation was cancelled (e.g. keychain request denied)
   * — the vote UI will not be updated.
   */
  onVotePoll?: (author: string, permlink: string, choiceNums: number[]) => void | boolean | Promise<void | boolean>;

  // Composer tokens
  ecencyToken?: string;
  threeSpeakApiKey?: string;
  giphyApiKey?: string;
  templateToken?: string;
  templateApiBaseUrl?: string;

  // Content moderation
  /** Array of usernames whose comments should be hidden from the current user's view. */
  reportedAuthors?: string[];
  /** Array of {author, permlink} posts/comments to hide from the current user's view. */
  reportedPosts?: { author: string; permlink: string }[];

  // Theming
  /** URL to a Hive logo icon shown next to the payout value. Defaults to "/images/hive_logo.png". */
  hiveIconUrl?: string;
  /** Background color for the component. Pass a single color string for a solid background, or an array of colors for a gradient (e.g. `["#0f172a", "#1e293b"]` or `["#1a1a2e", "#16213e", "#0f3460"]`). Defaults to gray-900. */
  backgroundColor?: string | string[];

  // Navigation
  onBack?: () => void;
  /** Opens the host app's navigation (left) drawer. When set, a hamburger
   *  button appears at the far left of the header so the drawer is reachable
   *  from this full-screen page. */
  onOpenMenu?: () => void;
  onOpenProfileMenu?: () => void;
  onUserClick?: (username: string) => void;
  /** Called when user clicks "View parent post" — navigate to the parent post. */
  onNavigateToPost?: (author: string, permlink: string) => void;
  /** Called when the user taps the community pill in the header.
   *  Receives the community ID (`hive-xxxxxx`) so the consumer can route
   *  to its community-detail page. */
  onCommunityClick?: (communityId: string) => void;
  // URL builders — when provided, the header author + community pill
  // render as real <a href> links so the browser offers "open in new
  // tab" / Cmd-click. Plain clicks still route through the callbacks.
  getUserUrl?: (username: string) => string;
  getCommunityUrl?: (communityId: string) => string;

  // ── Header kebab (in-app-bar more menu) ────────────────────────────
  // Mirror of the per-card action bar's `onShare` / `onReport`, but
  // surfaced in the top app bar via a 3-dot popover. Each item only
  // appears when its handler is provided; rendered in this order:
  // Bookmark · Share · Report. Pass `isBookmarked` to render the
  // toggled-on state.
  /** True when the post is bookmarked by the current user. Controls
   *  the visual state of the header's Bookmark item (filled vs.
   *  outline). The kit doesn't fetch this — pass it from the
   *  consumer's bookmark store. */
  isBookmarked?: boolean;
  /** Called when the user taps Bookmark in the header kebab.
   *  Consumer decides whether to add or remove based on
   *  `isBookmarked`. The `meta` payload carries the post's
   *  `title`, a `body` excerpt (useful for storage backends that
   *  require a non-empty body, e.g. hreplier's `/data/v2/bookmarks`),
   *  and the parent / depth / json_metadata fields so the consumer
   *  can route the bookmark to the right category (snap / comment /
   *  video / post) without re-fetching the post. */
  onToggleBookmark?: (meta: {
    title: string;
    body: string;
    parent_author?: string;
    parent_permlink?: string;
    depth?: number;
    json_metadata?: string;
  }) => void;
  /** Called when the user taps Share in the header kebab. When
   *  omitted, falls back to `onShare`. */
  onHeaderShare?: () => void;
  /** Called when the user taps Report in the header kebab. When
   *  omitted, falls back to `onReport`. */
  onHeaderReport?: () => void;

  // ── Header language picker (whole-post auto-translate) ────────────
  /** Currently active language for the page (BCP-47, e.g. "en",
   *  "es", "hi"). Consumer should pass the value it hands to
   *  `<HiveLanguageProvider language=…>` so the picker's tick mark
   *  reflects the actual state. */
  language?: string;
  /** Called when the user picks a language from the header globe.
   *  Consumer should update its `<HiveLanguageProvider>`'s
   *  `language` prop — the existing `<TranslatedBody>` /
   *  `<TranslatedText>` / inline-comment translators inside the
   *  page will then re-render with the new language. */
  onSelectLanguage?: (code: string) => void;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

const formatReputation = (rep: number): string => {
  if (rep === 0) return '25';
  const neg = rep < 0;
  const val = neg ? -rep : rep;
  let out = Math.log10(val);
  out = Math.max(out - 9, 0);
  out = (neg ? -1 : 1) * out;
  out = out * 9 + 25;
  return Math.round(out).toString();
};

/**
 * Format a Hive post's `created` timestamp as a compact "time ago"
 * label (e.g. "just now", "5m ago", "3h ago", "2d ago"). Hive returns
 * timestamps in UTC without a `Z` suffix, so we append one before
 * parsing — otherwise the local-time interpretation skews the result
 * by the user's timezone offset (e.g. "in 5h ago" on the US east
 * coast).
 *
 * Falls back to a localised long date for posts older than ~1 year so
 * the meta line still has *something* readable, and to the raw input
 * if Date parsing fails entirely.
 */
const formatDate = (dateString: string): string => {
  try {
    const iso = /Z|[+-]\d{2}:?\d{2}$/.test(dateString)
      ? dateString
      : `${dateString}Z`;
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return dateString;
    const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (seconds < 45) return 'just now';
    if (seconds < 60) return '1m ago';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
  } catch {
    return dateString;
  }
};

// ─── Component ───────────────────────────────────────────────────────────────

export function HiveDetailPost({
  author,
  permlink,
  currentUser,
  onUpvote,
  onSubmitComment,
  onClickCommentUpvote,
  onReblog,
  isReblogged = false,
  onShare,
  onTip,
  onReport,
  onEdit,
  onDelete,
  onShareComment,
  onTipComment,
  onReportComment,
  onToggleCommentBookmark,
  isCommentBookmarked,
  onEditComment,
  onDeleteComment,
  ecencyToken,
  threeSpeakApiKey,
  giphyApiKey,
  templateToken,
  templateApiBaseUrl,
  reportedAuthors,
  reportedPosts,
  hiveIconUrl = '/images/hive_logo.png',
  backgroundColor,
  onBack,
  onOpenMenu,
  onOpenProfileMenu,
  onUserClick,
  onCommunityClick,
  getUserUrl,
  getCommunityUrl,
  onNavigateToPost,
  isBookmarked,
  onToggleBookmark,
  onHeaderShare,
  onHeaderReport,
  language,
  onSelectLanguage,
  onVotePoll,
  showVoteButton,
  processBody,
  defaultReward,
  defaultBeneficiaries,
  beneficiaryFavorites,
  defaultVotePercent = 100,
  voteWeightStep = 0.25,
  allowLandscapeVideos = false,
  renderOptions,
  awaitingWalletApproval = false,
}: HiveDetailPostProps) {
  // Compute background style from prop
  const bgStyle = useMemo<React.CSSProperties>(() => {
    if (!backgroundColor) return {};
    if (Array.isArray(backgroundColor)) {
      if (backgroundColor.length === 0) return {};
      if (backgroundColor.length === 1) return { background: backgroundColor[0] };
      return { background: `linear-gradient(to bottom, ${backgroundColor.join(', ')})` };
    }
    return { background: backgroundColor };
  }, [backgroundColor]);

  // Slightly darkened variant for the sticky header
  const headerBgStyle = useMemo<React.CSSProperties>(() => {
    if (!backgroundColor) return {};
    if (Array.isArray(backgroundColor)) {
      // Use the first color with opacity for the header
      return { backgroundColor: backgroundColor[0], opacity: 0.97 };
    }
    return { backgroundColor };
  }, [backgroundColor]);

  const [post, setPost] = useState<Post | null>(null);
  // Title translation follows the language set on <HiveLanguageProvider>.
  // Returns the original synchronously, swaps to translated when the API
  // responds, no-op for English. Cached so subsequent renders are free.
  const { text: translatedTitle } = useTranslatedText(post?.title);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [pollLoading, setPollLoading] = useState(false);
  // Header-kebab modals (Version History + View Raw). Open state lives
  // here so the kebab itself can close itself before opening the modal —
  // keeps focus management simple.
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [rawViewOpen, setRawViewOpen] = useState(false);
  const commentsSectionRef = useRef<HTMLDivElement>(null);
  const postBodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [selectedChoices, setSelectedChoices] = useState<number[]>([]);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [votedChoices, setVotedChoices] = useState<number[]>([]);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [spokenWords, setSpokenWords] = useState<{ word: string; element: HTMLElement }[]>([]);
  const [activeWordIndex, setActiveWordIndex] = useState(0);

  const tokenizeElement = useCallback((element: HTMLElement | null, startWordIndex: number = 0): number => {
    if (!element) return startWordIndex;
    
    // Clean up any existing tts-word-spans first to make it idempotent
    const existing = element.querySelectorAll('.tts-word-span');
    existing.forEach((span) => {
      const parent = span.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(span.textContent || ''), span);
      }
    });
    element.normalize(); // merge adjacent text nodes
    
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    const textNodes: Node[] = [];
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (parent && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE' && parent.tagName !== 'IFRAME' && !parent.closest('.tts-word-span')) {
        textNodes.push(node);
      }
    }

    let wordIndex = startWordIndex;
    for (const node of textNodes) {
      const parent = node.parentNode;
      if (!parent) continue;

      const text = node.nodeValue || '';
      const tokens = text.split(/(\s+)/);
      const fragment = document.createDocumentFragment();

      for (const token of tokens) {
        if (/\S/.test(token)) {
          const span = document.createElement('span');
          span.className = 'tts-word-span transition-all duration-150 rounded cursor-pointer hover:bg-[var(--hrk-bg-surface-raised)]';
          span.dataset.wordIndex = String(wordIndex);
          span.textContent = token;
          fragment.appendChild(span);
          wordIndex++;
        } else {
          fragment.appendChild(document.createTextNode(token));
        }
      }
      parent.replaceChild(fragment, node);
    }
    
    return wordIndex;
  }, []);

  const detokenizeElement = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    const spans = element.querySelectorAll('.tts-word-span');
    spans.forEach((span) => {
      const parent = span.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(span.textContent || ''), span);
      }
    });
    element.normalize();
  }, []);

  const speakFromIndex = useCallback((startIndex: number) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !post) return;

    window.speechSynthesis.cancel();

    const remainingWordsList = spokenWords.slice(startIndex);
    if (remainingWordsList.length === 0) {
      window.speechSynthesis.cancel();
      detokenizeElement(titleRef.current);
      if (postBodyRef.current) {
        const bodyEl = postBodyRef.current.querySelector('.hive-post-body') as HTMLElement || postBodyRef.current;
        detokenizeElement(bodyEl);
      }
      setIsSpeaking(false);
      return;
    }
    const remainingText = remainingWordsList.map(w => w.word).join(' ');
    const utterance = new SpeechSynthesisUtterance(remainingText);
    
    if (language) {
      utterance.lang = language;
    }

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (event.name === 'word') {
        const relativeText = remainingText.slice(0, event.charIndex);
        const relativeWordCount = (relativeText.match(/\S+/g) || []).length;
        setActiveWordIndex(startIndex + relativeWordCount);
      }
    };

    utterance.onend = () => {
      window.speechSynthesis.cancel();
      detokenizeElement(titleRef.current);
      if (postBodyRef.current) {
        const bodyEl = postBodyRef.current.querySelector('.hive-post-body') as HTMLElement || postBodyRef.current;
        detokenizeElement(bodyEl);
      }
      setIsSpeaking(false);
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted') {
        window.speechSynthesis.cancel();
        detokenizeElement(titleRef.current);
        if (postBodyRef.current) {
          const bodyEl = postBodyRef.current.querySelector('.hive-post-body') as HTMLElement || postBodyRef.current;
          detokenizeElement(bodyEl);
        }
        setIsSpeaking(false);
      }
    };

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [post, spokenWords, language, detokenizeElement]);

  const handleSpeechToggle = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      detokenizeElement(titleRef.current);
      if (postBodyRef.current) {
        const bodyEl = postBodyRef.current.querySelector('.hive-post-body') as HTMLElement || postBodyRef.current;
        detokenizeElement(bodyEl);
      }
      setIsSpeaking(false);
      setActiveWordIndex(0);
    } else {
      if (!post) return;
      
      // Tokenize elements
      const bodyStartIndex = tokenizeElement(titleRef.current, 0);
      const bodyEl = postBodyRef.current?.querySelector('.hive-post-body') as HTMLElement || postBodyRef.current;
      tokenizeElement(bodyEl, bodyStartIndex);

      // Extract all tokenized word spans
      const titleSpans = titleRef.current?.querySelectorAll('.tts-word-span') || [];
      const bodySpans = bodyEl?.querySelectorAll('.tts-word-span') || [];
      const allSpans = [...Array.from(titleSpans), ...Array.from(bodySpans)] as HTMLElement[];

      if (allSpans.length === 0) return;

      const wordsList = allSpans.map((span) => ({
        word: span.textContent || '',
        element: span,
      }));

      setSpokenWords(wordsList);
      setActiveWordIndex(0);
      setIsSpeaking(true);

      const fullText = wordsList.map(w => w.word).join(' ');
      const utterance = new SpeechSynthesisUtterance(fullText);
      if (language) utterance.lang = language;

      utterance.onboundary = (event: SpeechSynthesisEvent) => {
        if (event.name === 'word') {
          const relativeText = fullText.slice(0, event.charIndex);
          const relativeWordCount = (relativeText.match(/\S+/g) || []).length;
          setActiveWordIndex(relativeWordCount);
        }
      };

      utterance.onend = () => {
        window.speechSynthesis.cancel();
        detokenizeElement(titleRef.current);
        detokenizeElement(bodyEl);
        setIsSpeaking(false);
      };

      utterance.onerror = (e) => {
        if (e.error !== 'interrupted') {
          window.speechSynthesis.cancel();
          detokenizeElement(titleRef.current);
          detokenizeElement(bodyEl);
          setIsSpeaking(false);
        }
      };

      window.speechSynthesis.speak(utterance);
    }
  }, [isSpeaking, post, language, tokenizeElement, detokenizeElement]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Sync highlight and center scrolling
  useEffect(() => {
    if (!isSpeaking || spokenWords.length === 0) return;

    spokenWords.forEach((item, idx) => {
      const isActive = idx === activeWordIndex;
      if (isActive) {
        item.element.className = 'tts-word-span transition-all duration-150 rounded cursor-pointer bg-[var(--hrk-brand)]/20 border-b border-[var(--hrk-brand)] font-semibold';
        item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        item.element.className = 'tts-word-span transition-all duration-150 rounded cursor-pointer hover:bg-[var(--hrk-bg-surface-raised)]';
      }
    });
  }, [activeWordIndex, isSpeaking, spokenWords]);

  // Handle skip reading on word click directly in content
  useEffect(() => {
    if (!isSpeaking) return;

    const handleWordClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.classList.contains('tts-word-span')) {
        if (target.closest('a')) return;
        
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt(target.dataset.wordIndex || '0', 10);
        speakFromIndex(index);
      }
    };

    const titleEl = titleRef.current;
    const bodyEl = postBodyRef.current;

    titleEl?.addEventListener('click', handleWordClick);
    bodyEl?.addEventListener('click', handleWordClick);

    return () => {
      titleEl?.removeEventListener('click', handleWordClick);
      bodyEl?.removeEventListener('click', handleWordClick);
    };
  }, [isSpeaking, speakFromIndex]);

  // Hive content renderer using @snapie/renderer (supports YouTube, 3Speak, IPFS, X.com).
  // Defaults point at peakd so the in-body click interceptor catches user mentions
  // and post links automatically. Consumers can override any of these via `renderOptions`.
  const renderMarkdown = useMemo(() => {
    try {
      return createHiveRenderer({
        baseUrl: renderOptions?.postBaseUrl ?? 'https://peakd.com/',
        ipfsGateway: renderOptions?.ipfsGateway ?? 'https://ipfs.3speak.tv',
        assetsWidth: 640,
        assetsHeight: 480,
        usertagUrlFn: renderOptions?.userLinkUrlFn ?? ((user: string) => `https://peakd.com/@${user}`),
        hashtagUrlFn: renderOptions?.tagLinkUrlFn ?? ((tag: string) => `https://peakd.com/created/${tag}`),
        convertHiveUrls: true,
      });
    } catch {
      return null;
    }
  }, [
    renderOptions?.postBaseUrl,
    renderOptions?.ipfsGateway,
    renderOptions?.userLinkUrlFn,
    renderOptions?.tagLinkUrlFn,
  ]);

  // Parse json_metadata — condenser_api returns it as a raw JSON string; bridge returns an object.
  // Cast via unknown so the runtime string check works despite the Post type saying object.
  const parsedMetadata = useMemo(() => {
    const raw = post?.json_metadata as unknown;
    if (!raw) return {} as Record<string, any>;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) as Record<string, any>; } catch { return {} as Record<string, any>; }
    }
    return raw as Record<string, any>;
  }, [post?.json_metadata]);

  // Tags to seed the comment composer's locked defaults. Inherited from the parent post.
  const parentTags = useMemo<string[]>(() => {
    const t = parsedMetadata?.tags;
    return Array.isArray(t) ? t.filter((x: unknown): x is string => typeof x === 'string') : [];
  }, [parsedMetadata]);

  /**
   * 3Speak video reference. Sources, in order of preference:
   *   1. `json_metadata.video.platform === '3speak'` — the canonical
   *      Hive snaps / waves contract; carries author + permlink in
   *      a known `url` field.
   *   2. `json_metadata.links[]` — Ecency's mobile client doesn't
   *      fill in the `video` block, but it lists every embed URL
   *      here. Scanning for a 3Speak embed/watch URL gives us the
   *      same metadata-driven player even when (1) is missing.
   *
   * When found we render a single ThreeSpeakPlayer above the body
   * and strip the matching iframe / autolinked URL out of the body,
   * so the page shows one player instead of duplicating.
   */
  const threeSpeakRef = useMemo<{ author: string; permlink: string } | null>(() => {
    const extract = (url: unknown): { author: string; permlink: string } | null => {
      if (typeof url !== 'string') return null;
      // Match `v=author/permlink` whether it's the first query param
      // (`?v=…`) or one of several (`?foo=bar&v=…`). The previous form
      // `\?[^"\s'<>]*[?&]v=` required a preceding `?` or `&`, which
      // missed the very common single-param shape Ecency/peakd posts
      // use (`/embed?v=author/permlink`).
      const m = url.match(/3speak\.tv\/(?:embed|watch)\?(?:[^"\s'<>]*[?&])?v=([^&\s/?#]+)\/([^&\s/?#]+)/i);
      if (!m) return null;
      return { author: m[1], permlink: m[2] };
    };
    // Path 1: declared `video` block.
    const video = parsedMetadata?.video as { platform?: unknown; url?: unknown } | undefined;
    if (video && video.platform === '3speak') {
      const fromVideo = extract(video.url);
      if (fromVideo) return fromVideo;
    }
    // Path 2: scan `links[]` for a 3Speak embed URL.
    const links = parsedMetadata?.links;
    if (Array.isArray(links)) {
      for (const link of links) {
        const fromLink = extract(link);
        if (fromLink) return fromLink;
      }
    }
    return null;
  }, [parsedMetadata]);

  // Let the consumer transform the body (e.g. strip app footers) before the
  // markdown renderer runs. Depends on parentTags so transforms can inspect them.
  const processedBody = useMemo(() => {
    if (!post?.body) return '';
    if (!processBody) return post.body;
    try {
      return processBody(post.body, parentTags);
    } catch {
      return post.body;
    }
  }, [post?.body, processBody, parentTags]);

  const reSnapTarget = useMemo(
    () => detectHivePostReference(processedBody),
    [processedBody],
  );
  const reSnapTargetKey = reSnapTarget ? `${reSnapTarget.author}/${reSnapTarget.permlink}` : null;
  const [visibleReSnapKey, setVisibleReSnapKey] = useState<string | null>(null);
  const handleReSnapPreviewVisibility = useCallback((visible: boolean) => {
    setVisibleReSnapKey((current) => {
      if (visible) return reSnapTargetKey;
      return current === reSnapTargetKey ? null : current;
    });
  }, [reSnapTargetKey]);
  const shouldStripReSnapUrl = !!reSnapTargetKey && visibleReSnapKey === reSnapTargetKey;

  const bodyForContent = useMemo(
    () => shouldStripReSnapUrl ? stripHivePostReference(processedBody, reSnapTarget) : processedBody,
    [processedBody, reSnapTarget, shouldStripReSnapUrl],
  );

  // WorldMappin geo-pin: posts embed `[//]:# (!worldmappin <lat> lat <lng>
  // long <descr> d3scr)` to declare a location. Extract the first pin so we
  // can render an interactive Leaflet map below the body. The marker is a
  // markdown comment, so the renderer drops it from the visible HTML — no
  // need to strip it manually.
  const worldMappinPin = useMemo(
    () => extractWorldMappinPin(bodyForContent),
    [bodyForContent],
  );

  // Seed accounts for the `@`-mention autocomplete inside every inline
  // reply composer on this page: the post author first, then every
  // `@account` that appears in the post body, deduped. The composer
  // also calls `condenser_api.get_account_reputations` once the user
  // types 3+ characters, so this just gives them the "people from this
  // post" shortcut up top — same UX as peakd.
  const mentionSeedAccounts = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    const add = (raw?: string | null) => {
      const v = (raw || '').toLowerCase().trim();
      if (!v || seen.has(v)) return;
      seen.add(v);
      out.push(v);
    };
    add(post?.author);
    for (const m of extractMentionsFromBody(bodyForContent)) add(m);
    return out;
  }, [post?.author, bodyForContent]);

  // IPFS gateway URLs (no file extension) — extract them up front and
  // render via <IpfsMedia> in their own gallery. They can be image OR
  // video, which the renderer can't tell from the URL alone, so it
  // either flags them as "(Unsupported …)" or auto-links them. Same
  // pattern Snaps feed cards use: pull them out before the markdown
  // engine sees them, so the body itself stays clean.
  const ipfsMediaUrls = useMemo<string[]>(() => {
    if (!bodyForContent) return [];
    const re = new RegExp(IPFS_URL_REGEX.source, IPFS_URL_REGEX.flags);
    const seen = new Set<string>();
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(bodyForContent)) !== null) {
      const url = m[0];
      if (!seen.has(url)) {
        seen.add(url);
        out.push(url);
      }
    }
    return out;
  }, [bodyForContent]);

  /** Odysee / LBRY videos embedded as <iframe src="https://odysee.com/$/embed/...">.
   *  The @snapie/renderer strips these iframes (Odysee is not on its allowlist),
   *  so we extract the embed URL before rendering and mount native iframes below. */
  const odyseeBodyRefs = useMemo<string[]>(() => {
    if (!bodyForContent) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    // Match src attribute of <iframe> tags that point to odysee.com or lbry.tv
    const iframeRe = /<iframe\b[^>]*\bsrc=["'](https?:\/\/(?:www\.)?(?:odysee\.com|lbry\.tv)\/[^"']+)["'][^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = iframeRe.exec(bodyForContent)) !== null) {
      const url = m[1];
      if (!seen.has(url)) { seen.add(url); out.push(url); }
    }
    // Also catch bare Odysee URLs that aren't in an iframe yet
    const bareRe = /https?:\/\/(?:www\.)?(?:odysee\.com|lbry\.tv)\/[^\s"'<>)]+/gi;
    while ((m = bareRe.exec(bodyForContent)) !== null) {
      // Skip embed-path URLs that were already captured from iframes to avoid duplication
      const url = m[0];
      if (!seen.has(url)) { seen.add(url); out.push(url); }
    }
    return out;
  }, [bodyForContent]);

  // 3Speak URLs (`play.3speak.tv/embed?v=author/permlink` or `/watch?…`
  // or the canonical `3speak.tv/v/author/permlink` path) extracted
  // directly from the body. Same body-only philosophy as the IPFS
  // gallery: we don't read `json_metadata.video`. Each ref renders
  // its own <ThreeSpeakPlayer>, which fetches the embed-api manifest
  // and mounts an HLS-driven <video controls> — i.e. exactly the
  // shape the user described.
  const threeSpeakBodyRefs = useMemo<Array<{ author: string; permlink: string; thumbnail?: string }>>(() => {
    if (!bodyForContent) return [];
    const seen = new Set<string>();
    const out: Array<{ author: string; permlink: string; thumbnail?: string }> = [];
    const push = (author: string, permlink: string, thumbnail?: string) => {
      const key = `${author}/${permlink}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ author, permlink, thumbnail });
    };
    let m: RegExpExecArray | null;
    // 0) 3Speak's canonical embed markdown is a linked thumbnail:
    //      [![](THUMB)](https://3speak.tv/watch?v=author/permlink)
    //    Capture THUMB so the inline player shows the post's own poster
    //    (matching the composer preview) instead of the API's first frame.
    const linkedThumbRe = /\[!\[[^\]]*\]\(([^)\s]+)\)\]\(\s*https?:\/\/(?:play\.)?3speak\.tv\/(?:embed|watch)\?(?:[^)\s]*[?&])?v=([a-z0-9.-]+)\/([a-z0-9.-]+)/gi;
    while ((m = linkedThumbRe.exec(bodyForContent)) !== null) {
      push(m[2].toLowerCase(), m[3].toLowerCase(), m[1]);
    }
    // `?v=author/permlink` — works for both `/embed?v=…` and `/watch?v=…`
    const queryRe = /https?:\/\/(?:play\.)?3speak\.tv\/(?:embed|watch)\?(?:[^\s"'<>]*[?&])?v=([a-z0-9.-]+)\/([a-z0-9.-]+)/gi;
    while ((m = queryRe.exec(bodyForContent)) !== null) {
      push(m[1].toLowerCase(), m[2].toLowerCase());
    }
    // Canonical path form `3speak.tv/v/author/permlink`.
    const pathRe = /https?:\/\/(?:[a-z0-9-]+\.)?3speak\.tv\/v\/([a-z0-9.-]+)\/([a-z0-9.-]+)/gi;
    while ((m = pathRe.exec(bodyForContent)) !== null) {
      push(m[1].toLowerCase(), m[2].toLowerCase());
    }
    return out;
  }, [bodyForContent]);

  const renderedBody = useMemo(() => {
    if (!bodyForContent || !renderMarkdown) return '';
    try {
      // Pre-link bare @mentions to markdown links so the underlying
      // content-renderer doesn't reorder lines — see preLinkMentions for
      // the bug. We also pre-link bare URLs for the same reason.
      let safeBody = preLinkMentions(bodyForContent, renderOptions?.userLinkUrlFn);
      safeBody = preLinkUrls(safeBody);
      // Strip IPFS URLs (and any iframe/video shell wrapping one) before
      // the markdown engine sees them — they're rendered separately via
      // <IpfsMedia> above the body. Leaving them in produces "(Unsupported
      // …)" leftovers because the renderer can't classify a CID-only URL.
      safeBody = safeBody.replace(
        /<(iframe|video)\b[^>]*\bsrc=["'][^"']*\/ipfs\/[^"']*["'][^>]*>(?:\s*<\/\1>)?/gi,
        '',
      );
      safeBody = safeBody.replace(
        new RegExp(IPFS_URL_REGEX.source, IPFS_URL_REGEX.flags),
        '',
      );
      // Strip 3Speak URLs (embed / watch / v/author/permlink) — they're
      // rendered as a dedicated <ThreeSpeakPlayer> gallery via
      // `threeSpeakBodyRefs`, same body-only approach as IPFS above.
      // Without this strip the renderer would auto-embed them inline
      // and the page would show TWO copies of the same video (the
      // renderer's iframe + our extracted player).
      //
      // 1) Iframe / video tags whose src is on 3speak.tv (some authors
      //    paste raw HTML instead of a bare URL).
      safeBody = safeBody.replace(
        /<(iframe|video)\b[^>]*\bsrc=["'][^"']*3speak\.tv[^"']*["'][^>]*>(?:\s*<\/\1>)?/gi,
        '',
      );
      // 1b) Markdown links whose target is a 3Speak URL. 3Speak's
      //     standard embed markdown is a linked thumbnail plus a
      //     "▶️ [Watch on 3Speak](…)" text link:
      //         [![](thumb)](https://3speak.tv/watch?v=a/p)
      //         ▶️ [Watch on 3Speak](https://3speak.tv/watch?v=a/p)
      //     Stripping only the bare URL (rules 2/3) leaves dangling
      //     `](` and "▶️ [Watch on 3Speak](" fragments in the body, so
      //     we remove the whole link construct here — BEFORE the bare-
      //     URL strip, which would otherwise gut the URL inside `(…)`
      //     and break these matches.
      const THREE_SPEAK_HREF = String.raw`https?:\/\/(?:[a-z0-9-]+\.)?3speak\.tv\/[^)\s]+`;
      // Linked thumbnail image: `[![alt](img)](3speak-url)`.
      safeBody = safeBody.replace(
        new RegExp(String.raw`\[!\[[^\]]*\]\([^)]*\)\]\(\s*${THREE_SPEAK_HREF}\s*\)`, 'gi'),
        '',
      );
      // Text link (incl. the leading play emoji): `▶️ [Watch on 3Speak](3speak-url)`.
      safeBody = safeBody.replace(
        new RegExp(String.raw`(?:▶️?\s*)?\[[^\]]*\]\(\s*${THREE_SPEAK_HREF}\s*\)`, 'gi'),
        '',
      );
      // Any stray play emoji left dangling next to a removed link.
      safeBody = safeBody.replace(/▶️?/g, '');
      // 2) Bare query-string URLs (`?v=author/permlink`).
      safeBody = safeBody.replace(
        /https?:\/\/(?:play\.)?3speak\.tv\/(?:embed|watch)\?(?:[^\s"'<>]*[?&])?v=[a-z0-9.-]+\/[a-z0-9.-]+[^\s"'<>]*/gi,
        '',
      );
      // 3) Canonical-path URLs (`/v/author/permlink`).
      safeBody = safeBody.replace(
        /https?:\/\/(?:[a-z0-9-]+\.)?3speak\.tv\/v\/[a-z0-9.-]+\/[a-z0-9.-]+[^\s"'<>]*/gi,
        '',
      );
      // Strip Odysee URLs/iframes from the body — they are rendered as
      // dedicated players via `odyseeBodyRefs`, same body-only approach
      // as 3Speak / IPFS above.
      //
      // 1) Full <iframe> tags whose src is on odysee.com / lbry.tv
      safeBody = safeBody.replace(
        /<iframe\b[^>]*\bsrc=["'][^"']*(?:odysee\.com|lbry\.tv)[^"']*["'][^>]*>(?:\s*<\/iframe>)?/gi,
        '',
      );
      // 2) Markdown links whose href is an Odysee URL
      safeBody = safeBody.replace(
        /\[([^\]]+)\]\(\s*(https?:\/\/(?:www\.)?(?:odysee\.com|lbry\.tv)\/[^)\s]+)\s*\)/gi,
        '',
      );
      // 3) Bare Odysee URLs
      safeBody = safeBody.replace(
        new RegExp(ODYSEE_REGEX.source, ODYSEE_REGEX.flags),
        '',
      );
      let html = renderMarkdown(safeBody);
      // Belt-and-suspenders: drop any leftover "(Unsupported …)" the
      // renderer produced for an IPFS URL we couldn't pre-strip.
      html = html.replace(/<div>\(Unsupported[^<]*\)<\/div>/gi, '');

      // Replace 3Speak embed references in the body. Two cases:
      //   1. The renderer emitted an <iframe src="…/embed?v=…">.
      //   2. The renderer auto-linked a bare URL — `<a href>...</a>`.
      //
      // When `threeSpeakRef` is set (the post's `json_metadata.video`
      // already pinned a 3Speak clip), we strip those embeds entirely
      // — the metadata-driven ThreeSpeakPlayer rendered above the
      // We no longer render a metadata-driven 3Speak player above
      // the body — the detail page only shows body content — so the
      // body's iframe / autolinked anchor must ALWAYS be turned into
      // a placeholder that mounts a player inline. Was previously
      // gated on `!threeSpeakRef`; that path is dead now but kept as
      // `const stripOnly = false` for documentation.
      const stripOnly = false;
      const replaceWithPlaceholder = (v: string) => {
        if (stripOnly) return '';
        const slash = v.indexOf('/');
        if (slash < 1) return '';
        const author = v.slice(0, slash);
        const permlink = v.slice(slash + 1);
        return `<div class="threeSpeakEmbed" data-author="${author}" data-permlink="${permlink}"></div>`;
      };
      // Case 1: iframe embed
      // Accept both `/embed?v=` and `/watch?v=` shapes — some authors
      // paste the watch URL straight from the 3Speak page, and the
      // renderer will autolink (or convert to iframe) either form.
      html = html.replace(
        /<iframe\s[^>]*src="https:\/\/(?:play\.)?3speak\.tv\/(?:embed|watch)\?v=([^"&]+\/[^"&]+)[^"]*"[^>]*>(?:<\/iframe>)?/gi,
        (_m: string, v: string) => replaceWithPlaceholder(v),
      );
      // Case 2: auto-linked anchor (markdown autolink of a bare URL)
      html = html.replace(
        /<a\s[^>]*href="https:\/\/(?:play\.)?3speak\.tv\/(?:embed|watch)\?v=([^"&]+\/[^"&]+)[^"]*"[^>]*>[^<]*<\/a>/gi,
        (_m: string, v: string) => replaceWithPlaceholder(v),
      );

      // Wrap 3Speak audio iframes in .audioWrapper — crop to just the player controls
      html = html.replace(
        /<iframe\s[^>]*src="(https:\/\/audio\.3speak\.tv\/play\?[^"]*)"[^>]*>(?:<\/iframe>)?/gi,
        (_m: string, url: string) => {
          // Ensure mode=minimal and iframe=1 are present
          let cleanUrl = url;
          if (!cleanUrl.includes('mode=minimal')) cleanUrl += '&mode=minimal';
          if (!cleanUrl.includes('iframe=1')) cleanUrl += '&iframe=1';
          return `<div class="audioWrapper"><iframe src="${cleanUrl}" scrolling="no" frameborder="0" allow="autoplay"></iframe></div>`;
        },
      );

      // Wrap <img> tags that have a non-empty alt attribute in <figure>
      html = html.replace(
        /<img\s([^>]*?)alt="([^"]+)"([^>]*?)\/?\s*>/gi,
        (_match: string, before: string, alt: string, after: string) => {
          const imgTag = `<img ${before}alt="${alt}"${after}>`;
          return `<figure class="hive-img-figure">${imgTag}</figure>`;
        }
      );
      return html;
    } catch {
      return '';
    }
  }, [bodyForContent, renderMarkdown, threeSpeakRef]);

  const titleContent = useMemo(() => {
    return (
      <SelectionTranslator>
        <h1 ref={titleRef} className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-tight mb-4">
          {translatedTitle || post?.title}
        </h1>
      </SelectionTranslator>
    );
  }, [translatedTitle, post?.title]);

  const bodyContent = useMemo(() => {
    if (!renderedBody) {
      return <p className="text-[var(--hrk-text-tertiary)] text-sm italic">No content available.</p>;
    }
    return (
      <SelectionTranslator>
        <TranslatedBody
          ref={postBodyRef}
          className="hive-post-body"
          html={renderedBody}
        />
      </SelectionTranslator>
    );
  }, [renderedBody]);

  // Distinct metadata images — every URL declared in
  // `json_metadata.image` / `json_metadata.images` / `json_metadata.video.thumbnail`
  // that DOESN'T already appear as an <img src="…"> in the rendered
  // body. Rendered as a small gallery above the body so wave / snap
  // posts (whose body is usually just "text + a 3Speak URL") still
  // show their thumbnail when the embedded player is loading, slow
  // to start, or fails outright. Dedup is by decodeURIComponent
  // value so `%2C` vs `,` collisions don't double-list the same
  // image.
  const metadataMediaImages = useMemo<string[]>(() => {
    if (!parsedMetadata) return [];
    // Many Hive clients copy image URLs out of the body's markdown
    // by simple string-slicing — `![alt](https://…/foo.jpg)` ends up
    // in `json_metadata.image` with a stray closing `)`, and the
    // same image often appears once clean and once with that
    // trailing junk. `sanitize` peels off any trailing punctuation
    // that obviously can't be part of a real URL path, so both
    // forms collapse to the same key before dedup. Also corrects
    // the renderer's "https:/foo.jpg" single-slash artifact so a
    // proxied vs raw variant doesn't double-list.
    const sanitize = (raw: string): string =>
      raw.trim()
        .replace(/[)\],.;:>\s"'<]+$/, '')
        .replace(/^(https?):\/(?!\/)/, '$1://');
    const decode = (u: string) => { try { return decodeURIComponent(u) } catch { return u } };
    /** HTML-decode the most common entities the renderer leaves in
     *  `<img src>` attributes (`&amp;`, `&#x26;`, `&#38;`). Without
     *  this the dedup key for a body URL containing `&amp;` won't
     *  match the same URL pulled from `json_metadata.image` (which is
     *  raw `&`), and the gallery double-lists the image. */
    const decodeEntities = (u: string) =>
      u.replace(/&amp;/g, '&').replace(/&#x26;/gi, '&').replace(/&#38;/g, '&');
    const key = (u: string) => decode(decodeEntities(sanitize(u)));

    // Set of every URL the body already renders as <img>. Anything
    // matching this is dropped from the gallery so we never show
    // the same image twice.
    const fromBody = new Set<string>();
    if (renderedBody) {
      const re = /<img\s[^>]*src=["']([^"']+)["']/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(renderedBody)) !== null) fromBody.add(key(m[1]));
    }
    const out: string[] = [];
    const seen = new Set<string>(fromBody);
    const push = (raw: unknown) => {
      if (typeof raw !== 'string') return;
      const cleaned = sanitize(raw);
      if (!cleaned || !/^https?:\/\//.test(cleaned)) return;
      // Key match uses the same entity-decoded form as `fromBody`'s
      // keys, so a body `<img src="…&amp;…">` URL collapses to the
      // same key as the raw `…&…` URL stored in json_metadata.image.
      const k = decode(decodeEntities(cleaned));
      if (seen.has(k)) return;
      seen.add(k);
      out.push(cleaned);
    };
    const pushAll = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(push);
      else push(v);
    };
    pushAll(parsedMetadata.image);
    pushAll(parsedMetadata.images);
    pushAll(parsedMetadata.thumbnails);
    const video = parsedMetadata.video as { thumbnail?: unknown } | undefined;
    if (video && typeof video === 'object') push(video.thumbnail);
    return out;
  }, [parsedMetadata, renderedBody]);

  // Resilient image loading: many post bodies reference images that
  // fail under one delivery path but succeed under another. We walk a
  // small fallback chain per <img> before giving up:
  //
  //   1. Mixed-content upgrade — bump http://… to https://… up front
  //      so the browser doesn't silently block the request without
  //      firing onerror (the classic "image just doesn't appear"
  //      case on HTTPS pages).
  //   2. Proxy → raw — when the src looks like images.hive.blog /
  //      images.ecency.com, strip the proxy prefix and retry the
  //      direct URL. Also repairs the "https:/foo.jpg" single-slash
  //      artifact that some renderers emit.
  //   3. Raw → proxy — for direct URLs that fail (hot-link
  //      protection, CORS, expired CDN tokens), retry through the
  //      Hive image proxy which fetches server-side.
  //   4. IPFS gateway swap — if one gateway 4xx's, try the others
  //      with the same CID. Replaces the old "strip gateway" logic
  //      which left a bare CID that couldn't load.
  //
  // Each step is recorded in a per-image WeakMap so the retry chain
  // can't loop, and we stop hiding the figure caption only after the
  // whole chain is exhausted.
  useEffect(() => {
    const container = postBodyRef.current;
    if (!container) return;

    const IPFS_GATEWAYS = [
      'https://ipfs.3speak.tv',
      'https://ipfs.io',
      'https://cloudflare-ipfs.com',
      'https://gateway.pinata.cloud',
    ];
    const PROXY_PREFIXES = [
      /^https:\/\/images\.hive\.blog\/\d+x\d+\//,
      /^https:\/\/images\.hive\.blog\/p\//,
      /^https:\/\/images\.ecency\.com\/\d+x\d+\//,
    ];

    /** Build a retry queue for an image based on its current src.
     *  Each candidate is checked against `tried` so we never visit
     *  the same URL twice across the chain. */
    const buildQueue = (img: HTMLImageElement): string[] => {
      const src = img.getAttribute('src') || '';
      if (!src) return [];
      const tried = new Set<string>([src]);
      const queue: string[] = [];
      const push = (url: string | undefined) => {
        if (!url) return;
        if (!/^https?:\/\//.test(url)) return;
        if (tried.has(url)) return;
        tried.add(url);
        queue.push(url);
      };

      // Step: strip known proxy prefixes, repairing single-slash
      // scheme artifacts ("https:/foo.jpg" → "https://foo.jpg") that
      // creep in when proxy URLs are concatenated naively.
      for (const pattern of PROXY_PREFIXES) {
        if (pattern.test(src)) {
          const stripped = src
            .replace(pattern, '')
            .replace(/^(https?):\/(?!\/)/, '$1://');
          push(stripped);
          break;
        }
      }

      // Step: route a direct URL through the Hive image proxy. The
      // proxy fetches server-side, sidestepping hot-link protection
      // and most cross-origin / referer guards. Skipped for URLs
      // that are already proxied or are data:/blob:.
      const isAlreadyProxied =
        /^https?:\/\/(?:images\.hive\.blog|images\.ecency\.com)/.test(src);
      const isDataOrBlob = /^(?:data|blob):/.test(src);
      if (!isAlreadyProxied && !isDataOrBlob) {
        push(`https://images.hive.blog/0x0/${src}`);
      }

      // Step: IPFS gateway swap. Match any `<host>/ipfs/<cid…>` URL
      // and queue every other gateway with the same path.
      const ipfsMatch = src.match(/^https?:\/\/[^/]+\/ipfs\/(.+)$/);
      if (ipfsMatch) {
        const cidPath = ipfsMatch[1];
        IPFS_GATEWAYS.forEach((g) => push(`${g}/ipfs/${cidPath}`));
      }

      return queue;
    };

    // Per-image retry queues. WeakMap so detached <img> nodes get
    // garbage-collected naturally — no manual cleanup needed when
    // the body re-renders.
    const retryQueues = new WeakMap<HTMLImageElement, string[]>();

    /** Upgrade insecure URLs up front so the browser actually
     *  attempts the request. http:// images on https:// pages are
     *  blocked without an error event, so a reactive fallback can
     *  never catch them. */
    const upgradeMixedContent = () => {
      container.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
        if (img.dataset.hsMixedContentChecked) return;
        img.dataset.hsMixedContentChecked = '1';
        const src = img.getAttribute('src') || '';
        if (src.startsWith('http://')) {
          img.setAttribute('src', 'https://' + src.slice('http://'.length));
        }
      });
    };
    upgradeMixedContent();
    // The body can mutate after initial render (language switches
    // swap the HTML, lazy <img>'s get inserted). Watch for new
    // <img> nodes and apply the same upgrade.
    const mo = new MutationObserver(upgradeMixedContent);
    mo.observe(container, { childList: true, subtree: true });

    const handleError = (e: Event) => {
      const img = e.target as HTMLImageElement | null;
      if (!img || img.tagName !== 'IMG') return;
      let queue = retryQueues.get(img);
      if (!queue) {
        queue = buildQueue(img);
        retryQueues.set(img, queue);
      }
      const next = queue.shift();
      if (next) {
        img.src = next;
        return;
      }
      // Chain exhausted — hide the broken image + its caption so the
      // post body doesn't show a torn placeholder.
      img.style.display = 'none';
      const figcaption = img.closest('figure')?.querySelector('figcaption');
      if (figcaption) (figcaption as HTMLElement).style.display = 'none';
    };
    container.addEventListener('error', handleError, true);

    return () => {
      container.removeEventListener('error', handleError, true);
      mo.disconnect();
    };
  }, [renderedBody]);

  // DOM-walk pass: mount a native <ThreeSpeakPlayer> for every
  // 3Speak embed reference found in the rendered body. We hit four
  // shapes since the markdown renderer's output varies:
  //   • A `.threeSpeakEmbed` placeholder div (regex pre-replace path)
  //   • An <iframe src="…/embed?v=author/permlink"> (renderer
  //     converted the URL to an embed)
  //   • An <a href="…/embed?v=author/permlink">…</a> (auto-linked
  //     bare URL)
  //   • An <a href="…3speak.tv/watch?v=author/permlink">…</a>
  //     (some posts paste the watch URL instead of embed)
  //
  // When `threeSpeakRef` is already pinned by `json_metadata.video`
  // we render a single player above the body — in that case we
  // *remove* matching elements here instead of mounting a second
  // player into them. Otherwise we'd see two players (the metadata
  // one above, the body one below) for the same clip.
  //
  // useLayoutEffect (vs useEffect) keeps the swap synchronous before
  // paint, so users never see the stripped iframe / anchor briefly
  // and then the player.
  useLayoutEffect(() => {
    const container = postBodyRef.current;
    if (!container) return;
    // We render only what's in the body, so the metadata-driven
    // "play once above" branch is dead — body embeds always become
    // inline players.
    const stripOnly = false;
    /** Match `?…&v=author/permlink…` regardless of param order. */
    const extractIds = (url: string | null): { author: string; permlink: string } | null => {
      if (!url) return null;
      const m = url.match(/[?&]v=([^&\s/?#]+)\/([^&\s/?#]+)/i);
      if (!m) return null;
      return { author: m[1], permlink: m[2] };
    };
    const isThreeSpeakEmbedUrl = (url: string | null): boolean => {
      if (!url) return false;
      return /https?:\/\/(?:play\.)?3speak\.tv\/(?:embed|watch)\?/i.test(url);
    };

    const targets: { el: HTMLElement; author: string; permlink: string }[] = [];

    // Already-stamped placeholders.
    container
      .querySelectorAll<HTMLElement>('.threeSpeakEmbed:not([data-mounted="1"])')
      .forEach((el) => {
        if (stripOnly) {
          el.remove();
          return;
        }
        const author = el.dataset.author;
        const permlink = el.dataset.permlink;
        if (author && permlink) targets.push({ el, author, permlink });
      });

    // 3Speak iframes.
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

    // 3Speak anchors (autolinked bare URLs).
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
      root.render(<ThreeSpeakPlayer author={author} permlink={permlink} />);
      roots.push(root);
    });
    return () => {
      // Defer unmount past the commit boundary — React forbids
      // unmounting a root synchronously inside a render-phase
      // cleanup, and body re-renders can land mid-commit.
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
  }, [renderedBody]);

  // NOTE: The useLayoutEffect Odysee anchor-replacement approach is superseded
  // by the odyseeBodyRefs pre-extraction approach (mirrors threeSpeakBodyRefs).
  // Kept as a safety net for edge cases where a bare Odysee URL slips through.

  // Intercept anchor clicks inside the rendered body. Two policies:
  //   - Hive-ecosystem URLs (peakd, hive.blog, ecency, inleo) → keep the
  //     reader inside the app via `onUserClick` / `onNavigateToPost`, same
  //     tab.
  //   - Any other external `http(s)` URL → force a new tab so the post
  //     surface stays put. The renderer doesn't add `target="_blank"`, so
  //     without this generic links like https://hangout.3speak.tv/room/…
  //     would replace the post page.
  useEffect(() => {
    const container = postBodyRef.current;
    if (!container) return;
    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;

      const target = parseHiveFrontendUrl(href);
      if (target) {
        if (target.kind === 'post' && onNavigateToPost) {
          e.preventDefault();
          onNavigateToPost(target.author, target.permlink);
        } else if (target.kind === 'user' && onUserClick) {
          e.preventDefault();
          onUserClick(target.author);
        }
        return;
      }

      // Non-Hive external link — open in a new tab.
      if (/^https?:\/\//i.test(href)) {
        e.preventDefault();
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    };
    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [renderedBody, onNavigateToPost, onUserClick]);

  // Has the current user already upvoted this post? Drives visibility of the
  // composer's "upvote on publish" toggle (hidden once voted).
  const alreadyVoted = useMemo(() => {
    if (!currentUser || !post?.active_votes) return false;
    const me = currentUser.toLowerCase();
    return post.active_votes.some((v: { voter: string }) => v.voter?.toLowerCase() === me);
  }, [currentUser, post?.active_votes]);

  const fetchPostContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Pass `currentUser` as the observer so `bridge.get_post`
      // returns observer-aware data (mute/block flags) — keeps the
      // post shape consistent with the comment thread fetched by
      // `bridge.get_discussion` (which already uses observer).
      const content = await apiService.getPostContent(author, permlink, currentUser ?? '');
      if (content) {
        setPost(content);
      } else {
        setError('Post not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load post');
    } finally {
      setLoading(false);
    }
  }, [author, permlink, currentUser]);

  // Fetch post content
  useEffect(() => {
    fetchPostContent();
  }, [fetchPostContent]);

  // Fetch poll data when post has content_type === 'poll'
  useEffect(() => {
    if (!post || parsedMetadata?.content_type !== 'poll') return;
    setPollLoading(true);
    userService.getPollDetail(post.author, post.permlink)
      .then((data) => setPoll(data))
      .catch(() => setPoll(null))
      .finally(() => setPollLoading(false));
  }, [post?.author, post?.permlink, parsedMetadata?.content_type]);

  // Fetch author profile (lightweight — only what the header needs)
  useEffect(() => {
    const fetchProfile = async () => {
      if (!author) return;
      try {
        const profileResponse = await userService.getProfile(author);
        const user = profileResponse?.result;
        if (!user) return;

        setProfile({
          username: user.name,
          name: user.metadata?.profile?.name,
          profileImage: user.metadata?.profile?.profile_image,
          followersCount: user.stats?.followers || 0,
          followingCount: user.stats?.following || 0,
          postsCount: user.post_count || 0,
          reputation: user.reputation || 0,
        });
      } catch {
        // Silently fail — header still works with author name
      }
    };

    fetchProfile();
  }, [author]);

  // Helper: parse numeric value from a Hive value string like "1.234 HBD"
  // Also handles dhive Asset objects which stringify to e.g. "0.247 HBD"
  const parseHiveValue = (val?: unknown): number => {
    if (!val) return 0;
    const str = typeof val === 'string' ? val : String(val);
    const num = parseFloat(str.replace(/[^\d.]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  // Payout display — compute total from all payout fields
  const payoutValue = useMemo(() => {
    if (!post) return '';

    // 1. bridge API sets `payout` as a number
    if (post.payout && post.payout > 0) return `${post.payout.toFixed(3)}`;

    // 2. For pending posts, use pending_payout_value
    const pending = parseHiveValue(post.pending_payout_value);
    if (pending > 0) return `${pending.toFixed(3)}`;

    // 3. condenser_api returns total_payout_value for paid-out posts
    const totalPay = parseHiveValue((post as any).total_payout_value);
    if (totalPay > 0) return `${totalPay.toFixed(3)}`;

    // 4. Sum author + curator payouts
    const authorPay = parseHiveValue(post.author_payout_value);
    const curatorPay = parseHiveValue(post.curator_payout_value);
    const total = authorPay + curatorPay;
    if (total > 0) return `${total.toFixed(3)}`;

    return '0.000';
  }, [post]);

  // Calculate total count of Upvotes + Downvotes
  const totalVotesCount = useMemo(() => {
    if (!post) return 0;

    const totalVotes = (post as { stats?: { total_votes?: number } }).stats?.total_votes;
    if (typeof totalVotes === 'number' && totalVotes > 0) {
      return totalVotes;
    }

    const activeVotesLen = post.active_votes?.length ?? 0;
    const netVotes = (post as { net_votes?: number }).net_votes ?? 0;
    return Math.max(activeVotesLen, netVotes);
  }, [post]);

  // A post can only be deleted on-chain while it has no votes and no
  // replies. Hide the Delete entry-point once anyone has voted or
  // commented so we never offer an action the chain would reject.
  const canDeletePost = useMemo(() => {
    if (!post) return false;
    return (post.active_votes?.length ?? 0) === 0 && totalVotesCount <= 0 && (post.children ?? 0) === 0;
  }, [post, totalVotesCount]);

  const payoutTooltip = useMemo(() => {
    if (!post) return '';
    const lines: string[] = [];

    const pending = parseHiveValue(post.pending_payout_value);
    const authorPay = parseHiveValue(post.author_payout_value);
    const curatorPay = parseHiveValue(post.curator_payout_value);
    const total = post.payout && post.payout > 0 ? post.payout : (pending > 0 ? pending : authorPay + curatorPay);

    // Payout mode
    const hbdPercent = post.percent_hbd ?? 10000;
    if (hbdPercent === 0) {
      lines.push('Hive Rewards Payout 100% Powered Up');
    } else {
      lines.push(`Hive Rewards Payout (${(hbdPercent / 200).toFixed(0)}%/${100 - hbdPercent / 200}%)`);
    }

    if (post.is_paidout) {
      lines.push('Past payouts:');
      if (authorPay > 0) lines.push(`Author: $${authorPay.toFixed(3)}`);
      if (curatorPay > 0) lines.push(`Curator: $${curatorPay.toFixed(3)}`);
      lines.push(`Total: $${total.toFixed(3)}`);
    } else {
      // Time remaining
      if (post.payout_at) {
        const diffMs = new Date(post.payout_at).getTime() - Date.now();
        if (diffMs > 0) {
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          const diffDays = Math.floor(diffHours / 24);
          const remainHours = diffHours % 24;
          const timeStr = diffDays > 0
            ? `in ${diffDays} day${diffDays > 1 ? 's' : ''}${remainHours > 0 ? ` ${remainHours} hour${remainHours > 1 ? 's' : ''}` : ''}`
            : `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
          lines.push(`Payout will occur: ${timeStr}`);
        }
      }
      lines.push(`Pending: $${pending.toFixed(3)}`);
    }

    // Beneficiaries
    if (post.beneficiaries?.length > 0) {
      lines.push('Beneficiaries:');
      post.beneficiaries.forEach((b) => {
        lines.push(`${b.account}: ${(b.weight / 100).toFixed(0)}%`);
      });
    }

    return lines.join('\n');
  }, [post]);

  // Structured payout details consumed by the rewards modal opened
  // from the action bar's payout chip. Mirrors the data the legacy
  // `payoutTooltip` string carried — keeps both paths in sync so
  // consumers that don't pass the modal still see the tooltip.
  const payoutDetails = useMemo(() => {
    if (!post) return undefined;
    const pendingValue = parseHiveValue(post.pending_payout_value);
    const authorValue = parseHiveValue(post.author_payout_value);
    const curatorValue = parseHiveValue(post.curator_payout_value);
    const totalValue = post.payout && post.payout > 0
      ? post.payout
      : (pendingValue > 0 ? pendingValue : authorValue + curatorValue);
    return {
      pendingValue,
      authorValue,
      curatorValue,
      totalValue,
      isPaidout: !!post.is_paidout,
      payoutAt: post.payout_at,
      percentHbd: post.percent_hbd ?? 10000,
      beneficiaries: (post.beneficiaries ?? []).map((b) => ({
        account: b.account,
        weight: b.weight,
      })),
    };
  }, [post]);

  // ─── Skeleton loading state ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dark flex flex-col h-full bg-[var(--hrk-bg-app)] animate-pulse" style={bgStyle}>
        {/* Header skeleton */}
        <div className="sticky top-0 z-30 h-[calc(56px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-[var(--hrk-bg-surface)] border-b border-[var(--hrk-border-subtle)] flex items-center" style={headerBgStyle}>
          <div className="px-4 py-2 flex items-center gap-2 w-full">
            {onBack && <div className="w-8 h-8 bg-[var(--hrk-bg-surface-raised)] rounded-lg flex-shrink-0" />}
            <div className="w-8 h-8 bg-[var(--hrk-bg-surface-raised)] rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-4 bg-[var(--hrk-bg-surface-raised)] rounded w-28 mb-1.5" />
              <div className="h-3 bg-[var(--hrk-bg-surface-raised)] rounded w-44" />
            </div>
          </div>
        </div>

        {/* Content skeleton */}
        <div className="flex-1 overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6">
            {/* Title skeleton */}
            <div className="h-7 bg-[var(--hrk-bg-surface-raised)] rounded w-4/5 mb-2" />
            <div className="h-7 bg-[var(--hrk-bg-surface-raised)] rounded w-3/5 mb-3" />

            {/* Meta skeleton */}
            <div className="flex items-center gap-2 mb-4">
              <div className="h-3.5 bg-[var(--hrk-bg-surface-raised)] rounded w-32" />
              <div className="h-3.5 bg-[var(--hrk-bg-surface-raised)] rounded w-24" />
            </div>

            {/* Action bar skeleton */}
            <div className="py-2.5 border-y border-[var(--hrk-border-subtle)]/50 mb-5 flex items-center gap-3">
              <div className="h-4 w-4 bg-[var(--hrk-bg-surface-raised)] rounded" />
              <div className="h-3.5 bg-[var(--hrk-bg-surface-raised)] rounded w-8" />
              <div className="h-4 w-4 bg-[var(--hrk-bg-surface-raised)] rounded" />
              <div className="h-3.5 bg-[var(--hrk-bg-surface-raised)] rounded w-8" />
              <div className="h-4 w-4 bg-[var(--hrk-bg-surface-raised)] rounded" />
              <div className="h-4 w-4 bg-[var(--hrk-bg-surface-raised)] rounded" />
              <div className="h-4 w-4 bg-[var(--hrk-bg-surface-raised)] rounded" />
              <div className="h-4 w-4 bg-[var(--hrk-bg-surface-raised)] rounded" />
              <div className="flex-1" />
              <div className="h-3.5 bg-[var(--hrk-bg-surface-raised)] rounded w-16" />
            </div>

            {/* Body skeleton — mimics article content */}
            <div className="space-y-4">
              {/* Paragraph 1 */}
              <div className="space-y-2">
                <div className="h-4 bg-[var(--hrk-bg-surface-raised)]/60 rounded w-full" />
                <div className="h-4 bg-[var(--hrk-bg-surface-raised)]/60 rounded w-full" />
                <div className="h-4 bg-[var(--hrk-bg-surface-raised)]/60 rounded w-4/5" />
              </div>

              {/* Image placeholder */}
              <div className="h-48 sm:h-64 bg-[var(--hrk-bg-surface)] rounded-xl border border-[var(--hrk-border-subtle)]" />

              {/* Paragraph 2 */}
              <div className="space-y-2">
                <div className="h-4 bg-[var(--hrk-bg-surface-raised)]/60 rounded w-full" />
                <div className="h-4 bg-[var(--hrk-bg-surface-raised)]/60 rounded w-full" />
                <div className="h-4 bg-[var(--hrk-bg-surface-raised)]/60 rounded w-3/5" />
              </div>

              {/* Heading */}
              <div className="h-6 bg-[var(--hrk-bg-surface-raised)] rounded w-2/5 mt-2" />

              {/* Paragraph 3 */}
              <div className="space-y-2">
                <div className="h-4 bg-[var(--hrk-bg-surface-raised)]/60 rounded w-full" />
                <div className="h-4 bg-[var(--hrk-bg-surface-raised)]/60 rounded w-full" />
                <div className="h-4 bg-[var(--hrk-bg-surface-raised)]/60 rounded w-full" />
                <div className="h-4 bg-[var(--hrk-bg-surface-raised)]/60 rounded w-2/3" />
              </div>

              {/* Image placeholder */}
              <div className="h-48 sm:h-64 bg-[var(--hrk-bg-surface)] rounded-xl border border-[var(--hrk-border-subtle)]" />

              {/* Paragraph 4 */}
              <div className="space-y-2">
                <div className="h-4 bg-[var(--hrk-bg-surface-raised)]/60 rounded w-full" />
                <div className="h-4 bg-[var(--hrk-bg-surface-raised)]/60 rounded w-3/4" />
              </div>
            </div>

            {/* Tags skeleton */}
            <div className="border-t border-[var(--hrk-border-subtle)]/50 pt-4 mt-6">
              <div className="flex items-center gap-2">
                <div className="h-5 bg-[var(--hrk-bg-surface-raised)] rounded-full w-14" />
                <div className="h-5 bg-[var(--hrk-bg-surface-raised)] rounded-full w-16" />
                <div className="h-5 bg-[var(--hrk-bg-surface-raised)] rounded-full w-12" />
                <div className="h-5 bg-[var(--hrk-bg-surface-raised)] rounded-full w-18" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────────

  if (error || !post) {
    return (
      <div className="dark flex justify-center items-center min-h-screen bg-[var(--hrk-bg-app)] p-8" style={bgStyle}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">Failed to load post</h3>
          <p className="text-[var(--hrk-text-tertiary)] text-sm mb-4">{error}</p>
          <button
            onClick={fetchPostContent}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dark flex flex-col h-full bg-[var(--hrk-bg-app)] relative" style={bgStyle}>
      <div className="flex flex-col overflow-y-auto h-full">

        {/* ── Compact Header: Back + Avatar + Name + Stats (same pattern as UserDetailProfile) ── */}
        <div className="sticky top-0 z-30 h-[calc(56px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-[var(--hrk-bg-surface)]/95 backdrop-blur-sm border-b border-[var(--hrk-border-subtle)] flex items-center" style={headerBgStyle}>
          <div className="px-4 py-2 flex items-center gap-2 w-full">
            {/* Open app navigation drawer — keeps the drawers reachable on
                this full-screen page without navigating home first. */}
            {onOpenMenu && (
              <button
                onClick={onOpenMenu}
                aria-label="Open menu"
                className="p-1.5 hover:bg-[var(--hrk-bg-surface-raised)] rounded-lg transition-colors flex-shrink-0"
              >
                <Menu className="h-5 w-5 text-[var(--hrk-text-secondary)]" />
              </button>
            )}
            {/* Back */}
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 hover:bg-[var(--hrk-bg-surface-raised)] rounded-lg transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-[var(--hrk-text-secondary)]" />
              </button>
            )}

            {/* Avatar */}
            <HiveLink
              href={getUserUrl?.(post.author)}
              onActivate={() => onUserClick?.(post.author)}
              className="flex-shrink-0"
              aria-label={`@${post.author} profile`}
            >
              <img
                src={profile?.profileImage || `https://images.hive.blog/u/${post.author}/avatar`}
                alt={post.author}
                className="w-10 h-10 rounded-full bg-[var(--hrk-bg-surface-raised)] object-cover cursor-pointer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://images.hive.blog/u/${post.author}/avatar`;
                }}
              />
            </HiveLink>

            {/* Name + meta row. Time-ago and community sit directly
                below the username so the header carries the post's
                provenance — readers don't need to scan past the title
                to know when / where the post was published. Community
                pill is tappable when the consumer wires
                `onCommunityClick` (HiveSuite routes to the community
                detail page; other shells can route wherever). */}
            <div className="flex-1 min-w-0">
              <HiveLink
                href={getUserUrl?.(post.author)}
                onActivate={() => onUserClick?.(post.author)}
                className="block text-sm font-semibold text-white truncate hover:text-blue-400 transition-colors"
              >
                @{post.author}
              </HiveLink>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--hrk-text-tertiary)]">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(post.created)}
                </span>
                {post.community_title && (
                  (onCommunityClick || getCommunityUrl) && post.community ? (
                    <HiveLink
                      href={getCommunityUrl?.(post.community)}
                      onActivate={() => onCommunityClick?.(post.community)}
                      className="truncate text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      in {post.community_title}
                    </HiveLink>
                  ) : (
                    <span className="truncate">
                      in <span className="text-blue-400">{post.community_title}</span>
                    </span>
                  )
                )}
              </div>
            </div>

            {/* Whole-page language picker. Rendered only when the
                consumer wires both the controlled language and the
                setter — pairing it with a parent
                <HiveLanguageProvider> turns this into a one-tap
                "translate the entire post + all comments" affordance. */}
            {language !== undefined && onSelectLanguage && (
              <LanguagePickerButton
                language={language}
                onSelectLanguage={onSelectLanguage}
              />
            )}

            {/* Text-to-speech button to read post */}
            {typeof window !== 'undefined' && !!window.speechSynthesis && (
              <button
                onClick={handleSpeechToggle}
                className={`p-1.5 hover:bg-[var(--hrk-bg-surface-raised)] rounded-lg transition-colors flex-shrink-0 ${isSpeaking ? 'text-[var(--hrk-brand)] bg-[var(--hrk-bg-surface-raised)]' : 'text-[var(--hrk-text-secondary)]'}`}
                aria-label={isSpeaking ? "Stop reading post" : "Read post aloud"}
                title={isSpeaking ? "Stop reading post" : "Read post aloud"}
              >
                {isSpeaking ? (
                  <VolumeX className="h-5 w-5 animate-pulse text-red-400" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </button>
            )}

            {/* Header kebab — Bookmark · Share · Report. Each item is
                conditional on its handler; the trigger itself only
                appears when at least one handler is registered.
                Bookmark toggle forwards the post's title + a body
                excerpt so the consumer can hand them to backends
                that need a non-empty body (e.g. hreplier). */}
            <HeaderMoreMenu
              isBookmarked={!!isBookmarked}
              onToggleBookmark={
                onToggleBookmark
                  ? () => onToggleBookmark({
                      title: post.title || '',
                      // Cap at 500 chars so bookmark rows stay light
                      // — the consumer can show a richer preview
                      // by re-fetching the full body if needed.
                      body: (post.body || '').slice(0, 500),
                      parent_author: post.parent_author,
                      parent_permlink: post.parent_permlink,
                      depth: (post as { depth?: number }).depth,
                      json_metadata:
                        typeof post.json_metadata === 'string'
                          ? post.json_metadata
                          : post.json_metadata
                            ? JSON.stringify(post.json_metadata)
                            : undefined,
                    })
                  : undefined
              }
              onShare={onHeaderShare ?? onShare}
              onReport={onHeaderReport ?? onReport}
              onReblog={onReblog}
              isReblogged={isReblogged}
              onVersionHistory={() => setVersionHistoryOpen(true)}
              onViewRaw={() => setRawViewOpen(true)}
              onEdit={onEdit && currentUser && post.author === currentUser
                ? () => onEdit({
                    author: post.author,
                    permlink: post.permlink,
                    body: post.body ?? '',
                    title: post.title ?? '',
                    parent_author: post.parent_author ?? '',
                    parent_permlink: post.parent_permlink ?? '',
                    json_metadata: typeof post.json_metadata === 'string'
                      ? post.json_metadata
                      : (post.json_metadata ? JSON.stringify(post.json_metadata) : ''),
                  })
                : undefined}
            />
            {onOpenProfileMenu && (
              <button
                onClick={onOpenProfileMenu}
                className="p-1.5 hover:bg-[var(--hrk-bg-surface-raised)] rounded-full transition-colors flex-shrink-0"
                aria-label="Open user menu"
              >
                {currentUser ? (
                  <img
                    src={`https://images.hive.blog/u/${currentUser}/avatar`}
                    alt={currentUser}
                    className="h-6 w-6 rounded-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                      const fallback = e.currentTarget.nextSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = 'block';
                    }}
                  />
                ) : null}
                <User
                  className="h-5 w-5 text-[var(--hrk-text-secondary)]"
                  style={{ display: currentUser ? 'none' : 'block' }}
                />
              </button>
            )}
          </div>
        </div>

        {/* Header-kebab modals. Rendered once at the top of the detail
            surface so they live above the sticky header. */}
        <PostVersionHistoryModal
          isOpen={versionHistoryOpen}
          onClose={() => setVersionHistoryOpen(false)}
          author={post.author}
          permlink={post.permlink}
        />
        <PostRawViewModal
          isOpen={rawViewOpen}
          onClose={() => setRawViewOpen(false)}
          post={post}
        />

        {/* ── Single-column scrollable content ── */}
        <div className="flex-1">
          <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6">

            {/* View Parent — shown when this post is a reply (depth > 0) */}
            {post.depth > 0 && post.parent_author && post.parent_permlink && (
              <button
                onClick={() => onNavigateToPost?.(post.parent_author!, post.parent_permlink!)}
                className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)]/60 hover:bg-[var(--hrk-bg-surface-raised)]/60 transition-colors text-sm text-blue-400 hover:text-blue-300"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>View parent post</span>
                <span className="text-[var(--hrk-text-tertiary)] text-xs truncate max-w-[250px]">
                  @{post.parent_author}/{post.parent_permlink}
                </span>
              </button>
            )}

            {titleContent}

            {/* Metadata-driven gallery and 3Speak preview have been
                removed deliberately. The detail page should render
                ONLY what the author put in the body. Every embed
                (3Speak / IPFS) is extracted from the body and
                rendered as a dedicated player below, mirroring the
                Snaps feed card pattern. Any `json_metadata.image` /
                `video.thumbnail` that isn't in the body is ignored. */}

            {/* 3Speak videos pulled from body URLs. Each `<ThreeSpeakPlayer>`
                calls `play.3speak.tv/api/embed?v=author/permlink` to get
                the manifest URL and mounts an HLS-driven <video controls>
                — exactly the pattern the spec describes. */}
            {threeSpeakBodyRefs.length > 0 && (
              <div className="space-y-3 pb-4">
                {threeSpeakBodyRefs.map((ref) => (
                  <div
                    key={`${ref.author}/${ref.permlink}`}
                    className="flex justify-center"
                  >
                    <ThreeSpeakPlayer
                      author={ref.author}
                      permlink={ref.permlink}
                      thumbnail={ref.thumbnail}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Odysee / LBRY videos embedded via <iframe src="https://odysee.com/$/embed/…">.
                The @snapie/renderer strips these (not on its allowlist) so we
                pre-extract and render them here — same pattern as 3Speak. */}
            {odyseeBodyRefs.length > 0 && (
              <div className="space-y-3 pb-4">
                {odyseeBodyRefs.map((url) => {
                  const embedUrl = buildOdyseeEmbedUrl(url) ?? url;
                  return (
                    <div key={url} className="overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '16/9' }}>
                      <iframe
                        src={embedUrl}
                        title="Odysee Video"
                        className="h-full w-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* IPFS gateway media — image OR video, decided per URL by
                <IpfsMedia> via a one-time HEAD content-type probe. Same
                approach Snaps feed cards use: pull the URLs out of the
                body and render them as a dedicated gallery so the
                markdown renderer can't flag them as "(Unsupported …)". */}
            {ipfsMediaUrls.length > 0 && (
              <div className="space-y-3 pb-4">
                {ipfsMediaUrls.map((url) => (
                  <div
                    key={url}
                    className="overflow-hidden rounded-lg bg-[var(--hrk-bg-surface-sunken)]"
                  >
                    <IpfsMedia url={url} />
                  </div>
                ))}
              </div>
            )}

            {/* Rendered body — full width. Wrapped in
                SelectionTranslator so the user can highlight any
                passage and get a one-tap Google translation. */}
            <div className="pb-6">
              {bodyContent}
              {reSnapTarget && (
                <div className={renderedBody ? 'mt-4' : ''}>
                  <ReSnapEmbed
                    author={reSnapTarget.author}
                    permlink={reSnapTarget.permlink}
                    observer={currentUser}
                    onPostClick={onNavigateToPost}
                    onUserClick={onUserClick}
                    onPreviewVisibilityChange={handleReSnapPreviewVisibility}
                    showTopLevelPostPreview
                  />
                </div>
              )}
            </div>

            {/* WorldMappin pin — rendered below the body when the post has a
                geo-tag marker. Tapping the pin opens a popup with the
                author-supplied description. */}
            {worldMappinPin && (
              <div className="pb-6">
                <WorldMappinMap
                  lat={worldMappinPin.lat}
                  lng={worldMappinPin.lng}
                  description={worldMappinPin.description}
                />
              </div>
            )}

            {/* ── Poll Widget ── */}
            {parsedMetadata?.content_type === 'poll' && (() => {
              const maxChoices: number = poll?.max_choices_voted ?? parsedMetadata?.max_choices_voted ?? 1;
              const isMulti = maxChoices > 1;
              const endTs = poll?.end_time
                ? new Date(poll.end_time).getTime()
                : (parsedMetadata?.end_time ?? 0) * 1000;
              const pollEnded = endTs > 0 && Date.now() > endTs;
              const hasVoted = votedChoices.length > 0;
              // Check if currentUser already voted (from API data).
              // poll_voters may have .choices[] (multi) or .choice_num (single) — handle both.
              const apiVoter = currentUser
                ? poll?.poll_voters?.find(v => v.name === currentUser)
                : undefined;
              const apiVotedChoices: number[] = apiVoter?.choices?.length
                ? apiVoter.choices
                : apiVoter?.choice_num != null
                  ? [apiVoter.choice_num]
                  : [];
              const alreadyVoted = hasVoted || apiVotedChoices.length > 0;
              const allowVoteChanges = poll?.allow_vote_changes ?? parsedMetadata?.allow_vote_changes ?? false;
              const displayVoted = hasVoted ? votedChoices : apiVotedChoices;
              // Show vote UI for: logged-in user + active poll + callback provided + (not yet voted OR vote changes allowed)
              const showVoteUI = !!currentUser && !pollEnded && !!onVotePoll && (!alreadyVoted || allowVoteChanges);
              // Track whether user is changing their vote (already voted + allowed to change)
              const isChangingVote = alreadyVoted && allowVoteChanges && !hasVoted;
              const choices = poll?.poll_choices ?? (parsedMetadata?.choices ?? []).map((text: string, i: number) => ({ choice_num: i + 1, choice_text: text, votes: null }));
              const totalVotes = choices.reduce((sum: number, c: any) => sum + (c.votes?.total_votes ?? 0), 0);

              // When changing vote: use submit button flow (even for single choice)
              const needsSubmitButton = isMulti || isChangingVote;

              const handleChoiceClick = async (choiceNum: number) => {
                if (!showVoteUI || isSubmittingVote) return;
                if (!needsSubmitButton) {
                  // Single choice, first vote — vote immediately
                  setIsSubmittingVote(true);
                  try {
                    const result = await Promise.resolve(onVotePoll?.(post!.author, post!.permlink, [choiceNum]));
                    if (result === false) return; // cancelled — don't update UI
                    setVotedChoices([choiceNum]);
                  } finally {
                    setIsSubmittingVote(false);
                  }
                } else {
                  // Multi choice or changing vote — toggle selection
                  setSelectedChoices(prev => {
                    if (prev.includes(choiceNum)) return prev.filter(n => n !== choiceNum);
                    if (prev.length >= maxChoices) return prev; // cap at max
                    return [...prev, choiceNum];
                  });
                }
              };

              const handleSubmit = async () => {
                if (!showVoteUI || isSubmittingVote || selectedChoices.length === 0) return;
                setIsSubmittingVote(true);
                try {
                  const result = await Promise.resolve(onVotePoll?.(post!.author, post!.permlink, selectedChoices));
                  if (result === false) return; // cancelled — keep selections, don't mark as voted
                  setVotedChoices(selectedChoices);
                  setSelectedChoices([]);
                } finally {
                  setIsSubmittingVote(false);
                }
              };

              return (
                <div className="mb-6 rounded-xl border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)]/60 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                    <BarChart2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Poll</span>
                    <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium ${pollEnded ? 'bg-[var(--hrk-bg-surface-raised)] text-[var(--hrk-text-tertiary)]' : 'bg-green-900/50 text-green-400'}`}>
                      {pollEnded ? 'Ended' : `Ends in ${Math.ceil((endTs - Date.now()) / (1000 * 60 * 60 * 24))}d`}
                    </span>
                  </div>

                  {/* Question */}
                  <p className="px-4 pb-3 text-sm font-semibold text-white">
                    <TranslatedText text={poll?.question ?? parsedMetadata?.question} />
                  </p>

                  {/* Selection hint */}
                  {showVoteUI && needsSubmitButton && (
                    <p className="px-4 pb-2 text-[11px] text-[var(--hrk-text-tertiary)]">
                      {isChangingVote ? 'Change your vote — ' : ''}Select up to {maxChoices} option{maxChoices > 1 ? 's' : ''}
                      {selectedChoices.length > 0 && (
                        <span className="ml-1 text-blue-400">· {selectedChoices.length} selected</span>
                      )}
                    </p>
                  )}

                  {/* Choices */}
                  <div className="px-4 pb-4 space-y-2">
                    {pollLoading ? (
                      [1, 2, 3].map(i => (
                        <div key={i} className="h-9 bg-[var(--hrk-bg-surface-raised)]/50 rounded-lg animate-pulse" />
                      ))
                    ) : choices.map((choice: { choice_num: number; choice_text: string; votes?: { total_votes: number } | null }) => {
                      const votes = choice.votes?.total_votes ?? 0;
                      const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                      const isVoted = displayVoted.includes(choice.choice_num);
                      const isSelected = selectedChoices.includes(choice.choice_num);
                      const isMaxed = needsSubmitButton && selectedChoices.length >= maxChoices && !isSelected;
                      const isClickable = showVoteUI && !isMaxed;

                      let borderColor = 'border-[var(--hrk-border-subtle)]';
                      let iconEl = <Circle className="w-3.5 h-3.5 text-[var(--hrk-text-tertiary)] flex-shrink-0" />;
                      let fillColor = 'bg-blue-600/20';

                      if (isSelected) {
                        // Currently selected (new selection)
                        borderColor = 'border-blue-500/60';
                        iconEl = <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
                      } else if (isVoted && !isChangingVote) {
                        // Previously voted and not in change mode — solid green
                        borderColor = 'border-green-600/60';
                        iconEl = <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />;
                        fillColor = 'bg-green-600/20';
                      } else if (isVoted && isChangingVote) {
                        // Previously voted but in change mode — dimmed green (old vote)
                        borderColor = 'border-green-800/40';
                        iconEl = <CheckCircle2 className="w-3.5 h-3.5 text-green-700 flex-shrink-0" />;
                        fillColor = 'bg-green-900/10';
                      }

                      return (
                        <div
                          key={choice.choice_num}
                          className={`relative rounded-lg overflow-hidden border ${borderColor} bg-[var(--hrk-bg-app)]/50 transition-colors ${isClickable ? 'cursor-pointer hover:border-blue-500/40' : isMaxed ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={() => handleChoiceClick(choice.choice_num)}
                        >
                          {pct > 0 && (
                            <div
                              className={`absolute inset-y-0 left-0 ${fillColor} transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                            />
                          )}
                          <div className="relative flex items-center justify-between px-3 py-2.5 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {iconEl}
                              <span className={`text-sm truncate ${isSelected ? 'text-blue-300 font-medium' : isVoted && !isChangingVote ? 'text-green-300 font-medium' : isVoted && isChangingVote ? 'text-green-700' : 'text-[var(--hrk-text-primary)]'}`}>
                                <TranslatedText text={choice.choice_text} />
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 text-[11px] text-[var(--hrk-text-tertiary)]">
                              <span>{pct}%</span>
                              <span className="text-gray-600">·</span>
                              <span>{votes} vote{votes !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Submit / Change vote button */}
                  {showVoteUI && needsSubmitButton && (
                    <div className="px-4 pb-4">
                      <button
                        onClick={handleSubmit}
                        disabled={selectedChoices.length === 0 || isSubmittingVote}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-[var(--hrk-bg-surface-raised)] disabled:text-[var(--hrk-text-tertiary)] text-white text-sm rounded-lg transition-colors w-full justify-center font-medium"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {isSubmittingVote ? 'Submitting…' : isChangingVote ? 'Change Vote' : `Submit Vote${selectedChoices.length > 1 ? 's' : ''}`}
                      </button>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="px-4 pb-3 text-[11px] text-[var(--hrk-text-tertiary)] border-t border-[var(--hrk-border-subtle)]/50 pt-2 flex items-center gap-2">
                    <span>{poll?.poll_stats?.total_voting_accounts_num ?? 0} voter{(poll?.poll_stats?.total_voting_accounts_num ?? 0) !== 1 ? 's' : ''} total</span>
                    {alreadyVoted && (
                      <span className="text-green-500 ml-auto">
                        ✓ Voted{allowVoteChanges ? ' · Vote changes allowed' : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Tags */}
            {parsedMetadata?.tags && parsedMetadata.tags.length > 0 && (
              <div className="border-t border-[var(--hrk-border-subtle)]/50 pt-4 pb-4">
                <div className="flex items-center gap-1.5 text-xs text-[var(--hrk-text-tertiary)] mb-2">
                  <Tag className="w-3.5 h-3.5" /> Tags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {parsedMetadata.tags.map((tag: string, index: number) => (
                    <span
                      key={index}
                      className="px-2.5 py-0.5 bg-blue-900/50 text-blue-300 text-[11px] rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom action bar (repeat for long posts) */}
            <div className="py-2.5 border-t border-[var(--hrk-border-subtle)]/50">
              <PostActionButton
                author={post.author}
                permlink={post.permlink}
                currentUser={currentUser}
                hiveValue={payoutValue}
                hiveIconUrl={hiveIconUrl}
                payoutTooltip={payoutTooltip}
                payoutDetails={payoutDetails}
                awaitingWalletApproval={awaitingWalletApproval}
                initialVotes={post.active_votes || []}
                initialVoteCount={totalVotesCount}
                initialFlagWeight={post.stats?.flag_weight}
                initialCommentsCount={post.children || 0}
                postCreatedAt={post.created}
                onUpvote={onUpvote}
                onSubmitComment={onSubmitComment}
                onClickCommentUpvote={onClickCommentUpvote}
                onReblog={onReblog}
                onShare={onShare}
                onTip={onTip}
                onReport={onReport}
                onEdit={onEdit && currentUser && post.author === currentUser
                  ? () => onEdit({
                      author: post.author,
                      permlink: post.permlink,
                      body: post.body ?? '',
                      title: post.title ?? '',
                      parent_author: post.parent_author ?? '',
                      parent_permlink: post.parent_permlink ?? '',
                      json_metadata: typeof post.json_metadata === 'string'
                        ? post.json_metadata
                        : (post.json_metadata ? JSON.stringify(post.json_metadata) : ''),
                    })
                  : undefined}
                onDelete={onDelete && currentUser && post.author === currentUser && canDeletePost
                  ? () => onDelete({ author: post.author, permlink: post.permlink })
                  : undefined}
                onUserClick={onUserClick}
                getUserUrl={getUserUrl}
                ecencyToken={ecencyToken}
                threeSpeakApiKey={threeSpeakApiKey}
                giphyApiKey={giphyApiKey}
                templateToken={templateToken}
                templateApiBaseUrl={templateApiBaseUrl}
                disableCommentsModal
                onComments={() => commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                showVoteButton={showVoteButton}
                parentTags={parentTags}
                defaultReward={defaultReward}
                defaultBeneficiaries={defaultBeneficiaries}
                beneficiaryFavorites={beneficiaryFavorites}
                defaultVotePercent={defaultVotePercent}
                voteWeightStep={voteWeightStep}
                allowLandscapeVideos={allowLandscapeVideos}
              />
            </div>

            {/* Inline comments section — wrapped so highlighting any
                comment body triggers the same translate popover the
                post body uses. */}
            <div ref={commentsSectionRef}>
              <SelectionTranslator>
              <InlineCommentSection
                author={post.author}
                permlink={post.permlink}
                currentUser={currentUser}
                onSubmitComment={onSubmitComment}
                onClickCommentUpvote={onClickCommentUpvote}
                ecencyToken={ecencyToken}
                threeSpeakApiKey={threeSpeakApiKey}
                giphyApiKey={giphyApiKey}
                templateToken={templateToken}
                templateApiBaseUrl={templateApiBaseUrl}
                reportedAuthors={reportedAuthors}
                reportedPosts={reportedPosts}
                hiveIconUrl={hiveIconUrl}
                onShareComment={onShareComment}
                onTipComment={onTipComment}
                onReportComment={onReportComment}
                onToggleCommentBookmark={onToggleCommentBookmark}
                isCommentBookmarked={isCommentBookmarked}
                mentionSeedAccounts={mentionSeedAccounts}
                onEditComment={onEditComment}
                onDeleteComment={onDeleteComment}
                onNavigateToPost={onNavigateToPost}
                onUserClick={onUserClick}
                showVoteButton={showVoteButton}
                alreadyVoted={alreadyVoted}
                parentTags={parentTags}
                defaultReward={defaultReward}
                defaultBeneficiaries={defaultBeneficiaries}
                beneficiaryFavorites={beneficiaryFavorites}
                defaultVotePercent={defaultVotePercent}
                voteWeightStep={voteWeightStep}
                allowLandscapeVideos={allowLandscapeVideos}
                awaitingWalletApproval={awaitingWalletApproval}
                renderOptions={renderOptions}
              />
              </SelectionTranslator>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HiveDetailPost;

// ─── Header kebab popover ─────────────────────────────────────────
// Standalone small menu rendered in the sticky app bar. Mirrors
// MoreActionsMenu's portal-based positioning but ships only the
// items relevant to the detail surface: Bookmark · Share · Report.
// Each item is conditional on its handler.

interface HeaderMoreMenuProps {
  isBookmarked: boolean;
  onToggleBookmark?: () => void;
  onShare?: () => void;
  onReport?: () => void;
  /** Opens the on-chain edit-history modal for this post. Always
   *  rendered from the kit — no consumer wiring required. */
  onVersionHistory?: () => void;
  /** Opens the raw-fields inspector modal. */
  onViewRaw?: () => void;
  /** Author-only Edit entry. HiveDetailPost only passes this when
   *  `post.author === currentUser`, so the trigger row stays hidden
   *  for everyone else. */
  onEdit?: () => void;
  onReblog?: () => void;
  isReblogged?: boolean;
}

const HEADER_MENU_WIDTH = 180;
const HEADER_MENU_GAP = 4;

function HeaderMoreMenu({
  isBookmarked,
  onToggleBookmark,
  onShare,
  onReport,
  onVersionHistory,
  onViewRaw,
  onEdit,
  onReblog,
  isReblogged = false,
}: HeaderMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const top = rect.bottom + HEADER_MENU_GAP;
      const vw = window.innerWidth;
      // Right-align under the kebab; clamp to the viewport so the
      // popover never falls off the edge on narrow screens.
      const rawLeft = rect.right - HEADER_MENU_WIDTH;
      const left = Math.max(8, Math.min(vw - HEADER_MENU_WIDTH - 8, rawLeft));
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  // No handlers registered — render nothing (the trigger itself
  // disappears, mirroring how the inline icons drop out when their
  // callbacks aren't passed).
  if (!onToggleBookmark && !onShare && !onReport && !onVersionHistory && !onViewRaw && !onEdit && !onReblog) return null;

  const run = (cb?: () => void) => () => {
    setOpen(false);
    cb?.();
  };

  const menu =
    open && pos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: HEADER_MENU_WIDTH,
              zIndex: 2000,
            }}
            className="overflow-hidden rounded-lg border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface-sunken)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {onEdit && (
              <button
                type="button"
                role="menuitem"
                onClick={run(onEdit)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--hrk-text-secondary)] transition-colors hover:bg-[var(--hrk-bg-hover)]"
              >
                <Pencil className="h-3.5 w-3.5 text-gray-300" />
                <span>Edit post</span>
              </button>
            )}
            {onReblog && (
              <button
                type="button"
                role="menuitem"
                onClick={run(onReblog)}
                aria-pressed={isReblogged}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--hrk-text-secondary)] transition-colors hover:bg-[var(--hrk-bg-hover)]"
              >
                <Repeat2
                  className={`h-3.5 w-3.5 ${
                    isReblogged ? 'fill-current text-[var(--hrk-brand)]' : 'text-gray-300'
                  }`}
                />
                <span>{isReblogged ? 'Reblogged' : 'Reblog'}</span>
              </button>
            )}
            {onToggleBookmark && (
              <button
                type="button"
                role="menuitem"
                onClick={run(onToggleBookmark)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--hrk-text-secondary)] transition-colors hover:bg-[var(--hrk-bg-hover)]"
              >
                <Bookmark
                  className={
                    'h-3.5 w-3.5 ' +
                    (isBookmarked
                      ? 'fill-[var(--hrk-brand)] text-[var(--hrk-brand)]'
                      : 'text-gray-300')
                  }
                />
                <span>{isBookmarked ? 'Remove bookmark' : 'Bookmark'}</span>
              </button>
            )}
            {onShare && (
              <button
                type="button"
                role="menuitem"
                onClick={run(onShare)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--hrk-text-secondary)] transition-colors hover:bg-[var(--hrk-bg-hover)]"
              >
                <Share2 className="h-3.5 w-3.5 text-gray-300" />
                <span>Share</span>
              </button>
            )}
            {onVersionHistory && (
              <button
                type="button"
                role="menuitem"
                onClick={run(onVersionHistory)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--hrk-text-secondary)] transition-colors hover:bg-[var(--hrk-bg-hover)]"
              >
                <History className="h-3.5 w-3.5 text-gray-300" />
                <span>Version History</span>
              </button>
            )}
            {onViewRaw && (
              <button
                type="button"
                role="menuitem"
                onClick={run(onViewRaw)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--hrk-text-secondary)] transition-colors hover:bg-[var(--hrk-bg-hover)]"
              >
                <FileCode2 className="h-3.5 w-3.5 text-gray-300" />
                <span>View Raw</span>
              </button>
            )}
            {onReport && (
              <button
                type="button"
                role="menuitem"
                onClick={run(onReport)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-300 transition-colors hover:bg-[var(--hrk-bg-hover)]"
              >
                <Flag className="h-3.5 w-3.5" />
                <span>Report post</span>
              </button>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="p-1.5 hover:bg-[var(--hrk-bg-surface-raised)] rounded-lg transition-colors flex-shrink-0"
      >
        <MoreVertical className="h-5 w-5 text-[var(--hrk-text-secondary)]" />
      </button>
      {menu}
    </>
  );
}
