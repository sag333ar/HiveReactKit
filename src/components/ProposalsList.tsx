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
        <div className="text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)]">Loading proposals...</div>
      </div>
    );
  }

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className={`space-y-6 p-2 ${theme === 'dark' ? 'bg-[var(--hrk-bg-app)]' : 'bg-white'}`}>
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {FILTERS.map(f => (
            <button key={f} className={`px-3 py-1 rounded text-sm ${filter === f ? 'bg-[var(--hrk-info)] text-white' : `${theme === 'dark' ? 'bg-[var(--hrk-bg-app)] text-[var(--hrk-text-secondary)]' : 'bg-[var(--hrk-bg-hover)] text-[var(--hrk-text-secondary)]'}`}`}
              onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>

        {/* Sort Select */}
        <div className="mb-4">
          <label className={`${theme === 'dark' ? 'text-[var(--hrk-text-secondary)]' : 'text-[var(--hrk-text-secondary)]'} mr-2`}>Sort by:</label>
          <select value={sort} onChange={e => setSort(e.target.value)} className={`px-3 py-1 border rounded ${theme === 'dark' ? 'border-[var(--hrk-border-default)] bg-[var(--hrk-bg-app)] text-[var(--hrk-text-primary)]' : 'border-gray-300 bg-white text-[var(--hrk-text-primary)]'}`}>
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
                  <div key={p.proposal_id} className={`border rounded-[14px] mb-3 p-3 sm:p-4 transition-[background-color,border-color] duration-150 ease-out ${theme === 'dark' ? 'border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] hover:bg-[var(--hrk-bg-surface-raised)] hover:border-[var(--hrk-border-default)]' : 'border-[var(--hrk-border-subtle)] bg-white hover:bg-[var(--hrk-bg-hover)]'}`}>
                    {/* Existing proposal content */}
                    <div className="flex flex-col sm:flex-row">
                      {/* Left side content */}
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <span onClick={() => onClickAvatar(p)} className="inline-block mr-2 cursor-pointer">
                            <img src={`https://images.hive.blog/u/${p.creator}/avatar`} className="w-8 h-8 rounded-full inline" alt={`${p.creator} avatar`} />
                          </span>
                          <span
                            className={`font-bold cursor-pointer ${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}
                            onClick={() => onClickUser(p)}
                          >
                            by {p.creator}
                          </span>
                          {p.receiver && <span className={`ml-2 ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>with receiver <strong className={`${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}>{p.receiver}</strong></span>}
                        </div>
                        <div
                          className={`cursor-pointer text-lg font-semibold mb-1 ${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}
                          onClick={() => onClickSelect(p)}
                        >
                          {p.subject} <span className={`cursor-pointer text-lg font-semibold mb-1 ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>#{p.proposal_id}</span>
                        </div>
                        <div className={`text-sm mb-2 ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${new Date(p.start_date + 'Z') > new Date() ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : new Date(p.end_date + 'Z') < new Date() ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : p.status === 'active' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-[var(--hrk-bg-hover)] text-[var(--hrk-text-primary)] dark:bg-[var(--hrk-bg-surface-raised)] dark:text-[var(--hrk-text-secondary)]'}`}>{new Date(p.start_date + 'Z') > new Date() ? 'upcoming' : new Date(p.end_date + 'Z') < new Date() ? 'expired' : p.status}</span>{' - ' + new Date(p.start_date + 'Z').toLocaleDateString() + ' - ' + new Date(p.end_date + 'Z').toLocaleDateString()} <span className={`text-xs ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>{getDaysInfo(p)}</span>
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
                            className={`inline-block cursor-pointer px-2 py-1 rounded ${theme === 'dark' ? 'bg-[var(--hrk-bg-surface)] text-[var(--hrk-text-secondary)]' : 'bg-[var(--hrk-bg-hover)] text-[var(--hrk-text-secondary)]'}`}
                            onClick={() => onClickVoteValue(p)}
                          >
                            Vote value: {p.vote_value_total ? formatNumber(p.vote_value_total) : 0} HP
                          </span>
                        </div>

                      </div>

                      {/* Right side values */}
                      <div className="mt-4 sm:mt-0 sm:ml-4 w-full sm:w-48 flex flex-col space-y-1">
                        <div className="flex justify-between">
                          <span className={`font-mono text-xs sm:text-sm ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>Daily Pay:</span>
                          <strong className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}>{p.daily_pay_hbd ? formatNumber(p.daily_pay_hbd) : 0} HBD</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className={`font-mono text-xs sm:text-sm ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>Remaining:</span>
                          <strong className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}>{formatNumber(p.remaining_days || 0)} Days</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className={`font-mono text-xs sm:text-sm ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>Paid:</span>
                          <strong className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}>{formatNumber(p.total_hbd_received || 0)} HBD</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className={`font-mono text-xs sm:text-sm ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>To Pay:</span>
                          <strong className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}>{formatNumber(p.max_hbd_remaining || 0)} HBD</strong>
                        </div>
                        <div className="mt-2">
                          <button
                            className="px-3 sm:px-5 py-2 bg-[var(--hrk-success)] hover:brightness-110 text-white rounded cursor-pointer w-full text-xs sm:text-sm"
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
                      <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}>Upcoming proposals</h3>
                      <p className={`${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>The proposals listed below will start in the future. You can already support them.</p>
                    </div>

                    {upcomingProposals.map((p) => (
                      <div key={p.proposal_id} className={`border rounded-[14px] mb-3 p-3 sm:p-4 transition-[background-color,border-color] duration-150 ease-out ${theme === 'dark' ? 'border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] hover:bg-[var(--hrk-bg-surface-raised)] hover:border-[var(--hrk-border-default)]' : 'border-[var(--hrk-border-subtle)] bg-white hover:bg-[var(--hrk-bg-hover)]'}`}>
                        {/* Existing proposal content */}
                        <div className="flex flex-col sm:flex-row">
                          {/* Left side content */}
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <span onClick={() => onClickAvatar(p)} className="inline-block mr-2 cursor-pointer">
                                <img src={`https://images.hive.blog/u/${p.creator}/avatar`} className="w-8 h-8 rounded-full inline" alt={`${p.creator} avatar`} />
                              </span>
                              <span
                                className={`font-bold cursor-pointer ${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}
                                onClick={() => onClickUser(p)}
                              >
                                {p.creator}
                              </span>
                              <span className={`ml-2 ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>with receiver <strong className={`${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}>{p.receiver}</strong></span>
                            </div>
                            <div
                              className={`cursor-pointer text-lg font-semibold mb-1 ${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}
                              onClick={() => onClickSelect(p)}
                            >
                              {p.subject}
                            </div>
                            <div className={`text-sm mb-2 ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${new Date(p.start_date + 'Z') > new Date() ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : new Date(p.end_date + 'Z') < new Date() ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : p.status === 'active' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-[var(--hrk-bg-hover)] text-[var(--hrk-text-primary)] dark:bg-[var(--hrk-bg-surface-raised)] dark:text-[var(--hrk-text-secondary)]'}`}>{new Date(p.start_date + 'Z') > new Date() ? 'upcoming' : new Date(p.end_date + 'Z') < new Date() ? 'expired' : p.status}</span>{' - ' + new Date(p.start_date + 'Z').toLocaleDateString() + ' - ' + new Date(p.end_date + 'Z').toLocaleDateString()} <span className={`text-xs ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>{getDaysInfo(p)}</span>
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
                                className={`inline-block cursor-pointer px-2 py-1 rounded ${theme === 'dark' ? 'bg-[var(--hrk-bg-surface)] text-[var(--hrk-text-secondary)]' : 'bg-[var(--hrk-bg-hover)] text-[var(--hrk-text-secondary)]'}`}
                                onClick={() => onClickVoteValue(p)}
                              >
                                Vote value: {p.vote_value_total ? formatNumber(p.vote_value_total) : 0} HP
                              </span>
                            </div>

                          </div>

                          {/* Right side values */}
                          <div className="mt-4 sm:mt-0 sm:ml-4 w-full sm:w-48 flex flex-col space-y-1">
                            <div className="flex justify-between">
                              <span className={`font-mono text-xs sm:text-sm ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>Daily Pay:</span>
                              <strong className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}>{p.daily_pay_hbd ? formatNumber(p.daily_pay_hbd) : 0} HBD</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className={`font-mono text-xs sm:text-sm ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>Remaining:</span>
                              <strong className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}>{formatNumber(p.remaining_days || 0)} Days</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className={`font-mono text-xs sm:text-sm ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>Paid:</span>
                              <strong className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}>{formatNumber(p.total_hbd_received || 0)} HBD</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className={`font-mono text-xs sm:text-sm ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>To Pay:</span>
                              <strong className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}>{formatNumber(p.max_hbd_remaining || 0)} HBD</strong>
                            </div>
                            <div className="mt-2">
                              <button
                                className="px-3 sm:px-5 py-2 bg-[var(--hrk-success)] hover:brightness-110 text-white rounded cursor-pointer w-full text-xs sm:text-sm"
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
            <div key={p.proposal_id} className={`border rounded-[14px] mb-3 p-3 sm:p-4 transition-[background-color,border-color] duration-150 ease-out ${theme === 'dark' ? 'border-[var(--hrk-border-subtle)] bg-[var(--hrk-bg-surface)] hover:bg-[var(--hrk-bg-surface-raised)] hover:border-[var(--hrk-border-default)]' : 'border-[var(--hrk-border-subtle)] bg-white hover:bg-[var(--hrk-bg-hover)]'}`}>
              <div className="flex flex-col sm:flex-row">
                {/* Left side content */}
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <span onClick={() => onClickAvatar(p)} className="inline-block mr-2 cursor-pointer">
                      <img src={`https://images.hive.blog/u/${p.creator}/avatar`} className="w-8 h-8 rounded-full inline" alt={`${p.creator} avatar`} />
                    </span>
                    <span
                      className={`font-bold cursor-pointer ${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}
                      onClick={() => onClickUser(p)}
                    >
                      {p.creator}
                    </span>
                    <span className={`ml-2 ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>with receiver <strong className={`${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}>{p.receiver}</strong></span>
                  </div>
                  <div
                    className={`cursor-pointer text-lg font-semibold mb-1 ${theme === 'dark' ? 'text-[var(--hrk-text-primary)]' : 'text-[var(--hrk-text-primary)]'}`}
                    onClick={() => onClickSelect(p)}
                  >
                    {p.subject} #{p.proposal_id}
                  </div>
                  <div className={`text-sm mb-2 ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${new Date(p.start_date + 'Z') > new Date() ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : new Date(p.end_date + 'Z') < new Date() ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : p.status === 'active' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-[var(--hrk-bg-hover)] text-[var(--hrk-text-primary)] dark:bg-[var(--hrk-bg-surface-raised)] dark:text-[var(--hrk-text-secondary)]'}`}>{new Date(p.start_date + 'Z') > new Date() ? 'upcoming' : new Date(p.end_date + 'Z') < new Date() ? 'expired' : p.status}</span>{' - ' + new Date(p.start_date + 'Z').toLocaleDateString() + ' - ' + new Date(p.end_date + 'Z').toLocaleDateString()} <span className={`text-xs ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`}>{getDaysInfo(p)}</span>
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
                      className={`inline-block cursor-pointer px-2 py-1 rounded ${theme === 'dark' ? 'bg-[var(--hrk-bg-surface)] text-[var(--hrk-text-secondary)]' : 'bg-[var(--hrk-bg-hover)] text-[var(--hrk-text-secondary)]'}`}
                      onClick={() => onClickVoteValue(p)}
                    >
                      Vote value: {p.vote_value_total ? formatNumber(p.vote_value_total) : 0} HP
                    </span>
                  </div>

                </div>

                {/* Right side values */}
                <div className="mt-4 sm:mt-0 sm:ml-4 w-full sm:w-48 flex flex-col space-y-1">
                  <div className="flex justify-between">
                    <span className="font-mono text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)] text-xs sm:text-sm">Daily Pay:</span>
                    <strong className="text-[var(--hrk-text-primary)] dark:text-[var(--hrk-text-primary)] text-xs sm:text-sm">{p.daily_pay_hbd ? formatNumber(p.daily_pay_hbd) : 0} HBD</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)] text-xs sm:text-sm">Remaining:</span>
                    <strong className="text-[var(--hrk-text-primary)] dark:text-[var(--hrk-text-primary)] text-xs sm:text-sm">{formatNumber(p.remaining_days || 0)} Days</strong>
                  </div>
                  {filter !== 'Expired' && (
                    <div className="flex justify-between">
                      <span className="font-mono text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)] text-xs sm:text-sm">Paid:</span>
                      <strong className="text-[var(--hrk-text-primary)] dark:text-[var(--hrk-text-primary)] text-xs sm:text-sm">{formatNumber(p.total_hbd_received || 0)} HBD</strong>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="font-mono text-[var(--hrk-text-tertiary)] dark:text-[var(--hrk-text-tertiary)] text-xs sm:text-sm">To Pay:</span>
                    <strong className="text-[var(--hrk-text-primary)] dark:text-[var(--hrk-text-primary)] text-xs sm:text-sm">{formatNumber(p.max_hbd_remaining || 0)} HBD</strong>
                  </div>
                  <div className="mt-2">
                    <button
                      className="px-3 sm:px-5 py-2 bg-[var(--hrk-success)] hover:brightness-110 text-white rounded cursor-pointer w-full text-xs sm:text-sm"
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
