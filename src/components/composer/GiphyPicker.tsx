import React, { useState, useRef, useEffect } from 'react'
import { Search, X, Image } from 'lucide-react'

interface Gif {
  id: string
  title: string
  images: {
    fixed_height?: { url: string }
    downsized?: { url: string }
    original?: { url: string }
  }
}

export interface GiphyPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelectGif: (gifUrl: string) => void
  /** GIPHY API key. Required for search functionality. */
  giphyApiKey?: string
}

const GiphyPicker: React.FC<GiphyPickerProps> = ({ isOpen, onClose, onSelectGif, giphyApiKey }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [gifs, setGifs] = useState<Gif[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100)
  }, [isOpen])

  const searchGifs = async (query: string) => {
    if (!query.trim()) return
    searchAbortRef.current?.abort()
    const abortController = new AbortController()
    searchAbortRef.current = abortController
    setIsLoading(true)
    setError(null)
    try {
      if (!giphyApiKey) throw new Error('GIPHY API key not provided. Pass giphyApiKey prop.')
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${encodeURIComponent(query)}&limit=20&rating=g`,
        { signal: abortController.signal }
      )
      if (!response.ok) throw new Error(`Failed to fetch GIFs: ${response.statusText}`)
      const data = await response.json()
      setGifs(data.data || [])
    } catch (err) {
      if (abortController.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to search GIFs')
    } finally {
      if (!abortController.signal.aborted) setIsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    searchGifs(searchTerm)
  }

  const handleGifSelect = (gif: Gif) => {
    const url = gif.images.original?.url || gif.images.downsized?.url || gif.images.fixed_height?.url
    if (url) { onSelectGif(url); onClose() }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Choose a GIF</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          <form onSubmit={handleSearch} className="mb-4">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search for GIFs..."
                className="flex-1 px-3 py-2 border border-gray-700 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
              />
              <button type="submit" disabled={isLoading || !searchTerm.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                <Search className="h-4 w-4" />Search
              </button>
            </div>
          </form>
          {error && <div className="text-red-400 text-sm mb-4">{error}</div>}
          {isLoading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto" />
              <p className="mt-2 text-gray-400">Searching for GIFs...</p>
            </div>
          )}
          {gifs.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
              {gifs.map((gif) => (
                <button key={gif.id} type="button" onClick={() => handleGifSelect(gif)} className="relative group rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all">
                  <img src={gif.images.fixed_height?.url || gif.images.downsized?.url || gif.images.original?.url} alt={gif.title} className="w-full h-32 object-cover" loading="lazy" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/90 rounded-full p-2"><Image className="h-4 w-4 text-blue-400" /></div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {!isLoading && gifs.length === 0 && searchTerm && (
            <div className="text-center py-8 text-gray-400">No GIFs found for &quot;{searchTerm}&quot;</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GiphyPicker
