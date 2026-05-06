/**
 * UpvoteListModal — opens from a post's "upvote count" pill and
 * shows every voter on the post with the share of the Hive reward
 * each one earned.
 *
 * Layout (modelled on PeakD's "Votes (Hive Rewards)" dialog):
 *   • Header     : title + total vote count + sort + close
 *   • Breakdown  : stacked bar showing each voter's value share
 *   • Voter grid : 1 / 2 / 3-column responsive list with avatar,
 *                  username, reputation pill, value, vote weight %,
 *                  time ago
 *
 * The kit fetches both the active votes and the post itself so it
 * can derive per-voter Hive value and curation reward without the
 * consumer having to thread additional data through.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ThumbsUp, X } from "lucide-react";
import { apiService } from "@/services/apiService";
import { ActiveVote } from "@/types/video";
import type { Post } from "@/types/post";
import { VoteSlider } from "./VoteSlider";
import { toast } from "@/hooks";

interface UpvoteListModalProps {
  author: string;
  permlink: string;
  onClose: () => void;
  currentUser?: string;
  token?: string;
  onClickUpvoteButton?: (currentUser?: string, token?: string) => void;
  /** URL for the small Hive icon shown next to each voter's reward
   *  amount. Consumers usually pass a local asset (e.g. the bundled
   *  hivesuite hive_logo.png) so the icon stays sharp on retina and
   *  works offline; falls back to the official Hive logo from
   *  hive.io otherwise. */
  hiveIconUrl?: string;
}

type SortMode = "value" | "voter" | "newest" | "oldest" | "curation";

export function formatTimeAgo(date: string | Date): string {
  // Hive timestamps are UTC without a `Z` suffix; tag them so the
  // browser doesn't interpret them as local time and skew the label.
  const raw = typeof date === "string"
    ? /Z|[+-]\d{2}:?\d{2}$/.test(date)
      ? date
      : `${date}Z`
    : date;
  const _date = typeof raw === "string" ? new Date(raw) : raw;
  const seconds = Math.floor((Date.now() - _date.getTime()) / 1000);
  const intervals: Record<string, number> = {
    year: 31536000,
    month: 2628000,
    day: 86400,
    hour: 3600,
    minute: 60,
  };
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval > 1) return `${interval} ${unit}s ago`;
    if (interval === 1) return `${interval} ${unit} ago`;
  }
  return "just now";
}

/** Convert raw Hive reputation (huge int) to the familiar 25-100 score.
 *  Returns the input rounded if it's already in that range so the
 *  function is safe to call against either form. */
function formatReputation(rep: number | undefined): string {
  if (!rep || rep === 0) return "25";
  const neg = rep < 0;
  const val = Math.abs(rep);
  if (val < 1000) return Math.floor(val).toString();
  let out = Math.log10(val);
  out = Math.max(out - 9, 0);
  return ((neg ? -1 : 1) * out * 9 + 25).toFixed(0);
}

/** Parse "1.234 HBD" / "0.000 HBD" into a number. */
function parseAsset(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Fixed colour cycle for the stacked breakdown bar — matches the
 *  reference's "rainbow distribution" feel. Cycles when the post has
 *  more voters than colours. */
const SLICE_COLORS = [
  "#e31337",
  "#f59e0b",
  "#facc15",
  "#22c55e",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
];

const SORT_LABELS: Record<SortMode, string> = {
  value: "Vote Value",
  voter: "Voter",
  newest: "Newest",
  oldest: "Oldest",
  curation: "Curation Rewards",
};

const UpvoteListModal = ({
  author,
  permlink,
  onClose,
  currentUser,
  token,
  onClickUpvoteButton,
  hiveIconUrl,
}: UpvoteListModalProps) => {
  // Use the consumer-supplied icon when available, otherwise fall back
  // to the official Hive logo CDN so the row never shows a broken
  // image even when no icon is wired through.
  const resolvedHiveIcon =
    hiveIconUrl && hiveIconUrl.length > 0
      ? hiveIconUrl
      : "https://hive.io/images/hive-logo.png";
  const [votes, setVotes] = useState<ActiveVote[]>([]);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [showVoteSlider, setShowVoteSlider] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sort, setSort] = useState<SortMode>("value");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const hasAlreadyVoted =
    !!currentUser && votes.some((v) => v.voter === currentUser);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastOpen(true);
    setTimeout(() => setToastOpen(false), 2500);
  };

  const refreshVotes = async () => {
    setLoading(true);
    // Pull active votes + post payload in parallel — the post gives us
    // the payout pool needed to translate each voter's rshares into a
    // Hive reward number.
    const [fetchedVotes, fetchedPost] = await Promise.all([
      apiService.getActiveVotes(author, permlink),
      apiService.getPostContent(author, permlink),
    ]);
    setVotes(fetchedVotes);
    setPost(fetchedPost);
    setLoading(false);
  };

  useEffect(() => {
    refreshVotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author, permlink]);

  // ── Reward derivations ─────────────────────────────────────────────
  // Total payout drives the per-voter Hive reward; total rshares /
  // total weight drive the share split. Pending posts use
  // pending_payout_value; paid-out posts add author + curator payouts
  // so historical posts still show meaningful numbers.
  const { totalPayout, totalCurationPool } = useMemo(() => {
    if (!post) return { totalPayout: 0, totalCurationPool: 0 };
    const pending = parseAsset(
      (post as unknown as { pending_payout_value?: string }).pending_payout_value,
    );
    const author = parseAsset(
      (post as unknown as { author_payout_value?: string }).author_payout_value,
    );
    const curator = parseAsset(
      (post as unknown as { curator_payout_value?: string }).curator_payout_value,
    );
    const total =
      pending > 0 ? pending : author + curator;
    // Hive splits payout 50/50 between author and curators by default,
    // so the curation pool is half the total for pending posts. Paid-
    // out posts can use the canonical curator_payout_value directly.
    const curationPool = curator > 0 ? curator : total / 2;
    return { totalPayout: total, totalCurationPool: curationPool };
  }, [post]);

  const totalRshares = useMemo(
    () =>
      votes.reduce(
        (sum, v) => sum + Math.max(0, Number(v.rshares) || 0),
        0,
      ),
    [votes],
  );
  const totalWeight = useMemo(
    () =>
      votes.reduce(
        (sum, v) => sum + Math.max(0, Number(v.weight) || 0),
        0,
      ),
    [votes],
  );

  const enrichedVotes = useMemo(() => {
    return votes.map((vote) => {
      const rshares = Math.max(0, Number(vote.rshares) || 0);
      const weight = Math.max(0, Number(vote.weight) || 0);
      const value =
        totalRshares > 0 ? (rshares / totalRshares) * totalPayout : 0;
      const curation =
        totalWeight > 0 ? (weight / totalWeight) * totalCurationPool : 0;
      return { ...vote, value, curation };
    });
  }, [votes, totalRshares, totalWeight, totalPayout, totalCurationPool]);

  const sortedVotes = useMemo(() => {
    const list = enrichedVotes.slice();
    list.sort((a, b) => {
      switch (sort) {
        case "value":
          return b.value - a.value;
        case "voter":
          return a.voter.localeCompare(b.voter);
        case "newest":
          return new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime();
        case "oldest":
          return new Date(a.time ?? 0).getTime() - new Date(b.time ?? 0).getTime();
        case "curation":
          return b.curation - a.curation;
      }
      return 0;
    });
    return list;
  }, [enrichedVotes, sort]);

  // Top N slices for the breakdown bar; everything else collapses
  // into a final grey "rest" segment so the chart stays legible on a
  // post with hundreds of voters.
  const breakdownSegments = useMemo(() => {
    if (totalPayout <= 0) return [] as { color: string; widthPct: number; voter: string }[];
    const byValue = enrichedVotes
      .slice()
      .sort((a, b) => b.value - a.value);
    const TOP = 9;
    const top = byValue.slice(0, TOP);
    const rest = byValue.slice(TOP);
    const segs = top.map((v, i) => ({
      color: SLICE_COLORS[i % SLICE_COLORS.length],
      widthPct: (v.value / totalPayout) * 100,
      voter: v.voter,
    }));
    if (rest.length > 0) {
      const restSum = rest.reduce((s, v) => s + v.value, 0);
      segs.push({
        color: "#4b5563",
        widthPct: (restSum / totalPayout) * 100,
        voter: `+${rest.length} more`,
      });
    }
    return segs;
  }, [enrichedVotes, totalPayout]);

  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleUpvote = async (percent: number) => {
    if (!token || !currentUser) {
      alert("Please login to upvote");
      return;
    }
    try {
      const weight = Math.round(percent * 100);
      await apiService.handleUpvote({ author, permlink, weight, authToken: token });
      setShowVoteSlider(false);
      setIsRefreshing(true);
      setTimeout(async () => {
        await refreshVotes();
        setIsRefreshing(false);
        showToast("Vote submitted successfully ✅");
        onClose();
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upvote";
      toast({ title: "Error", description: message });
      setIsRefreshing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-3 sm:px-4 h-screen"
      onClick={onOverlayClick}
    >
      <div className="relative bg-[#1f2429] rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-[#3a424a]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#3a424a] bg-[#1a1e22]/80 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-white truncate">
              Votes (Hive Rewards)
            </h2>
            {isRefreshing && (
              <span className="inline-flex items-center" aria-label="Refreshing">
                <span className="w-3.5 h-3.5 border-2 border-[#e31337] border-t-transparent rounded-full animate-spin" />
              </span>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#3a424a] bg-[#262b30] px-2.5 py-1 text-xs font-medium text-[#e7e7f1] hover:bg-[#2f353d]"
              aria-haspopup="menu"
              aria-expanded={sortMenuOpen}
            >
              <span className="hidden sm:inline">{SORT_LABELS[sort].toUpperCase()}</span>
              <span className="sm:hidden">SORT</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {sortMenuOpen && (
              <ul
                role="menu"
                className="absolute right-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-md border border-[#3a424a] bg-[#1f2429] shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                  <li key={mode}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSort(mode);
                        setSortMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-[#2f353d] ${
                        sort === mode ? "text-[#e31337]" : "text-[#e7e7f1]"
                      }`}
                    >
                      {SORT_LABELS[mode]}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!showVoteSlider && (
            <button
              onClick={() => {
                if (onClickUpvoteButton) {
                  onClickUpvoteButton(currentUser, token);
                  return;
                }
                if (!currentUser || !token) {
                  showToast("Please login to upvote");
                  return;
                }
                if (hasAlreadyVoted) {
                  showToast("You have already upvoted this post");
                } else {
                  setShowVoteSlider(true);
                }
              }}
              aria-label="Upvote this post"
              className="rounded p-1 hover:bg-[#2f353d]"
              type="button"
            >
              <ThumbsUp
                className={`w-4 h-4 ${
                  hasAlreadyVoted
                    ? "text-[#e31337] fill-current"
                    : "text-gray-300"
                }`}
              />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 hover:bg-[#2f353d]"
          >
            <X className="w-4 h-4 text-gray-300" />
          </button>
        </div>

        {/* Breakdown */}
        {!loading && !showVoteSlider && votes.length > 0 && (
          <div className="border-b border-[#3a424a] bg-[#1a1e22]/40 px-4 py-3 sm:px-5">
            <p className="text-xs text-[#9ca3b0] mb-1.5">
              Breakdown for {votes.length} {votes.length === 1 ? "vote" : "votes"}
            </p>
            <div
              className="flex h-2.5 w-full overflow-hidden rounded-md bg-[#262b30]"
              role="img"
              aria-label="Vote value distribution"
            >
              {breakdownSegments.map((seg, i) => (
                <span
                  key={`${seg.voter}-${i}`}
                  title={`${seg.voter} · ${seg.widthPct.toFixed(1)}%`}
                  style={{
                    width: `${seg.widthPct}%`,
                    backgroundColor: seg.color,
                  }}
                  className="h-full"
                />
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
          {loading ? (
            <div className="flex justify-center items-center h-full p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#e31337]" />
            </div>
          ) : showVoteSlider && !hasAlreadyVoted ? (
            <VoteSlider
              author={author}
              permlink={permlink}
              onUpvote={handleUpvote}
              onCancel={() => setShowVoteSlider(false)}
            />
          ) : votes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-[#9ca3b0]">
              No votes yet.
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {sortedVotes.map((vote) => {
                const percent = Math.round((vote.percent ?? 0) / 100);
                const valueShown =
                  sort === "curation" ? vote.curation : vote.value;
                return (
                  <li
                    key={vote.voter}
                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-[#262b30]"
                  >
                    <img
                      src={`https://images.hive.blog/u/${vote.voter}/avatar`}
                      alt={vote.voter}
                      className="w-9 h-9 rounded-full bg-gray-700 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${vote.voter}&background=random`;
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      {/* Top row: username (truncates), reputation
                          pill, then the reward value pinned to the
                          right. The value column is `shrink-0` so it
                          can never be squeezed off-screen by a long
                          username — the username's `truncate` does
                          the eliding instead. */}
                      <div className="flex items-center gap-1.5 text-sm min-w-0">
                        <span className="min-w-0 flex-1 truncate text-white">
                          {vote.voter}
                        </span>
                        <span className="shrink-0 rounded bg-[#262b30] px-1.5 py-0.5 text-[10px] font-medium text-[#9ca3b0]">
                          {formatReputation(vote.reputation)}
                        </span>
                        <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-[#22c55e]">
                          {valueShown.toFixed(3)}
                          <img
                            src={resolvedHiveIcon}
                            alt=""
                            className="h-3.5 w-3.5 object-contain"
                            aria-hidden
                          />
                        </span>
                      </div>
                      <div className="text-[11px] text-[#9ca3b0]">
                        {percent}%
                        {/* Append a literal `Z` to the timestamp so it
                            parses as UTC. condenser_api.get_active_votes
                            returns `time` without a timezone suffix —
                            without this the label drifts by the user's
                            timezone offset (mirrors what UpvoteList and
                            ListOfWitnesses do at their call sites). */}
                        {vote.time && ` · ${formatTimeAgo(vote.time + "Z")}`}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {toastOpen && (
        <div className="fixed bottom-4 right-4 w-[280px] z-50">
          <div className="bg-[#1f2429] border border-[#3a424a] text-white rounded px-3 py-2 shadow-lg text-sm">
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
};

export default UpvoteListModal;
