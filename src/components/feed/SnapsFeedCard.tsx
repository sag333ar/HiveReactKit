/**
 * SnapsFeedCard — single feed card matching the hSnaps home-screen layout.
 *
 * Layout (mirrors hSnaps `<PostCard/>` / `<FeedItemBody/>`):
 *   header (avatar · @author · time · community)
 *   plain-text body (markdown stripped, mentions / hashtags / urls
 *     turned into clickable inline segments)
 *   attachment strip (swipeable image carousel + lightweight YouTube /
 *     3Speak / audio placeholders)
 *   action bar (`<PostActionButton/>`)
 *
 * No title is rendered in the card — taps anywhere outside the action
 * row navigate to the post via `onPostClick`.
 *
 * No app-specific stores: every action is forwarded via callbacks so
 * the host app owns the data plane.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FC, type ReactNode } from 'react';
import { createHiveRenderer } from '@snapie/renderer';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Music,
  ImageOff,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
} from 'lucide-react';
import type { Post } from '@/types/post';
import type { ActiveVote } from '@/types/video';
import { PostActionButton } from '../actionButtons/PostActionButton';
import { SelectionTranslator } from '../SelectionTranslator';
import { PollVoteWidget } from '../PollVoteWidget';
import { ThreeSpeakPlayer as ThreeSpeakNativePlayer } from '../ThreeSpeakPlayer';
import type { RewardOption } from '../../utils/commentOptions';
import { parseHiveFrontendUrl } from '@/utils/hiveLinks';
import { detectHivePostReference, stripHivePostReference } from '@/utils/hivePostReferences';
import ReSnapEmbed from './ReSnapEmbed';
import { IPFS_URL_REGEX, useIpfsKind } from '../IpfsMedia';
import { HiveLink } from '../common/HiveLink';

export interface SnapsFeedCardProps {
  post: Post;
  currentUser?: string;

  onUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onSubmitComment?: (parentAuthor: string, parentPermlink: string, body: string) => void | Promise<void>;
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onReblog?: (author: string, permlink: string) => void;
  /** Called when the viewer taps "Re-snap" in the snap's more menu.
   *  Host implements the broadcast — body is a URL pointing at the
   *  original snap (`http(s)://<frontend>/@<author>/<permlink>`) so
   *  consumers detect it and render the original inline. The
   *  `parentTags` argument carries the original snap's
   *  `json_metadata.tags` so the host can keep the new re-snap under
   *  the same community / topic. */
  onReSnap?: (
    author: string,
    permlink: string,
    parentTags?: string[],
  ) => void;
  onTip?: (author: string, permlink: string) => void;
  onSharePost?: (author: string, permlink: string) => void;
  onCommentClick?: (author: string, permlink: string) => void;
  /** Click on just the message-circle icon — typical use: open an
   *  inline reply composer. Mirrors hSnaps PostCard. The optional
   *  `parentTags` argument carries the parent post's
   *  `json_metadata.tags` so the composer can pre-fill (and lock) the
   *  reply's tag list with the same tags as the parent. */
  onClickCommentIcon?: (
    author: string,
    permlink: string,
    parentTags?: string[],
  ) => void;
  /** Click on just the count number next to the comment icon — typical
   *  use: navigate to the post detail / comments view. Mirrors hSnaps. */
  onClickCommentCount?: (author: string, permlink: string) => void;
  onReportPost?: (author: string, permlink: string) => void;
  /** Called when the user toggles the bookmark item inside the snap's
   *  kebab. Consumer decides whether to add or remove based on
   *  `isPostBookmarked` below. Omit to hide the bookmark item entirely. */
  onToggleBookmark?: (author: string, permlink: string) => void;
  /** Pure read function called per render with the snap's author +
   *  permlink. Return `true` when the current user has this snap
   *  bookmarked so the kebab item shows filled state. Pulled from the
   *  consumer's bookmark store. */
  isPostBookmarked?: (author: string, permlink: string) => boolean;
  /** Called when the snap's author taps Delete on the action-bar
   *  kebab. The kit only renders the entry-point when `currentUser`
   *  matches `post.author`. Consumer is responsible for the confirm
   *  dialog and the broadcast (`delete_comment`). */
  onDeletePost?: (author: string, permlink: string) => void;
  /** Called when the snap's author taps Edit on the action-bar kebab.
   *  The kit only renders the entry-point when `currentUser` matches
   *  `post.author`. Payload mirrors HiveDetailPost.onEdit. */
  onEditSnap?: (data: {
    author: string;
    permlink: string;
    body: string;
    title: string;
    parent_author: string;
    parent_permlink: string;
    json_metadata: string;
  }) => void;
  /** Called when the viewer submits a vote on a poll embedded in this
   *  snap. Pass the same handler used for poll posts on the detail
   *  page — consumers broadcast a `custom_json` op (id: "polls"). */
  onVotePoll?: (
    author: string,
    permlink: string,
    choiceNums: number[],
  ) => void | boolean | Promise<void | boolean>;
  onUserClick?: (username: string) => void;
  onPostClick?: (author: string, permlink: string, title?: string) => void;
  onTagClick?: (tag: string) => void;
  // URL builders — when provided, the matching clickable surfaces
  // render as real <a href> links (via HiveLink) so the browser
  // offers "open in new tab", Cmd/Ctrl/middle-click, etc. Plain
  // clicks still route through the on*Click callbacks for SPA nav.
  // When omitted, those surfaces fall back to <button> as before.
  getPostUrl?: (author: string, permlink: string) => string;
  getUserUrl?: (username: string) => string;
  getTagUrl?: (tag: string) => string;
  getCommunityUrl?: (community: string) => string;

  ecencyToken?: string;
  threeSpeakApiKey?: string;
  giphyApiKey?: string;
  templateToken?: string;
  templateApiBaseUrl?: string;
  defaultVotePercent?: number;
  voteWeightStep?: number;
  allowLandscapeVideos?: boolean;
  /** Blinking "Open Keychain App & Approve" hint on the vote slider
   *  while a broadcast is in flight. Set when the logged-in user is
   *  on Keychain / HiveAuth / PeakVault. */
  awaitingWalletApproval?: boolean;
  defaultReward?: RewardOption;

  /** Optional render slot for header right-side actions (e.g. a kebab
   *  menu with Edit / Delete / Flag). Receives the post so the host can
   *  own edit/delete/flag state per card. */
  renderHeaderActions?: (post: Post) => ReactNode;

  /** Collapse the per-card secondary actions (reblog · share · tip ·
   *  flag) into a single 3-dot kebab menu inside the action bar. */
  actionsAsMenu?: boolean;
}

// ── Body parsing ─────────────────────────────────────────────────────────

interface ParsedBody {
  segments: BodySegment[];
  attachments: Attachment[];
}

type BodySegment =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; username: string }
  | { kind: 'hashtag'; tag: string }
  | { kind: 'link'; url: string };

type Attachment =
  | { kind: 'image'; url: string }
  | { kind: 'ipfs'; url: string }
  | { kind: 'youtube'; id: string }
  | { kind: 'threespeak'; url: string }
  | { kind: 'twitter'; id: string }
  | { kind: 'audio'; url: string }
  | { kind: '3speak-audio'; url: string };

const TWITTER_REGEX = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/gi;
const YOUTUBE_REGEX =
  /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([^&\s]+)|https?:\/\/youtu\.be\/([^?\s]+)|https?:\/\/(?:www\.)?youtube\.com\/shorts\/([^?\s]+)/gi;
const THREE_SPEAK_REGEX = /https?:\/\/(?:play\.)?3speak\.tv\/[^\s"'<>)]+/gi;
// Direct audio file URLs — widened to mirror hSnaps (extra container
// formats + tolerate trailing query strings after the extension).
const AUDIO_FILE_REGEX =
  /https?:\/\/[^\s"'<>)]+?\.(?:mp3|wav|ogg|m4a|aac|flac|webm|opus)(?:\?[^\s"'<>)]*)?/gi;
// 3Speak's hosted audio player — `audio.3speak.tv/play?a=...&v=...`.
// Rendered inline as the same iframe shape hSnaps uses.
const THREE_SPEAK_AUDIO_REGEX = /https?:\/\/audio\.3speak\.tv\/play\?[^\s"'<>)]+/gi;
const IMG_MD_REGEX = /!\[[^\]]*\]\(([^\s)]+)\)/g;
const IMG_HTML_REGEX = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
/** Bare image URLs the markdown renderer would auto-promote into <img>
 *  tags. Match `.jpg|.jpeg|.png|.gif|.webp|.avif|.bmp|.svg`, optionally
 *  followed by querystring. Hive's images proxy (`images.hive.blog/<size>/<encoded-url>`)
 *  encodes the inner URL so the trailing dot-extension is on the wrapped
 *  URL, not on the proxy path — match that shape too. */
const IMG_URL_REGEX =
  /https?:\/\/[^\s"'<>)]+?\.(?:jpe?g|png|gif|webp|avif|bmp|svg)(?:\?[^\s"'<>)]*)?/gi;
const URL_REGEX = /https?:\/\/[^\s)<>\]]+/g;
const MENTION_REGEX = /@([a-z][a-z0-9.-]{1,15}[a-z0-9])/g;
const HASHTAG_REGEX = /(?:^|\s)#([a-zA-Z][\w-]{0,31})/g;

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/** Many Hive clients (Ecency mobile especially) copy image URLs out
 *  of body markdown by raw string-slicing and forget to strip the
 *  closing `)`, `,`, or quote. That leaves `json_metadata.image`
 *  with the same image listed once clean and once with trailing
 *  junk. `sanitizeImageUrl` peels off the punctuation; both forms
 *  collapse to the same key. Also corrects the renderer's
 *  "https:/foo.jpg" single-slash artifact so a proxied vs raw
 *  variant doesn't double-list. */
function sanitizeImageUrl(url: string): string {
  return url.trim()
    .replace(/[)\],.;:>\s"'<]+$/, '')
    .replace(/^(https?):\/(?!\/)/, '$1://');
}

/** Sanitised-and-decoded dedup for image URLs. Output values are
 *  the cleaned forms so a malformed URL never reaches the strip or
 *  the popup. */
function uniqImageUrls(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    if (typeof raw !== 'string') continue;
    const cleaned = sanitizeImageUrl(raw);
    if (!cleaned || !/^https?:\/\//.test(cleaned)) continue;
    let key = cleaned;
    try { key = decodeURIComponent(cleaned); } catch { /* keep as-is */ }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function parseJsonMetadata(jm: unknown): Record<string, unknown> {
  if (!jm) return {};
  if (typeof jm === 'string') {
    try {
      return JSON.parse(jm) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof jm === 'object') return jm as Record<string, unknown>;
  return {};
}

/** Tags that mark a post as part of the hivesuite app family. Posts
 *  carrying any of these get the unified "hivesuite" pill in the
 *  card header — `hsnaps` and `hreplier` are the historic identifiers
 *  the older sibling apps still emit, `hivesuite` is the canonical
 *  one used going forward. */
const HIVESUITE_FAMILY_TAGS = new Set(['hsnaps', 'hreplier', 'hivesuite']);

/** True when `json_metadata.tags` contains any of the hivesuite-family
 *  tags. Surfaces the pill in the header. Per-app chips (hSnaps,
 *  hReplier, …) are deliberately collapsed into one branded marker
 *  so the strip stays uncluttered. */
function hasHivesuiteFamilyTag(post: Post): boolean {
  const meta = parseJsonMetadata(post.json_metadata as unknown);
  const raw = Array.isArray(meta.tags) ? (meta.tags as unknown[]) : [];
  return raw.some(
    (t) => typeof t === 'string' && HIVESUITE_FAMILY_TAGS.has(t.toLowerCase()),
  );
}

/** Extract `json_metadata.tags` as a string array — used to seed the
 *  reply composer when the user taps the comment icon, so the inline
 *  composer can pre-fill (and lock) the parent's tag list. */
function extractTagsFromMeta(post: Post): string[] {
  const meta = parseJsonMetadata(post.json_metadata as unknown);
  const raw = Array.isArray(meta.tags) ? (meta.tags as unknown[]) : [];
  return raw.filter((t): t is string => typeof t === 'string' && t.length > 0);
}

/** Strip the trailing "via Apps from <url>" credit some clients append to
 *  snap bodies. Three observed shapes — anchored to end of body so we never
 *  trim mid-content. Used by both the rich (HTML) and plain-text paths. */
function stripViaAppsCredit(body: string): string {
  return body
    .replace(
      /\s*(?:<br\s*\/?>)?\s*<sub>\s*\[via Apps from\][^<]*<\/sub>\s*$/i,
      '',
    )
    .replace(
      /\s*(?:<br\s*\/?>)?\s*\[via Apps from\]\([^)]*\)\s*$/i,
      '',
    )
    .replace(
      /\s*(?:<br\s*\/?>)?\s*via Apps from\s+https?:\/\/\S+\s*$/i,
      '',
    );
}

function parseBody(post: Post): ParsedBody {
  const raw = stripViaAppsCredit(post.body ?? '');

  // Collect attachment URLs strictly from the body — `json_metadata.image`
  // / `json_metadata.video.thumbnail` etc. are intentionally ignored so
  // the card shows only what the author put inside the body text. This
  // matches the rule applied on HiveDetailPost (no metadata gallery).
  const imageUrls: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = IMG_MD_REGEX.exec(raw))) imageUrls.push(m[1]);
  while ((m = IMG_HTML_REGEX.exec(raw))) imageUrls.push(m[1]);
  // Bare image URLs the renderer would otherwise auto-promote into inline
  // <img> tags inside the body — pull them into the carousel so they're
  // shown once (in the strip) instead of twice (strip + body).
  while ((m = IMG_URL_REGEX.exec(raw))) imageUrls.push(m[0]);
  // IPFS gateway URLs (no file extension) need a HEAD probe at render
  // time to decide between <img> and <video>. Collect them separately
  // and surface them via the 'ipfs' attachment kind. Local regex
  // instance — IPFS_URL_REGEX is module-level shared, so reusing it
  // across `.exec` loops in two components could collide on lastIndex.
  const ipfsUrls: string[] = [];
  const ipfsReParse = new RegExp(IPFS_URL_REGEX.source, IPFS_URL_REGEX.flags);
  while ((m = ipfsReParse.exec(raw))) ipfsUrls.push(m[0]);

  const youtubeIds: string[] = [];
  while ((m = YOUTUBE_REGEX.exec(raw))) youtubeIds.push((m[1] || m[2] || m[3])!);

  const threeSpeakUrls: string[] = [];
  while ((m = THREE_SPEAK_REGEX.exec(raw))) threeSpeakUrls.push(m[0]);

  // Audio — both direct file URLs (mp3/wav/…) AND the hosted 3Speak
  // audio player (`audio.3speak.tv/play?…`). Extract 3Speak first so
  // the catch-all file regex doesn't accidentally grab the same URL.
  const threeSpeakAudioUrls: string[] = [];
  while ((m = THREE_SPEAK_AUDIO_REGEX.exec(raw))) threeSpeakAudioUrls.push(m[0]);
  const audioUrls: string[] = [];
  while ((m = AUDIO_FILE_REGEX.exec(raw))) {
    if (!threeSpeakAudioUrls.includes(m[0])) audioUrls.push(m[0]);
  }

  const twitterIds: string[] = [];
  while ((m = TWITTER_REGEX.exec(raw))) twitterIds.push(m[1]);

  const attachments: Attachment[] = [
    // Image URLs go through a stronger dedup that strips the trailing
    // `)` / `,` / `"` punctuation common in Ecency-mobile metadata
    // and normalises URL-encoding, so the same image never appears
    // twice in the strip or the popup.
    ...uniqImageUrls(imageUrls).map((url) => ({ kind: 'image' as const, url })),
    ...uniq(ipfsUrls).map((url) => ({ kind: 'ipfs' as const, url })),
    ...uniq(youtubeIds).map((id) => ({ kind: 'youtube' as const, id })),
    ...uniq(threeSpeakUrls).map((url) => ({ kind: 'threespeak' as const, url })),
    ...uniq(twitterIds).map((id) => ({ kind: 'twitter' as const, id })),
    ...uniq(threeSpeakAudioUrls).map((url) => ({ kind: '3speak-audio' as const, url })),
    ...uniq(audioUrls).map((url) => ({ kind: 'audio' as const, url })),
  ];

  // Strip media + markdown noise to plain text
  let text = raw;
  text = text.replace(IMG_MD_REGEX, '');
  text = text.replace(IMG_HTML_REGEX, '');
  text = text.replace(IPFS_URL_REGEX, '');
  text = text.replace(YOUTUBE_REGEX, '');
  text = text.replace(THREE_SPEAK_REGEX, '');
  text = text.replace(THREE_SPEAK_AUDIO_REGEX, '');
  text = text.replace(AUDIO_FILE_REGEX, '');
  text = text.replace(TWITTER_REGEX, '');
  text = text.replace(/<[^>]+>/g, ''); // strip remaining HTML
  text = text.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, '$1 $2'); // [text](url) → "text url"
  text = text.replace(/[*_~`>#-]+/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();

  // Tokenise into clickable segments
  const segments: BodySegment[] = [];
  let cursor = 0;
  type Token = { start: number; end: number; node: BodySegment };
  const tokens: Token[] = [];
  let mm: RegExpExecArray | null;

  // Find URLs first (they should NOT match mentions/hashtags inside)
  const urlRe = new RegExp(URL_REGEX.source, 'g');
  while ((mm = urlRe.exec(text)) !== null) {
    tokens.push({ start: mm.index, end: mm.index + mm[0].length, node: { kind: 'link', url: mm[0] } });
  }
  const mentionRe = new RegExp(MENTION_REGEX.source, 'g');
  while ((mm = mentionRe.exec(text)) !== null) {
    if (tokens.some((t) => mm!.index >= t.start && mm!.index < t.end)) continue;
    tokens.push({ start: mm.index, end: mm.index + mm[0].length, node: { kind: 'mention', username: mm[1] } });
  }
  const hashRe = new RegExp(HASHTAG_REGEX.source, 'g');
  while ((mm = hashRe.exec(text)) !== null) {
    const start = mm.index + (mm[0].startsWith(' ') ? 1 : 0);
    if (tokens.some((t) => start >= t.start && start < t.end)) continue;
    tokens.push({ start, end: start + (mm[0].length - (mm[0].startsWith(' ') ? 1 : 0)), node: { kind: 'hashtag', tag: mm[1] } });
  }
  tokens.sort((a, b) => a.start - b.start);

  for (const tok of tokens) {
    if (cursor < tok.start) segments.push({ kind: 'text', text: text.slice(cursor, tok.start) });
    segments.push(tok.node);
    cursor = tok.end;
  }
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });

  if (segments.length === 0 && text) segments.push({ kind: 'text', text });

  return { segments, attachments };
}

function formatTimeAgo(dateString: string): string {
  // Hive timestamps come in as UTC without the `Z` suffix; treat them
  // as UTC explicitly so the relative label doesn't skew by the user's
  // timezone offset (e.g. "in 5h" for a fresh post in the Americas).
  const iso = /Z|[+-]\d{2}:?\d{2}$/.test(dateString)
    ? dateString
    : `${dateString}Z`;
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Inline body renderer ─────────────────────────────────────────────────

const InlineBody: FC<{
  segments: BodySegment[];
  onUserClick?: (username: string) => void;
  onTagClick?: (tag: string) => void;
  getUserUrl?: (username: string) => string;
  getTagUrl?: (tag: string) => string;
}> = ({ segments, onUserClick, onTagClick, getUserUrl, getTagUrl }) => {
  const out: ReactNode[] = [];
  segments.forEach((seg, i) => {
    if (seg.kind === 'text') {
      out.push(<span key={i}>{seg.text}</span>);
    } else if (seg.kind === 'mention') {
      out.push(
        <HiveLink
          key={i}
          href={getUserUrl?.(seg.username)}
          onActivate={() => onUserClick?.(seg.username)}
          className="text-[var(--hrk-brand)] hover:underline"
        >
          @{seg.username}
        </HiveLink>,
      );
    } else if (seg.kind === 'hashtag') {
      out.push(
        <HiveLink
          key={i}
          href={getTagUrl?.(seg.tag)}
          onActivate={() => onTagClick?.(seg.tag)}
          className="text-[var(--hrk-brand)] hover:underline"
        >
          #{seg.tag}
        </HiveLink>,
      );
    } else {
      out.push(
        <a
          key={i}
          href={seg.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="break-all text-[var(--hrk-brand)] underline hover:text-[var(--hrk-brand-active)]"
        >
          {seg.url}
        </a>,
      );
    }
  });
  // `line-clamp-6` caps long blog bodies at 6 lines (with a "…" tail) so a
  // single card never grows tall enough to dominate the column. Tapping
  // the card still navigates to the full post via `onPostClick`.
  return (
    <p className="line-clamp-6 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--hrk-text-secondary)]">
      {out}
    </p>
  );
};

// ── 3Speak player ────────────────────────────────────────────────────────
// Uses the kit's native <ThreeSpeakNativePlayer/> (which fetches the
// m3u8 manifest from `play.3speak.tv/api/embed?v=author/permlink` and
// plays via hls.js + a real <video> element). The wrapper centres the
// player and keeps it inside a `.hive-post-body`-style container so
// the player's CSS (16:9 frame, layered thumbnail, portrait letterbox)
// applies the same way it does in HiveDetailPost.

function parse3SpeakAuthorPermlink(url: string): { author: string; permlink: string } | null {
  try {
    const u = new URL(url);
    const v = u.searchParams.get('v');
    if (!v) return null;
    const [author, permlink] = v.split('/');
    if (!author || !permlink) return null;
    return { author, permlink };
  } catch {
    return null;
  }
}

const ThreeSpeakPlayer: FC<{ author: string; permlink: string }> = ({ author, permlink }) => {
  return (
    <div className="three-speak-embed my-3 hive-post-body" style={{ margin: '0.75rem auto' }}>
      <ThreeSpeakNativePlayer author={author} permlink={permlink} />
    </div>
  );
};

// ── Media popup (matches hSnaps MediaPopup) ──────────────────────────────

const attachmentLabel = (a: Attachment): string => {
  if (a.kind === 'image') return a.url.toLowerCase().includes('.gif') ? 'GIF' : 'Image';
  if (a.kind === 'youtube') return 'YouTube';
  if (a.kind === 'threespeak') return '3Speak';
  if (a.kind === 'twitter') return 'Tweet';
  if (a.kind === '3speak-audio') return '3Speak audio';
  return 'Audio';
};

// ── Twitter embed ────────────────────────────────────────────────────────
// Mirrors the hSnaps `TwitterEmbed` — listens for resize postMessages from
// platform.twitter.com so the iframe height matches the rendered tweet
// (text-only tweets are short; tweets with media expand).

const TwitterEmbed: FC<{ id: string }> = ({ id }) => {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (!d || typeof d !== 'object') return;
        let h: number | undefined;
        if (d.method === 'resize' && Array.isArray(d.params)) {
          for (const p of d.params) {
            if (typeof p === 'number' && p > 0) h = p;
            if (p && typeof p === 'object' && typeof p.height === 'number') h = p.height;
          }
        }
        if (d['twttr.private.resize']?.height) h = d['twttr.private.resize'].height;
        if (!h && typeof d.height === 'number') h = d.height;
        if (!h && d.msg_type === 'resize' && d.msg_data?.height) h = d.msg_data.height;
        if (h && h > 50) setHeight(Math.ceil(h));
      } catch { /* ignore */ }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div
      className="twitter-embed-wrapper w-full overflow-hidden rounded-lg bg-black/60"
      style={height ? { maxHeight: '80vh', overflowY: 'auto' } : undefined}
    >
      <iframe
        src={`https://platform.twitter.com/embed/Tweet.html?id=${id}&theme=dark&dnt=true&origin=${encodeURIComponent(origin)}`}
        title={`Tweet ${id}`}
        className="twitter-embed-iframe w-full border-0 bg-black"
        scrolling="yes"
        style={{ height: height ?? '60vh' }}
      />
    </div>
  );
};

// ── Zoomable image — used by the image branch of MediaPopup. Mouse
// wheel, pinch, double-click, and +/- buttons zoom from 1× up to the
// image's natural pixel size (100%). Drag pans when zoomed in.

const ZOOM_MIN = 1;
const ZOOM_STEP = 0.25;
const ZOOM_WHEEL_STEP = 0.15;

const ZoomableImage: FC<{ src: string }> = ({ src }) => {
  const [zoom, setZoom] = useState(1);
  const [zoomMax, setZoomMax] = useState(3);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const panDragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const pinchRef = useRef<{ startDistance: number; startZoom: number } | null>(null);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Reset when src swaps (next/prev navigation in the popup).
  useEffect(() => { resetZoom(); }, [src, resetZoom]);

  const recomputeZoomMax = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const rw = img.clientWidth || 1;
    const rh = img.clientHeight || 1;
    const ratio = Math.max(img.naturalWidth / rw, img.naturalHeight / rh);
    setZoomMax(Math.max(1, Math.min(6, ratio || 1)));
  }, []);

  const zoomedIn = zoom > 1;
  const zoomPercent = Math.round(zoom * 100);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const cx = e.clientX - (rect.left + rect.width / 2);
    const cy = e.clientY - (rect.top + rect.height / 2);
    setZoom((prev) => {
      const dir = e.deltaY < 0 ? 1 : -1;
      const next = Math.max(ZOOM_MIN, Math.min(zoomMax, prev + dir * ZOOM_WHEEL_STEP));
      if (next === prev) return prev;
      setPan((p) => {
        if (next === 1) return { x: 0, y: 0 };
        const k = next / prev;
        return { x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k };
      });
      return next;
    });
  }, [zoomMax]);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoom === 1) setZoom(zoomMax);
    else resetZoom();
  }, [zoom, zoomMax, resetZoom]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinchRef.current = {
        startDistance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        startZoom: zoom,
      };
      return;
    }
    if (zoomedIn) {
      const t = e.touches[0];
      if (t) panDragRef.current = {
        startClientX: t.clientX,
        startClientY: t.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
    }
  }, [zoom, zoomedIn, pan.x, pan.y]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = d / pinchRef.current.startDistance;
      setZoom(Math.max(ZOOM_MIN, Math.min(zoomMax, pinchRef.current.startZoom * ratio)));
      return;
    }
    if (zoomedIn && panDragRef.current && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - panDragRef.current.startClientX;
      const dy = t.clientY - panDragRef.current.startClientY;
      setPan({ x: panDragRef.current.startPanX + dx, y: panDragRef.current.startPanY + dy });
    }
  }, [zoomMax, zoomedIn]);

  const onTouchEnd = useCallback(() => {
    pinchRef.current = null;
    panDragRef.current = null;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!zoomedIn) return;
    panDragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
  }, [zoomedIn, pan.x, pan.y]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!panDragRef.current || e.buttons !== 1) return;
    const dx = e.clientX - panDragRef.current.startClientX;
    const dy = e.clientY - panDragRef.current.startClientY;
    setPan({ x: panDragRef.current.startPanX + dx, y: panDragRef.current.startPanY + dy });
  }, []);

  const onPointerUp = useCallback(() => { panDragRef.current = null; }, []);

  const stopE = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="relative w-full" onClick={stopE}>
      {/* Zoom toolbar — always visible above the image. */}
      <div className="mb-2 flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
            setPan((p) => ({ x: p.x * 0.85, y: p.y * 0.85 }));
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
          aria-label="Zoom out"
          disabled={zoom <= ZOOM_MIN}
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="min-w-[3.25rem] text-center text-xs font-medium tabular-nums text-white">
          {zoomPercent}%
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setZoom((z) => Math.min(zoomMax, z + ZOOM_STEP));
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
          aria-label="Zoom in"
          disabled={zoom >= zoomMax}
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); resetZoom(); }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
          aria-label="Reset zoom"
          disabled={zoom === ZOOM_MIN}
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Image viewport — clips the panned/zoomed image. */}
      <div
        ref={wrapRef}
        className="relative flex items-center justify-center overflow-hidden rounded-lg"
        style={{ minHeight: 240, touchAction: zoomedIn ? 'none' : 'pan-y' }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          className="max-h-[80vh] max-w-full select-none object-contain"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: panDragRef.current || pinchRef.current ? 'none' : 'transform 120ms ease-out',
            cursor: zoomedIn ? (panDragRef.current ? 'grabbing' : 'grab') : 'zoom-in',
          }}
          onDoubleClick={onDoubleClick}
          onLoad={() => requestAnimationFrame(recomputeZoomMax)}
        />
      </div>
    </div>
  );
};

/** IPFS strip-tile preview. Probes content-type once via HEAD; renders an
 *  image thumbnail or a video poster with a play badge based on the result. */
const IpfsStripTile: FC<{ url: string; onOpen: (e: React.MouseEvent) => void }> = ({
  url,
  onOpen,
}) => {
  const kind = useIpfsKind(url);
  if (kind === null) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--hrk-bg-surface-sunken)]">
        <div className="h-6 w-6 animate-pulse rounded-full bg-[var(--hrk-bg-hover)]" />
      </div>
    );
  }
  if (kind === 'video') {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black"
        aria-label="Play video"
      >
        <video
          src={url}
          preload="metadata"
          muted
          playsInline
          className="h-full w-full object-cover opacity-80"
        />
        <span className="pointer-events-none absolute flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-white">
          <Play className="h-6 w-6" />
        </span>
      </button>
    );
  }
  // image or unknown — render as image; unknown falls back to broken-image
  // which the surrounding errored-set already handles for the regular
  // image branch, but here we keep it simple and just render an <img>.
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-[var(--hrk-bg-surface-sunken)]"
      aria-label="Open image preview"
    >
      <img src={url} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
    </button>
  );
};

/** IPFS popup body. Same probe; renders the zoomable image for images and a
 *  full-controls <video autoPlay> for videos. */
const IpfsPopupBody: FC<{ url: string }> = ({ url }) => {
  const kind = useIpfsKind(url);
  if (kind === 'video') {
    return (
      <video
        src={url}
        controls
        autoPlay
        playsInline
        className="max-h-[80vh] max-w-full"
      />
    );
  }
  if (kind === 'image' || kind === null) {
    return <ZoomableImage src={url} />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-[var(--hrk-brand)] underline"
    >
      Open in new tab
    </a>
  );
};

const MediaPopup: FC<{
  attachment: Attachment;
  onClose: () => void;
  index?: number;
  total?: number;
  onPrev?: () => void;
  onNext?: () => void;
}> = ({
  attachment,
  onClose,
  index,
  total,
  onPrev,
  onNext,
}) => {
  const hasNav = typeof total === 'number' && total > 1 && !!onPrev && !!onNext;

  // Lock body scroll + listen for Escape and arrow keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, onPrev, onNext]);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const closeAndStop = (e: React.SyntheticEvent) => { e.stopPropagation(); onClose(); };
  const isCompact = attachment.kind === 'audio' || attachment.kind === '3speak-audio';

  return (
    <div
      className="fixed inset-0 z-[2000] flex flex-col bg-black/85 sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={closeAndStop}
    >
      {/* Mobile title strip */}
      <div
        className="flex shrink-0 items-center justify-between gap-2 bg-black/40 px-4 py-3 pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:hidden"
        onClick={stop}
      >
        <span className="truncate text-sm font-medium text-white/80">
          {attachmentLabel(attachment)}
        </span>
        {hasNav && (
          <span className="shrink-0 text-xs text-white/60 tabular-nums">
            {(index ?? 0) + 1} / {total}
          </span>
        )}
      </div>

      {/* Floating close (mobile) */}
      <button
        type="button"
        onClick={closeAndStop}
        className="fixed right-3 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-[2010] flex h-11 w-11 items-center justify-center rounded-full bg-black/80 text-white shadow-lg ring-1 ring-white/30 transition hover:bg-black sm:hidden"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Content card — fullscreen on mobile, fitted on sm+ */}
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--hrk-bg-surface-sunken)] shadow-2xl sm:flex-initial sm:overflow-visible sm:rounded-2xl sm:border sm:border-[var(--hrk-border-default)] ${
          isCompact ? 'sm:max-w-md' : 'sm:max-w-3xl'
        } sm:w-full`}
        onClick={stop}
      >
        {/* Desktop close header */}
        <div className="hidden shrink-0 items-center justify-between border-b border-[var(--hrk-border-default)]/60 px-4 py-2.5 sm:flex">
          <span className="flex items-center gap-2 text-sm font-medium text-white/70">
            <span>{attachmentLabel(attachment)}</span>
            {hasNav && (
              <span className="text-xs text-white/50 tabular-nums">
                {(index ?? 0) + 1} / {total}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={closeAndStop}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center p-3 sm:p-4">
          {/* Side-arrow navigation — appears whenever the parent passed
              a multi-item nav. Lets the user step between media items
              without closing the popup. */}
          {hasNav && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
                className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-lg transition hover:bg-black/80"
                aria-label="Previous media"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-lg transition hover:bg-black/80"
                aria-label="Next media"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
          {attachment.kind === 'image' && (
            <ZoomableImage src={attachment.url} />
          )}

          {attachment.kind === 'ipfs' && (
            <IpfsPopupBody url={attachment.url} />
          )}

          {attachment.kind === 'youtube' && (
            <div className="w-full">
              <div className="w-full overflow-hidden rounded-lg" style={{ aspectRatio: '16/9' }}>
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${attachment.id}?autoplay=1&rel=0&playsinline=1`}
                  title="YouTube"
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <a
                href={`https://www.youtube.com/watch?v=${attachment.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/20"
              >
                <Play className="h-4 w-4 fill-current" />
                Watch on YouTube
              </a>
            </div>
          )}

          {attachment.kind === 'twitter' && (
            <div className="w-full">
              <TwitterEmbed id={attachment.id} />
            </div>
          )}

          {attachment.kind === 'threespeak' && (() => {
            const ap = parse3SpeakAuthorPermlink(attachment.url);
            return ap ? (
              <div className="w-full">
                <ThreeSpeakPlayer author={ap.author} permlink={ap.permlink} />
              </div>
            ) : (
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--hrk-brand)] underline"
              >
                Open on 3Speak
              </a>
            );
          })()}

          {attachment.kind === 'audio' && (
            <div className="w-full overflow-hidden rounded-xl border border-[var(--hrk-border-default)] bg-[#1a1d21] p-3">
              <div className="mb-2 flex items-center gap-2 text-sm text-[var(--hrk-text-tertiary)]">
                <Music className="h-4 w-4 shrink-0 text-[var(--hrk-brand)]" />
                <span className="truncate">
                  {decodeURIComponent(attachment.url.split('/').pop()?.split('?')[0] ?? 'Audio')}
                </span>
              </div>
              <audio src={attachment.url} controls preload="metadata" autoPlay className="h-10 w-full" />
            </div>
          )}

          {attachment.kind === '3speak-audio' && (
            // Hosted 3Speak audio — renders inline via the official
            // player iframe. Same iframe shape hSnaps uses.
            <div className="w-full overflow-hidden rounded-xl border border-[var(--hrk-border-default)] bg-[#1a1d21]">
              <iframe
                src={attachment.url}
                title="3Speak audio"
                className="h-24 w-full border-0"
                allow="autoplay"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Attachment strip ─────────────────────────────────────────────────────

interface AttachmentStripProps {
  attachments: Attachment[];
}

const AttachmentStrip: FC<AttachmentStripProps> = ({ attachments }) => {
  const [idx, setIdx] = useState(0);
  const [activeAttachment, setActiveAttachment] = useState<Attachment | null>(null);
  // Index of `activeAttachment` inside `attachments`. Used by the
  // popup's side-arrow buttons so the user can step through every
  // media item on the post without closing the viewer.
  const [popupIdx, setPopupIdx] = useState<number>(0);
  const [errored, setErrored] = useState<Set<number>>(new Set());
  // Transient loading flag for the strip — flipped on when the user
  // taps the prev/next arrow so a spinner covers the gap while the
  // next tile's media (image / iframe) fetches and paints. Cleared by
  // the image's onLoad/onError, and by a fallback timeout for embed
  // tiles that don't expose a reliable load event.
  const [tileLoading, setTileLoading] = useState(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending fallback timer on unmount so we don't call
  // setState after the strip is gone.
  useEffect(() => () => {
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
  }, []);

  if (attachments.length === 0) return null;
  const safeIdx = Math.min(idx, attachments.length - 1);
  const current = attachments[safeIdx];

  // Show the spinner immediately, then arm a fallback timer so it
  // always clears even for tiles without a load event (YouTube /
  // 3Speak / Twitter iframes, audio players).
  const startTileLoading = () => {
    setTileLoading(true);
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    loadingTimerRef.current = setTimeout(() => setTileLoading(false), 1200);
  };
  const stopTileLoading = () => {
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
    setTileLoading(false);
  };
  const next = () => { startTileLoading(); setIdx((i) => (i + 1) % attachments.length); };
  const prev = () => { startTileLoading(); setIdx((i) => (i - 1 + attachments.length) % attachments.length); };
  const open = (e: React.MouseEvent, a: Attachment) => {
    e.stopPropagation();
    const i = attachments.indexOf(a);
    setPopupIdx(i >= 0 ? i : 0);
    setActiveAttachment(a);
  };
  // The popup only opens for images / gifs (and IPFS URLs that
  // resolve to images — those still hit the popup via IpfsStripTile).
  // Restrict next/prev to the image-only subset so the user doesn't
  // step into a video/audio embed they can't see in the popup. Keep
  // the filtered list typed as Attachment[] so it can be compared
  // against the full activeAttachment.
  const imageAttachments: Attachment[] = attachments.filter(
    (a): a is Attachment => a.kind === 'image' || a.kind === 'ipfs',
  );
  const popupPrev = () => {
    if (imageAttachments.length === 0) return;
    setPopupIdx((i) => {
      const currentSubIdx = Math.max(0, imageAttachments.indexOf(attachments[i]));
      const ni = (currentSubIdx - 1 + imageAttachments.length) % imageAttachments.length;
      const target = imageAttachments[ni];
      setActiveAttachment(target);
      return attachments.indexOf(target);
    });
  };
  const popupNext = () => {
    if (imageAttachments.length === 0) return;
    setPopupIdx((i) => {
      const currentSubIdx = Math.max(0, imageAttachments.indexOf(attachments[i]));
      const ni = (currentSubIdx + 1) % imageAttachments.length;
      const target = imageAttachments[ni];
      setActiveAttachment(target);
      return attachments.indexOf(target);
    });
  };

  const renderTile = () => {
    if (current.kind === 'ipfs') {
      // IPFS strip tile: HEAD-probe decides image vs video. Image gets
      // the same lightbox open behaviour as regular images; video shows
      // a poster + play badge that opens the controls in the popup.
      return <IpfsStripTile url={current.url} onOpen={(e) => open(e, current)} />;
    }
    if (current.kind === 'image') {
      const isErr = errored.has(safeIdx);
      if (isErr) {
        return (
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full items-center justify-center bg-[var(--hrk-bg-app)] text-[var(--hrk-text-tertiary)]"
          >
            <ImageOff className="h-6 w-6" />
          </button>
        );
      }
      return (
        <button
          type="button"
          onClick={(e) => open(e, current)}
          className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-[var(--hrk-bg-surface-sunken)]"
          aria-label="Open image preview"
        >
          {/* Scale-to-fit image (matches hSnaps' ImageThumbnail). The
              parent flex container centers; `max-h/w-full object-contain`
              keeps the full image visible inside the fixed-height strip
              with a dark letterbox instead of cropping (object-cover). */}
          <img
            // `key` forces a fresh <img> per index so onLoad fires on
            // every navigation (React would otherwise reuse the node
            // and skip the event for a same-element src swap).
            key={safeIdx}
            ref={(node) => {
              // Cached images may already be complete before React
              // attaches onLoad — clear the spinner right away so it
              // doesn't hang for the fallback timeout.
              if (node && node.complete) stopTileLoading();
            }}
            src={current.url}
            alt=""
            loading="lazy"
            className="max-h-full max-w-full object-contain"
            onLoad={stopTileLoading}
            onError={() => {
              stopTileLoading();
              setErrored((prev) => new Set(prev).add(safeIdx));
            }}
          />
        </button>
      );
    }
    if (current.kind === 'youtube') {
      // Inline YouTube iframe scaled to the strip's 280px height. `flex
      // items-center` centres the 16:9 frame vertically so portrait/
      // landscape variants both letterbox cleanly. `e.stopPropagation`
      // so clicking the player doesn't fire the card's body-click
      // navigation.
      return (
        <div
          className="flex h-full w-full items-center justify-center bg-black"
          onClick={(e) => e.stopPropagation()}
        >
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${current.id}?rel=0&playsinline=1`}
            title="YouTube"
            className="border-0"
            style={{ aspectRatio: '16/9', height: '100%', maxHeight: '100%', maxWidth: '100%' }}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    if (current.kind === 'threespeak') {
      // Inline 3Speak via the kit's native player — it knows the
      // video's real width/height (from `loadedmetadata`) and sets
      // an inline `aspect-ratio` accordingly. We wrap it in a
      // `three-speak-snap-strip` host class so the strip's CSS can
      // override the player's default `width: 100%` (which would
      // make a portrait video taller than the 280 px strip and
      // overflow). The override keeps `height: 100%` and lets the
      // browser derive `width` from aspect-ratio → portrait videos
      // letterbox with black bars on the sides, landscape fill the
      // width and letterbox top/bottom when narrower than 16:9.
      const ap = parse3SpeakAuthorPermlink(current.url);
      return (
        <div
          className="three-speak-snap-strip flex h-full w-full items-center justify-center overflow-hidden bg-black"
          onClick={(e) => e.stopPropagation()}
        >
          {ap ? (
            <ThreeSpeakNativePlayer author={ap.author} permlink={ap.permlink} hideThumbnail />
          ) : (
            <a
              href={current.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--hrk-brand)] underline"
              onClick={(e) => e.stopPropagation()}
            >
              Open on 3Speak
            </a>
          )}
        </div>
      );
    }
    if (current.kind === 'twitter') {
      // Inline tweet — TwitterEmbed renders the official x.com widget
      // and auto-resizes via postMessage. Scrollable so long threads
      // don't blow the strip out.
      return (
        <div
          className="h-full w-full overflow-y-auto bg-[var(--hrk-bg-surface-sunken)]"
          onClick={(e) => e.stopPropagation()}
        >
          <TwitterEmbed id={current.id} />
        </div>
      );
    }
    if (current.kind === '3speak-audio') {
      // Inline 3Speak audio — same iframe shape the popup uses, but
      // sized to fit the strip. Centred on a violet gradient backdrop
      // so the compact player bar reads against the 280px tile.
      return (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-violet-900/40 to-violet-950/60 px-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 text-xs text-white/70">
            <Music className="h-4 w-4 shrink-0 text-[var(--hrk-brand)]" />
            <span className="font-medium">3Speak audio</span>
          </div>
          <iframe
            src={current.url}
            title="3Speak audio"
            className="h-24 w-full max-w-md border-0"
            allow="autoplay"
          />
        </div>
      );
    }
    // audio
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-emerald-900/40 to-emerald-950/60 px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-xs text-white/70">
          <Music className="h-4 w-4 shrink-0 text-[var(--hrk-brand)]" />
          <span className="max-w-[260px] truncate font-medium">
            {decodeURIComponent(current.url.split('/').pop()?.split('?')[0] ?? 'Audio')}
          </span>
        </div>
        <audio src={current.url} controls preload="metadata" className="h-10 w-full max-w-md" />
      </div>
    );
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-lg border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-app)]">
        {/* Fixed strip height matching hSnaps' STRIP_HEIGHT=280px so
            scale-to-fit images get a stable container instead of an
            aspect-ratio box that varied with card width. */}
        <div className="h-[280px] w-full">{renderTile()}</div>
        {/* Navigation loading overlay — covers the strip while the next
            tile's media loads after a prev/next tap. z-20 sits above
            the tile but below nothing else in the strip; pointer-events
            stay off so a quick second tap still reaches the arrows. */}
        {tileLoading && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/40">
            <Loader2 className="h-7 w-7 animate-spin text-white" />
          </div>
        )}
        {attachments.length > 1 && (
          <>
            {/* z-30 keeps the nav controls above both the inline
                YouTube / 3Speak / Twitter iframes (own stacking
                context) AND the z-20 navigation loading overlay, so
                the arrows stay crisp and tappable while a tile loads. */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 right-2 z-30 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
              {safeIdx + 1} / {attachments.length}
            </div>
          </>
        )}
      </div>

      {activeAttachment && (
        <MediaPopup
          attachment={activeAttachment}
          // Index + total reflect the image-only subset since prev/next
          // skip videos/audio/twitter in the popup (those play inline
          // in the strip now).
          index={Math.max(0, imageAttachments.indexOf(activeAttachment))}
          total={imageAttachments.length}
          onPrev={popupPrev}
          onNext={popupNext}
          onClose={() => setActiveAttachment(null)}
        />
      )}
    </>
  );
};

// ── Card ─────────────────────────────────────────────────────────────────

const SnapsFeedCard: FC<SnapsFeedCardProps> = ({
  post,
  currentUser,
  onUpvote,
  onSubmitComment,
  onClickCommentUpvote,
  onReblog,
  onReSnap,
  onTip,
  onSharePost,
  onCommentClick,
  onClickCommentIcon,
  onClickCommentCount,
  onReportPost,
  onToggleBookmark,
  isPostBookmarked,
  onDeletePost,
  onEditSnap,
  onVotePoll,
  onUserClick,
  onPostClick,
  onTagClick,
  getPostUrl,
  getUserUrl,
  getTagUrl,
  getCommunityUrl,
  ecencyToken,
  threeSpeakApiKey,
  giphyApiKey,
  templateToken,
  templateApiBaseUrl,
  defaultVotePercent,
  voteWeightStep,
  allowLandscapeVideos,
  awaitingWalletApproval,
  defaultReward,
  renderHeaderActions,
  actionsAsMenu,
}) => {
  const reSnapTarget = useMemo(
    () => detectHivePostReference(stripViaAppsCredit(post.body ?? '')),
    [post.body],
  );
  const reSnapTargetKey = reSnapTarget ? `${reSnapTarget.author}/${reSnapTarget.permlink}` : null;
  const [visibleReSnapKey, setVisibleReSnapKey] = useState<string | null>(null);
  const shouldStripReSnapUrl = !!reSnapTargetKey && visibleReSnapKey === reSnapTargetKey;
  const bodyForContent = useMemo(
    () => shouldStripReSnapUrl ? stripHivePostReference(post.body ?? '', reSnapTarget) : (post.body ?? ''),
    [post.body, reSnapTarget, shouldStripReSnapUrl],
  );
  const parsed = useMemo(
    () => parseBody({ ...post, body: bodyForContent }),
    [post, bodyForContent],
  );
  const handleReSnapPreviewVisibility = useCallback((visible: boolean) => {
    setVisibleReSnapKey((current) => {
      if (visible) return reSnapTargetKey;
      return current === reSnapTargetKey ? null : current;
    });
  }, [reSnapTargetKey]);
  const isHivesuitePost = useMemo(
    () => hasHivesuiteFamilyTag(post),
    [post.json_metadata],
  );
  const parentMetaTags = useMemo(
    () => extractTagsFromMeta(post),
    [post.json_metadata],
  );
  // Reset attachment carousel position when the post changes.
  useEffect(() => {}, [post.author, post.permlink]);

  // Detect if `currentUser` already has a reply on this post. The bridge
  // returns `post.replies` as an array of `${author}/${permlink}` strings;
  // matching the prefix `${currentUser}/` is enough to identify the
  // user's own reply (matches the hSnaps PostCard logic). The matched
  // key is forwarded so PostActionButton can lazy-load the body for its
  // hover preview tooltip.
  // ── Markdown rendering ───────────────────────────────────────────────
  // The original feed-body parser stripped everything down to plain text,
  // which meant bold/italic/headings/lists/tables/blockquotes never
  // rendered. Match the hSnaps FeedItemBody approach instead: render the
  // post body through @snapie/renderer (the same engine the detail page
  // uses), with compact `.snaps-feed-body` styles tightening it for a
  // narrow card. The AttachmentStrip continues to surface media
  // separately, so we strip media URLs from the body before rendering
  // to avoid duplicate previews.
  const renderHive = useMemo(() => {
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

  const renderedBodyHtml = useMemo(() => {
    const raw = bodyForContent;
    if (!raw || !renderHive) return '';
    let body = raw;

    // Strip trailing "via Apps from <url>" attribution (sub/markdown/plain
    // forms — see `stripViaAppsCredit`). LikeTu / hivesuite Snaps cards
    // should never show the trailer.
    body = stripViaAppsCredit(body);

    // Hive post bodies routinely use `<br>` instead of real newlines,
    // which kills GFM block parsing — tables, lists, blockquotes all
    // fall into a single paragraph. Convert every `<br>` variant back
    // to a real newline before the markdown engine sees the body.
    body = body.replace(/\r\n/g, '\n');
    body = body.replace(/<br\s*\/?>\s*\n?/gi, '\n');

    // Drop trailing tag-list lines (e.g. "#hsnaps, #hivesuite") that
    // some apps tack on — they're already represented by the hSnaps
    // pill / community chip in the header.
    body = body.replace(/(?:^|\n)\s*(?:#[\p{L}\p{N}_-]+(?:\s*,?\s*)){1,}$/u, '');

    // GFM requires a blank line between a paragraph and a table. After
    // collapsing `<br>` we often get "intro text\n| col | col |…" with
    // only a single newline — which the parser treats as part of the
    // preceding paragraph. Insert a blank line before any table row
    // that follows non-empty, non-pipe text.
    body = body.replace(/([^\n|])\n(\|)/g, '$1\n\n$2');

    // Strip media that the AttachmentStrip already surfaces, so we
    // don't show the same image / 3Speak / YouTube twice on one card.
    body = body.replace(IMG_MD_REGEX, '');
    body = body.replace(IMG_HTML_REGEX, '');
    // Drop any <iframe>/<video> wrapping an IPFS URL — otherwise after
    // we strip the URL alone the renderer sees an iframe shell with
    // empty src and emits "(Unsupported )".
    body = body.replace(
      /<(iframe|video)\b[^>]*\bsrc=["'][^"']*\/ipfs\/[^"']*["'][^>]*>(?:\s*<\/\1>)?/gi,
      '',
    );
    // Bare image URLs would otherwise be auto-promoted into <img> tags by
    // the markdown renderer, producing a vertical stack of the same images
    // already shown in the carousel. Pull them out before rendering.
    body = body.replace(IMG_URL_REGEX, '');
    body = body.replace(IPFS_URL_REGEX, '');
    body = body.replace(YOUTUBE_REGEX, '');
    body = body.replace(THREE_SPEAK_REGEX, '');
    body = body.replace(THREE_SPEAK_AUDIO_REGEX, '');
    body = body.replace(AUDIO_FILE_REGEX, '');
    body = body.replace(TWITTER_REGEX, '');

    // Tighten — collapse runs of 3+ blank lines to exactly one, trim
    // edges. (Without this the rendered HTML can pick up huge blank
    // gaps from the body when many tags or attribution lines were
    // stripped above.)
    body = body.replace(/\n{3,}/g, '\n\n').trim();

    if (!body) return '';
    try {
      let html = renderHive(body);
      // Match the kit's HiveDetailPost: rewrite the embed iframe to
      // `play.3speak.tv` (the legacy `3speak.tv/embed` shape doesn't
      // accept iframe mode in some browsers).
      html = html.replace(
        /https:\/\/3speak\.tv\/embed\?v=([^"&\s]+)/gi,
        (_m: string, v: string) =>
          `https://play.3speak.tv/embed?v=${v}&mode=iframe&noscroll=1`,
      );
      // Belt-and-suspenders: even after pre-stripping images from the
      // markdown source, the renderer can re-emit <img> tags from cases we
      // didn't anticipate (proxy redirects, encoded inner URLs, etc.).
      // Drop them from the final HTML so the AttachmentStrip carousel
      // remains the single source of truth for media.
      html = html.replace(/<img\b[^>]*>/gi, '');
      // Drop empty anchors that wrapped an <img> we just removed (they'd
      // render as bare clickable whitespace otherwise).
      html = html.replace(/<a\b[^>]*>\s*<\/a>/gi, '');
      // Drop any "(Unsupported …)" leftover the renderer emits for URLs
      // we couldn't pre-strip — same idea: the AttachmentStrip / IpfsMedia
      // is the single source of truth for media, so the body should never
      // surface the renderer's failure message.
      html = html.replace(/<div>\(Unsupported[^<]*\)<\/div>/gi, '');
      return html;
    } catch {
      return '';
    }
  }, [bodyForContent, renderHive]);

  const myReplyKey = useMemo(() => {
    if (!currentUser || !Array.isArray(post.replies) || post.replies.length === 0) return undefined;
    const prefix = `${currentUser.toLowerCase()}/`;
    const found = (post.replies as unknown[]).find(
      (key): key is string => typeof key === 'string' && key.toLowerCase().startsWith(prefix),
    );
    return found ?? undefined;
  }, [currentUser, post.replies]);
  const hasCommented = !!myReplyKey;

  const rawPayout = post.payout
    ? post.payout.toFixed(3)
    : post.pending_payout_value
      ? post.pending_payout_value.replace(/[^\d.]/g, '')
      : '0.000';

  // Structured payout/beneficiary breakdown for the rewards modal
  // surfaced from the action bar's payout chip.
  const payoutDetails = (() => {
    const parseDollar = (v?: string) =>
      parseFloat((v ?? '').replace(/[^\d.]/g, '')) || 0;
    const pendingValue = parseDollar(post.pending_payout_value as unknown as string);
    const authorValue = parseDollar(post.author_payout_value as unknown as string);
    const curatorValue = parseDollar(post.curator_payout_value as unknown as string);
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
  })();

  const handleBodyClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('a, button, input, textarea, select, video, iframe, img, [role="button"], [role="dialog"]')) return;
    // Let modified / non-primary clicks through untouched so the
    // browser can act on any underlying link (e.g. the body anchors).
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    onPostClick?.(post.author, post.permlink, post.title);
  };

  return (
    <article className="overflow-hidden rounded-xl border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-4 pb-2">
        <HiveLink
          href={getUserUrl?.(post.author)}
          onActivate={() => onUserClick?.(post.author)}
          className="shrink-0"
          aria-label={`@${post.author} profile`}
        >
          <img
            src={`https://images.hive.blog/u/${post.author}/avatar`}
            alt={post.author}
            className="h-9 w-9 rounded-full bg-[var(--hrk-bg-hover)] object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${post.author}&background=random&size=36`;
            }}
          />
        </HiveLink>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
          <HiveLink
            href={getUserUrl?.(post.author)}
            onActivate={() => onUserClick?.(post.author)}
            className="truncate text-sm font-semibold text-[var(--hrk-text-primary)] hover:text-[var(--hrk-brand)]"
          >
            @{post.author}
          </HiveLink>
          <span className="shrink-0 text-xs text-[var(--hrk-text-tertiary)]">·</span>
          {/* Timestamp doubles as the post permalink (X/Twitter
              pattern) so the snap — which has no title — still has a
              right-clickable "open in new tab" target. */}
          <HiveLink
            href={getPostUrl?.(post.author, post.permlink)}
            onActivate={() => onPostClick?.(post.author, post.permlink, post.title)}
            className="shrink-0 text-xs text-[var(--hrk-text-tertiary)] hover:text-[var(--hrk-brand)] hover:underline"
          >
            {formatTimeAgo(post.created)}
          </HiveLink>
          {/* Unified "hivesuite" pill — fires for any post whose
              json_metadata.tags include `hsnaps`, `hreplier`, or
              `hivesuite` (the historic + canonical family tags).
              Per-app chips were collapsed into one marker so the
              strip stays uncluttered, and so posts created from
              older sibling apps still get attributed correctly. */}
          {isHivesuitePost && (
            <span className="shrink-0 rounded-full bg-[var(--hrk-brand)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--hrk-brand)]">
              hivesuite
            </span>
          )}
          {post.community_title && (
            <>
              <span className="shrink-0 text-xs text-[var(--hrk-text-tertiary)]">·</span>
              <HiveLink
                href={post.community ? getCommunityUrl?.(post.community) : undefined}
                onActivate={() => {
                  if (post.community) onTagClick?.(post.community);
                }}
                className="shrink-0 truncate text-xs font-medium text-[var(--hrk-brand)] hover:underline"
              >
                #{post.community_title}
              </HiveLink>
            </>
          )}
        </div>
        {renderHeaderActions && (
          <div
            className="shrink-0"
            // Stop the card-body click handler from firing when the
            // user opens the menu / clicks Edit / Flag.
            onClick={(e) => e.stopPropagation()}
          >
            {renderHeaderActions(post)}
          </div>
        )}
      </header>

      {/* Body — media first (AttachmentStrip), then markdown HTML
          (compact `.snaps-feed-body` styles). Order mirrors hSnaps
          (`hive-snaps-reactjs/components/FeedItemBody`): swipeable
          carousel up top, prose below. We render markdown so bold /
          italic / headings / lists / blockquotes / code / TABLES all
          show up properly inside the card. */}
      <div
        className="cursor-pointer space-y-2 overflow-hidden px-4 pb-2 pt-1"
        onClick={handleBodyClick}
      >
        <AttachmentStrip attachments={parsed.attachments} />
        {renderedBodyHtml ? (
          // No `line-clamp-6` here: webkit-line-clamp is an
          // inline-text clamp and breaks block-level rendering for
          // tables / lists / blockquotes / code blocks. Letting the
          // body render at its natural height keeps tables intact;
          // the card stays clickable for anything inside that isn't
          // an anchor / button / media element. Wrapped in
          // SelectionTranslator so users can highlight any passage
          // and get a one-tap Google translation.
          <SelectionTranslator>
          <div
            className="snaps-feed-body"
            // The renderer already sanitises and rewrites Hive URLs;
            // dangerouslySetInnerHTML here is the standard pattern
            // used elsewhere in the kit (HiveDetailPost / inline
            // comments).
            dangerouslySetInnerHTML={{ __html: renderedBodyHtml }}
            onClick={(e) => {
              const t = e.target as HTMLElement;
              const anchor = t.closest('a') as HTMLAnchorElement | null;
              if (anchor) {
                // Don't bubble to the card-level click (which would
                // navigate to the post detail).
                e.stopPropagation();
                if (
                  e.defaultPrevented ||
                  e.button !== 0 ||
                  e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
                ) return;
                const href = anchor.getAttribute('href');
                if (!href) return;
                // Hive-ecosystem URLs (peakd, hive.blog, ecency, inleo)
                // route in-app via the kit's user/post callbacks — same
                // tab. Other external URLs open in a new tab so the
                // feed surface is not lost.
                const hiveTarget = parseHiveFrontendUrl(href);
                if (hiveTarget) {
                  if (hiveTarget.kind === 'post' && onPostClick) {
                    e.preventDefault();
                    onPostClick(hiveTarget.author, hiveTarget.permlink);
                  } else if (hiveTarget.kind === 'user' && onUserClick) {
                    e.preventDefault();
                    onUserClick(hiveTarget.author);
                  }
                  return;
                }
                if (/^https?:\/\//i.test(href)) {
                  e.preventDefault();
                  window.open(href, '_blank', 'noopener,noreferrer');
                }
                return;
              }
              if (t.closest('button, img, video, iframe')) e.stopPropagation();
            }}
          />
          </SelectionTranslator>
        ) : parsed.segments.length > 0 ? (
          // Fallback when the renderer is unavailable or returns empty
          // (e.g. body was entirely media): keep the old plain-text
          // segments so the card never renders blank.
          <InlineBody
            segments={parsed.segments}
            onUserClick={onUserClick}
            onTagClick={onTagClick}
            getUserUrl={getUserUrl}
            getTagUrl={getTagUrl}
          />
        ) : null}
        {reSnapTarget && (
          // Referenced Hive post/comment/snap appears inline after the
          // author's own content. Depth 0 → compact post preview; depth
          // ≥ 1 → re-snap card.
          <ReSnapEmbed
            author={reSnapTarget.author}
            permlink={reSnapTarget.permlink}
            observer={currentUser}
            onPostClick={onPostClick}
            onUserClick={onUserClick}
            onPreviewVisibilityChange={handleReSnapPreviewVisibility}
            showTopLevelPostPreview
          />
        )}
      </div>

      {/* Poll widget — rendered when the snap's json_metadata declares
          `content_type === 'poll'`. */}
      {(() => {
        const meta = parseJsonMetadata(post.json_metadata as unknown) as {
          content_type?: string;
          question?: string;
          choices?: string[];
          end_time?: number;
          max_choices_voted?: number;
          allow_vote_changes?: boolean;
        };
        if (meta.content_type !== 'poll') return null;
        return (
          <div className="px-3 pb-1.5" onClick={(e) => e.stopPropagation()}>
            <PollVoteWidget
              author={post.author}
              permlink={post.permlink}
              currentUser={currentUser}
              onVotePoll={onVotePoll}
              parsedMetadata={meta}
            />
          </div>
        );
      })()}

      {/* Action bar */}
      <div className="border-t border-[var(--hrk-border-default)]/60 px-2 py-1.5">
        <PostActionButton
          author={post.author}
          permlink={post.permlink}
          currentUser={currentUser}
          hiveValue={rawPayout}
          hiveIconUrl="/images/hive_logo.png"
          payoutDetails={payoutDetails}
          initialVotes={(post.active_votes as ActiveVote[] | undefined) ?? []}
          initialVoteCount={
            (post as { stats?: { total_votes?: number } }).stats?.total_votes
            ?? (post.active_votes as ActiveVote[] | undefined)?.length
            ?? Math.max(0, (post as { net_votes?: number }).net_votes ?? 0)
          }
          initialFlagWeight={(post as { stats?: { flag_weight?: number } }).stats?.flag_weight}
          initialCommentsCount={post.children || 0}
          postCreatedAt={post.created}
          onUpvote={onUpvote ? (percent) => onUpvote(post.author, post.permlink, percent) : undefined}
          onSubmitComment={onSubmitComment ? (pAuthor, pPermlink, body) => onSubmitComment(pAuthor, pPermlink, body) : undefined}
          onClickCommentUpvote={onClickCommentUpvote}
          onReblog={post.author !== currentUser && onReblog ? () => onReblog(post.author, post.permlink) : undefined}
          onReSnap={onReSnap ? () => onReSnap(post.author, post.permlink, parentMetaTags) : undefined}
          onShare={onSharePost ? () => onSharePost(post.author, post.permlink) : undefined}
          onTip={post.author !== currentUser && onTip ? () => onTip(post.author, post.permlink) : undefined}
          onReport={post.author !== currentUser && onReportPost ? () => onReportPost(post.author, post.permlink) : undefined}
          onToggleBookmark={
            onToggleBookmark ? () => onToggleBookmark(post.author, post.permlink) : undefined
          }
          isBookmarked={isPostBookmarked ? isPostBookmarked(post.author, post.permlink) : false}
          onDelete={onDeletePost && currentUser && post.author === currentUser ? () => onDeletePost(post.author, post.permlink) : undefined}
          onEdit={onEditSnap && currentUser && post.author === currentUser
            ? () => onEditSnap({
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
          disableCommentsModal={!!onCommentClick}
          onComments={onCommentClick ? () => onCommentClick(post.author, post.permlink) : undefined}
          onClickCommentIcon={onClickCommentIcon ? () => onClickCommentIcon(post.author, post.permlink, parentMetaTags) : undefined}
          onClickCommentCount={onClickCommentCount ? () => onClickCommentCount(post.author, post.permlink) : undefined}
          hasCommented={hasCommented}
          myReplyKey={myReplyKey}
          ecencyToken={ecencyToken}
          threeSpeakApiKey={threeSpeakApiKey}
          giphyApiKey={giphyApiKey}
          templateToken={templateToken}
          templateApiBaseUrl={templateApiBaseUrl}
          defaultReward={defaultReward}
          defaultVotePercent={defaultVotePercent}
          voteWeightStep={voteWeightStep}
          allowLandscapeVideos={allowLandscapeVideos}
          awaitingWalletApproval={awaitingWalletApproval}
          actionsAsMenu={actionsAsMenu}
          onUserClick={onUserClick}
          getUserUrl={getUserUrl}
          size="lg"
        />
      </div>
    </article>
  );
};

export default SnapsFeedCard;
