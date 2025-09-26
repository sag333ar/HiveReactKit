import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ThreeSpeakVideo, ApiVideoFeedType, VideoFeedItem } from "@/types/video";
import { apiService } from "@/services/apiService";
import { ArrowLeft, Clock, Eye, Play } from "lucide-react";
import VideoInfo from "@/components/VideoInfo";
import VideoFeed from "@/components/VideoFeed";
import CommentsModal from "@/components/modals/CommentsModal";
import UpvoteListModal from "@/components/modals/UpvoteListModal";
import DescriptionModal from "@/components/modals/DescriptionModal";
import Hls from "hls.js";
import { formatThumbnailUrl } from "@/utils/thumbnail";

const VideoDetail = () => {
  const { author, permlink } = useParams<{
    author: string;
    permlink: string;
  }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<ThreeSpeakVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showUpvotes, setShowUpvotes] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const fullscreenListenerRef = useRef<(() => void) | null>(null);

  // Fetch video details when route changes
  useEffect(() => {
    const fetchVideo = async () => {
      if (!author || !permlink) return;
      try {
        setLoading(true);
        setError(null);
        const videoData = await apiService.getVideoDetails(author, permlink);
        setVideo(videoData);
        setIsPlaying(false);
        setVideoError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load video");
      } finally {
        setLoading(false);
      }
    };
    fetchVideo();
  }, [author, permlink]);

  // Enhanced IPFS URL resolution matching Flutter logic
  const resolveIpfsUrl = (url: string): string => {
    if (!url) return "";

    if (url.startsWith("ipfs://")) {
      const hash = url.replace("ipfs://", "").split("/")[0];
      return `https://ipfs-3speak.b-cdn.net/ipfs/${hash}/manifest.m3u8`;
    }
    return url;
  };

  useEffect(() => {
    const setupVideo = async () => {
      const videoSource = video?.video_v2;

      if (!isPlaying || !videoSource || !videoRef.current) return;

      const videoElement = videoRef.current;
      const videoURL = resolveIpfsUrl(videoSource);

      // Clean up previous HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Reset video element
      videoElement.src = "";
      videoElement.load();

      try {
        let hasAttemptedPlay = false;
        const attemptPlay = () => {
          if (hasAttemptedPlay) return;
          hasAttemptedPlay = true;
          videoElement
            .play()
            .then(() => setVideoError(null))
            .catch((err) => setVideoError(`Playback failed: ${err.message}`));
        };

        if (Hls.isSupported()) {
          const hls = new Hls({
            debug: false,
            enableWorker: false,
            lowLatencyMode: false,
            backBufferLength: 90,
            maxLoadingDelay: 4,
            maxBufferLength: 30,
            maxMaxBufferLength: 600,
            startLevel: -1,
          });

          hlsRef.current = hls;

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            /* no-op */
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  setVideoError("Network error, retrying...");
                  setTimeout(() => hls.startLoad(), 1000);
                  break;

                case Hls.ErrorTypes.MEDIA_ERROR:
                  setVideoError("Media error, retrying...");
                  setTimeout(() => hls.recoverMediaError(), 1000);
                  break;

                default:
                  setVideoError(`Fatal error: ${data.details}`);
                  hls.destroy();
                  hlsRef.current = null;
                  break;
              }
            }
          });

          hls.attachMedia(videoElement);
          hls.loadSource(videoURL);
        } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
          // Native HLS (Safari)
          videoElement.src = videoURL;
        } else {
          // Fallback
          const fallbackUrl = videoURL.replace(
            "/manifest.m3u8",
            "/480p/index.m3u8"
          );
          videoElement.src = fallbackUrl;
        }

        // Video element listeners
        const handleLoadStart = () => setVideoLoading(true);
        const handleCanPlay = () => {
          setVideoLoading(false);
          attemptPlay();
        };
        const handleError = (e: Event) => {
          const target = e.target as HTMLVideoElement;
          setVideoError(
            `Video error: ${target.error?.message || "Unknown error"}`
          );
          setVideoLoading(false);
        };
        const handleLoadedData = () => setVideoLoading(false);

        videoElement.addEventListener("loadstart", handleLoadStart);
        videoElement.addEventListener("canplay", handleCanPlay);
        videoElement.addEventListener("error", handleError);
        videoElement.addEventListener("loadeddata", handleLoadedData);

        // Handle orientation when entering/exiting fullscreen
        const handleFullscreenChange = async () => {
          const isFullscreen = !!document.fullscreenElement;
          try {
            if (isFullscreen) {
              if ('orientation' in screen) {
                const anyScreen = screen as unknown as { orientation?: { lock?: (s: string) => Promise<void> } };
                await (anyScreen.orientation?.lock?.('landscape') ?? Promise.resolve());
              }
            } else {
              if ('orientation' in screen) {
                const anyScreen = screen as unknown as { orientation?: { unlock?: () => void } };
                anyScreen.orientation?.unlock?.();
              }
            }
          } catch (_e) {
            // Ignore if not supported / user gesture requirement not met
          }
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        fullscreenListenerRef.current = () => {
          document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };

        return () => {
          videoElement.removeEventListener("loadstart", handleLoadStart);
          videoElement.removeEventListener("canplay", handleCanPlay);
          videoElement.removeEventListener("error", handleError);
          videoElement.removeEventListener("loadeddata", handleLoadedData);
          if (fullscreenListenerRef.current) fullscreenListenerRef.current();
        };
      } catch (error) {
        setVideoError(
          `Setup error: ${error instanceof Error ? error.message : "Unknown"}`
        );
      }
    };

    setupVideo();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isPlaying, video?.video_v2]);

  const handlePlayClick = () => {
    const videoSource = video?.video_v2;
    if (!videoSource) {
      setVideoError("No video source available");
      return;
    }
    setIsPlaying(true);
    setVideoError(null);
    setVideoLoading(true);
  };

  const handleVideoClick = (clickedVideo: VideoFeedItem) => {
    navigate(`/video/${clickedVideo.author}/${clickedVideo.permlink}`);
  };

  const handleAuthorClick = (authorName: string) => {
    navigate(`/user/${authorName}`);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "00:00";

    const totalSeconds = Math.floor(seconds);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (num: number) => num.toString().padStart(2, "0");

    if (totalSeconds < 60) {
      return `00:${pad(secs)}`;
    }
    if (hrs === 0) {
      return `${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Sticky back header skeleton */}
        <div className="sticky top-0 z-50 w-full bg-background border-b border-border">
          <div className="container mx-auto px-4 py-3">
            <div className="h-8 w-24 bg-muted rounded-full animate-pulse" />
          </div>
        </div>

        {/* Main skeleton */}
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="animate-pulse space-y-6">
            <div className="aspect-video bg-muted rounded-xl"></div>
            <div className="space-y-3">
              <div className="h-6 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <h2 className="text-xl font-semibold text-card-foreground mb-2">
            Failed to Load Video
          </h2>
          <p className="text-muted-foreground mb-4">
            {error || "Video not found"}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border text-card-foreground rounded-lg hover:bg-card-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky back header */}
      <div className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-card-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main video section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player */}
            <div className="w-full aspect-video bg-black rounded-xl overflow-hidden relative shadow-card">
              {!isPlaying ? (
                <>
                  <img
                    src={
                      formatThumbnailUrl(video.thumbnail) ||
                      `https://images.hive.blog/u/${video.owner}/avatar`
                    }
                    alt={video.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://images.hive.blog/u/${video.owner}/avatar`;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-overlay opacity-30" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      onClick={handlePlayClick}
                      className="bg-primary hover:bg-primary-hover rounded-full p-6 transform hover:scale-110 transition-all duration-300 shadow-lg"
                    >
                      <Play className="w-8 h-8 text-primary-foreground ml-1" fill="currentColor" />
                    </button>
                  </div>

                  {/* Duration badge on thumbnail */}
                  {video.duration && (
                    <div className="absolute bottom-4 right-4 bg-black/80 text-white text-sm px-3 py-1 rounded-md flex items-center gap-1 backdrop-blur-sm">
                      <Clock className="w-3 h-3" />
                      {formatDuration(video.duration)}
                    </div>
                  )}

                  {/* Views badge */}
                  {video.views && (
                    <div className="absolute bottom-4 left-4 bg-black/80 text-white text-sm px-3 py-1 rounded-md flex items-center gap-1 backdrop-blur-sm">
                      <Eye className="w-3 h-3" />
                      {video.views.toLocaleString()} views
                    </div>
                  )}
                </>
              ) : (
                <div className="relative w-full h-full">
                  <video
                    ref={videoRef}
                    controls
                    poster={formatThumbnailUrl(video.thumbnail)}
                    className="w-full h-full object-contain bg-black"
                    onDoubleClick={async (e) => {
                      const el = e.currentTarget;
                      try {
                        if (!document.fullscreenElement) {
                          await el.requestFullscreen();
                        } else {
                          await document.exitFullscreen();
                        }
                      } catch (_e) { /* empty */ }
                    }}
                  />

                  {videoLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                  )}

                  {videoError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                      <div className="text-center text-white">
                        <p className="mb-4">{videoError}</p>
                        <button
                          onClick={() => {
                            setIsPlaying(false);
                            setVideoError(null);
                          }}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Video Info */}
            <VideoInfo
              title={video.title || ""}
              author={video.owner || ""}
              permlink={video.permlink || ""}
              createdAt={video.created}
              description={video.description || ""}
              video={{
                title: video.title || "",
                author: video.owner || "",
                permlink: video.permlink || "",
                created: video.created || new Date(),
                category: video.category || "",
                numOfUpvotes: undefined,
                numOfComments: undefined,
                hiveValue: undefined,
                duration: video.duration,
                thumbnail: video.thumbnail,
                views: video.views,
              }}
              onTapComment={() => setShowComments(true)}
              onTapUpvote={() => setShowUpvotes(true)}
              onTapInfo={() => setShowDescription(true)}
              onTapAuthor={() => navigate(`/user/${video.owner}`)}
            />

            {/* Tags */}
            {video.tags && (
              <div className="flex flex-wrap gap-2">
                {video.tags.split(",").map((tag, index) => (
                  <span
                    key={index}
                    className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium hover:bg-primary/20 transition-colors cursor-pointer"
                    onClick={() => navigate(`/tag/${tag.trim()}`)}
                  >
                    #{tag.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar - Related Videos */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-xl p-6 sticky top-24">
              <h3 className="font-semibold text-card-foreground mb-4 text-lg">
                Related Videos
              </h3>
              <div className="space-y-4">
                <VideoFeed
                  feedType={ApiVideoFeedType.RELATED}
                  username={video.owner}
                  onVideoClick={handleVideoClick}
                  onAuthorClick={handleAuthorClick}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showComments && author && permlink && (
        <CommentsModal
          author={author}
          permlink={permlink}
          onClose={() => setShowComments(false)}
        />
      )}

      {showUpvotes && author && permlink && (
        <UpvoteListModal
          author={author}
          permlink={permlink}
          onClose={() => setShowUpvotes(false)}
        />
      )}

      {showDescription && author && permlink && (
        <DescriptionModal
          author={author}
          permlink={permlink}
          content={video.description || ""}
          onClose={() => setShowDescription(false)}
        />
      )}
    </div>
  );
};

export default VideoDetail;