import React, { useState, useEffect } from 'react';
import { Proposal, ProposalsListProps } from '../types/proposal';
import { proposalService } from '../services/proposalService';

// Filter lists
const FILTERS = ['All', 'Active', 'Upcoming', 'Expired', 'By Peak Projects'];
const SORTS = ['Votes', 'Start Date', 'End Date', 'Creator'];

const ProposalsList: React.FC<ProposalsListProps> = ({
  onClickSupport,
  onClickVoteValue,
  onClickSelect,
  onClickUser,
  onClickAvatar
}) => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('Votes');
  const [loading, setLoading] = useState(true);

  // Fetch proposals
  useEffect(() => {
    const fetchProposals = async () => {
      setLoading(true);
      const data = await proposalService.getProposals(filter === 'Expired' ? 'expired' : 'active');
      setProposals(data);
      setLoading(false);
    };
    fetchProposals();
  }, [filter]);

  // Filter logic
  const filteredProposals = proposals.filter((p) => {
    if (filter === 'All') return true;
    if (filter === 'Active') return p.status === 'active';
    if (filter === 'Upcoming') return new Date(p.start_date) > new Date();
    if (filter === 'Expired') return new Date(p.end_date) < new Date();
    if (filter === 'By Peak Projects') return p.creator === 'peakd';
    return true;
  });

  // Sorting logic
  const sortedProposals = filteredProposals.sort((a, b) => {
    if (sort === 'Votes') return Number(b.all_votes_num) - Number(a.all_votes_num);
    if (sort === 'Start Date') return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
    if (sort === 'End Date') return new Date(b.end_date).getTime() - new Date(a.end_date).getTime();
    if (sort === 'Creator') return a.creator.localeCompare(b.creator);
    return 0;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-600 dark:text-gray-400">Loading proposals...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} className={`px-3 py-1 rounded text-sm ${filter === f ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {/* Sort Select */}
      <div className="mb-4">
        <label className="text-gray-700 dark:text-gray-300 mr-2">Sort by:</label>
        <select value={sort} onChange={e => setSort(e.target.value)} className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
          {SORTS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Proposal Listing */}
      <div>
        {sortedProposals.map((p) => (
          <div key={p.proposal_id} className="border border-gray-200 dark:border-gray-700 rounded-lg mb-4 p-4 shadow bg-white dark:bg-gray-800">
            <div className="flex">
              {/* Left side content */}
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <span onClick={() => onClickAvatar(p)} className="inline-block mr-2 cursor-pointer">
                    <img src={`https://images.hive.blog/u/${p.creator}/avatar`} className="w-8 h-8 rounded-full inline" alt={`${p.creator} avatar`} />
                  </span>
                  <span
                    className="font-bold cursor-pointer text-gray-900 dark:text-gray-100"
                    onClick={() => onClickUser(p)}
                  >
                    {p.creator}
                  </span>
                  <span className="ml-2 text-gray-500 dark:text-gray-400">with receiver <strong className="text-gray-900 dark:text-gray-100">{p.receiver}</strong></span>
                </div>
                <div
                  className="cursor-pointer text-lg font-semibold mb-1 text-gray-900 dark:text-gray-100"
                  onClick={() => onClickSelect(p)}
                >
                  {p.subject}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${new Date(p.start_date) > new Date() ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : new Date(p.end_date) < new Date() ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : p.status === 'active' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>{new Date(p.start_date) > new Date() ? 'upcoming' : new Date(p.end_date) < new Date() ? 'expired' : p.status}</span>{' - ' + new Date(p.start_date).toLocaleDateString() + ' - ' + new Date(p.end_date).toLocaleDateString()}
                </div>
                <div className="mb-2">
                  <span
                    className="inline-block cursor-pointer px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300"
                    onClick={() => onClickVoteValue(p)}
                  >
                    Vote value: {p.vote_value_total ? p.vote_value_total.toFixed(0) : 0} HP
                  </span>
                </div>

              </div>

              {/* Right side values */}
              <div className="ml-4 w-48 flex flex-col space-y-1">
                <div className="flex justify-between">
                  <span className="font-mono text-gray-600 dark:text-gray-400 text-sm">Daily Pay:</span>
                  <strong className="text-gray-900 dark:text-gray-100 text-sm">{p.daily_pay_hbd ? p.daily_pay_hbd.toFixed(2) : 0} HBD</strong>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-gray-600 dark:text-gray-400 text-sm">Remaining:</span>
                  <strong className="text-gray-900 dark:text-gray-100 text-sm">{p.remaining_days || 0} Days</strong>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-gray-600 dark:text-gray-400 text-sm">Paid:</span>
                  <strong className="text-gray-900 dark:text-gray-100 text-sm">{p.total_hbd_received || 0} HBD</strong>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-gray-600 dark:text-gray-400 text-sm">To Pay:</span>
                  <strong className="text-gray-900 dark:text-gray-100 text-sm">{p.max_hbd_remaining || 0} HBD</strong>
                </div>
                <div className="mt-2">
                  <button
                    className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded cursor-pointer w-full"
                    onClick={() => onClickSupport(p)}
                  >
                    Support
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProposalsList;
