import { useEffect, useState } from 'react';
import { apiService } from '@/services/apiService';
import { ThumbsUp, Loader2 } from 'lucide-react';

function formatTimeAgo(date: string | Date): string {
  const _date = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - _date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears}y ago`;
}

interface UpvoteListProps {
  author: string;
  permlink: string;
  currentUser?: string;
  token?: string;
  onClickUpvoteButton?: (currentUser?: string, token?: string) => void;
}

export function UpvoteList({
  author,
  permlink,
  currentUser,
  token,
  onClickUpvoteButton
}: UpvoteListProps) {
  const [votes, setVotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVotes();
  }, [author, permlink]);

  const fetchVotes = async () => {
    setLoading(true);
    try {
      const post = await apiService.getPostContent(author, permlink);
      if (post?.active_votes) {
        setVotes(post.active_votes);
      }
    } catch (err) {
      console.error('Failed to fetch votes:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (votes.length === 0) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 p-8">
        No votes yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {votes.map((vote, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
        >
          <div className="flex items-center space-x-3">
            <img
              src={`https://images.hive.blog/u/${vote.voter}/avatar`}
              alt={vote.voter}
              className="w-8 h-8 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${vote.voter}&background=random&size=32`;
              }}
            />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">@{vote.voter}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {Math.round(vote.percent / 100)}%
              </p>
            </div>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {formatTimeAgo(vote.time + "Z")}
          </div>
        </div>
      ))}
    </div>
  );
}
