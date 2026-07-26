'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { VenueCard } from '@/components/venues/venue-card'
import type { Venue } from '@/lib/supabase/types'
import { MessageCircle, X, Send, Bot, Loader2, Waves, Navigation, Radio, Clock } from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  venues?: Venue[]
}

const COASTAL_CITIES: Record<string, { lat: number; lng: number }> = {
  'תל אביב': { lat: 32.0853, lng: 34.7818 },
  'הרצליה': { lat: 32.1663, lng: 34.8435 },
  'נתניה': { lat: 32.3215, lng: 34.8532 },
  'חיפה': { lat: 32.7940, lng: 34.9896 },
  'עכו': { lat: 32.9282, lng: 35.0828 },
  'אשדוד': { lat: 31.8040, lng: 34.6553 },
  'אשקלון': { lat: 31.6693, lng: 34.5711 },
  'אילת': { lat: 29.5577, lng: 34.9519 },
  'נהריה': { lat: 33.0042, lng: 35.0963 },
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function nearestCity(lat: number, lng: number): string {
  let best = { city: 'תל אביב', dist: Infinity }
  for (const [city, coords] of Object.entries(COASTAL_CITIES)) {
    const dist = haversineKm(lat, lng, coords.lat, coords.lng)
    if (dist < best.dist) best = { city, dist }
  }
  return best.city
}

const QUICK_ACTIONS = [
  { icon: Radio, label: 'שיעורים עכשיו', message: 'אילו שיעורים מתרחשים עכשיו?' },
  { icon: Navigation, label: 'קרוב אלי', message: 'מצאי חלל קרוב אלי' },
  { icon: Clock, label: 'בוקר מחר', message: 'אני מחפשת חלל לשיעור בוקר מחר ב-08:00' },
]

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'שלום! אני עוזרת WELLNESS&SEA 🌊\n\nאני יכולה לעזור לך למצוא חללים, לראות שיעורים פעילים עכשיו, ולהמליץ על משך שכירות מתאים. מה תרצי לעשות?',
}

function parseVenuesFromText(text: string): { cleanText: string; venues: Venue[] | null } {
  const match = text.match(/__VENUES_JSON__([\s\S]*?)__VENUES_END__/)
  if (!match) return { cleanText: text, venues: null }
  try {
    const venues = JSON.parse(match[1]) as Venue[]
    const cleanText = text.replace(/__VENUES_JSON__[\s\S]*?__VENUES_END__/, '').trim()
    return { cleanText, venues }
  } catch {
    return { cleanText: text.replace(/__VENUES_JSON__[\s\S]*?__VENUES_END__/, '').trim(), venues: null }
  }
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full ocean-gradient flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className={`max-w-[85%] space-y-3 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {message.content && (
          <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-ocean text-white rounded-tr-sm'
              : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-sm'
          }`}>
            {message.content}
          </div>
        )}
        {message.venues && message.venues.length > 0 && (
          <div className="w-full space-y-2">
            <p className="text-xs text-gray-400 font-medium">נמצאו {message.venues.length} חללים:</p>
            <div className="space-y-3 max-h-96 overflow-y-auto pl-1">
              {message.venues.map((venue) => (
                <div key={venue.id} className="scale-95 origin-right">
                  <VenueCard venue={venue} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [userCity, setUserCity] = useState<string | undefined>()
  const [locating, setLocating] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100)
  }, [isOpen])

  function shareLocation() {
    if (!navigator.geolocation || locating) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const city = nearestCity(pos.coords.latitude, pos.coords.longitude)
        setUserCity(city)
        setLocating(false)
        // Insert a system-style message
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `📍 מיקום אוכן — אני אחפש חללים קרובים ל${city}`,
          },
        ])
      },
      () => setLocating(false),
      { timeout: 8000 }
    )
  }

  const sendMessage = useCallback(async (overrideText?: string) => {
    const trimmed = (overrideText ?? input).trim()
    if (!trimmed || isLoading) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    const apiMessages = [...messages, userMessage]
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }))

    const payload = apiMessages.length === 1
      ? [{ role: 'user' as const, content: trimmed }]
      : apiMessages

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload, userCity }),
      })

      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      const assistantMessageId = crypto.randomUUID()

      setMessages((prev) => [...prev, { id: assistantMessageId, role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const match = line.slice(6).match(/^0:(.+)$/)
            if (match) {
              try {
                accumulated += JSON.parse(match[1]) as string
                setMessages((prev) =>
                  prev.map((m) => m.id === assistantMessageId ? { ...m, content: accumulated } : m)
                )
              } catch { /* skip */ }
            }
          }
        }
      }

      const { cleanText, venues } = parseVenuesFromText(accumulated)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId ? { ...m, content: cleanText, venues: venues ?? undefined } : m
        )
      )
    } catch (err) {
      console.error('Chat error:', err)
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: 'מצטערת, אירעה שגיאה. אנא נסי שוב.' }])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, userCity])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setIsOpen(false)} aria-hidden="true" />
      )}

      <div
        className={`fixed bottom-0 left-0 z-50 w-full sm:w-[400px] sm:bottom-24 sm:left-6 transition-all duration-300 ease-out ${
          isOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-4 opacity-0 pointer-events-none'
        }`}
        dir="rtl"
      >
        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col h-[75vh] sm:h-[560px] overflow-hidden">
          {/* Header */}
          <div className="ocean-gradient px-4 py-3.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Waves className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">סוכן WELLNESS&SEA</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                  <span className="text-white/70 text-xs">פעיל · יכול לחפש, להמליץ ולאתר</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Location share button */}
              <button
                onClick={shareLocation}
                disabled={locating || !!userCity}
                title={userCity ? `מיקום: ${userCity}` : 'שתפי מיקום'}
                className={`p-1.5 rounded-full transition-colors ${
                  userCity
                    ? 'text-green-300 cursor-default'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {locating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                aria-label="סגור"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Location indicator */}
          {userCity && (
            <div className="bg-green-50 border-b border-green-100 px-4 py-1.5 flex items-center gap-2">
              <Navigation className="w-3 h-3 text-green-500" />
              <span className="text-xs text-green-700">מיקום: {userCity}</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {isLoading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full ocean-gradient flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-white shadow-sm border border-gray-100 rounded-2xl rounded-tl-sm px-3.5 py-3 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-ocean animate-spin" />
                  <span className="text-xs text-gray-400">חושבת...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          {messages.length <= 1 && !isLoading && (
            <div className="px-3 pb-2 flex gap-2 overflow-x-auto flex-shrink-0">
              {QUICK_ACTIONS.map(({ icon: Icon, label, message }) => (
                <button
                  key={label}
                  onClick={() => sendMessage(message)}
                  className="flex items-center gap-1.5 bg-ocean/8 hover:bg-ocean/15 text-ocean text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors border border-ocean/20 flex-shrink-0"
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="border-t border-gray-100 p-3 flex-shrink-0 bg-white">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="שאלי על חללים, שיעורים פעילים..."
                rows={1}
                disabled={isLoading}
                className="flex-1 resize-none text-sm text-right border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean transition-all placeholder-gray-400 disabled:opacity-50 max-h-24 overflow-y-auto"
                dir="rtl"
                style={{ minHeight: '40px' }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 rounded-xl ocean-gradient flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:opacity-90 transition-opacity shadow-sm"
                aria-label="שלח"
              >
                <Send className="w-4 h-4 text-white rotate-180" />
              </button>
            </div>
            <p className="text-center text-xs text-gray-300 mt-2">Enter לשליחה · Shift+Enter שורה חדשה</p>
          </div>
        </div>
      </div>

      {/* Floating toggle */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className={`fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full ocean-gradient shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 ${isOpen ? 'rotate-180' : ''}`}
        aria-label={isOpen ? 'סגור עוזרת' : 'פתחי עוזרת AI'}
      >
        {isOpen ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
      </button>
    </>
  )
}
