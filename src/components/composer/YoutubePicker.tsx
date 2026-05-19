/**
 * YoutubePicker — search YouTube and pick a video to embed in a post.
 *
 * Mirrors GiphyPicker's shape: the composer renders it as a modal alongside
 * the other media pickers, hands in an API key, and gets back a URL through
 * `onSelectVideo`. The composer inserts that URL as plain text — Hive content
 * renderers turn a bare `https://www.youtube.com/watch?v=…` URL into an
 * embedded player on every major frontend.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Search, X, Play } from 'lucide-react';

interface YoutubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

export interface YoutubePickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the canonical watch URL of the selected video. */
  onSelectVideo: (videoUrl: string) => void;
  /** YouTube Data API v3 key. Required for search. */
  youtubeApiKey?: string;
}

const YoutubePicker: React.FC<YoutubePickerProps> = ({
  isOpen,
  onClose,
  onSelectVideo,
  youtubeApiKey,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [videos, setVideos] = useState<YoutubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setVideos([]);
      setError(null);
      setIsLoading(false);
      searchAbortRef.current?.abort();
    }
  }, [isOpen]);

  const searchVideos = async (query: string) => {
    if (!query.trim()) return;
    searchAbortRef.current?.abort();
    const abortController = new AbortController();
    searchAbortRef.current = abortController;
    setIsLoading(true);
    setError(null);
    try {
      if (!youtubeApiKey)
        throw new Error('YouTube API key not provided. Pass youtubeApiKey prop.');
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&type=video&safeSearch=moderate&q=${encodeURIComponent(query)}&key=${youtubeApiKey}`;
      const response = await fetch(url, { signal: abortController.signal });
      if (!response.ok) {
        // YouTube returns a JSON error envelope; surface the message when present.
        let detail = response.statusText;
        try {
          const body = await response.json();
          detail = body?.error?.message || detail;
        } catch {
          // ignore JSON parse failure — fall back to statusText
        }
        throw new Error(`Failed to search YouTube: ${detail}`);
      }
      const data = await response.json();
      const items: YoutubeVideo[] = (data.items || [])
        .filter((it: { id?: { videoId?: string } }) => it?.id?.videoId)
        .map((it: {
          id: { videoId: string };
          snippet: {
            title: string;
            channelTitle: string;
            thumbnails: { medium?: { url: string }; default?: { url: string }; high?: { url: string } };
          };
        }) => ({
          id: it.id.videoId,
          title: it.snippet.title,
          channelTitle: it.snippet.channelTitle,
          thumbnail:
            it.snippet.thumbnails.medium?.url ||
            it.snippet.thumbnails.high?.url ||
            it.snippet.thumbnails.default?.url ||
            '',
        }));
      setVideos(items);
    } catch (err) {
      if (abortController.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to search YouTube');
    } finally {
      if (!abortController.signal.aborted) setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchVideos(searchTerm);
  };

  const handleSelect = (video: YoutubeVideo) => {
    onSelectVideo(`https://www.youtube.com/watch?v=${video.id}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--hrk-bg-app)] border border-[var(--hrk-border-subtle)] rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--hrk-border-subtle)]">
          <h3 className="text-lg font-semibold text-white inline-flex items-center gap-2">
            <span className="inline-flex h-5 w-7 items-center justify-center rounded-sm bg-[#ff0000]">
              <Play className="h-3 w-3 fill-white text-white" />
            </span>
            Search YouTube
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-[var(--hrk-bg-surface)] rounded transition-colors text-[var(--hrk-text-tertiary)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          <form onSubmit={handleSearch} className="mb-4">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search YouTube videos..."
                className="flex-1 px-3 py-2 border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--hrk-info)] text-white placeholder-[var(--hrk-text-tertiary)]"
              />
              <button
                type="submit"
                disabled={isLoading || !searchTerm.trim()}
                className="px-4 py-2 bg-[var(--hrk-brand)] text-white rounded-lg hover:bg-[var(--hrk-brand-hover)] disabled:opacity-50 flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                Search
              </button>
            </div>
          </form>
          {error && <div className="text-[var(--hrk-danger)] text-sm mb-4">{error}</div>}
          {isLoading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto" />
              <p className="mt-2 text-[var(--hrk-text-tertiary)]">Searching YouTube...</p>
            </div>
          )}
          {videos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto">
              {videos.map((video) => (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => handleSelect(video)}
                  className="text-left rounded-lg overflow-hidden border border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] hover:border-[var(--hrk-info)] transition-colors group"
                >
                  <div className="relative aspect-video bg-black">
                    {video.thumbnail && (
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <div className="rounded-full bg-[#ff0000] p-3">
                        <Play className="h-5 w-5 fill-white text-white" />
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <div className="text-sm font-medium text-white line-clamp-2">{video.title}</div>
                    <div className="text-xs text-[var(--hrk-text-tertiary)] mt-0.5">
                      {video.channelTitle}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {!isLoading && videos.length === 0 && searchTerm && !error && (
            <div className="text-center py-8 text-[var(--hrk-text-tertiary)]">
              No videos found for &quot;{searchTerm}&quot;
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default YoutubePicker;
