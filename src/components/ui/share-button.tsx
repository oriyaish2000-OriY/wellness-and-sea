'use client'

import { useState } from 'react'
import { Share2, Copy, Check, MessageCircle } from 'lucide-react'
import { Button } from './button'

interface ShareButtonProps {
  url: string
  title: string
  description?: string
  /** compact = icon only, no label */
  compact?: boolean
}

export function ShareButton({ url, title, description, compact = false }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  const fullText = description ? `${title}\n${description}\n${url}` : `${title}\n${url}`
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: description ?? title, url })
        return
      } catch { /* user dismissed */ }
    }
    setOpen(prev => !prev)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative inline-block">
      <Button
        type="button"
        variant="outline"
        size={compact ? 'icon' : 'sm'}
        onClick={handleNativeShare}
        className="gap-1.5 border-gray-200 hover:border-ocean hover:text-ocean"
        title="שתפי"
      >
        <Share2 className={compact ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        {!compact && <span>שתפי</span>}
      </Button>

      {/* Fallback dropdown (when Web Share API not available) */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-2 z-50 rounded-xl shadow-xl border border-gray-100 bg-white min-w-[200px] overflow-hidden"
            style={{ direction: 'rtl' }}
          >
            {/* WhatsApp */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
              onClick={() => setOpen(false)}
            >
              <span className="text-lg">💬</span>
              <span className="font-medium text-gray-700">שתפי בוואטסאפ</span>
            </a>

            {/* Instagram — copy link (no direct API) */}
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 transition-colors text-right"
              onClick={async () => {
                await handleCopy()
                setOpen(false)
              }}
            >
              <span className="text-lg">📸</span>
              <span className="font-medium text-gray-700">העתקי לאינסטגרם</span>
            </button>

            <div style={{ borderTop: '1px solid #f0e6d3' }} />

            {/* Copy link */}
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 transition-colors text-right"
              onClick={async () => { await handleCopy(); setOpen(false) }}
            >
              {copied
                ? <Check className="w-4 h-4 text-green-500" />
                : <Copy className="w-4 h-4 text-gray-400" />}
              <span className="font-medium text-gray-700">
                {copied ? 'הועתק!' : 'העתקי קישור'}
              </span>
            </button>
          </div>
        </>
      )}

      {/* Inline copy confirmation */}
      {copied && !open && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2.5 py-1 rounded-full whitespace-nowrap">
          הועתק!
        </span>
      )}
    </div>
  )
}

/** Full share panel — shown after venue publish */
export function SharePanel({ url, title, description }: { url: string; title: string; description?: string }) {
  const [copied, setCopied] = useState(false)

  const fullText = `${title}\n${description ? description + '\n' : ''}${url}`
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div className="space-y-3">
      {/* URL bar */}
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5"
        style={{ background: 'rgba(10,74,74,0.06)', border: '1.5px solid rgba(10,74,74,0.15)' }}
      >
        <span className="flex-1 text-sm text-gray-700 truncate dir-ltr text-left">{url}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: copied ? '#5c8c6e' : '#0a4a4a', color: 'white' }}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'הועתק!' : 'העתק'}
        </button>
      </div>

      {/* Share buttons */}
      <div className="flex gap-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          style={{ background: '#25D366', color: 'white' }}
        >
          <MessageCircle className="w-4 h-4" />
          וואטסאפ
        </a>

        <button
          type="button"
          onClick={async () => {
            if (navigator.share) {
              try { await navigator.share({ title, text: description ?? title, url }); return } catch {}
            }
            await handleCopy()
          }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors border"
          style={{ borderColor: '#f0e6d3', color: '#0a4a4a' }}
        >
          <Share2 className="w-4 h-4" />
          שתף עוד
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center">
        הקישור יפתח את דף החלל עם לוגו WELLNESS&SEA לשיתוף ברשתות
      </p>
    </div>
  )
}
