import React from 'react';
import { WitnessFilters } from '../types/witness';

interface WitnessFiltersProps {
  filters: WitnessFilters;
  onFiltersChange: (filters: WitnessFilters) => void;
  theme?: 'light' | 'dark';
}

const WitnessFiltersComponent: React.FC<WitnessFiltersProps> = ({ filters, onFiltersChange, theme = 'dark' }) => {
  const clearButtonClass = theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800';
  const handleStatusChange = (status: 'all' | 'active' | 'disabled' | 'approved') => {
    // If clicking the same status that's already selected, uncheck it (set to 'all')
    const newStatus = filters.status === status ? 'all' : status;
    onFiltersChange({ ...filters, status: newStatus });
  };

  const handleNameChange = (name: string) => {
    onFiltersChange({ ...filters, name });
  };

  const handleVersionChange = (version: string) => {
    onFiltersChange({ ...filters, version });
  };

  return (
    <div className={`rounded-lg p-4 mb-6 border ${theme === 'dark' ? 'bg-[var(--hrk-bg-app)] border-[var(--hrk-border-subtle)]' : 'bg-white border-[var(--hrk-border-subtle)]'}`}>
      <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-[var(--hrk-text-primary)]'}`}>FILTERS</h3>

      {/* WITNESS Status Filter */}
      <div className="mb-6">
        <h4 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-[var(--hrk-text-secondary)]' : 'text-[var(--hrk-text-secondary)]'}`}>WITNESS</h4>
        <div className="space-y-2">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.status === 'active'}
              onChange={() => handleStatusChange('active')}
              className="w-4 h-4 text-blue-600 rounded focus:ring-[var(--hrk-info)] focus:ring-2"
            />
            <span className={`${theme === 'dark' ? 'text-white' : 'text-[var(--hrk-text-primary)]'}`}>Active</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.status === 'disabled'}
              onChange={() => handleStatusChange('disabled')}
              className="w-4 h-4 text-blue-600 rounded focus:ring-[var(--hrk-info)] focus:ring-2"
            />
            <span className={`${theme === 'dark' ? 'text-white' : 'text-[var(--hrk-text-primary)]'}`}>Disabled/Stale</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.status === 'approved'}
              onChange={() => handleStatusChange('approved')}
              className="w-4 h-4 text-blue-600 rounded focus:ring-[var(--hrk-info)] focus:ring-2"
            />
            <span className={`${theme === 'dark' ? 'text-white' : 'text-[var(--hrk-text-primary)]'}`}>Approved</span>
          </label>
          {filters.status !== 'all' && (
            <button
              onClick={() => onFiltersChange({ ...filters, status: 'all' })}
              className={`text-sm underline ${clearButtonClass}`}
            >
              Clear Status Filter
            </button>
          )}
        </div>
      </div>

      {/* NAME Filter */}
      <div className="mb-6">
        <h4 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-[var(--hrk-text-secondary)]' : 'text-[var(--hrk-text-secondary)]'}`}>NAME</h4>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className={`w-4 h-4 ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search"
            value={filters.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border-b focus:outline-none focus:border-[var(--hrk-info)] ${theme === 'dark' ? 'bg-[var(--hrk-bg-app)] border-[var(--hrk-border-subtle)] text-white placeholder-[var(--hrk-text-tertiary)]' : 'bg-[var(--hrk-bg-hover)] border-gray-300 text-[var(--hrk-text-primary)] placeholder-[var(--hrk-text-tertiary)]'}`}
          />
        </div>
      </div>

      {/* VERSION Filter */}
      <div>
        <h4 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-[var(--hrk-text-secondary)]' : 'text-[var(--hrk-text-secondary)]'}`}>VERSION</h4>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className={`w-4 h-4 ${theme === 'dark' ? 'text-[var(--hrk-text-tertiary)]' : 'text-[var(--hrk-text-tertiary)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Version"
            value={filters.version}
            onChange={(e) => handleVersionChange(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border-b focus:outline-none focus:border-[var(--hrk-info)] ${theme === 'dark' ? 'bg-[var(--hrk-bg-app)] border-[var(--hrk-border-subtle)] text-white placeholder-[var(--hrk-text-tertiary)]' : 'bg-[var(--hrk-bg-hover)] border-gray-300 text-[var(--hrk-text-primary)] placeholder-[var(--hrk-text-tertiary)]'}`}
          />
        </div>
      </div>
    </div>
  );
};

export default WitnessFiltersComponent;
