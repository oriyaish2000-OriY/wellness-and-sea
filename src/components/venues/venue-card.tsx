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
    <Card className={`overflow-hidden hover:shadow-xl transition-all duration-300 group bg-white border-0 shadow-md ${compact ? 'rounded-2xl' : ''}`}>
      {/* Image / visual area */}
      <div className={`relative ocean-gradient overflow-hidden ${compact ? 'h-40' : 'h-48'}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <Waves className="w-16 h-16 text-white/20" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

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
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 group-hover:text-ocean transition-colors line-clamp-1 text-right mb-1">
          {venue.title}
        </h3>

        <div className="flex items-center gap-1 text-gray-500 text-xs mb-2">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{venue.location_address}, {venue.location_city}</span>
        </div>

        {!compact && (
          <p className="text-gray-600 text-sm line-clamp-2 mb-3 text-right">
            {venue.description}
          </p>
        )}

        {/* Amenities */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {topAmenities.map((amenity) => amenity && (
            <span
              key={amenity.label}
              className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
            >
              {amenity.icon} {amenity.label}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div>
            <span className="font-bold text-ocean text-lg">₪{venue.hourly_price}</span>
            <span className="text-gray-400 text-xs"> / שעה</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400 text-xs">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              עד {venue.capacity}
            </span>
          </div>
        </div>

        <Button
          className="w-full mt-3 bg-ocean hover:bg-deep-ocean text-white text-sm h-9"
          asChild
        >
          <Link href={`/venues/${venue.id}`}>לפרטים והזמנה</Link>
        </Button>
      </div>
    </Card>
  )
}
