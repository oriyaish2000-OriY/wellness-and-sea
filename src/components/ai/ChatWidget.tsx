'use client'

import { useState, useRef, useEffect } from 'react'
import { VenueCard } from '@/components/venues/venue-card'
import type { Venue } from '@/lib/supabase/types'
import {
  MessageCircle, X, Bot, Loader2, Waves,
  Navigation, Radio, Clock, Users, Star, DollarSign, History, Search
} from 'lucide-react'

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

type Intent = 'happening_now' | 'nearby' | 'morning' | 'my_history' | 'recommendation' | 'small_group' | 'large_group' | 'budget' | 'all'

interface QuickAction {
  icon: React.ElementType
  label: string
  intent: Intent
  message: string
}

const QUICK_ACTIONS: QuickAction[] = [
  { icon: Radio,      label: 'שיעורים עכשיו',        intent: 'happening_now',  message: 'אילו שיעורים מתרחשים עכשיו?' },
  { icon: Navigation, label: 'קרוב אלי',              intent: 'nearby',         message: 'חללים קרובים אלי' },
  { icon: Clock,      label: 'שיעורי בוקר',           intent: 'morning',        message: 'חלל לשיעור בוקר' },
  { icon: Star,       label: 'המלצה אישית',           intent: 'recommendation', message: 'המלצה אישית בשבילי' },
  { icon: History,    label: 'ביקרתי בעבר',           intent: 'my_history',     message: 'ההזמנות הקודמות שלי' },
  { icon: Users,      label: 'קבוצה קטנה (עד 15)',   intent: 'small_group',    message: 'חלל לקבוצה קטנה' },
  { icon: Users,      label: 'קבוצה גדולה (20+)',    intent: 'large_group',    message: 'חלל לקבוצה גדולה' },
  { icon: DollarSign, label: 'מחיר נוח',              intent: 'budget',         message: 'חללים במחיר נוח' },
]

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'שלום! אני עוזרת WELLNESS&SEA 🌊\n\nבחרי מהשאלות המוכנות או שתפי מיקום לחיפוש מדויק:',
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
                  <VenueCard venue={venue} compact />
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
  const [isLoading, setIsLoading] = useState(false)
  const [userCity, setUserCity] = useState<string | undefined>()
  const [locating, setLocating] = useState(false)
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  function shareLocation() {
    if (!navigator.geolocation || locating) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const city = nearestCity(pos.coords.latitude, pos.coords.longitude)
        setUserCity(city)
        setLocating(false)
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `📍 מיקום אותר — ${city}. עכשיו לחצי על "קרוב אלי" לחיפוש חללים באזורך.`,
        }])
      },
      () => {
        setLocating(false)
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'לא הצלחתי לגשת למיקום. אנא אפשרי גישה למיקום בהגדרות הדפדפן.',
        }])
      },
      { timeout: 8000 }
    )
  }

  async function sendIntent(intent: Intent, userMessage: string) {
    if (isLoading) return

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: userMessage }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, message: userMessage, userCity }),
      })

      if (!res.ok) {
        if (res.status === 401) {
          setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'יש להתחבר לחשבון כדי להשתמש בעוזרת. 🔐',
          }])
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json() as { reply: string; venues?: Venue[] }
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply,
        venues: data.venues?.length ? data.venues : undefined,
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'אירעה שגיאה. אנא נסי שוב.',
      }])
    } finally {
      setIsLoading(false)
    }
  }

  async function handleFreeText() {
    const text = inputText.trim()
    if (!text || isLoading) return
    setInputText('')

    // Simple keyword → intent map
    const m = text.toLowerCase()
    let intent: Intent = 'all'
    if (/עכשיו|פעיל|מתרחש/.test(m)) intent = 'happening_now'
    else if (/קרוב|ליד|מיקום/.test(m)) intent = 'nearby'
    else if (/בוקר|07|08|09/.test(m)) intent = 'morning'
    else if (/היסטוריה|הזמנות שלי/.test(m)) intent = 'my_history'
    else if (/המלצ|בשביל|מתאים/.test(m)) intent = 'recommendation'
    else if (/קטנ|עד 10|עד 15/.test(m)) intent = 'small_group'
    else if (/גדול|20\+|קבוצה גדול/.test(m)) intent = 'large_group'
    else if (/זול|תקציב|מחיר נוח/.test(m)) intent = 'budget'

    await sendIntent(intent, text)
  }

  const showQuickActions = messages.length <= 1 && !isLoading

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
        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col h-[75vh] sm:h-[580px] overflow-hidden">

          {/* Header */}
          <div className="ocean-gradient px-4 py-3.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Waves className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">עוזרת WELLNESS&SEA</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                  <span className="text-white/70 text-xs">פעילה · מחפשת חללים בשבילך</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={shareLocation}
                disabled={locating || !!userCity}
                title={userCity ? `מיקום: ${userCity}` : 'שתפי מיקום'}
                className={`p-1.5 rounded-full transition-colors ${
                  userCity ? 'text-green-300 cursor-default' : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
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
                  <span className="text-xs text-gray-400">מחפשת...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick action buttons grid */}
          {showQuickActions && (
            <div className="px-3 pb-2 flex-shrink-0">
              <p className="text-xs text-gray-400 mb-2 text-center">בחרי שאלה מהרשימה:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_ACTIONS.map(({ icon: Icon, label, intent, message }) => (
                  <button
                    key={label}
                    onClick={() => sendIntent(intent, message)}
                    className="flex items-center gap-1.5 bg-ocean/6 hover:bg-ocean/12 text-ocean text-xs px-2.5 py-2 rounded-xl transition-colors border border-ocean/15 text-right"
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Free text input (after first interaction) */}
          {!showQuickActions && (
            <div className="border-t border-gray-100 p-3 flex-shrink-0 bg-white">
              {/* Re-show quick actions as small chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">
                {QUICK_ACTIONS.slice(0, 4).map(({ icon: Icon, label, intent, message }) => (
                  <button
                    key={label}
                    onClick={() => sendIntent(intent, message)}
                    disabled={isLoading}
                    className="flex items-center gap-1 bg-gray-100 hover:bg-ocean/10 text-gray-600 hover:text-ocean text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors flex-shrink-0 disabled:opacity-40"
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => setMessages([WELCOME_MESSAGE])}
                  className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors flex-shrink-0"
                >
                  <Search className="w-3 h-3" />
                  כל האפשרויות
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleFreeText() }}
                  placeholder="הקלידי שאלה חופשית..."
                  disabled={isLoading}
                  className="flex-1 text-sm text-right border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean placeholder-gray-400 disabled:opacity-50"
                  dir="rtl"
                />
                <button
                  onClick={handleFreeText}
                  disabled={!inputText.trim() || isLoading}
                  className="w-9 h-9 rounded-xl ocean-gradient flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:opacity-90 shadow-sm"
                >
                  <Search className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating toggle */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full ocean-gradient shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        aria-label={isOpen ? 'סגור עוזרת' : 'פתחי עוזרת'}
      >
        {isOpen ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
      </button>
    </>
  )
}
