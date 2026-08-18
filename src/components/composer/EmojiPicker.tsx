/**
 * Emoji picker surfaced from PostComposer / ParentPostComposer's
 * toolbar. Categorised tabs + keyword/name emoji search.
 */
import React, { useState, useRef, useEffect, useMemo } from 'react'
import { X, Search } from 'lucide-react'
import {
  EMOJI_CATEGORIES,
  CATEGORY_ICONS,
  CATEGORY_NAMES,
  searchEmojis,
} from './emojiData'

export interface EmojiPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelectEmoji: (emoji: string) => void
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ isOpen, onClose, onSelectEmoji }) => {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState(CATEGORY_NAMES[0] || 'Smileys')
  const searchRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setActiveCategory(CATEGORY_NAMES[0] || 'Smileys')
      setTimeout(() => searchRef.current?.focus(), 100)
    }
  }, [isOpen])

  const filteredEmojis = useMemo(() => {
    return search.trim() ? searchEmojis(search) : null
  }, [search])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <style>{`.emoji-no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative bg-[var(--hrk-bg-app)] border border-[var(--hrk-border-subtle)] rounded-xl shadow-xl w-full max-w-md h-[460px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[var(--hrk-border-subtle)]">
          <h3 className="text-sm font-semibold text-white">Emoji Picker</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-[var(--hrk-bg-surface)] rounded text-[var(--hrk-text-tertiary)]"
            aria-label="Close emoji picker"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--hrk-text-tertiary)]" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search emoji (e.g. smile, dog, fire, heart)…"
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--hrk-bg-surface)] border border-[var(--hrk-border-subtle)] rounded-lg text-white placeholder-[var(--hrk-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--hrk-info)]"
            />
          </div>
        </div>

        {/* Category tabs */}
        {!search.trim() && (
          <div
            className="emoji-no-scrollbar flex gap-1 px-3 pt-2 pb-1 overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            {CATEGORY_NAMES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setActiveCategory(cat)
                  scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className={`p-1.5 text-lg rounded-md transition-colors ${
                  activeCategory === cat
                    ? 'bg-[var(--hrk-brand)]/20 ring-1 ring-blue-500'
                    : 'hover:bg-[var(--hrk-bg-surface)]'
                }`}
                title={cat}
              >
                {CATEGORY_ICONS[cat] || cat.charAt(0)}
              </button>
            ))}
          </div>
        )}

        {/* Emoji grid */}
        <div
          ref={scrollRef}
          className="emoji-no-scrollbar flex-1 overflow-y-auto p-3 min-h-0"
          style={{ scrollbarWidth: 'none' }}
        >
          {search.trim() ? (
            filteredEmojis && filteredEmojis.length > 0 ? (
              <div className="grid grid-cols-8 gap-1">
                {filteredEmojis.map((emoji, i) => (
                  <button
                    key={`${emoji}-${i}`}
                    type="button"
                    onClick={() => onSelectEmoji(emoji)}
                    className="p-1.5 hover:bg-[var(--hrk-bg-surface)] rounded text-xl transition-colors text-center"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-[var(--hrk-text-tertiary)] text-sm py-8">
                No emoji found for "{search}"
              </p>
            )
          ) : (
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_CATEGORIES[activeCategory]?.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  type="button"
                  onClick={() => onSelectEmoji(emoji)}
                  className="p-1.5 hover:bg-[var(--hrk-bg-surface)] rounded text-xl transition-colors text-center"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EmojiPicker
