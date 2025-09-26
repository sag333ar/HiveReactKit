import { useState, useEffect } from "react";
import { apiService } from "@/services/apiService";
import { ActiveVote } from "@/types/video";
import Modal from "./Modal";
import { ThumbsUp, Loader2 } from "lucide-react";

interface UpvoteListModalProps {
  author: string;
  permlink: string;
  onClose: () => void;
}

const UpvoteListModal = ({ author, permlink, onClose }: UpvoteListModalProps) => {
  const [votes, setVotes] = useState<ActiveVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVotes = async () => {
      try {
        setLoading(true);
        const activeVotes = await apiService.getActiveVotes(author, permlink);
        // Sort by rshares (influence) descending
        const sortedVotes = activeVotes.sort((a, b) => b.rshares - a.rshares);
        setVotes(sortedVotes);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load votes");
      } finally {
        setLoading(false);
      }
    };

    fetchVotes();
  }, [author, permlink]);

  const formatRshares = (rshares: number) => {
    if (rshares >= 1_000_000_000) return `${(rshares / 1_000_000_000).toFixed(1)}B`;
    if (rshares >= 1_000_000) return `${(rshares / 1_000_000).toFixed(1)}M`;
    if (rshares >= 1_000) return `${(rshares / 1_000).toFixed(1)}K`;
    return rshares.toString();
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Votes (${votes.length})`}
      maxWidth="max-w-md"
    >
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading votes...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-error">{error}</p>
          </div>
        ) : votes.length === 0 ? (
          <div className="text-center py-8">
            <ThumbsUp className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No votes yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {votes.map((vote, index) => (
              <div
                key={`${vote.voter}-${index}`}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={`https://images.hive.blog/u/${vote.voter}/avatar`}
                    alt={vote.voter}
                    className="w-8 h-8 rounded-full object-cover border border-border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${vote.voter}&background=random`;
                    }}
                  />
                  <div>
                    <div className="font-medium text-card-foreground">
                      @{vote.voter}
                    </div>
                    {vote.time && (
                      <div className="text-sm text-muted-foreground">
                        {new Date(vote.time).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {vote.percent && (
                    <div className="text-sm font-medium text-primary">
                      {(vote.percent / 100).toFixed(1)}%
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {formatRshares(vote.rshares)} rshares
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default UpvoteListModal;