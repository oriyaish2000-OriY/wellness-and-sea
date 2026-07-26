'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Radio, Users, MapPin, Clock } from 'lucide-react'
import type { Venue } from '@/lib/supabase/types'

interface HappeningNowVenue extends Venue {
  current_class_type?: string
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 bg-coral text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
      עכשיו
    </span>
  )
}

export function HappeningNowSection() {
  const [venues, setVenues] = useState<HappeningNowVenue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/venues/happening-now')
      .then((r) => r.json())
      .then((data) => setVenues(Array.isArray(data) ? data : []))
      .catch(() => setVenues([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (venues.length === 0) return null

  return (
    <section className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-5">
          <Radio className="w-5 h-5 text-coral" />
          <h2 className="text-xl font-bold text-deep-ocean">שיעורים מתרחשים כעת</h2>
          <LiveBadge />
        </div>
        <p className="text-sm text-gray-500 -mt-3 mb-5 mr-7">חללים עם שיעורים פעילים ברגע זה</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {venues.map((venue) => (
            <Link
              key={venue.id}
              href={`/venues/${venue.id}`}
              className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5"
            >
              {/* Image */}
              <div className="relative h-36 bg-gradient-to-br from-ocean/30 to-teal/20 overflow-hidden">
                {venue.images?.[0] ? (
                  <img
                    src={venue.images[0]}
                    alt={venue.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">🌊</div>
                )}
                {/* Live overlay */}
                <div className="absolute top-2 right-2">
                  <LiveBadge />
                </div>
                {/* Pulse ring */}
                <div className="absolute top-2 right-2 translate-x-full -translate-y-0.5 mr-2">
                  <span className="flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral opacity-60" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-coral" />
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-3.5">
                <h3 className="font-semibold text-gray-900 text-sm truncate group-hover:text-ocean transition-colors">
                  {venue.title}
                </h3>
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{venue.location_city}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  {venue.current_class_type && (
                    <span className="flex items-center gap-1 text-xs text-teal font-medium">
                      <Clock className="w-3 h-3" />
                      {venue.current_class_type}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-gray-500 mr-auto">
                    <Users className="w-3 h-3" />
                    עד {venue.capacity}
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
