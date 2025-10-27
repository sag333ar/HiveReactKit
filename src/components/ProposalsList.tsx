import React, { useState, useEffect } from 'react';
import { Proposal, ProposalsListProps } from '../types/proposal';
import { proposalService } from '../services/proposalService';
import { ExternalLink, PieChart } from 'lucide-react';

// Filter lists
const FILTERS = ['All', 'Active', 'Upcoming', 'Expired', 'By Peak Projects'];
const SORTS = ['Votes', 'Start Date', 'End Date', 'Creator'];

// Sort options based on filter
const getSortOptions = (filter: string) => {
  if (filter === 'By Peak Projects') {
    return ['Creator'];
  }
  return SORTS;
};

// Format numbers with comma separators
const formatNumber = (num: number | string) => {
  const numericValue = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(numericValue)) return num.toString();

  return numericValue.toLocaleString();
};

// Calculate days info for display
const getDaysInfo = (proposal: Proposal) => {
  const startDate = new Date(proposal.start_date);
  const endDate = new Date(proposal.end_date);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  return `(${totalDays} days)`;
};

const ProposalsList: React.FC<ProposalsListProps> = ({
  onClickSupport,
  onClickVoteValue,
  onClickSelect,
  onClickUser,
  onClickAvatar,
  theme = 'dark'
}) => {
  const [allProposals, setAllProposals] = useState<Proposal[]>([]);
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('Votes');

  // Reset sort to default when filter changes
  useEffect(() => {
    if (filter === 'By Peak Projects' && !getSortOptions(filter).includes(sort)) {
      setSort('Creator');
    } else if (filter !== 'By Peak Projects' && sort === 'Creator' && !SORTS.includes(sort)) {
      setSort('Votes');
    }
  }, [filter, sort]);
  const [loading, setLoading] = useState(true);

  // Fetch all proposals once on mount
  useEffect(() => {
    const fetchAllProposals = async () => {
      setLoading(true);
      try {
        const [activeData, expiredData] = await Promise.all([
          proposalService.getProposals('active'),
          proposalService.getProposals('expired')
        ]);
        setAllProposals([...activeData, ...expiredData]);
      } catch (error) {
        console.error('Error fetching proposals:', error);
        setAllProposals([]);
      }
      setLoading(false);
    };
    fetchAllProposals();
  }, []);

  // Filter logic
  const filteredProposals = allProposals.filter((p) => {
    if (filter === 'All') return p.status === 'active' || new Date(p.start_date + 'Z') > new Date();
    if (filter === 'Active') return p.status === 'active';
    if (filter === 'Upcoming') return new Date(p.start_date + 'Z') > new Date();
    if (filter === 'Expired') return new Date(p.end_date + 'Z') < new Date();
    if (filter === 'By Peak Projects') return p.creator === 'peakd';
    return true;
  }).sort((a, b) => {
    // For "By Peak Projects" filter, sort by creator descending (Z to A)
    if (filter === 'By Peak Projects') {
      return b.creator.localeCompare(a.creator);
    }
    return 0;
  });

  // Sorting logic
  const sortedProposals = filter === 'All'
    ? (() => {
      const activeProposals = filteredProposals.filter(p => p.status === 'active');
      const upcomingProposals = filteredProposals.filter(p => new Date(p.start_date + 'Z') > new Date());

      const sortFn = (a: Proposal, b: Proposal) => {
        if (sort === 'Votes') return Number(b.all_votes_num) - Number(a.all_votes_num);
        if (sort === 'Start Date') return new Date(b.start_date + 'Z').getTime() - new Date(a.start_date + 'Z').getTime();
        if (sort === 'End Date') return new Date(a.end_date + 'Z').getTime() - new Date(b.end_date + 'Z').getTime(); // Reverse for ascending order
        if (sort === 'Creator') return a.creator.localeCompare(b.creator);
        return 0;
      };

      return [...activeProposals.sort(sortFn), ...upcomingProposals.sort(sortFn)];
    })()
    : filteredProposals.sort((a, b) => {
      if (sort === 'Votes') return Number(b.all_votes_num) - Number(a.all_votes_num);
      if (sort === 'Start Date') return new Date(b.start_date + 'Z').getTime() - new Date(a.start_date + 'Z').getTime();
      if (sort === 'End Date') return new Date(a.end_date + 'Z').getTime() - new Date(b.end_date + 'Z').getTime(); // Reverse for ascending order
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
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className={`space-y-6 p-2 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {FILTERS.map(f => (
            <button key={f} className={`px-3 py-1 rounded text-sm ${filter === f ? 'bg-blue-500 text-white' : `${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}`}
              onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>

        {/* Sort Select */}
        <div className="mb-4">
          <label className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mr-2`}>Sort by:</label>
          <select value={sort} onChange={e => setSort(e.target.value)} className={`px-3 py-1 border rounded ${theme === 'dark' ? 'border-gray-600 bg-gray-800 text-gray-100' : 'border-gray-300 bg-white text-gray-900'}`}>
            {getSortOptions(filter).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Proposal Listing */}
        <div>
          {filter === 'All' && (() => {
            const activeProposals = sortedProposals.filter(p => p.status === 'active');
            const upcomingProposals = sortedProposals.filter(p => new Date(p.start_date + 'Z') > new Date());

            return (
              <>
                {activeProposals.map((p) => (
                  <div key={p.proposal_id} className={`border rounded-lg mb-4 p-2 sm:p-4 shadow ${theme === 'dark' ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                    {/* Existing proposal content */}
                    <div className="flex flex-col sm:flex-row">
                      {/* Left side content */}
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <span onClick={() => onClickAvatar(p)} className="inline-block mr-2 cursor-pointer">
                            <img src={`https://images.hive.blog/u/${p.creator}/avatar`} className="w-8 h-8 rounded-full inline" alt={`${p.creator} avatar`} />
                          </span>
                          <span
                            className={`font-bold cursor-pointer ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}
                            onClick={() => onClickUser(p)}
                          >
                            by {p.creator}
                          </span>
                          {p.receiver && <span className={`ml-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>with receiver <strong className={`${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{p.receiver}</strong></span>}
                        </div>
                        <div
                          className={`cursor-pointer text-lg font-semibold mb-1 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}
                          onClick={() => onClickSelect(p)}
                        >
                          {p.subject} <span className={`cursor-pointer text-lg font-semibold mb-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>#{p.proposal_id}</span>
                        </div>
                        <div className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${new Date(p.start_date + 'Z') > new Date() ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : new Date(p.end_date + 'Z') < new Date() ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : p.status === 'active' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>{new Date(p.start_date + 'Z') > new Date() ? 'upcoming' : new Date(p.end_date + 'Z') < new Date() ? 'expired' : p.status}</span>{' - ' + new Date(p.start_date + 'Z').toLocaleDateString() + ' - ' + new Date(p.end_date + 'Z').toLocaleDateString()} <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{getDaysInfo(p)}</span>
                        </div>
                        <div className="flex gap-2 mb-2">
                          <button
                            onClick={() => window.open(`https://peakd.com/${p.creator}/${p.permlink}`, '_blank')}
                            className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            title="View on Peakd"
                          >
                            <ExternalLink size={16} />
                          </button>
                          <button
                            onClick={() => window.open(`https://hivehub.dev/proposals/${p.proposal_id}`, '_blank')}
                            className="flex text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                            title="View Stats"
                          >
                            <PieChart size={16} /> Stats
                          </button>
                        </div>
                        <div className="mb-2">
                          <span
                            className={`inline-block cursor-pointer px-2 py-1 rounded ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}
                            onClick={() => onClickVoteValue(p)}
                          >
                            Vote value: {p.vote_value_total ? formatNumber(p.vote_value_total) : 0} HP
                          </span>
                        </div>

                      </div>

                      {/* Right side values */}
                      <div className="mt-4 sm:mt-0 sm:ml-4 w-full sm:w-48 flex flex-col space-y-1">
                        <div className="flex justify-between">
                          <span className={`font-mono text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Daily Pay:</span>
                          <strong className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{p.daily_pay_hbd ? formatNumber(p.daily_pay_hbd) : 0} HBD</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className={`font-mono text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Remaining:</span>
                          <strong className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{formatNumber(p.remaining_days || 0)} Days</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className={`font-mono text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Paid:</span>
                          <strong className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{formatNumber(p.total_hbd_received || 0)} HBD</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className={`font-mono text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>To Pay:</span>
                          <strong className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{formatNumber(p.max_hbd_remaining || 0)} HBD</strong>
                        </div>
                        <div className="mt-2">
                          <button
                            className="px-3 sm:px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded cursor-pointer w-full text-xs sm:text-sm"
                            onClick={() => onClickSupport(p)}
                          >
                            Support
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {upcomingProposals.length > 0 && (
                  <>
                    <div className="my-6 text-center">
                      <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>Upcoming proposals</h3>
                      <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>The proposals listed below will start in the future. You can already support them.</p>
                    </div>

                    {upcomingProposals.map((p) => (
                      <div key={p.proposal_id} className={`border rounded-lg mb-4 p-2 sm:p-4 shadow ${theme === 'dark' ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                        {/* Existing proposal content */}
                        <div className="flex flex-col sm:flex-row">
                          {/* Left side content */}
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <span onClick={() => onClickAvatar(p)} className="inline-block mr-2 cursor-pointer">
                                <img src={`https://images.hive.blog/u/${p.creator}/avatar`} className="w-8 h-8 rounded-full inline" alt={`${p.creator} avatar`} />
                              </span>
                              <span
                                className={`font-bold cursor-pointer ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}
                                onClick={() => onClickUser(p)}
                              >
                                {p.creator}
                              </span>
                              <span className={`ml-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>with receiver <strong className={`${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{p.receiver}</strong></span>
                            </div>
                            <div
                              className={`cursor-pointer text-lg font-semibold mb-1 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}
                              onClick={() => onClickSelect(p)}
                            >
                              {p.subject}
                            </div>
                            <div className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${new Date(p.start_date + 'Z') > new Date() ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : new Date(p.end_date + 'Z') < new Date() ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : p.status === 'active' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>{new Date(p.start_date + 'Z') > new Date() ? 'upcoming' : new Date(p.end_date + 'Z') < new Date() ? 'expired' : p.status}</span>{' - ' + new Date(p.start_date + 'Z').toLocaleDateString() + ' - ' + new Date(p.end_date + 'Z').toLocaleDateString()} <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{getDaysInfo(p)}</span>
                            </div>
                            <div className="flex gap-2 mb-2">
                              <button
                                onClick={() => window.open(`https://peakd.com/${p.creator}/${p.permlink}`, '_blank')}
                                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                title="View on Peakd"
                              >
                                <ExternalLink size={16} />
                              </button>
                              <button
                                onClick={() => window.open(`https://hivehub.dev/proposals/${p.proposal_id}`, '_blank')}
                                className="flex text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                                title="View Stats"
                              >
                                <PieChart size={16} /> Stats
                              </button>
                            </div>
                            <div className="mb-2">
                              <span
                                className={`inline-block cursor-pointer px-2 py-1 rounded ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}
                                onClick={() => onClickVoteValue(p)}
                              >
                                Vote value: {p.vote_value_total ? formatNumber(p.vote_value_total) : 0} HP
                              </span>
                            </div>

                          </div>

                          {/* Right side values */}
                          <div className="mt-4 sm:mt-0 sm:ml-4 w-full sm:w-48 flex flex-col space-y-1">
                            <div className="flex justify-between">
                              <span className={`font-mono text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Daily Pay:</span>
                              <strong className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{p.daily_pay_hbd ? formatNumber(p.daily_pay_hbd) : 0} HBD</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className={`font-mono text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Remaining:</span>
                              <strong className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{formatNumber(p.remaining_days || 0)} Days</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className={`font-mono text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Paid:</span>
                              <strong className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{formatNumber(p.total_hbd_received || 0)} HBD</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className={`font-mono text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>To Pay:</span>
                              <strong className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{formatNumber(p.max_hbd_remaining || 0)} HBD</strong>
                            </div>
                            <div className="mt-2">
                              <button
                                className="px-3 sm:px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded cursor-pointer w-full text-xs sm:text-sm"
                                onClick={() => onClickSupport(p)}
                              >
                                Support
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            );
          })()}

          {filter !== 'All' && sortedProposals.map((p) => (
            <div key={p.proposal_id} className={`border rounded-lg mb-4 p-2 sm:p-4 shadow ${theme === 'dark' ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
              <div className="flex flex-col sm:flex-row">
                {/* Left side content */}
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <span onClick={() => onClickAvatar(p)} className="inline-block mr-2 cursor-pointer">
                      <img src={`https://images.hive.blog/u/${p.creator}/avatar`} className="w-8 h-8 rounded-full inline" alt={`${p.creator} avatar`} />
                    </span>
                    <span
                      className={`font-bold cursor-pointer ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}
                      onClick={() => onClickUser(p)}
                    >
                      {p.creator}
                    </span>
                    <span className={`ml-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>with receiver <strong className={`${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{p.receiver}</strong></span>
                  </div>
                  <div
                    className={`cursor-pointer text-lg font-semibold mb-1 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}
                    onClick={() => onClickSelect(p)}
                  >
                    {p.subject} #{p.proposal_id}
                  </div>
                  <div className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${new Date(p.start_date + 'Z') > new Date() ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : new Date(p.end_date + 'Z') < new Date() ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : p.status === 'active' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>{new Date(p.start_date + 'Z') > new Date() ? 'upcoming' : new Date(p.end_date + 'Z') < new Date() ? 'expired' : p.status}</span>{' - ' + new Date(p.start_date + 'Z').toLocaleDateString() + ' - ' + new Date(p.end_date + 'Z').toLocaleDateString()} <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{getDaysInfo(p)}</span>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => window.open(`https://peakd.com/@${p.creator}/${p.permlink}`, '_blank')}
                      className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      title="View on Peakd"
                    >
                      <ExternalLink size={16} />
                    </button>
                    <button
                      onClick={() => window.open(`https://hivehub.dev/proposals/${p.proposal_id}`, '_blank')}
                      className="flex text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                      title="View Stats"
                    >
                      <PieChart size={16} /> Stats
                    </button>
                  </div>
                  <div className="mb-2">
                    <span
                      className={`inline-block cursor-pointer px-2 py-1 rounded ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}
                      onClick={() => onClickVoteValue(p)}
                    >
                      Vote value: {p.vote_value_total ? formatNumber(p.vote_value_total) : 0} HP
                    </span>
                  </div>

                </div>

                {/* Right side values */}
                <div className="mt-4 sm:mt-0 sm:ml-4 w-full sm:w-48 flex flex-col space-y-1">
                  <div className="flex justify-between">
                    <span className="font-mono text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Daily Pay:</span>
                    <strong className="text-gray-900 dark:text-gray-100 text-xs sm:text-sm">{p.daily_pay_hbd ? formatNumber(p.daily_pay_hbd) : 0} HBD</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Remaining:</span>
                    <strong className="text-gray-900 dark:text-gray-100 text-xs sm:text-sm">{formatNumber(p.remaining_days || 0)} Days</strong>
                  </div>
                  {filter !== 'Expired' && (
                    <div className="flex justify-between">
                      <span className="font-mono text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Paid:</span>
                      <strong className="text-gray-900 dark:text-gray-100 text-xs sm:text-sm">{formatNumber(p.total_hbd_received || 0)} HBD</strong>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="font-mono text-gray-600 dark:text-gray-400 text-xs sm:text-sm">To Pay:</span>
                    <strong className="text-gray-900 dark:text-gray-100 text-xs sm:text-sm">{formatNumber(p.max_hbd_remaining || 0)} HBD</strong>
                  </div>
                  <div className="mt-2">
                    <button
                      className="px-3 sm:px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded cursor-pointer w-full text-xs sm:text-sm"
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
    </div>
  );
};

export default ProposalsList;
