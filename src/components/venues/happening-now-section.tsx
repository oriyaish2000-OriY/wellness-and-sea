'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MapPin, Clock } from 'lucide-react'
import type { Venue } from '@/lib/supabase/types'

interface HappeningNowVenue extends Venue {
  current_class_type?: string
}

export function HappeningNowSection() {
  const [venues, setVenues] = useState<HappeningNowVenue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/venues/happening-now')
      .then(r => r.json())
      .then(data => setVenues(Array.isArray(data) ? data : []))
      .catch(() => setVenues([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading || venues.length === 0) return null

  return (
    <section className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="flex items-center gap-3 mb-5">
          {/* Animated pulse ring */}
          <span className="relative flex h-4 w-4 flex-shrink-0">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
              style={{ background: '#e07a5f' }}
            />
            <span
              className="relative inline-flex rounded-full h-4 w-4"
              style={{ background: '#e07a5f' }}
            />
          </span>
          <h2 className="font-black text-xl" style={{ color: '#0a4a4a', fontFamily: "'Playfair Display', serif" }}>
            גאות עכשיו
          </h2>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white"
            style={{ background: '#e07a5f' }}
          >
            LIVE
          </span>
          <span className="text-sm text-gray-400">שיעורים מתרחשים ברגע זה</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {venues.map(venue => (
            <Link
              key={venue.id}
              href={`/venues/${venue.id}`}
              className="group rounded-2xl overflow-hidden block"
              style={{
                background: 'white',
                boxShadow: 'var(--shadow-card)',
                transition: 'transform 0.25s ease, box-shadow 0.25s ease',
              }}
            >
              {/* Venue image */}
              <div className="relative h-40 overflow-hidden" style={{ background: 'linear-gradient(145deg, #0a4a4a, #1a9090)' }}>
                {venue.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={venue.images[0]}
                    alt={venue.title}
                    className="w-full h-full object-cover"
                    style={{ transition: 'transform 0.35s ease' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl opacity-30">🌊</div>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,74,74,0.65) 0%, transparent 50%)' }} />

                {/* LIVE badge top-right */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                  </span>
                  <span
                    className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full text-white"
                    style={{ background: '#e07a5f' }}
                  >
                    פעיל עכשיו
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3
                  className="font-bold text-sm mb-1.5 truncate"
                  style={{ color: '#1a2a2a', transition: 'color 0.2s' }}
                >
                  {venue.title}
                </h3>
                <div className="flex items-center gap-1 text-xs mb-2" style={{ color: '#6b7c7c' }}>
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{venue.location_city}</span>
                </div>
                <div className="flex items-center justify-between">
                  {venue.current_class_type && (
                    <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#0d6e6e' }}>
                      <Clock className="w-3 h-3" />
                      {venue.current_class_type}
                    </span>
                  )}
                  <span
                    className="text-xs font-bold mr-auto px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(13,110,110,0.08)', color: '#0d6e6e' }}
                  >
                    ₪{venue.hourly_price}/שעה
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
