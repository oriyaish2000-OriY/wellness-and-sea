import Link from 'next/link'
import { MapPin, Users, Star, Waves, Sparkles, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Venue } from '@/lib/supabase/types'
import { amenityLabels, NEW_VENUE_THRESHOLD_DAYS } from '@/lib/mock-data'

interface VenueCardProps {
  venue: Venue
  /** compact: narrower card for carousel use */
  compact?: boolean
  /** badgeType: auto-assigns a contextual badge */
  badgeType?: 'new' | 'recommended' | 'nearby' | 'visited'
  /** distance in km to show when in nearby mode */
  distanceKm?: number
}

function isNewVenue(createdAt: string): boolean {
  const created = new Date(createdAt).getTime()
  const cutoff = Date.now() - NEW_VENUE_THRESHOLD_DAYS * 86400000
  return created > cutoff
}

export function VenueCard({ venue, compact = false, badgeType, distanceKm }: VenueCardProps) {
  const topAmenities = Object.entries(venue.amenities)
    .filter(([, value]) => value)
    .slice(0, compact ? 2 : 4)
    .map(([key]) => amenityLabels[key])

  const showNewBadge = badgeType === 'new' || (!badgeType && isNewVenue(venue.created_at))

  return (
    <Card className={`overflow-hidden group bg-white border-0 venue-card-hover ${compact ? 'rounded-2xl' : ''}`} style={{ boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius)' }}>
      {/* Image / visual area */}
      <div className={`relative ocean-gradient overflow-hidden ${compact ? 'h-40' : 'h-56'}`}>
        {venue.images?.[0] ? (
          <img
            src={venue.images[0]}
            alt={venue.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Waves className="w-16 h-16 text-white/20" />
          </div>
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,74,74,0.6) 0%, transparent 60%)' }} />

        {/* Top badges row */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
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

        {/* Bottom row: rating + distance */}
        <div className="absolute bottom-3 right-3 left-3 flex items-center justify-between">
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

        {/* Amenities */}
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

        {/* Footer */}
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

        <Button
          className="w-full mt-3 bg-ocean hover:bg-deep-ocean text-white text-sm font-semibold rounded-full"
          style={{ height: 38 }}
          asChild
        >
          <Link href={`/venues/${venue.id}`}>לפרטים והזמנה</Link>
        </Button>
      </div>
    </Card>
  )
}
