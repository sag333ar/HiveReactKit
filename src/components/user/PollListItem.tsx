/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from "react";
import { Circle, CheckCircle2, Send } from "lucide-react";
import { PostActionButton } from "../actionButtons/PostActionButton";
import { TranslatedText } from "../TranslatedText";
import type { Poll } from "@/types/poll";

// Inline poll-voting card used inside the polls tab of UserDetailProfile.
// Mirrors the voting widget in HiveDetailPost so users can vote without
// leaving the list. The choice rendering / submit flow is intentionally
// kept identical to that component for consistency.

const formatTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

const extractPlainText = (body: string): string => {
  let text = body;
  text = text.replace(/<[^>]*>/g, "");
  text = text.replace(/!\[.*?\]\([^\s)]+\)/g, "");
  text = text.replace(/\[([^\]]*)\]\([^\s)]+\)/g, "$1");
  text = text.replace(/https?:\/\/[^\s)>\]]+/g, "");
  text = text.replace(/\[.*?\]/g, "");
  text = text.replace(/\(https?:\/\/[^\s)]*\)/g, "");
  text = text.replace(/[*_~`#>|]/g, "");
  text = text.replace(/^[-_*]{3,}\s*$/gm, "");
  text = text.replace(/\s+/g, " ").trim();
  return text;
};

export interface PollListItemProps {
  poll: Poll;
  currentUsername?: string;

  /**
   * Called when the user submits a poll vote from the inline voting UI.
   * `choiceNums` is an array of 1-based choice numbers selected.
   *
   * Return `false` (or a Promise resolving to `false`) to indicate the
   * operation was cancelled (e.g. keychain request denied) — the local
   * vote state will NOT be updated.
   */
  onVotePoll?: (author: string, permlink: string, choiceNums: number[]) => void | boolean | Promise<void | boolean>;

  /** Card click — opens poll detail (clicks on choices/buttons don't bubble here) */
  onPollClick?: (author: string, permlink: string, question: string) => void;

  // Forwarded to PostActionButton
  onUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onSubmitComment?: (parentAuthor: string, parentPermlink: string, body: string) => void | Promise<void>;
  onClickCommentUpvote?: (author: string, permlink: string, percent: number) => void | Promise<void>;
  onReblog?: (author: string, permlink: string) => void;
  onTip?: (author: string, permlink: string) => void;
  onSharePost?: (author: string, permlink: string) => void;
  onCommentClick?: (author: string, permlink: string) => void;
  /**
   * Called when the user clicks the report button on the action bar.
   * The parent owns the report modal — this is purely a request to open it.
   */
  onRequestReportPost?: (author: string, permlink: string) => void;
  onUserClick?: (username: string) => void;

  // Composer tokens (forwarded to comments composer via PostActionButton)
  ecencyToken?: string;
  threeSpeakApiKey?: string;
  giphyApiKey?: string;
  templateToken?: string;
  templateApiBaseUrl?: string;
}

const PollListItem: React.FC<PollListItemProps> = ({
  poll,
  currentUsername,
  onVotePoll,
  onPollClick,
  onUpvote,
  onSubmitComment,
  onClickCommentUpvote,
  onReblog,
  onTip,
  onSharePost,
  onCommentClick,
  onRequestReportPost,
  onUserClick,
  ecencyToken,
  threeSpeakApiKey,
  giphyApiKey,
  templateToken,
  templateApiBaseUrl,
}) => {
  const [selectedChoices, setSelectedChoices] = useState<number[]>([]);
  const [votedChoices, setVotedChoices] = useState<number[]>([]);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);

  const totalVoters = poll.poll_stats?.total_voting_accounts_num || 0;
  const isActive = poll.status === "Active";
  const endDate = new Date(poll.end_time);
  const isExpired = endDate < new Date();
  const previewText = useMemo(
    () => (poll.post_body ? extractPlainText(poll.post_body) : ""),
    [poll.post_body]
  );

  const maxChoices: number = poll.max_choices_voted ?? 1;
  const isMulti = maxChoices > 1;
  const pollEnded = isExpired || !isActive;
  const hasVotedLocal = votedChoices.length > 0;

  // Determine if the current user has already voted from API data.
  // poll_voters may have .choices[] (multi) or .choice_num (single) — handle both.
  const apiVoter = currentUsername
    ? poll.poll_voters?.find((v) => v.name === currentUsername)
    : undefined;
  const apiVotedChoices: number[] = apiVoter?.choices?.length
    ? apiVoter.choices
    : apiVoter?.choice_num != null
      ? [apiVoter.choice_num]
      : [];
  const alreadyVoted = hasVotedLocal || apiVotedChoices.length > 0;
  const allowVoteChanges = poll.allow_vote_changes ?? false;
  const displayVoted = hasVotedLocal ? votedChoices : apiVotedChoices;

  // showVoteUI = "is voting interactive right now"
  //   - logged-in user
  //   - poll still active
  //   - consumer wired onVotePoll
  //   - either user hasn't voted, OR poll allows vote changes
  const showVoteUI = !!currentUsername && !pollEnded && !!onVotePoll && (!alreadyVoted || allowVoteChanges);

  // We show the explicit Submit button for ALL active votable polls — no
  // auto-submit-on-click for single-choice polls. Users get a chance to
  // confirm before signing.
  const showSubmitButton = showVoteUI;

  // True only for the "user has voted before, is now picking new options" case.
  // Used purely for labelling ("Change Vote" instead of "Submit Vote") and for
  // dimming the previously-voted options.
  const isChangingVote = alreadyVoted && allowVoteChanges && !hasVotedLocal;

  const choices = poll.poll_choices ?? [];
  const totalVotesAcrossChoices = choices.reduce(
    (sum, c) => sum + (c.votes?.total_votes ?? 0),
    0
  );

  const handleChoiceClick = (choiceNum: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showVoteUI || isSubmittingVote) return;

    setSelectedChoices((prev) => {
      // Single-choice → radio behaviour: replace any existing selection.
      if (!isMulti) {
        return prev[0] === choiceNum ? [] : [choiceNum];
      }
      // Multi-choice → checkbox behaviour: toggle, capped at maxChoices.
      if (prev.includes(choiceNum)) return prev.filter((n) => n !== choiceNum);
      if (prev.length >= maxChoices) return prev;
      return [...prev, choiceNum];
    });
  };

  const handleSubmit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showVoteUI || isSubmittingVote || selectedChoices.length === 0) return;
    setIsSubmittingVote(true);
    try {
      const result = await Promise.resolve(onVotePoll?.(poll.author, poll.permlink, selectedChoices));
      if (result === false) return; // cancelled — keep the user's selection so they can retry
      setVotedChoices(selectedChoices);
      setSelectedChoices([]);
    } finally {
      setIsSubmittingVote(false);
    }
  };

  return (
    <div
      className="border border-gray-700 rounded-lg bg-gray-800 hover:bg-gray-700/50 transition-colors cursor-pointer"
      onClick={() => onPollClick?.(poll.author, poll.permlink, poll.question)}
    >
      <div className="p-4">
        {/* Header: author + status */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <img
              src={`https://images.hive.blog/u/${poll.author}/avatar`}
              alt={poll.author}
              className="w-8 h-8 rounded-full bg-gray-700"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${poll.author}&background=random&size=32`;
              }}
            />
            <div>
              <button
                onClick={(e) => { e.stopPropagation(); onUserClick?.(poll.author); }}
                className="text-sm font-medium text-white hover:text-blue-400"
              >
                @{poll.author}
              </button>
              <p className="text-[10px] text-gray-500">{formatTimeAgo(poll.created)}</p>
            </div>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${!pollEnded ? "bg-green-500/20 text-green-400" : "bg-gray-600/30 text-gray-400"}`}>
            {!pollEnded ? "Active" : "Ended"}
          </span>
        </div>

        {/* Question */}
        <h3 className="text-sm font-semibold text-white mb-1">
          <TranslatedText text={poll.question} />
        </h3>

        {/* Body preview */}
        {previewText && (
          <p className="text-gray-400 text-xs line-clamp-2 mb-2">
            <TranslatedText text={previewText.substring(0, 150)} />
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-3">
          <span>{totalVoters} voter{totalVoters !== 1 ? "s" : ""}</span>
          <span>{choices.length} option{choices.length !== 1 ? "s" : ""}</span>
          {poll.poll_stats?.total_hive_hp != null && poll.poll_stats.total_hive_hp > 0 && (
            <span>{(poll.poll_stats.total_hive_hp / 1000).toFixed(1)}k HP</span>
          )}
          {poll.end_time && (
            <span>{!pollEnded ? `Ends ${formatTimeAgo(poll.end_time)}` : "Ended"}</span>
          )}
        </div>

        {/* Selection hint */}
        {showVoteUI && (
          <p className="mb-2 text-[11px] text-gray-400">
            {isChangingVote ? "Change your vote — " : ""}
            {isMulti
              ? `Select up to ${maxChoices} option${maxChoices > 1 ? "s" : ""}`
              : "Select an option"}
            {selectedChoices.length > 0 && (
              <span className="ml-1 text-blue-400">· {selectedChoices.length} selected</span>
            )}
          </p>
        )}

        {/* Choices */}
        <div
          className="space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          {choices.map((choice) => {
            const votes = choice.votes?.total_votes ?? 0;
            const pct = totalVotesAcrossChoices > 0 ? Math.round((votes / totalVotesAcrossChoices) * 100) : 0;
            const isVoted = displayVoted.includes(choice.choice_num);
            const isSelected = selectedChoices.includes(choice.choice_num);
            // Only multi-choice polls can hit the cap. Single-choice always
            // allows clicking another option (replaces the selection).
            const isMaxed = isMulti && selectedChoices.length >= maxChoices && !isSelected;
            const isClickable = showVoteUI && !isMaxed;

            let borderColor = "border-gray-700";
            let iconEl = <Circle className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />;
            let fillColor = "bg-blue-600/20";

            if (isSelected) {
              borderColor = "border-blue-500/60";
              iconEl = <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
            } else if (isVoted && !isChangingVote) {
              borderColor = "border-green-600/60";
              iconEl = <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />;
              fillColor = "bg-green-600/20";
            } else if (isVoted && isChangingVote) {
              borderColor = "border-green-800/40";
              iconEl = <CheckCircle2 className="w-3.5 h-3.5 text-green-700 flex-shrink-0" />;
              fillColor = "bg-green-900/10";
            }

            return (
              <div
                key={choice.choice_num}
                className={`relative rounded-lg overflow-hidden border ${borderColor} bg-gray-900/50 transition-colors ${isClickable ? "cursor-pointer hover:border-blue-500/40" : isMaxed ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={(e) => handleChoiceClick(choice.choice_num, e)}
              >
                {pct > 0 && (
                  <div
                    className={`absolute inset-y-0 left-0 ${fillColor} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                )}
                <div className="relative flex items-center justify-between px-3 py-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {iconEl}
                    <span
                      className={`text-sm truncate ${
                        isSelected
                          ? "text-blue-300 font-medium"
                          : isVoted && !isChangingVote
                            ? "text-green-300 font-medium"
                            : isVoted && isChangingVote
                              ? "text-green-700"
                              : "text-gray-200"
                      }`}
                    >
                      <TranslatedText text={choice.choice_text} />
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 text-[11px] text-gray-400">
                    <span>{pct}%</span>
                    <span className="text-gray-600">·</span>
                    <span>{votes} vote{votes !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit / Change vote button — shown for any active votable poll */}
        {showSubmitButton && (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleSubmit}
              disabled={selectedChoices.length === 0 || isSubmittingVote}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors w-full justify-center font-medium"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmittingVote ? "Submitting…" : isChangingVote ? "Change Vote" : `Submit Vote${selectedChoices.length > 1 ? "s" : ""}`}
            </button>
          </div>
        )}

        {/* Voted footer marker */}
        {alreadyVoted && (
          <div className="mt-2 text-[11px] text-green-500">
            ✓ Voted{allowVoteChanges ? " · Vote changes allowed" : ""}
          </div>
        )}
      </div>

      {/* PostActionButton */}
      <div className="px-4 pb-3 pt-1 border-t border-gray-700/50" onClick={(e) => e.stopPropagation()}>
        <PostActionButton
          author={poll.author}
          permlink={poll.permlink}
          currentUser={currentUsername}
          hiveIconUrl="/images/hive_logo.png"
          initialVotes={[]}
          initialCommentsCount={0}
          onUpvote={onUpvote ? (percent) => onUpvote(poll.author, poll.permlink, percent) : undefined}
          onSubmitComment={onSubmitComment ? (pAuthor, pPermlink, body) => onSubmitComment(pAuthor, pPermlink, body) : undefined}
          onClickCommentUpvote={onClickCommentUpvote}
          onReblog={poll.author !== currentUsername && onReblog ? () => onReblog(poll.author, poll.permlink) : undefined}
          onShare={onSharePost ? () => onSharePost(poll.author, poll.permlink) : undefined}
          onTip={poll.author !== currentUsername && onTip ? () => onTip(poll.author, poll.permlink) : undefined}
          onReport={poll.author !== currentUsername && onRequestReportPost ? () => onRequestReportPost(poll.author, poll.permlink) : undefined}
          disableCommentsModal={!!onCommentClick}
          onComments={onCommentClick ? () => onCommentClick(poll.author, poll.permlink) : undefined}
          ecencyToken={ecencyToken}
          threeSpeakApiKey={threeSpeakApiKey}
          giphyApiKey={giphyApiKey}
          templateToken={templateToken}
          templateApiBaseUrl={templateApiBaseUrl}
        />
      </div>
    </div>
  );
};

export default PollListItem;
