import { useEffect, useState } from "react";
import { VideoFeedItem } from "@/types/video";
import { ThumbsUp, MessageCircle, Clock, Play } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiService } from "@/services/apiService";
import { formatThumbnailUrl } from "@/utils/thumbnail";

interface VideoCardProps {
  video: VideoFeedItem;
  onVideoClick: (video: VideoFeedItem) => void;
  onAuthorClick: (author: string) => void;
  isGrid?: boolean;
}

const VideoCard = ({
  video,
  onVideoClick,
  onAuthorClick,
  isGrid = false,
}: VideoCardProps) => {
  const [stats, setStats] = useState({
    numOfUpvotes: video.numOfUpvotes,
    numOfComments: video.numOfComments,
    hiveValue: video.hiveValue,
  });

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

          {/* Created At */}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(video.created, { addSuffix: true })}
          </span>
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
            <div className="text-primary font-semibold">
              ${stats.hiveValue.toFixed(2)}
            </div>
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
    </div>
  );
};

export default VideoCard;