'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Venue } from '@/lib/supabase/types'
import { VenueCard } from './venue-card'

interface VenueCarouselProps {
  title: string
  subtitle?: string
  venues: Venue[]
  seeAllHref?: string
  seeAllLabel?: string
  badgeType?: 'new' | 'recommended' | 'nearby' | 'visited'
  emptyMessage?: string
}

export function VenueCarousel({
  title,
  subtitle,
  venues,
  seeAllHref,
  seeAllLabel = 'כל החללים',
  badgeType,
  emptyMessage = 'אין חללים להצגה',
}: VenueCarouselProps) {
  if (venues.length === 0) return null

  return (
    <section className="py-6">
      {/* Section header */}
      <div className="flex items-end justify-between mb-4 px-4 md:px-0">
        <div>
          <h2 className="text-xl font-bold text-deep-ocean">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="text-sm text-ocean hover:text-deep-ocean flex items-center gap-1 transition-colors flex-shrink-0 mr-3"
          >
            {seeAllLabel}
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {/* Horizontal scroll container */}
      <div
        className="flex gap-4 overflow-x-auto pb-4 px-4 md:px-0 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {venues.map((venue) => (
          <div
            key={venue.id}
            className="flex-shrink-0 w-72 snap-start"
          >
            <VenueCard venue={venue} badgeType={badgeType} compact />
          </div>
        ))}

        {/* See all card at the end */}
        {seeAllHref && venues.length >= 4 && (
          <div className="flex-shrink-0 w-40 snap-start">
            <Link
              href={seeAllHref}
              className="h-full min-h-[280px] flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-ocean/20 hover:border-ocean/50 bg-white/50 hover:bg-ocean/5 transition-all text-ocean"
            >
              <div className="w-10 h-10 rounded-full bg-ocean/10 flex items-center justify-center">
                <ArrowLeft className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-center px-2">{seeAllLabel}</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
