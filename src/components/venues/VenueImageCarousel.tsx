'use client'

import { useState, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X, Expand } from 'lucide-react'

interface Props {
  images: string[]
  title: string
}

export function VenueImageCarousel({ images, title }: Props) {
  const [current, setCurrent] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)

  const count = images.length
  const prev = useCallback(() => setCurrent(i => (i - 1 + count) % count), [count])
  const next = useCallback(() => setCurrent(i => (i + 1) % count), [count])

  // Keyboard navigation when lightbox is open
  useEffect(() => {
    if (!lightbox) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') next()
      if (e.key === 'ArrowRight') prev()
      if (e.key === 'Escape') setLightbox(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightbox, next, prev])

  // Touch swipe
  const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX)
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return
    const diff = touchStart - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev()
    setTouchStart(null)
  }

  if (count === 0) return null

  return (
    <>
      {/* ── Main carousel ─────────────────────────────────────────── */}
      <div
        className="relative h-72 md:h-[420px] overflow-hidden bg-gray-900 select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Images */}
        {images.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`${title} — תמונה ${i + 1}`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              i === current ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10 pointer-events-none" />

        {/* Left / Right arrows */}
        {count > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="תמונה קודמת"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/65 backdrop-blur-sm flex items-center justify-center text-white transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              aria-label="תמונה הבאה"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/65 backdrop-blur-sm flex items-center justify-center text-white transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Expand to lightbox */}
        <button
          onClick={() => setLightbox(true)}
          aria-label="הגדל תמונה"
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/65 backdrop-blur-sm flex items-center justify-center text-white transition"
        >
          <Expand className="w-4 h-4" />
        </button>

        {/* Counter badge */}
        {count > 1 && (
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
            {current + 1} / {count}
          </div>
        )}

        {/* Dot indicators */}
        {count > 1 && (
          <div className="absolute bottom-14 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
            {images.slice(0, 10).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all pointer-events-auto ${
                  i === current ? 'bg-white scale-125' : 'bg-white/45 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        )}

        {/* Thumbnail strip — shows max 5 */}
        {count > 1 && (
          <div className="absolute bottom-0 left-0 right-0 flex gap-1 p-1.5 bg-black/30 backdrop-blur-sm">
            {images.slice(0, 8).map((src, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`flex-shrink-0 h-10 rounded overflow-hidden transition-all ${
                  i === current
                    ? 'ring-2 ring-white opacity-100 w-16'
                    : 'opacity-60 hover:opacity-90 w-12'
                }`}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox ──────────────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightbox(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {count > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev() }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next() }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            </>
          )}

          <img
            src={images[current]}
            alt={`${title} — תמונה ${current + 1}`}
            className="max-h-[90vh] max-w-[92vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setCurrent(i) }}
                className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-white scale-125' : 'bg-white/40'}`}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
