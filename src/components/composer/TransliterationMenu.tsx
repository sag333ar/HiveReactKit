import React, { useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface TransliterationMenuProps {
  isOpen: boolean;
  query: string;
  suggestions: string[];
  selectedIndex: number;
  position: { top: number; left: number };
  onSelect: (suggestion: string) => void;
  onNavigate: (direction: 'up' | 'down') => void;
  onClose: () => void;
}

export const TransliterationMenu: React.FC<TransliterationMenuProps> = ({
  isOpen,
  query,
  suggestions,
  selectedIndex,
  position,
  onSelect,
  onNavigate,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || (!query && suggestions.length === 0)) {
    return null;
  }

  // Combine fetched suggestions + raw query as last fallback option
  const allOptions = [...suggestions];
  if (query && !allOptions.includes(query)) {
    allOptions.push(query);
  }

  if (allOptions.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        position: 'absolute',
        zIndex: 9999,
      }}
      className="w-48 bg-[#1e2329] text-white border border-[#3a424a] rounded-lg shadow-2xl overflow-hidden text-sm select-none animate-in fade-in zoom-in-95 duration-100"
      role="listbox"
      aria-label="Transliteration suggestions"
    >
      {/* Current typed query header */}
      <div className="px-3 py-1.5 font-medium border-b border-[#2d343c] bg-[#161a1e] text-[#9ca3b0] flex items-center justify-between text-xs">
        <span className="truncate max-w-[120px] font-mono text-white">{query}</span>
        <span className="text-[10px] text-gray-400">Space/Enter ↵</span>
      </div>

      {/* Options list */}
      <div className="max-h-56 overflow-y-auto py-1">
        {allOptions.map((opt, idx) => {
          const isSelected = idx === selectedIndex;
          const isRawOption = opt === query && idx === allOptions.length - 1;
          return (
            <div
              key={`${opt}-${idx}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(opt);
              }}
              onMouseEnter={() => {}}
              className={`px-3 py-1.5 cursor-pointer flex items-center justify-between transition-colors ${
                isSelected
                  ? 'bg-[#374151] text-white font-medium'
                  : 'hover:bg-[#282f37] text-[#e5e7eb]'
              }`}
              role="option"
              aria-selected={isSelected}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-xs text-[#9ca3b0] w-3.5 flex-shrink-0">{idx + 1}.</span>
                <span className={`truncate text-sm ${isRawOption ? 'font-mono text-xs text-[#a0aec0]' : ''}`}>
                  {opt}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer controls with Up/Down arrows */}
      <div className="px-2 py-1 bg-[#161a1e] border-t border-[#2d343c] flex items-center justify-between text-[11px] text-[#9ca3b0]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNavigate('up');
            }}
            className="p-1 hover:bg-[#282f37] rounded text-gray-300 hover:text-white"
            title="Previous (Arrow Up)"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNavigate('down');
            }}
            className="p-1 hover:bg-[#282f37] rounded text-gray-300 hover:text-white"
            title="Next (Arrow Down)"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
        <span className="text-[10px] text-gray-500">Esc to cancel</span>
      </div>
    </div>
  );
};

export default TransliterationMenu;
