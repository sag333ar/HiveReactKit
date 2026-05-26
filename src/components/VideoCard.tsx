import { useEffect, useState } from "react";
import { VideoFeedItem } from "@/types/video";
import { ThumbsUp, MessageCircle, Clock, Play } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiService } from "@/services/apiService";
import { formatThumbnailUrl } from "@/utils/thumbnail";
import { RewardsModal } from "@/components/RewardsModal";
import type { RewardsModalPayoutDetails } from "@/components/RewardsModal";
import { getHiveClient } from "@/config/hiveEndpoint";
import { MoreActionsMenu } from "./actionButtons/MoreActionsMenu";

interface VideoCardProps {
  video: VideoFeedItem;
  onVideoClick: (video: VideoFeedItem) => void;
  onAuthorClick: (author: string) => void;
  isGrid?: boolean;
  /** Toggle bookmark on the video. Surfaces a small 3-dot kebab on
   *  the card with a Bookmark item. Consumer decides add vs remove
   *  based on `isBookmarked`. */
  onToggleBookmark?: (author: string, permlink: string) => void;
  /** Read flag — controls filled vs outline state of the Bookmark
   *  item inside the kebab. */
  isBookmarked?: boolean;
}

const VideoCard = ({
  video,
  onVideoClick,
  onAuthorClick,
  isGrid = false,
  onToggleBookmark,
  isBookmarked = false,
}: VideoCardProps) => {
  const [stats, setStats] = useState({
    numOfUpvotes: video.numOfUpvotes,
    numOfComments: video.numOfComments,
    hiveValue: video.hiveValue,
  });
  // Rewards popup state — payout details are fetched lazily on click
  // because the video feed item only carries the headline value, not
  // the structured payout/beneficiary fields the modal needs.
  const [showRewards, setShowRewards] = useState(false);
  const [rewardsDetails, setRewardsDetails] = useState<RewardsModalPayoutDetails | null>(null);
  const [rewardsLoading, setRewardsLoading] = useState(false);

  const openRewards = async () => {
    setShowRewards(true);
    if (rewardsDetails || rewardsLoading) return;
    if (!video.author || !video.permlink) return;
    setRewardsLoading(true);
    try {
      const result: any = await getHiveClient().call(
        "condenser_api",
        "get_content",
        [video.author, video.permlink],
      );
      const parseDollar = (v?: string) =>
        parseFloat(String(v ?? "").replace(/[^\d.]/g, "")) || 0;
      const pendingValue = parseDollar(result?.pending_payout_value);
      const authorValue = parseDollar(result?.author_payout_value);
      const curatorValue = parseDollar(result?.curator_payout_value);
      const isPaidout = !!result?.last_payout && result.last_payout !== "1970-01-01T00:00:00";
      const totalValue = pendingValue > 0 ? pendingValue : authorValue + curatorValue;
      setRewardsDetails({
        pendingValue,
        authorValue,
        curatorValue,
        totalValue,
        isPaidout,
        payoutAt: result?.cashout_time && result.cashout_time !== "1969-12-31T23:59:59"
          ? result.cashout_time
          : undefined,
        percentHbd: result?.percent_hbd ?? 10000,
        beneficiaries: Array.isArray(result?.beneficiaries)
          ? result.beneficiaries.map((b: { account: string; weight: number }) => ({
              account: b.account,
              weight: b.weight,
            }))
          : [],
      });
    } catch {
      // leave details null — modal will render with empty data
    } finally {
      setRewardsLoading(false);
    }
  };

  // Fetch real stats in background if not provided
  useEffect(() => {
    // Only fetch stats if not already provided from GraphQL
    if (stats.numOfUpvotes === undefined && video.numOfUpvotes === undefined) {
      let isMounted = true;
      (async () => {
        try {
          const res = await apiService.getContentStats(
            video.author || "",
            video.permlink || ""
          );
          if (isMounted) {
            setStats(res);
          }
        } catch (e) {
          console.error("Error fetching content stats for VideoCard:", e);
        }
      })();
      return () => {
        isMounted = false;
      };
    } else if (video.numOfUpvotes !== undefined) {
      // Use stats from GraphQL response
      setStats({
        numOfUpvotes: video.numOfUpvotes,
        numOfComments: video.numOfComments || 0,
        hiveValue: video.hiveValue || 0,
      });
    }
  }, [video.author, video.permlink, stats.numOfUpvotes, video.numOfUpvotes, video.numOfComments, video.hiveValue]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "00:00";
    const totalSeconds = Math.floor(seconds);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (num: number) => num.toString().padStart(2, "0");

    if (totalSeconds < 60) return `00:${pad(secs)}`;
    if (hrs === 0) return `${pad(mins)}:${pad(secs)}`;
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  };

  const formatNumber = (num?: number) => {
    if (num == null) return "";
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="group bg-card border border-border rounded-xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-1 cursor-pointer">
      {/* Thumbnail */}
      <div
        className="relative aspect-video bg-muted overflow-hidden"
        onClick={() => onVideoClick(video)}
      >
        <img
          src={formatThumbnailUrl(video.thumbnail)}
          alt={video.title}
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://images.hive.blog/u/${video.author}/avatar`;
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Duration overlay */}
        {video.duration && (
          <div className="absolute bottom-3 right-3 bg-black/80 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-sm">
            <Clock className="w-3 h-3" />
            {formatDuration(video.duration)}
          </div>
        )}

        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/20">
          <div className="bg-primary hover:bg-primary-hover rounded-full p-4 transform scale-75 group-hover:scale-100 transition-all duration-300 shadow-lg">
            <Play className="w-6 h-6 text-primary-foreground ml-0.5" fill="currentColor" />
          </div>
        </div>

        {/* Gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-overlay opacity-0 group-hover:opacity-30 transition-opacity duration-300" />
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <h3
          className="font-semibold text-card-foreground line-clamp-2 group-hover:text-primary transition-colors cursor-pointer leading-tight"
          onClick={() => onVideoClick(video)}
        >
          {video.title}
        </h3>

        {/* Author Row with CreatedAt */}
        <div className="flex items-center justify-between">
          {/* Author */}
          <div
            className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors group/author"
            onClick={() => onAuthorClick(video.author)}
          >
            <img
              src={`https://images.hive.blog/u/${video.author}/avatar`}
              alt={video.author}
              className="w-8 h-8 rounded-full object-cover border-2 border-border group-hover/author:border-primary transition-colors"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://images.hive.blog/u/null/avatar`;
              }}
            />
            <span className="font-medium text-sm text-muted-foreground group-hover/author:text-primary transition-colors">
              @{video.author}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Created At */}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(video.created, { addSuffix: true })}
            </span>

            {/* 3-dot kebab — bookmark toggle. Stop propagation so
                opening the menu doesn't also fire the video click. */}
            {onToggleBookmark && (
              <div onClick={(e) => e.stopPropagation()}>
                <MoreActionsMenu
                  onToggleBookmark={() => onToggleBookmark(video.author, video.permlink)}
                  isBookmarked={isBookmarked}
                  ariaLabel="More video actions"
                  buttonClassName="text-muted-foreground hover:text-primary transition-colors p-0.5"
                />
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            {stats.numOfUpvotes != null && (
              <div className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                <ThumbsUp className="w-4 h-4" />
                <span>{formatNumber(stats.numOfUpvotes)}</span>
              </div>
            )}
            {stats.numOfComments != null && (
              <div className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                <MessageCircle className="w-4 h-4" />
                <span>{formatNumber(stats.numOfComments)}</span>
              </div>
            )}
          </div>

          {stats.hiveValue != null && stats.hiveValue > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openRewards(); }}
              className="text-primary font-semibold rounded-md px-1 py-0.5 transition-colors hover:bg-white/5"
              aria-label="Show rewards breakdown"
            >
              {stats.hiveValue.toFixed(2)}
            </button>
          )}
        </div>

        {/* Category */}
        {video.category && (
          <div className="flex items-center gap-2">
            <span className="inline-block bg-primary/10 text-primary text-xs px-2 py-1 rounded-full font-medium">
              {video.category}
            </span>
          </div>
        )}
      </div>

      {showRewards && (
        <RewardsModal
          onClose={() => setShowRewards(false)}
          details={rewardsDetails ?? {
            pendingValue: stats.hiveValue ?? 0,
            authorValue: 0,
            curatorValue: 0,
            totalValue: stats.hiveValue ?? 0,
            isPaidout: false,
            percentHbd: 10000,
            beneficiaries: [],
          }}
        />
      )}
    </div>
  );
};

export default VideoCard;