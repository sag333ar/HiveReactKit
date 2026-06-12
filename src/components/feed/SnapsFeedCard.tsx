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
import type { Post } from '@/types/post';
import type { ActiveVote } from '@/types/video';
import { PostActionButton } from '../actionButtons/PostActionButton';
import { SelectionTranslator } from '../SelectionTranslator';
import { PollVoteWidget } from '../PollVoteWidget';
import type { RewardOption } from '../../utils/commentOptions';
import { parseHiveFrontendUrl, preLinkMentions, preLinkUrls } from '@/utils/hiveLinks';
import { detectHivePostReference, stripHivePostReference } from '@/utils/hivePostReferences';
import ReSnapEmbed from './ReSnapEmbed';
import { IPFS_URL_REGEX } from '../IpfsMedia';
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

import {
  AttachmentStrip,
  parseBody,
  hasHivesuiteFamilyTag,
  extractTagsFromMeta,
  parseJsonMetadata,
  stripViaAppsCredit,
  TWITTER_REGEX,
  YOUTUBE_REGEX,
  THREE_SPEAK_REGEX,
  AUDIO_FILE_REGEX,
  THREE_SPEAK_AUDIO_REGEX,
  IMG_MD_REGEX,
  IMG_HTML_REGEX,
  IMG_URL_REGEX,
  SPOTIFY_REGEX,
  type Attachment,
  type BodySegment,
} from './AttachmentStrip';

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
    body = body.replace(SPOTIFY_REGEX, '');

    // Tighten — collapse runs of 3+ blank lines to exactly one, trim
    // edges. (Without this the rendered HTML can pick up huge blank
    // gaps from the body when many tags or attribution lines were
    // stripped above.)
    body = body.replace(/\n{3,}/g, '\n\n').trim();

    if (!body) return '';
    try {
      // Pre-link mentions and URLs before rendering to fix parsing bugs
      let safeBody = preLinkMentions(body);
      safeBody = preLinkUrls(safeBody);
      let html = renderHive(safeBody);
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
