'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin, Users, Star, Waves, Sparkles, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShareButton } from '@/components/ui/share-button'
import { Venue } from '@/lib/supabase/types'
import { amenityLabels, NEW_VENUE_THRESHOLD_DAYS } from '@/lib/mock-data'

interface VenueCardProps {
  venue: Venue
  compact?: boolean
  badgeType?: 'new' | 'recommended' | 'nearby' | 'visited'
  distanceKm?: number
}

function isNewVenue(createdAt: string): boolean {
  const created = new Date(createdAt).getTime()
  const cutoff = Date.now() - NEW_VENUE_THRESHOLD_DAYS * 86400000
  return created > cutoff
}

export function VenueCard({ venue, compact = false, badgeType, distanceKm }: VenueCardProps) {
  const [imgIndex, setImgIndex] = useState(0)
  const images = venue.images ?? []
  const count = images.length

  const prev = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setImgIndex(i => (i - 1 + count) % count)
  }
  const next = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setImgIndex(i => (i + 1) % count)
  }

  const topAmenities = Object.entries(venue.amenities)
    .filter(([, value]) => value)
    .slice(0, compact ? 2 : 4)
    .map(([key]) => amenityLabels[key])

  const showNewBadge = badgeType === 'new' || (!badgeType && isNewVenue(venue.created_at))

  return (
    <Card
      className={`overflow-hidden group bg-white border-0 venue-card-hover ${compact ? 'rounded-2xl' : ''}`}
      style={{ boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius)' }}
    >
      {/* Image area */}
      <div className={`relative ocean-gradient overflow-hidden ${compact ? 'h-40' : 'h-56'}`}>
        {count > 0 ? (
          <>
            {images.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={`${venue.title} — ${i + 1}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
                  i === imgIndex ? 'opacity-100' : 'opacity-0'
                } ${count === 1 ? 'group-hover:scale-105 transition-transform duration-300' : ''}`}
              />
            ))}

            {/* Prev / Next arrows — only shown when there are multiple images */}
            {count > 1 && (
              <>
                <button
                  onClick={prev}
                  aria-label="תמונה קודמת"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/45 hover:bg-black/65 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={next}
                  aria-label="תמונה הבאה"
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/45 hover:bg-black/65 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Dot indicators */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-10">
                  {images.slice(0, 8).map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setImgIndex(i) }}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        i === imgIndex ? 'bg-white scale-125' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>

                {/* Image counter */}
                <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full z-10">
                  {imgIndex + 1}/{count}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Waves className="w-16 h-16 text-white/20" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

        {/* Top badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          {venue.bonus_offer && (
            <Badge className="bg-golden text-white border-0 text-xs shadow">
              🎁 {venue.bonus_offer}
            </Badge>
          )}
          {showNewBadge && (
            <Badge className="bg-coral text-white border-0 text-xs shadow">
              ✨ חדש
            </Badge>
          )}
          {badgeType === 'recommended' && (
            <Badge className="bg-ocean text-white border-0 text-xs shadow flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              מומלץ
            </Badge>
          )}
          {badgeType === 'visited' && (
            <Badge className="bg-teal text-white border-0 text-xs shadow flex items-center gap-1">
              <Clock className="w-3 h-3" />
              ביקרת כאן
            </Badge>
          )}
        </div>

        {/* Bottom: rating + distance */}
        <div className="absolute bottom-3 right-3 left-3 flex items-center justify-between z-10 pointer-events-none">
          <div className="flex items-center gap-1 text-white">
            <Star className="w-3.5 h-3.5 fill-golden text-golden" />
            <span className="text-sm font-medium">4.9</span>
            <span className="text-xs text-white/70">(24)</span>
          </div>
          {distanceKm !== undefined && (
            <span className="text-xs text-white/90 bg-black/30 rounded-full px-2 py-0.5">
              📍 {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} מ'` : `${distanceKm.toFixed(1)} ק"מ`}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-bold text-dark group-hover:text-ocean transition-colors line-clamp-1 text-right mb-1.5" style={{ fontSize: 16 }}>
          {venue.title}
        </h3>

        <div className="flex items-center gap-1 text-gray-500 text-xs mb-2.5">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{venue.location_address}, {venue.location_city}</span>
        </div>

        {!compact && (
          <p className="text-gray-400 text-sm line-clamp-2 mb-3 text-right leading-relaxed">
            {venue.description}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 mb-4">
          {topAmenities.map((amenity) => amenity && (
            <span
              key={amenity.label}
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(10,74,74,0.07)', color: '#0d6e6e' }}
            >
              {amenity.icon} {amenity.label}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #f0e6d3' }}>
          <div>
            <span className="font-black text-ocean" style={{ fontSize: 20 }}>₪{venue.hourly_price}</span>
            <span className="text-gray-400 text-xs font-normal"> / שעה</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400 text-xs">
            <Users className="w-3 h-3" />
            עד {venue.capacity}
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <Button
            className="flex-1 bg-ocean hover:bg-deep-ocean text-white text-sm font-semibold rounded-full"
            style={{ height: 38 }}
            asChild
          >
            <Link href={`/venues/${venue.id}`}>לפרטים והזמנה</Link>
          </Button>
          <ShareButton
            url={`${typeof window !== 'undefined' ? window.location.origin : ''}/venues/${venue.id}`}
            title={`🌊 ${venue.title} — WELLNESS&SEA`}
            description={`${venue.location_city} | ₪${venue.hourly_price}/שעה`}
            compact
          />
        </div>
      </div>
    </Card>
  )
}
