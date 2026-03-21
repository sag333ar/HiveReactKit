import React from 'react'

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
  '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
  '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😔', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩',
  '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓',
  '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️',
  '🖖', '👋', '🤝', '👏', '🙌', '👐', '🤲', '🤜', '🤛', '✊', '👊',
]

export interface EmojiPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelectEmoji: (emoji: string) => void
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ isOpen, onClose, onSelectEmoji }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-xl p-4 max-w-sm w-full max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Choose an emoji</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 text-xl leading-none">&times;</button>
        </div>
        <div className="grid grid-cols-8 gap-1.5 max-h-60 overflow-y-auto">
          {EMOJIS.map((emoji) => (
            <button key={emoji} type="button" onClick={() => onSelectEmoji(emoji)} className="p-2 hover:bg-gray-800 rounded text-lg transition-colors">
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default EmojiPicker
