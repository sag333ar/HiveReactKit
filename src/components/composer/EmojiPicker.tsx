import React, { useState, useRef, useEffect } from 'react'
import { X, Search } from 'lucide-react'

const EMOJI_CATEGORIES: Record<string, string[]> = {
  'Smileys': [
    '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
    '😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡',
    '🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴',
    '😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐',
    '😕','🫤','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥',
    '😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿',
  ],
  'Gestures': [
    '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟',
    '🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏',
    '🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻',
  ],
  'People': [
    '👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵','🙍','🙎','🙅','🙆',
    '💁','🙋','🧏','🙇','🤦','🤷','👮','🕵️','💂','🥷','👷','🫅','🤴','👸','👳','👲',
    '🧕','🤵','👰','🤰','🫃','🤱','👼','🎅','🤶','🦸','🦹','🧙','🧚','🧛','🧜','🧝',
  ],
  'Animals': [
    '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵',
    '🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗',
    '🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷️','🐢',
    '🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈',
  ],
  'Food': [
    '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥',
    '🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠',
    '🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭',
    '🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜',
    '🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧',
    '🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯',
  ],
  'Travel': [
    '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵',
    '🚲','🛴','🛹','🛼','🚁','🛸','🚀','🛩️','✈️','🚢','⛵','🚤','🛥️','🛳️','⛴️','🚂',
    '🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒',
    '🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋','⛲','⛺','🌁','🌃','🏙️','🌄','🌅','🌆',
  ],
  'Objects': [
    '⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️','💾','💿','📀','📼','📷',
    '📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️',
    '💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳','💎','⚖️',
    '🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧲','🔫','💣','🧨',
    '🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️','🏺','🔮','📿','🧿','🪬','💈','⚗️',
  ],
  'Symbols': [
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓',
    '💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐',
    '⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑',
    '☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴',
    '🈵','🈹','🈲','🅰️','🅱️','🆎','🅾️','🆑','🆘','❌','⭕','🛑','⛔','📛','🚫','💯',
    '💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅',
    '🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎','🌐','💠',
    '🔘','🔳','🔲','⬛','⬜','◼️','◻️','◾','◽','▪️','▫️','🔴','🟠','🟡','🟢','🔵','🟣','🟤','⚫','⚪',
  ],
  'Flags': [
    '🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️',
    '🇦🇫','🇦🇱','🇩🇿','🇦🇸','🇦🇩','🇦🇴','🇦🇮','🇦🇬','🇦🇷','🇦🇲','🇦🇺','🇦🇹',
    '🇧🇸','🇧🇭','🇧🇩','🇧🇧','🇧🇾','🇧🇪','🇧🇿','🇧🇯','🇧🇹','🇧🇴','🇧🇦','🇧🇼',
    '🇧🇷','🇧🇳','🇧🇬','🇧🇫','🇧🇮','🇨🇦','🇨🇳','🇨🇴','🇨🇷','🇭🇷','🇨🇺','🇨🇿',
    '🇩🇰','🇩🇴','🇪🇨','🇪🇬','🇸🇻','🇪🇹','🇫🇮','🇫🇷','🇩🇪','🇬🇭','🇬🇷','🇬🇹',
    '🇭🇹','🇭🇳','🇭🇰','🇭🇺','🇮🇸','🇮🇳','🇮🇩','🇮🇷','🇮🇶','🇮🇪','🇮🇱','🇮🇹',
    '🇯🇲','🇯🇵','🇯🇴','🇰🇿','🇰🇪','🇰🇼','🇱🇧','🇱🇾','🇱🇹','🇱🇺','🇲🇾','🇲🇽',
    '🇲🇦','🇲🇿','🇳🇵','🇳🇱','🇳🇿','🇳🇬','🇳🇴','🇴🇲','🇵🇰','🇵🇦','🇵🇪','🇵🇭',
    '🇵🇱','🇵🇹','🇶🇦','🇷🇴','🇷🇺','🇸🇦','🇷🇸','🇸🇬','🇸🇰','🇸🇮','🇿🇦','🇰🇷',
    '🇪🇸','🇱🇰','🇸🇪','🇨🇭','🇹🇼','🇹🇭','🇹🇷','🇺🇦','🇦🇪','🇬🇧','🇺🇸','🇻🇪','🇻🇳',
  ],
}

const CATEGORY_ICONS: Record<string, string> = {
  'Smileys': '😀',
  'Gestures': '👋',
  'People': '👤',
  'Animals': '🐶',
  'Food': '🍔',
  'Travel': '✈️',
  'Objects': '💡',
  'Symbols': '❤️',
  'Flags': '🏁',
}

const CATEGORY_NAMES = Object.keys(EMOJI_CATEGORIES)

export interface EmojiPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelectEmoji: (emoji: string) => void
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ isOpen, onClose, onSelectEmoji }) => {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState(CATEGORY_NAMES[0])
  const searchRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setActiveCategory(CATEGORY_NAMES[0])
      setTimeout(() => searchRef.current?.focus(), 100)
    }
  }, [isOpen])

  if (!isOpen) return null

  const allEmojis = Object.values(EMOJI_CATEGORIES).flat()
  const filteredEmojis = search
    ? allEmojis.filter(e => e.includes(search))
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <style>{`.emoji-no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-xl w-full max-w-md h-[400px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-white">Emoji Picker</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-800 rounded text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search emoji..."
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Category tabs */}
        {!search && (
          <div className="emoji-no-scrollbar flex gap-1 px-3 pt-2 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
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
                    ? 'bg-blue-600/20 ring-1 ring-blue-500'
                    : 'hover:bg-gray-800'
                }`}
                title={cat}
              >
                {CATEGORY_ICONS[cat] || cat.charAt(0)}
              </button>
            ))}
          </div>
        )}

        {/* Emoji grid */}
        <div ref={scrollRef} className="emoji-no-scrollbar flex-1 overflow-y-auto p-3 min-h-0" style={{ scrollbarWidth: 'none' }}>
          {search ? (
            filteredEmojis && filteredEmojis.length > 0 ? (
              <div className="grid grid-cols-8 gap-1">
                {filteredEmojis.map((emoji, i) => (
                  <button
                    key={`${emoji}-${i}`}
                    type="button"
                    onClick={() => onSelectEmoji(emoji)}
                    className="p-1.5 hover:bg-gray-800 rounded text-xl transition-colors text-center"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 text-sm py-8">No emoji found</p>
            )
          ) : (
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_CATEGORIES[activeCategory]?.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  type="button"
                  onClick={() => onSelectEmoji(emoji)}
                  className="p-1.5 hover:bg-gray-800 rounded text-xl transition-colors text-center"
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
