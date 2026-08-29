import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchTransliteration,
  isTransliterationSupported,
} from '../services/transliterationService';
import { getCaretCoordinates } from '../utils/caretCoordinates';

export interface UseTransliterationOptions {
  language: string;
  enabled: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (newValue: string) => void;
}

export interface UseTransliterationReturn {
  isOpen: boolean;
  query: string;
  suggestions: string[];
  selectedIndex: number;
  position: { top: number; left: number };
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
  selectSuggestion: (suggestion: string, appendSpace?: boolean) => void;
  navigateSuggestion: (direction: 'up' | 'down') => void;
  closeMenu: () => void;
  isSupported: boolean;
}

export function useTransliteration({
  language,
  enabled,
  textareaRef,
  value,
  onChange,
}: UseTransliterationOptions): UseTransliterationReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [wordRange, setWordRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

  const dismissedWordRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSupported = isTransliterationSupported(language);

  // Close menu and cleanup
  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSuggestions([]);
    setSelectedIndex(0);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    abortControllerRef.current?.abort();
  }, []);

  // Compute all available options including original query as last item
  const allOptions = suggestions.length > 0
    ? (!suggestions.includes(query) ? [...suggestions, query] : suggestions)
    : (query ? [query] : []);

  // Accept and insert a suggestion into the textarea
  const selectSuggestion = useCallback(
    (chosenWord: string, appendSpace = true) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = wordRange.start;
      const end = wordRange.end;

      const prefix = value.slice(0, start);
      const suffix = value.slice(end);
      const spacer = appendSpace ? ' ' : '';
      const nextValue = `${prefix}${chosenWord}${spacer}${suffix}`;
      const nextCursor = start + chosenWord.length + spacer.length;

      onChange(nextValue);
      closeMenu();

      // Restore focus and cursor position after React re-renders value
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(nextCursor, nextCursor);
        }
      });
    },
    [wordRange, value, onChange, closeMenu, textareaRef]
  );

  const navigateSuggestion = useCallback((direction: 'up' | 'down') => {
    setSelectedIndex((prev) => {
      if (allOptions.length === 0) return 0;
      if (direction === 'down') {
        return (prev + 1) % allOptions.length;
      }
      return (prev - 1 + allOptions.length) % allOptions.length;
    });
  }, [allOptions.length]);

  // Monitor cursor and value changes to detect active phonetic word
  useEffect(() => {
    if (!enabled || !isSupported) {
      if (isOpen) closeMenu();
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursor = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursor);

    // Match romanized word characters ending at current cursor
    const match = textBeforeCursor.match(/([a-zA-Z0-9']+)$/);

    if (!match) {
      if (isOpen) closeMenu();
      dismissedWordRef.current = null;
      return;
    }

    const activeWord = match[1];
    const start = cursor - activeWord.length;
    const end = cursor;

    // Check if user dismissed this exact word
    if (dismissedWordRef.current === activeWord) {
      return;
    }

    setWordRange({ start, end });
    setQuery(activeWord);

    // Calculate pixel coordinates for the popup
    try {
      const caret = getCaretCoordinates(textarea, start);
      const scrollTop = textarea.scrollTop;
      const scrollLeft = textarea.scrollLeft;

      // Position right below the active word
      const top = caret.top - scrollTop + caret.height + 4;
      const left = Math.max(0, caret.left - scrollLeft);

      setPosition({ top, left });
    } catch {
      // Fallback position
      setPosition({ top: 40, left: 10 });
    }

    // Debounced fetch
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    abortControllerRef.current?.abort();

    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const results = await fetchTransliteration(activeWord, language, {
        num: 5,
        signal: controller.signal,
      });

      if (!controller.signal.aborted && results.length > 0) {
        setSuggestions(results);
        setSelectedIndex(0);
        setIsOpen(true);
      }
    }, 60);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [value, enabled, isSupported, language, isOpen, closeMenu, textareaRef]);

  // Keyboard interceptor: returns true if event was handled
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!isOpen || allOptions.length === 0) {
        return false;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        navigateSuggestion('down');
        return true;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        navigateSuggestion('up');
        return true;
      }

      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        e.stopPropagation();
        const selected = allOptions[selectedIndex] || allOptions[0] || query;
        selectSuggestion(selected, true);
        return true;
      }

      if (e.key === 'Enter') {
        // If Shift+Enter is pressed, let it create a newline normally unless selecting
        if (!e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          const selected = allOptions[selectedIndex] || allOptions[0] || query;
          selectSuggestion(selected, false);
          return true;
        }
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        const selected = allOptions[selectedIndex] || allOptions[0] || query;
        selectSuggestion(selected, true);
        return true;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        dismissedWordRef.current = query;
        closeMenu();
        return true;
      }

      // Number keys 1-9 to select directly
      if (/^[1-9]$/.test(e.key)) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= allOptions.length) {
          e.preventDefault();
          e.stopPropagation();
          selectSuggestion(allOptions[num - 1], true);
          return true;
        }
      }

      return false;
    },
    [isOpen, allOptions, selectedIndex, query, selectSuggestion, navigateSuggestion, closeMenu]
  );

  return {
    isOpen,
    query,
    suggestions,
    selectedIndex,
    position,
    handleKeyDown,
    selectSuggestion,
    navigateSuggestion,
    closeMenu,
    isSupported,
  };
}
