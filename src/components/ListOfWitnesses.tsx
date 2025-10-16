import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Witness, WitnessFilters, ListOfWitnessesProps, WitnessVote, Account } from '../types/witness';
import { useWitnessStore } from '../store';
import { witnessService } from '../services/witnessService';
import WitnessFiltersComponent from './WitnessFilters';
import { useIsMobile } from '../hooks/use-mobile';

interface WitnessVotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  witness: string;
  votes: WitnessVote[];
  loadingMore: boolean;
  hasMore: boolean;
  loadingInitial: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  sentinelRef: React.RefObject<HTMLDivElement>;
  loadMoreVotes: () => void;
}

const WitnessVotesModal: React.FC<WitnessVotesModalProps> = ({
  isOpen,
  onClose,
  witness,
  votes,
  loadingMore,
  hasMore,
  loadingInitial,
  scrollContainerRef,
  sentinelRef,
  loadMoreVotes
}) => {
  // Intersection Observer for infinite scroll votes
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && hasMore && !loadingMore) {
      loadMoreVotes();
    }
  }, [hasMore, loadingMore, loadMoreVotes]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.1,
      root: scrollContainerRef.current,
    });

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }
    return () => {
      if (sentinelRef.current) {
        observer.unobserve(sentinelRef.current);
      }
    };
  }, [handleIntersection, scrollContainerRef, sentinelRef]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Votes for @{witness} (showing {votes.length})</h3>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xl font-bold"
          >
            ×
          </button>
        </div>
        <div ref={scrollContainerRef} className="p-4 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {votes.map((vote, index) => (
              <div key={vote.account} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center text-gray-900 dark:text-white text-sm font-medium">
                  <img
                    className="w-8 h-8 rounded-full"
                    src={`https://images.hive.blog/u/${vote.account}/avatar`}
                    alt={vote.account}
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.hive.blog/u/null/avatar'; }}
                  />
                </div>
                <div className="flex-1">
                  <div className="text-gray-900 dark:text-white font-medium">{vote.account}</div>
                  <div className="text-gray-500 dark:text-gray-400 text-sm">Vote #{index + 1}</div>
                </div>
                <div className="text-gray-500 dark:text-gray-400 text-sm">25</div>
              </div>
            ))}
          </div>
          {votes.length === 0 && !loadingInitial && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No votes found for this witness.
            </div>
          )}
          {loadingMore && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
              Loading more votes...
            </div>
          )}
          {hasMore && !loadingMore && (
            <div className="text-center py-4">
              <button
                onClick={loadMoreVotes}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Load More Votes
              </button>
            </div>
          )}
          {hasMore && (
            <div ref={sentinelRef} className="h-4"></div>
          )}
        </div>
      </div>
    </div>
  );
};

const ListOfWitnesses: React.FC<ListOfWitnessesProps> = ({
  username,
  filters: initialFilters = { status: 'all', name: '', version: '' },
  onWitnessVoteClick,
  onWitnessStatsClick,
  onWitnessUrlClick
}) => {
  const isMobile = useIsMobile();
  const witnesses = useWitnessStore(state => state.witnesses);
  const userWitnessVotes = useWitnessStore(state => state.userWitnessVotes);
  const loading = useWitnessStore(state => state.loadingWitnesses);
  const error = useWitnessStore(state => state.error);
  const selectedWitness = useWitnessStore(state => state.selectedWitness);
  const witnessVotes = useWitnessStore(state => state.witnessVotes);
  const hasMoreVotes = useWitnessStore(state => state.hasMoreVotes);
  const loadingMore = useWitnessStore(state => state.loadingMoreVotes);
  const loadingVotes = useWitnessStore(state => state.loadingVotes);
  const filters = useWitnessStore(state => state.filters);
  const hasMoreWitnesses = useWitnessStore(state => state.hasMoreWitnesses);
  const loadingMoreWitnesses = useWitnessStore(state => state.loadingWitnesses);
  const witnessDetails = useWitnessStore(state => state.witnessDetails);
  const witnessAccounts = useWitnessStore(state => state.witnessAccounts);

  const loadWitnesses = useWitnessStore(state => state.loadWitnesses);
  const loadMoreWitnesses = useWitnessStore(state => state.loadMoreWitnesses);
  const loadWitnessVotes = useWitnessStore(state => state.loadWitnessVotes);
  const loadMoreVotes = useWitnessStore(state => state.loadMoreVotes);
  const loadUserWitnessVotes = useWitnessStore(state => state.loadUserWitnessVotes);
  const setFilters = useWitnessStore(state => state.setFilters);
  const [votesModalOpen, setVotesModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const witnessSentinelRef = useRef<HTMLDivElement>(null);



  // Intersection Observer for witness infinite scroll
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && hasMoreWitnesses && !loadingMoreWitnesses) {
      loadMoreWitnesses();
    }
  }, [hasMoreWitnesses, loadingMoreWitnesses, loadMoreWitnesses]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, { threshold: 0.1 });

    if (witnessSentinelRef.current) {
      observer.observe(witnessSentinelRef.current);
    }

    return () => {
      if (witnessSentinelRef.current) {
        observer.unobserve(witnessSentinelRef.current);
      }
    };
  }, [handleIntersection]);

  // Initial load
  useEffect(() => {
    loadWitnesses();
  }, [loadWitnesses]);

  useEffect(() => {
    if (username) {
      loadUserWitnessVotes(username);
    }
  }, [username, loadUserWitnessVotes]);

  // Set initial filters
  useEffect(() => {
    setFilters(initialFilters);
  }, []); // Only on mount to prevent infinite loop

  // Filter witnesses based on current filters
  const filteredWitnesses = useMemo(() => witnesses.filter(witness => {
    // Status filter
    if (filters.status !== 'all') {
      if (filters.status === 'active') {
        // Active: last HBD exchange update within 1 year
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const lastExchange = new Date(witness.last_hbd_exchange_update + 'Z');
        if (lastExchange <= oneYearAgo) {
          return false;
        }
      } else if (filters.status === 'disabled') {
        // Disabled: last HBD exchange update more than 1 year ago
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const lastExchange = new Date(witness.last_hbd_exchange_update + 'Z');
        if (lastExchange > oneYearAgo) {
          return false;
        }
      } else if (filters.status === 'approved') {
        // Approved: witnesses available in user account data (witness_votes)
        if (!userWitnessVotes.includes(witness.owner)) {
          return false;
        }
      }
    }

    // Name filter
    if (filters.name && !witness.owner.toLowerCase().includes(filters.name.toLowerCase())) {
      return false;
    }

    // Version filter
    if (filters.version && !witness.running_version.includes(filters.version)) {
      return false;
    }

    return true;
  }), [witnesses, filters, userWitnessVotes]);

  const handleVotesClick = async (witness: string) => {
    if (onWitnessVoteClick) {
      onWitnessVoteClick(witness);
    } else {
      await loadWitnessVotes(witness);
      setVotesModalOpen(true);
    }
  };

  const handleStatsClick = (witness: string) => {
    if (onWitnessStatsClick) {
      onWitnessStatsClick(witness);
    } else {
      window.open(`https://hivehub.dev/witnesses/@${witness}`, '_blank');
    }
  };

  const handleUrlClick = (url: string) => {
    if (onWitnessUrlClick) {
      onWitnessUrlClick(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const isVotedFor = (witness: string) => {
    return username ? userWitnessVotes.includes(witness) : false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full">
      <WitnessVotesModal
        isOpen={votesModalOpen}
        onClose={() => setVotesModalOpen(false)}
        witness={selectedWitness || ''}
        votes={witnessVotes}
        loadingMore={loadingMore}
        hasMore={hasMoreVotes}
        loadingInitial={loadingVotes}
        scrollContainerRef={scrollContainerRef}
        sentinelRef={sentinelRef}
        loadMoreVotes={loadMoreVotes}
      />

      {isMobile ? (
        <div className="w-full">
          {/* Filter Toggle Button */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Witnesses</h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
            </button>
          </div>

          {/* Filters Modal */}
          {showFilters && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-md max-h-[80vh] overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xl font-bold"
                  >
                    ×
                  </button>
                </div>
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                  <WitnessFiltersComponent
                    filters={filters}
                    onFiltersChange={setFilters}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Witnesses List */}
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {filteredWitnesses.map((witness, index) => {
              const versionStatus = witnessService.getVersionStatus(
                witness.running_version,
                witness.hardfork_version_vote
              );
              const votedFor = isVotedFor(witness.owner);
              const rank = witnesses.findIndex(w => w.owner === witness.owner) + 1;

              return (
                <div key={witness.owner} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                  {/* Header Row: Rank, Witness, Vote Status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">#{rank}</span>
                      <img
                        className="w-10 h-10 rounded-full"
                        src={`https://images.hive.blog/u/${witness.owner}/avatar`}
                        alt={witness.owner}
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.hive.blog/u/null/avatar'; }}
                      />
                      <div>
                        <div className="text-gray-900 dark:text-white font-medium">{witness.owner}</div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs">Since {new Date(witness.created).getFullYear()}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center justify-center">
                        <svg
                          className={`w-6 h-6 ${votedFor ? 'text-green-600 dark:text-green-500' : 'text-gray-400 dark:text-gray-500'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleUrlClick(witness.url)}
                          className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          title="Visit witness URL"
                        >
                          🔗
                        </button>
                        <button
                          onClick={() => handleStatsClick(witness.owner)}
                          className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          title="View witness stats"
                        >
                          📊
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Details Row: Version, Votes, APR */}
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Version</div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium mt-1 block ${versionStatus === 'green' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300' :
                        versionStatus === 'red' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        }`}>
                        {witness.running_version}
                      </span>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Votes (MHP)</div>
                      <button
                        onClick={() => handleVotesClick(witness.owner)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer text-sm font-medium mt-1"
                        disabled={loadingVotes}
                      >
                        {loadingVotes && selectedWitness === witness.owner ? 'Loading...' : witnessService.formatVotesToMHP(witness.votes)}
                      </button>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">APR</div>
                      <div className="text-gray-900 dark:text-white font-medium mt-1">
                        {witnessService.calculateAPR(witness.props.hbd_interest_rate)}%
                      </div>
                    </div>
                  </div>

                  {/* Additional Details Row: Last Block, Miss, Price Feed */}
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div className="text-center">
                      <div className="text-gray-500 dark:text-gray-400 uppercase">Last Block</div>
                      <div className="text-gray-900 dark:text-white">{witness.last_confirmed_block_num.toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-500 dark:text-gray-400 uppercase">Miss</div>
                      <div className="text-gray-900 dark:text-white">{witness.total_missed.toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-500 dark:text-gray-400 uppercase">Price Feed</div>
                      <div className="text-gray-900 dark:text-white">{witness.hbd_exchange_rate.base}</div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {witnessService.formatTimeAgo(witness.last_hbd_exchange_update + 'Z')}
                      </div>
                    </div>
                  </div>

                  {/* Witness Details */}
                  {witnessDetails.get(witness.owner) && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-gray-500 dark:text-gray-400 text-xs line-clamp-2">
                        {witnessDetails.get(witness.owner)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {loadingMoreWitnesses && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-gray-500 dark:text-gray-400">Loading more witnesses...</span>
              </div>
            )}
            {hasMoreWitnesses && (
              <div ref={witnessSentinelRef} className="h-1"></div>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-1 sticky top-0 h-screen overflow-y-auto">
              <WitnessFiltersComponent
                filters={filters}
                onFiltersChange={setFilters}
              />
            </div>

            <div className="col-span-4 overflow-auto max-h-screen">
              <table className="w-full text-xs text-left text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th scope="col" className="px-2 py-2">Rank</th>
                    <th scope="col" className="px-2 py-2">Witness</th>
                    <th scope="col" className="px-2 py-2">Version</th>
                    <th scope="col" className="px-2 py-2">Votes</th>
                    <th scope="col" className="px-2 py-2">Last Block</th>
                    <th scope="col" className="px-2 py-2">Miss</th>
                    <th scope="col" className="px-2 py-2">Feed</th>
                    <th scope="col" className="px-2 py-2">APR</th>
                    <th scope="col" className="px-2 py-2">Vote</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWitnesses.map((witness, index) => {
                    const versionStatus = witnessService.getVersionStatus(
                      witness.running_version,
                      witness.hardfork_version_vote
                    );
                    const votedFor = isVotedFor(witness.owner);

                    return (
                      <tr key={witness.owner} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-2 py-2 font-medium text-gray-900 dark:text-white text-xs">
                          {witnesses.findIndex(w => w.owner === witness.owner) + 1}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center space-x-2">
                            <img
                              className="w-6 h-6 rounded-full"
                              src={`https://images.hive.blog/u/${witness.owner}/avatar`}
                              alt={witness.owner}
                              onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.hive.blog/u/null/avatar'; }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-gray-900 dark:text-white font-medium text-xs truncate">{witness.owner}</div>
                              <div className="text-gray-500 dark:text-gray-400 text-xs">Since {new Date(witness.created).getFullYear()}</div>
                            </div>
                            <div className="flex space-x-1 flex-shrink-0">
                              <button
                                onClick={() => handleUrlClick(witness.url)}
                                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs"
                                title="Visit witness URL"
                              >
                                🔗
                              </button>
                              <button
                                onClick={() => handleStatsClick(witness.owner)}
                                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs"
                                title="View witness stats"
                              >
                                📊
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <span className={`px-1 py-0.5 rounded text-xs font-medium ${versionStatus === 'green' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300' :
                            versionStatus === 'red' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300' :
                              'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                            }`}>
                            {witness.running_version}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => handleVotesClick(witness.owner)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer text-xs"
                            disabled={loadingVotes}
                          >
                            {loadingVotes && selectedWitness === witness.owner ? '...' : witnessService.formatVotesToMHP(witness.votes)}
                          </button>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="text-gray-900 dark:text-white text-xs">{witness.last_confirmed_block_num.toLocaleString()}</div>
                        </td>
                        <td className="px-2 py-2 text-right text-gray-900 dark:text-white text-xs">
                          {witness.total_missed.toLocaleString()}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="text-gray-900 dark:text-white text-xs">{witness.hbd_exchange_rate.base}</div>
                        </td>
                        <td className="px-2 py-2 text-right text-gray-900 dark:text-white text-xs">
                          {witnessService.calculateAPR(witness.props.hbd_interest_rate)}%
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-center">
                            <svg
                              className={`w-4 h-4 ${votedFor ? 'text-green-600 dark:text-green-500' : 'text-gray-400 dark:text-gray-500'}`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {loadingMoreWitnesses && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  <span className="ml-2 text-gray-500 dark:text-gray-400">Loading more witnesses...</span>
                </div>
              )}
              {hasMoreWitnesses && (
                <div ref={witnessSentinelRef} className="h-1"></div>
              )}
            </div>
          </div>
        </div>
      )
      }
    </div>
  );
};

export default ListOfWitnesses;
