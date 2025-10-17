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
    <div className={`rounded-lg p-4 mb-6 border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>FILTERS</h3>

      {/* WITNESS Status Filter */}
      <div className="mb-6">
        <h4 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>WITNESS</h4>
        <div className="space-y-2">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.status === 'active'}
              onChange={() => handleStatusChange('active')}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Active</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.status === 'disabled'}
              onChange={() => handleStatusChange('disabled')}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Disabled/Stale</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.status === 'approved'}
              onChange={() => handleStatusChange('approved')}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Approved</span>
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
        <h4 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>NAME</h4>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search"
            value={filters.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border-b focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'}`}
          />
        </div>
      </div>

      {/* VERSION Filter */}
      <div>
        <h4 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>VERSION</h4>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Version"
            value={filters.version}
            onChange={(e) => handleVersionChange(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border-b focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'}`}
          />
        </div>
      </div>
    </div>
  );
};

export default WitnessFiltersComponent;
