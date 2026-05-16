/**
 * PollVoteWidget — compact poll renderer + voter used inside snap feed
 * cards. Mirrors the inline poll UI in HiveDetailPost: fetches the
 * current poll state from the hivehub polls API, lets the logged-in
 * user cast (or change) a vote, and shows live tallies. Designed for
 * embedding — drop it in wherever a post's json_metadata has
 * `content_type === 'poll'`.
 */
import { useEffect, useState } from 'react';
import { BarChart2, CheckCircle2, Circle, Send } from 'lucide-react';
import { userService } from '@/services/userService';
import type { Poll } from '@/types/poll';

export interface PollVoteWidgetProps {
  author: string;
  permlink: string;
  /** Logged-in user. When null/undefined the widget renders results
   *  only (no vote UI). */
  currentUser?: string;
  /** Consumer broadcasts the vote (custom_json id=`polls`). Return
   *  `false` to indicate cancellation so the widget keeps the
   *  selection. */
  onVotePoll?: (
    author: string,
    permlink: string,
    choiceNums: number[],
  ) => void | boolean | Promise<void | boolean>;
  /** Parsed `json_metadata` from the post — used as a fallback for the
   *  question/choices when the polls API hasn't indexed the poll yet. */
  parsedMetadata?: {
    question?: string;
    choices?: string[];
    end_time?: number;
    max_choices_voted?: number;
    allow_vote_changes?: boolean;
  } | null;
}

export function PollVoteWidget({
  author,
  permlink,
  currentUser,
  onVotePoll,
  parsedMetadata,
}: PollVoteWidgetProps) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChoices, setSelectedChoices] = useState<number[]>([]);
  const [votedChoices, setVotedChoices] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    userService
      .getPollDetail(author, permlink, ac.signal)
      .then((data) => setPoll(data ?? null))
      .catch(() => setPoll(null))
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [author, permlink]);

  const maxChoices: number =
    poll?.max_choices_voted ?? parsedMetadata?.max_choices_voted ?? 1;
  const isMulti = maxChoices > 1;
  const endTs = poll?.end_time
    ? new Date(poll.end_time).getTime()
    : (parsedMetadata?.end_time ?? 0) * 1000;
  const pollEnded = endTs > 0 && Date.now() > endTs;
  const hasVoted = votedChoices.length > 0;
  const apiVoter = currentUser
    ? poll?.poll_voters?.find((v) => v.name === currentUser)
    : undefined;
  const apiVotedChoices: number[] = apiVoter?.choices?.length
    ? apiVoter.choices
    : apiVoter?.choice_num != null
      ? [apiVoter.choice_num]
      : [];
  const alreadyVoted = hasVoted || apiVotedChoices.length > 0;
  const allowVoteChanges =
    poll?.allow_vote_changes ?? parsedMetadata?.allow_vote_changes ?? false;
  const displayVoted = hasVoted ? votedChoices : apiVotedChoices;
  const showVoteUI =
    !!currentUser && !pollEnded && !!onVotePoll && (!alreadyVoted || allowVoteChanges);
  const isChangingVote = alreadyVoted && allowVoteChanges && !hasVoted;
  const choices = poll?.poll_choices ?? (parsedMetadata?.choices ?? []).map(
    (text: string, i: number) => ({ choice_num: i + 1, choice_text: text, votes: null }),
  );
  const totalVotes = choices.reduce(
    (sum, c) => sum + (c.votes?.total_votes ?? 0),
    0,
  );
  const needsSubmitButton = isMulti || isChangingVote;

  const handleChoiceClick = async (choiceNum: number) => {
    if (!showVoteUI || submitting) return;
    if (!needsSubmitButton) {
      setSubmitting(true);
      try {
        const result = await Promise.resolve(
          onVotePoll?.(author, permlink, [choiceNum]),
        );
        if (result === false) return;
        setVotedChoices([choiceNum]);
      } finally {
        setSubmitting(false);
      }
    } else {
      setSelectedChoices((prev) => {
        if (prev.includes(choiceNum)) return prev.filter((n) => n !== choiceNum);
        if (prev.length >= maxChoices) return prev;
        return [...prev, choiceNum];
      });
    }
  };

  const handleSubmit = async () => {
    if (!showVoteUI || submitting || selectedChoices.length === 0) return;
    setSubmitting(true);
    try {
      const result = await Promise.resolve(
        onVotePoll?.(author, permlink, selectedChoices),
      );
      if (result === false) return;
      setVotedChoices(selectedChoices);
      setSelectedChoices([]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)]/60 overflow-hidden">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <BarChart2 className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-400">Poll</span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${pollEnded ? 'bg-[var(--hrk-bg-surface-raised)] text-[var(--hrk-text-tertiary)]' : 'bg-green-900/50 text-green-400'}`}
        >
          {pollEnded
            ? 'Ended'
            : endTs > 0
              ? `Ends in ${Math.ceil((endTs - Date.now()) / (1000 * 60 * 60 * 24))}d`
              : 'Active'}
        </span>
      </div>

      <p className="px-3 pb-2 text-sm font-semibold text-white">
        {poll?.question ?? parsedMetadata?.question ?? ''}
      </p>

      {showVoteUI && needsSubmitButton && (
        <p className="px-3 pb-1.5 text-[11px] text-[var(--hrk-text-tertiary)]">
          {isChangingVote ? 'Change your vote — ' : ''}Select up to {maxChoices} option
          {maxChoices > 1 ? 's' : ''}
          {selectedChoices.length > 0 && (
            <span className="ml-1 text-blue-400">· {selectedChoices.length} selected</span>
          )}
        </p>
      )}

      <div className="space-y-1.5 px-3 pb-3">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-[var(--hrk-bg-surface-raised)]/50" />
          ))
        ) : (
          choices.map((choice) => {
            const votes = choice.votes?.total_votes ?? 0;
            const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            const isVoted = displayVoted.includes(choice.choice_num);
            const isSelected = selectedChoices.includes(choice.choice_num);
            const isMaxed = needsSubmitButton && selectedChoices.length >= maxChoices && !isSelected;
            const isClickable = showVoteUI && !isMaxed;

            let borderColor = 'border-[var(--hrk-border-subtle)]';
            let iconEl = <Circle className="h-3 w-3 flex-shrink-0 text-[var(--hrk-text-tertiary)]" />;
            let fillColor = 'bg-blue-600/20';

            if (isSelected) {
              borderColor = 'border-blue-500/60';
              iconEl = <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-blue-400" />;
            } else if (isVoted && !isChangingVote) {
              borderColor = 'border-green-600/60';
              iconEl = <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-green-500" />;
              fillColor = 'bg-green-600/20';
            } else if (isVoted && isChangingVote) {
              borderColor = 'border-green-800/40';
              iconEl = <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-green-700" />;
              fillColor = 'bg-green-900/10';
            }

            return (
              <button
                type="button"
                key={choice.choice_num}
                onClick={(e) => {
                  e.stopPropagation();
                  handleChoiceClick(choice.choice_num);
                }}
                className={`relative w-full overflow-hidden rounded-md border bg-[var(--hrk-bg-app)]/50 text-left transition-colors ${borderColor} ${isClickable ? 'cursor-pointer hover:border-blue-500/40' : isMaxed ? 'cursor-not-allowed opacity-50' : 'cursor-default'}`}
                disabled={!isClickable}
              >
                {pct > 0 && (
                  <div
                    className={`absolute inset-y-0 left-0 ${fillColor} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                )}
                <div className="relative flex items-center justify-between gap-2 px-2.5 py-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {iconEl}
                    <span
                      className={`truncate text-xs ${isSelected ? 'font-medium text-blue-300' : isVoted && !isChangingVote ? 'font-medium text-green-300' : isVoted && isChangingVote ? 'text-green-700' : 'text-[var(--hrk-text-primary)]'}`}
                    >
                      {choice.choice_text}
                    </span>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5 text-[10px] text-[var(--hrk-text-tertiary)]">
                    <span>{pct}%</span>
                    <span className="text-[var(--hrk-text-tertiary)]">·</span>
                    <span>{votes} vote{votes !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {showVoteUI && needsSubmitButton && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSubmit();
            }}
            disabled={selectedChoices.length === 0 || submitting}
            className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[var(--hrk-brand)] px-3 py-1.5 text-xs font-medium text-[var(--hrk-text-on-brand)] transition-colors hover:bg-[var(--hrk-brand-hover)] disabled:bg-[var(--hrk-bg-surface-raised)] disabled:text-[var(--hrk-text-tertiary)]"
          >
            <Send className="h-3 w-3" />
            {submitting
              ? 'Submitting…'
              : isChangingVote
                ? 'Change Vote'
                : `Submit Vote${selectedChoices.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-[var(--hrk-border-subtle)]/50 px-3 py-2 text-[10px] text-[var(--hrk-text-tertiary)]">
        <span>
          {poll?.poll_stats?.total_voting_accounts_num ?? 0} voter
          {(poll?.poll_stats?.total_voting_accounts_num ?? 0) !== 1 ? 's' : ''} total
        </span>
        {alreadyVoted && (
          <span className="ml-auto text-green-500">
            ✓ Voted{allowVoteChanges ? ' · changes allowed' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

export default PollVoteWidget;
