/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ThumbsUp, MessageSquare, ChevronDown, ChevronUp, Clock, X, Share2, Gift, Flag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { createHiveRenderer } from '@snapie/renderer';
import { Discussion } from '@/types/comment';
import { apiService } from '@/services/apiService';
import { VoteSlider } from '../VoteSlider';
import UpvoteListModal from '../UpvoteListModal';
import { PostComposer } from '../comments/AddCommentInput';
import { toast } from '@/index';
import { parseHiveFrontendUrl } from '@/utils/hiveLinks';

interface InlineCommentItemProps {
  comment: Discussion;
  allComments: Discussion[];
  onReply: (author: string, permlink: string) => void;
  onCancelReply: () => void;
  onCommentSubmit: (parentAuthor: string, parentPermlink: string, body: string) => Promise<void | boolean>;
  /** "author/permlink" key of the comment currently being replied to (null = none) */
  activeReplyKey: string | null;
  currentUser?: string;
  token?: string;
  depth?: number;
  onVotedRefresh?: () => void;
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  /** Composer props passed through */
  ecencyToken?: string;
  threeSpeakApiKey?: string;
  giphyApiKey?: string;
  templateToken?: string;
  templateApiBaseUrl?: string;
  hiveIconUrl?: string;
  onShareComment?: (author: string, permlink: string) => void;
  onTipComment?: (author: string, permlink: string) => void;
  onReportComment?: (author: string, permlink: string) => void;
  /** Called when an intra-body link points at a Hive post (peakd/hive.blog/ecency/inleo). */
  onNavigateToPost?: (author: string, permlink: string) => void;
  /** Called when an intra-body link points at a Hive user profile. */
  onUserClick?: (username: string) => void;
}

const MAX_DEPTH = 4;

export default function InlineCommentItem({
  comment,
  allComments,
  onReply,
  onCancelReply,
  onCommentSubmit,
  activeReplyKey,
  currentUser,
  token,
  depth = 0,
  onVotedRefresh,
  onClickCommentUpvote,
  ecencyToken,
  threeSpeakApiKey,
  giphyApiKey,
  templateToken,
  templateApiBaseUrl,
  hiveIconUrl,
  onShareComment,
  onTipComment,
  onReportComment,
  onNavigateToPost,
  onUserClick,
}: InlineCommentItemProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [showVoteSlider, setShowVoteSlider] = useState(false);
  const [showUpvoteListModal, setShowUpvoteListModal] = useState(false);
  const [isUpvoted, setIsUpvoted] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [expandedPastMaxDepth, setExpandedPastMaxDepth] = useState(false);
  const [replyBody, setReplyBody] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastOpen(true);
    setTimeout(() => setToastOpen(false), 2500);
  };

  const hasAlreadyVoted = useMemo(() => {
    if (!currentUser) return false;
    const user = currentUser.toLowerCase();
    return (comment.active_votes || []).some(
      (v: { voter?: string }) => (v.voter || '').toLowerCase() === user
    );
  }, [comment.active_votes, currentUser]);

  // Find direct replies
  const parentDepth = comment.depth || 0;
  let replies = allComments.filter(
    (c) =>
      c.parent_author === comment.author &&
      c.parent_permlink === comment.permlink &&
      (typeof c.depth !== 'number' || c.depth === parentDepth + 1)
  );
  if (replies.length === 0 && Array.isArray(comment.replies) && comment.replies.length > 0) {
    const replyKeys = new Set(comment.replies as string[]);
    replies = allComments.filter((c) => replyKeys.has(`${c.author}/${c.permlink}`));
  }

  const hasReplies = replies.length > 0;
  const isMaxDepth = depth >= MAX_DEPTH;

  // Is this comment the active reply target?
  const isReplyTarget = activeReplyKey === `${comment.author}/${comment.permlink}`;

  // Reset reply body when this comment becomes/stops being the reply target
  useEffect(() => {
    if (isReplyTarget) {
      setReplyBody('');
    }
  }, [isReplyTarget]);

  // Intercept Hive-frontend links (peakd/hive.blog/ecency/inleo) in the rendered
  // comment body so they route in-app via the provided callbacks.
  useEffect(() => {
    const container = bodyRef.current;
    if (!container) return;
    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      const target = parseHiveFrontendUrl(href);
      if (!target) return;
      if (target.kind === 'post' && onNavigateToPost) {
        e.preventDefault();
        onNavigateToPost(target.author, target.permlink);
      } else if (target.kind === 'user' && onUserClick) {
        e.preventDefault();
        onUserClick(target.author);
      }
    };
    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [onNavigateToPost, onUserClick]);

  // Parse metadata
  const metadata = (comment as any).json_metadata_parsed ||
    (() => { try { return comment.json_metadata ? JSON.parse(comment.json_metadata) : undefined; } catch { return undefined; } })();

  // Show first tag next to username only when developer is sagarkothari88
  const developerTag = metadata?.developer === 'sagarkothari88' && Array.isArray(metadata?.tags) && metadata.tags.length > 0
    ? (metadata.tags[0] as string)
    : null;

  // Sanitize body
  const rawBody = comment.body || '';
  const sanitizedBody = rawBody
    .replace(/<br\s*\/?>\s*\n?\s*<sub>\[via Apps from\]\(https:\/\/linktr\.ee\/sagarkothari88\)<\/sub>/gi, '')
    .replace(/^(\s*(?:#[\p{L}\p{N}_-]+\s*(?:,\s*)?)+\s*)$/gimu, '')
    .trim();

  const hasMarkdownImagesInBody = /!\[[^\]]*\]\([^)]+\)/.test(sanitizedBody) || /<img\s/i.test(sanitizedBody);
  const metadataImages: string[] = Array.isArray(metadata?.image) ? metadata.image : [];

  // Use @snapie/renderer createHiveRenderer (supports YouTube, 3Speak, IPFS, X.com embeds)
  const renderHiveContent = useMemo(() => {
    try {
      return createHiveRenderer({
        baseUrl: 'https://hreplier.sagarkothari88.one/',
        ipfsGateway: 'https://ipfs.3speak.tv',
        assetsWidth: 640,
        assetsHeight: 480,
        usertagUrlFn: (user: string) => `https://hreplier.sagarkothari88.one/#/@${user}`,
        hashtagUrlFn: (tag: string) => `https://peakd.com/created/${tag}`,
        convertHiveUrls: true,
      });
    } catch {
      return null;
    }
  }, []);

  const renderedBody = useMemo(() => {
    if (!sanitizedBody || !renderHiveContent) return '';
    try {
      let html = renderHiveContent(sanitizedBody);
      html = html.replace(
        /https:\/\/3speak\.tv\/embed\?v=([^"&\s]+)/gi,
        (_m: string, v: string) =>
          `https://play.3speak.tv/embed?v=${v}&mode=iframe&noscroll=1`,
      );
      return html;
    } catch {
      return '';
    }
  }, [sanitizedBody, renderHiveContent]);

  const voteCount = comment.stats?.total_votes || comment.net_votes || 0;

  // Compute payout value
  const payoutValue = useMemo(() => {
    if (comment.payout && comment.payout > 0) return comment.payout.toFixed(3);
    const pending = parseFloat(String(comment.pending_payout_value ?? '0').replace(/[^\d.]/g, '')) || 0;
    if (pending > 0) return pending.toFixed(3);
    const authorPay = parseFloat(String(comment.author_payout_value ?? '0').replace(/[^\d.]/g, '')) || 0;
    const curatorPay = parseFloat(String(comment.curator_payout_value ?? '0').replace(/[^\d.]/g, '')) || 0;
    const total = authorPay + curatorPay;
    if (total > 0) return total.toFixed(3);
    return '';
  }, [comment.payout, comment.pending_payout_value, comment.author_payout_value, comment.curator_payout_value]);

  const handlePerformUpvote = async (percent: number) => {
    if (onClickCommentUpvote) {
      try {
        await Promise.resolve(onClickCommentUpvote(comment.author, comment.permlink, percent));
        setIsUpvoted(true);
        setShowVoteSlider(false);
        setTimeout(() => {
          onVotedRefresh?.();
          showToast('Vote submitted successfully!');
        }, 3000);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to upvote';
        toast({ title: 'Error', description: message });  
      }
      return;
    }
    if (!token) {
      showToast('Please login or provide an upvote handler to vote');
      return;
    }
    try {
      await apiService.handleUpvote({
        author: comment.author,
        permlink: comment.permlink,
        weight: Math.round(percent * 100),
        authToken: token,
      });
      setIsUpvoted(true);
      setShowVoteSlider(false);
      setTimeout(() => {
        onVotedRefresh?.();
        showToast('Vote submitted successfully!');
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upvote';
      toast({ title: 'Error', description: message });
    }
  };

  const handleUpvoteClick = () => {
    if (!currentUser) { showToast('Please login to upvote'); return; }
    if (hasAlreadyVoted || isUpvoted) { showToast('You have already upvoted this comment'); return; }
    setShowVoteSlider(true);
  };

  const handleReplyClick = () => {
    if (!currentUser) { showToast('Please login to reply'); return; }
    onReply(comment.author, comment.permlink);
  };

  const shouldShowChildReplies = !isMaxDepth || expandedPastMaxDepth;

  return (
    <div className={`${depth > 0 ? 'ml-2 md:ml-6 border-l-2 border-gray-700/50 pl-2 md:pl-4' : ''}`}>
      <div className="py-2 px-1.5 md:py-3 md:px-3">
        {/* Header row */}
        <div className="flex items-center gap-1.5 md:gap-2 mb-1 min-w-0">
          <img
            src={`https://images.hive.blog/u/${comment.author}/avatar`}
            alt={comment.author}
            className="w-6 h-6 md:w-7 md:h-7 rounded-full flex-shrink-0 bg-gray-700"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${comment.author}&background=random`;
            }}
          />
          <span className="text-xs md:text-sm font-semibold text-white truncate">@{comment.author}</span>
          {comment.author === currentUser && (
            <span className="px-1 py-0.5 text-[9px] md:text-[10px] bg-blue-900 text-blue-200 rounded-full flex-shrink-0">You</span>
          )}
          {developerTag && (
            <span className="px-1.5 py-0.5 text-[9px] md:text-[10px] bg-purple-900/60 text-purple-200 border border-purple-700/60 rounded-full flex-shrink-0">
              #{developerTag}
            </span>
          )}
          <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
            <Clock className="w-3 h-3" />
            {comment.created
              ? formatDistanceToNow(new Date(comment.created + 'Z'), { addSuffix: true })
              : ''}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-gray-700/60 transition-colors text-gray-400 hover:text-white flex-shrink-0"
            title={collapsed ? 'Expand comment' : 'Minimize comment'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Collapsible body */}
        {!collapsed && (
          <>
            {/* Rendered body */}
            <div className="prose prose-sm prose-invert max-w-none mb-2 text-gray-200 text-left prose-a:text-blue-400 [&>*]:text-left ml-7 md:ml-9">
              {renderedBody ? (
                <div ref={bodyRef} className="hive-post-body" dangerouslySetInnerHTML={{ __html: renderedBody }} />
              ) : (
                <p className="text-gray-400 text-sm italic">No content available.</p>
              )}
            </div>

            {/* Metadata images */}
            {!hasMarkdownImagesInBody && metadataImages.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 ml-7 md:ml-9">
                {metadataImages.map((src, idx) => (
                  <img
                    key={src + idx}
                    src={src}
                    alt={`image-${idx}`}
                    className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(src, '_blank')}
                  />
                ))}
              </div>
            )}

            {/* Actions — wraps into two rows on mobile */}
            <div className="ml-7 md:ml-9 text-xs">
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5">
                {/* Primary: upvote, reply */}
                <button
                  onClick={handleUpvoteClick}
                  className={`flex items-center gap-1 font-medium transition-colors ${
                    hasAlreadyVoted || isUpvoted ? 'text-blue-400' : 'text-gray-400 hover:text-blue-400'
                  }`}
                  title="Upvote"
                >
                  <ThumbsUp className={`w-3.5 h-3.5 ${hasAlreadyVoted || isUpvoted ? 'fill-current' : ''}`} />
                </button>
                <button
                  onClick={() => setShowUpvoteListModal(true)}
                  className="flex items-center gap-1 font-medium text-gray-400 hover:text-blue-400 transition-colors -ml-2"
                  title="View upvotes"
                >
                  <span>{voteCount}</span>
                </button>

                <button
                  onClick={handleReplyClick}
                  className="flex items-center gap-1 font-medium text-gray-400 hover:text-blue-400 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </button>

                {/* Secondary: share, report, tip — icons only on mobile */}
                {onShareComment && (
                  <button
                    onClick={() => onShareComment(comment.author, comment.permlink)}
                    className="text-gray-400 hover:text-blue-400 transition-colors p-0.5"
                    title="Share"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {onReportComment && currentUser && comment.author !== currentUser && (
                  <button
                    onClick={() => onReportComment(comment.author, comment.permlink)}
                    className="text-gray-400 hover:text-red-400 transition-colors p-0.5"
                    title="Report"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                )}

                {onTipComment && currentUser && comment.author !== currentUser && (
                  <button
                    onClick={() => onTipComment(comment.author, comment.permlink)}
                    className="text-gray-400 hover:text-green-400 transition-colors p-0.5"
                    title="Tip"
                  >
                    <Gift className="w-3.5 h-3.5" />
                  </button>
                )}

                {hasReplies && (
                  <button
                    onClick={() => setShowReplies(!showReplies)}
                    className="flex items-center gap-1 font-medium text-gray-400 hover:text-blue-400 transition-colors"
                  >
                    {showReplies ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{showReplies ? 'Hide' : 'Show'} </span>
                    <span>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
                  </button>
                )}

                {/* Hive payout value — pushed to end */}
                {payoutValue && (
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="font-semibold text-green-400 text-[11px]">{payoutValue}</span>
                    {hiveIconUrl && <img src={hiveIconUrl} alt="Hive" className="w-3 h-3 rounded-full" />}
                  </div>
                )}
              </div>
            </div>

            {/* Upvote list modal */}
            {showUpvoteListModal && (
              <UpvoteListModal
                author={comment.author}
                permlink={comment.permlink}
                onClose={() => setShowUpvoteListModal(false)}
                currentUser={currentUser}
                token={token}
                onClickUpvoteButton={() => {
                  setShowUpvoteListModal(false);
                  handleUpvoteClick();
                }}
              />
            )}

            {/* Vote slider */}
            {showVoteSlider && !hasAlreadyVoted && (
              <div className="mt-2 ml-7 md:ml-9">
                <VoteSlider
                  author={comment.author}
                  permlink={comment.permlink}
                  onUpvote={handlePerformUpvote}
                  onCancel={() => setShowVoteSlider(false)}
                />
              </div>
            )}

            {/* Inline reply composer — portal bottom sheet on mobile, inline on desktop */}
            {isReplyTarget && currentUser && (
              <>
                {/* Mobile: portal to document.body so it escapes overflow containers */}
                {createPortal(
                  <div className="md:hidden">
                    {/* Backdrop */}
                    <div className="fixed inset-0 bg-black/40 z-[9998]" onClick={onCancelReply} />
                    {/* Bottom sheet */}
                    <div className="fixed inset-x-0 bottom-0 z-[9999] border-t border-gray-700 bg-gray-900 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] max-h-[70vh] overflow-y-auto">
                      {/* Composer header */}
                      <div className="px-3 py-2 border-b border-gray-700 bg-gray-900/95 sticky top-0 z-10">
                        <div className="flex items-center gap-2">
                          <img
                            src={`https://images.hive.blog/u/${currentUser}/avatar`}
                            alt={currentUser}
                            className="w-6 h-6 rounded-full flex-shrink-0 bg-gray-700 border border-gray-600"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${currentUser}&background=random`;
                            }}
                          />
                          <span className="text-xs font-medium text-white truncate">@{currentUser}</span>
                          {currentUser === comment.author ? (
                            <span className="text-gray-500 text-[11px]">replying to your comment</span>
                          ) : (
                            <>
                              <span className="text-gray-500 text-[11px]">to</span>
                              <img
                                src={`https://images.hive.blog/u/${comment.author}/avatar`}
                                alt={comment.author}
                                className="w-6 h-6 rounded-full flex-shrink-0 bg-gray-700 border border-gray-600"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${comment.author}&background=random`;
                                }}
                              />
                              <span className="text-xs font-medium text-blue-400 truncate">@{comment.author}</span>
                            </>
                          )}
                          <div className="flex-1" />
                          <button
                            onClick={onCancelReply}
                            className="p-1.5 rounded hover:bg-gray-700/60 transition-colors flex-shrink-0"
                            title="Cancel reply"
                          >
                            <X className="w-4 h-4 text-gray-400 hover:text-white" />
                          </button>
                        </div>
                      </div>
                      <PostComposer
                        onSubmit={(body) => onCommentSubmit(comment.author, comment.permlink, body)}
                        onCancel={onCancelReply}
                        currentUser={currentUser}
                        parentAuthor={comment.author}
                        parentPermlink={comment.permlink}
                        placeholder={`Reply to @${comment.author}...`}
                        value={replyBody}
                        onChange={setReplyBody}
                        ecencyToken={ecencyToken}
                        threeSpeakApiKey={threeSpeakApiKey}
                        giphyApiKey={giphyApiKey}
                        templateToken={templateToken}
                        templateApiBaseUrl={templateApiBaseUrl}
                        hideUserHeader
                        showCancel
                      />
                    </div>
                  </div>,
                  document.body
                )}

                {/* Desktop: inline composer */}
                <div className="hidden md:block mt-3 ml-9 border border-gray-700 rounded-xl overflow-hidden bg-gray-800/50">
                  <div className="px-3 py-2 border-b border-gray-700 bg-gray-900/50">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={`https://images.hive.blog/u/${currentUser}/avatar`}
                        alt={currentUser}
                        className="w-6 h-6 rounded-full flex-shrink-0 bg-gray-700 border border-gray-600"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${currentUser}&background=random`;
                        }}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-white truncate">@{currentUser}</span>
                      </div>
                      {currentUser === comment.author ? (
                        <span className="text-gray-500 text-[11px]">replying to your comment</span>
                      ) : (
                        <>
                          <span className="text-gray-500 text-[11px]">replying to</span>
                          <img
                            src={`https://images.hive.blog/u/${comment.author}/avatar`}
                            alt={comment.author}
                            className="w-6 h-6 rounded-full flex-shrink-0 bg-gray-700 border border-gray-600"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${comment.author}&background=random`;
                            }}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium text-blue-400 truncate">@{comment.author}/{comment.permlink}</span>
                          </div>
                        </>
                      )}
                      <div className="flex-1" />
                      <button
                        onClick={onCancelReply}
                        className="p-1 rounded hover:bg-gray-700/60 transition-colors flex-shrink-0"
                        title="Cancel reply"
                      >
                        <X className="w-3.5 h-3.5 text-gray-400 hover:text-white" />
                      </button>
                    </div>
                  </div>
                  <PostComposer
                    onSubmit={(body) => onCommentSubmit(comment.author, comment.permlink, body)}
                    onCancel={onCancelReply}
                    currentUser={currentUser}
                    parentAuthor={comment.author}
                    parentPermlink={comment.permlink}
                    placeholder={`Reply to @${comment.author}...`}
                    value={replyBody}
                    onChange={setReplyBody}
                    ecencyToken={ecencyToken}
                    threeSpeakApiKey={threeSpeakApiKey}
                    giphyApiKey={giphyApiKey}
                    templateToken={templateToken}
                    templateApiBaseUrl={templateApiBaseUrl}
                    hideUserHeader
                    showCancel
                  />
                </div>
              </>
            )}
          </>
        )}

        {/* Collapsed summary — strip HTML/markdown tags for plain text preview */}
        {collapsed && (() => {
          const plainText = sanitizedBody.replace(/<[^>]*>/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*_~`>]/g, '').replace(/\s+/g, ' ').trim();
          return (
            <p className="text-xs text-gray-500 ml-7 md:ml-9 truncate">
              {plainText.slice(0, 120)}{plainText.length > 120 ? '…' : ''}
            </p>
          );
        })()}
      </div>

      {/* Nested replies */}
      {!collapsed && hasReplies && showReplies && shouldShowChildReplies && (
        <div>
          {replies.map((reply) => (
            <InlineCommentItem
              key={reply.permlink}
              comment={reply}
              allComments={allComments}
              onReply={onReply}
              onCancelReply={onCancelReply}
              onCommentSubmit={onCommentSubmit}
              activeReplyKey={activeReplyKey}
              currentUser={currentUser}
              token={token}
              depth={depth + 1}
              onVotedRefresh={onVotedRefresh}
              onClickCommentUpvote={onClickCommentUpvote}
              ecencyToken={ecencyToken}
              threeSpeakApiKey={threeSpeakApiKey}
              giphyApiKey={giphyApiKey}
              templateToken={templateToken}
              templateApiBaseUrl={templateApiBaseUrl}
              hiveIconUrl={hiveIconUrl}
              onShareComment={onShareComment}
              onTipComment={onTipComment}
              onReportComment={onReportComment}
              onNavigateToPost={onNavigateToPost}
              onUserClick={onUserClick}
            />
          ))}
        </div>
      )}

      {/* Max depth: clickable "View more replies" */}
      {!collapsed && hasReplies && showReplies && isMaxDepth && !expandedPastMaxDepth && (
        <div className="ml-3 md:ml-6 py-2 pl-3 md:pl-4 border-l-2 border-gray-700/50">
          <button
            onClick={() => setExpandedPastMaxDepth(true)}
            className="text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors"
          >
            View {replies.length} more {replies.length === 1 ? 'reply' : 'replies'}
          </button>
        </div>
      )}

      {/* Toast */}
      {toastOpen && (
        <div className="fixed bottom-4 right-4 w-[280px] z-50">
          <div className="bg-gray-800 text-white rounded px-3 py-2 shadow-lg text-sm">{toastMessage}</div>
        </div>
      )}
    </div>
  );
}
