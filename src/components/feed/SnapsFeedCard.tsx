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
import { useEffect, useMemo, useState, type FC, type ReactNode } from 'react';
import { createHiveRenderer } from '@snapie/renderer';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Music,
  ImageOff,
  X,
} from 'lucide-react';
import type { Post } from '@/types/post';
import type { ActiveVote } from '@/types/video';
import { PostActionButton } from '../actionButtons/PostActionButton';
import { PollVoteWidget } from '../PollVoteWidget';
import { ThreeSpeakPlayer as ThreeSpeakNativePlayer } from '../ThreeSpeakPlayer';
import type { RewardOption } from '../../utils/commentOptions';
import { parseHiveFrontendUrl } from '@/utils/hiveLinks';

export interface SnapsFeedCardProps {
  post: Post;
  currentUser?: string;

  onUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onSubmitComment?: (parentAuthor: string, parentPermlink: string, body: string) => void | Promise<void>;
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onReblog?: (author: string, permlink: string) => void;
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
  | { kind: 'youtube'; id: string }
  | { kind: 'threespeak'; url: string }
  | { kind: 'twitter'; id: string }
  | { kind: 'audio'; url: string };

const TWITTER_REGEX = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/gi;
const YOUTUBE_REGEX =
  /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([^&\s]+)|https?:\/\/youtu\.be\/([^?\s]+)|https?:\/\/(?:www\.)?youtube\.com\/shorts\/([^?\s]+)/gi;
const THREE_SPEAK_REGEX = /https?:\/\/(?:play\.)?3speak\.tv\/[^\s"'<>)]+/gi;
const AUDIO_FILE_REGEX = /https?:\/\/[^\s"'<>)]+\.(?:mp3|wav|ogg|m4a)\b/gi;
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
  const meta = parseJsonMetadata(post.json_metadata as unknown) as { image?: string[] };

  // Collect attachment URLs
  const imageUrls: string[] = [...(meta.image ?? [])];
  let m: RegExpExecArray | null;
  while ((m = IMG_MD_REGEX.exec(raw))) imageUrls.push(m[1]);
  while ((m = IMG_HTML_REGEX.exec(raw))) imageUrls.push(m[1]);
  // Bare image URLs the renderer would otherwise auto-promote into inline
  // <img> tags inside the body — pull them into the carousel so they're
  // shown once (in the strip) instead of twice (strip + body).
  while ((m = IMG_URL_REGEX.exec(raw))) imageUrls.push(m[0]);

  const youtubeIds: string[] = [];
  while ((m = YOUTUBE_REGEX.exec(raw))) youtubeIds.push((m[1] || m[2] || m[3])!);

  const threeSpeakUrls: string[] = [];
  while ((m = THREE_SPEAK_REGEX.exec(raw))) threeSpeakUrls.push(m[0]);

  const audioUrls: string[] = [];
  while ((m = AUDIO_FILE_REGEX.exec(raw))) audioUrls.push(m[0]);

  const twitterIds: string[] = [];
  while ((m = TWITTER_REGEX.exec(raw))) twitterIds.push(m[1]);

  const attachments: Attachment[] = [
    ...uniq(imageUrls).map((url) => ({ kind: 'image' as const, url })),
    ...uniq(youtubeIds).map((id) => ({ kind: 'youtube' as const, id })),
    ...uniq(threeSpeakUrls).map((url) => ({ kind: 'threespeak' as const, url })),
    ...uniq(twitterIds).map((id) => ({ kind: 'twitter' as const, id })),
    ...uniq(audioUrls).map((url) => ({ kind: 'audio' as const, url })),
  ];

  // Strip media + markdown noise to plain text
  let text = raw;
  text = text.replace(IMG_MD_REGEX, '');
  text = text.replace(IMG_HTML_REGEX, '');
  text = text.replace(YOUTUBE_REGEX, '');
  text = text.replace(THREE_SPEAK_REGEX, '');
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
}> = ({ segments, onUserClick, onTagClick }) => {
  const out: ReactNode[] = [];
  segments.forEach((seg, i) => {
    if (seg.kind === 'text') {
      out.push(<span key={i}>{seg.text}</span>);
    } else if (seg.kind === 'mention') {
      out.push(
        <button
          key={i}
          type="button"
          onClick={(e) => { e.stopPropagation(); onUserClick?.(seg.username); }}
          className="text-[var(--hrk-brand)] hover:underline"
        >
          @{seg.username}
        </button>,
      );
    } else if (seg.kind === 'hashtag') {
      out.push(
        <button
          key={i}
          type="button"
          onClick={(e) => { e.stopPropagation(); onTagClick?.(seg.tag); }}
          className="text-[var(--hrk-brand)] hover:underline"
        >
          #{seg.tag}
        </button>,
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

const MediaPopup: FC<{ attachment: Attachment; onClose: () => void }> = ({
  attachment,
  onClose,
}) => {
  // Lock body scroll + listen for Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const closeAndStop = (e: React.SyntheticEvent) => { e.stopPropagation(); onClose(); };
  const isCompact = attachment.kind === 'audio';

  return (
    <div
      className="fixed inset-0 z-[2000] flex flex-col bg-black/85 sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={closeAndStop}
    >
      {/* Mobile title strip */}
      <div
        className="flex shrink-0 items-center bg-black/40 px-4 py-3 pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:hidden"
        onClick={stop}
      >
        <span className="truncate text-sm font-medium text-white/80">
          {attachmentLabel(attachment)}
        </span>
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
          <span className="text-sm font-medium text-white/70">{attachmentLabel(attachment)}</span>
          <button
            type="button"
            onClick={closeAndStop}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center p-3 sm:p-4">
          {attachment.kind === 'image' && (
            <img
              src={attachment.url}
              alt=""
              className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain"
            />
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
  const [errored, setErrored] = useState<Set<number>>(new Set());

  if (attachments.length === 0) return null;
  const safeIdx = Math.min(idx, attachments.length - 1);
  const current = attachments[safeIdx];

  const next = () => setIdx((i) => (i + 1) % attachments.length);
  const prev = () => setIdx((i) => (i - 1 + attachments.length) % attachments.length);
  const open = (e: React.MouseEvent, a: Attachment) => {
    e.stopPropagation();
    setActiveAttachment(a);
  };

  const renderTile = () => {
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
            src={current.url}
            alt=""
            loading="lazy"
            className="max-h-full max-w-full object-contain"
            onError={() => setErrored((prev) => new Set(prev).add(safeIdx))}
          />
        </button>
      );
    }
    if (current.kind === 'youtube') {
      return (
        <button
          type="button"
          onClick={(e) => open(e, current)}
          className="relative flex h-full w-full items-center justify-center bg-black"
          aria-label="Play YouTube video"
        >
          <img
            src={`https://img.youtube.com/vi/${current.id}/hqdefault.jpg`}
            alt=""
            className="h-full w-full object-cover opacity-80"
          />
          <span className="absolute flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-white">
            <Play className="h-6 w-6" />
          </span>
          <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[10px] text-white">
            YouTube
          </span>
        </button>
      );
    }
    if (current.kind === 'threespeak') {
      return (
        <button
          type="button"
          onClick={(e) => open(e, current)}
          className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[var(--hrk-bg-surface-sunken)] text-sm text-[var(--hrk-text-secondary)]"
          aria-label="Play 3Speak video"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--hrk-brand)]/15 text-[var(--hrk-brand)]">
            <Play className="h-6 w-6" />
          </span>
          <span className="text-xs text-[var(--hrk-text-tertiary)]">3Speak · Tap to play</span>
        </button>
      );
    }
    if (current.kind === 'twitter') {
      return (
        <button
          type="button"
          onClick={(e) => open(e, current)}
          className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-sky-900/40 to-slate-950/60 text-sm text-[var(--hrk-text-secondary)]"
          aria-label="Open tweet"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/80">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </span>
          <span className="text-xs font-medium text-white/70">Tweet</span>
          <span className="text-[10px] text-white/40">Tap to preview</span>
        </button>
      );
    }
    // audio
    return (
      <button
        type="button"
        onClick={(e) => open(e, current)}
        className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[var(--hrk-bg-surface-sunken)] text-sm text-[var(--hrk-text-secondary)]"
        aria-label="Play audio"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--hrk-brand)]/15 text-[var(--hrk-brand)]">
          <Music className="h-6 w-6" />
        </span>
        <span className="text-xs text-[var(--hrk-text-tertiary)]">Audio · Tap to play</span>
      </button>
    );
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-lg border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-app)]">
        {/* Fixed strip height matching hSnaps' STRIP_HEIGHT=280px so
            scale-to-fit images get a stable container instead of an
            aspect-ratio box that varied with card width. */}
        <div className="h-[280px] w-full">{renderTile()}</div>
        {attachments.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
              {safeIdx + 1} / {attachments.length}
            </div>
          </>
        )}
      </div>

      {activeAttachment && (
        <MediaPopup
          attachment={activeAttachment}
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
  onTip,
  onSharePost,
  onCommentClick,
  onClickCommentIcon,
  onClickCommentCount,
  onReportPost,
  onEditSnap,
  onVotePoll,
  onUserClick,
  onPostClick,
  onTagClick,
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
  const parsed = useMemo(() => parseBody(post), [post.body, post.json_metadata]);
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
    const raw = post.body ?? '';
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
    // Bare image URLs would otherwise be auto-promoted into <img> tags by
    // the markdown renderer, producing a vertical stack of the same images
    // already shown in the carousel. Pull them out before rendering.
    body = body.replace(IMG_URL_REGEX, '');
    body = body.replace(YOUTUBE_REGEX, '');
    body = body.replace(THREE_SPEAK_REGEX, '');
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
      return html;
    } catch {
      return '';
    }
  }, [post.body, renderHive]);

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
    onPostClick?.(post.author, post.permlink, post.title);
  };

  return (
    <article className="overflow-hidden rounded-xl border border-[var(--hrk-border-default)] bg-[var(--hrk-bg-surface)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onUserClick?.(post.author); }}
          className="shrink-0"
        >
          <img
            src={`https://images.hive.blog/u/${post.author}/avatar`}
            alt={post.author}
            className="h-9 w-9 rounded-full bg-[var(--hrk-bg-hover)] object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${post.author}&background=random&size=36`;
            }}
          />
        </button>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUserClick?.(post.author); }}
            className="truncate text-sm font-semibold text-[var(--hrk-text-primary)] hover:text-[var(--hrk-brand)]"
          >
            @{post.author}
          </button>
          <span className="shrink-0 text-xs text-[var(--hrk-text-tertiary)]">·</span>
          <span className="shrink-0 text-xs text-[var(--hrk-text-tertiary)]">{formatTimeAgo(post.created)}</span>
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
              <span className="shrink-0 truncate text-xs font-medium text-[var(--hrk-brand)]">
                #{post.community_title}
              </span>
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
          // an anchor / button / media element.
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
        ) : parsed.segments.length > 0 ? (
          // Fallback when the renderer is unavailable or returns empty
          // (e.g. body was entirely media): keep the old plain-text
          // segments so the card never renders blank.
          <InlineBody
            segments={parsed.segments}
            onUserClick={onUserClick}
            onTagClick={onTagClick}
          />
        ) : null}
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
            ?? (post as { net_votes?: number }).net_votes
            ?? (post.active_votes as ActiveVote[] | undefined)?.length
            ?? 0
          }
          initialCommentsCount={post.children || 0}
          postCreatedAt={post.created}
          onUpvote={onUpvote ? (percent) => onUpvote(post.author, post.permlink, percent) : undefined}
          onSubmitComment={onSubmitComment ? (pAuthor, pPermlink, body) => onSubmitComment(pAuthor, pPermlink, body) : undefined}
          onClickCommentUpvote={onClickCommentUpvote}
          onReblog={post.author !== currentUser && onReblog ? () => onReblog(post.author, post.permlink) : undefined}
          onShare={onSharePost ? () => onSharePost(post.author, post.permlink) : undefined}
          onTip={post.author !== currentUser && onTip ? () => onTip(post.author, post.permlink) : undefined}
          onReport={post.author !== currentUser && onReportPost ? () => onReportPost(post.author, post.permlink) : undefined}
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
          size="lg"
        />
      </div>
    </article>
  );
};

export default SnapsFeedCard;
