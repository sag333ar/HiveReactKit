import React from 'react';
import { WitnessFilters } from '../types/witness';

interface WitnessFiltersProps {
  filters: WitnessFilters;
  onFiltersChange: (filters: WitnessFilters) => void;
}

const WitnessFiltersComponent: React.FC<WitnessFiltersProps> = ({ filters, onFiltersChange }) => {
  const handleStatusChange = (status: 'all' | 'active' | 'disabled' | 'approved') => {
    onFiltersChange({ ...filters, status });
  };

  const handleNameChange = (name: string) => {
    onFiltersChange({ ...filters, name });
  };

  const handleVersionChange = (version: string) => {
    onFiltersChange({ ...filters, version });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">FILTERS</h3>

      {/* WITNESS Status Filter */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">WITNESS</h4>
        <div className="space-y-2">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.status === 'active'}
              onChange={() => handleStatusChange('active')}
              className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-gray-900 dark:text-white">Active</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.status === 'disabled'}
              onChange={() => handleStatusChange('disabled')}
              className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-gray-900 dark:text-white">Disabled/Stale</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.status === 'approved'}
              onChange={() => handleStatusChange('approved')}
              className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-gray-900 dark:text-white">Approved</span>
          </label>
        </div>
      </div>

      {/* NAME Filter */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">NAME</h4>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search"
            value={filters.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* VERSION Filter */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">VERSION</h4>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Version"
            value={filters.version}
            onChange={(e) => handleVersionChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
};

export default WitnessFiltersComponent;
