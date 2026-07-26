'use client'

import { useEffect, useState } from 'react'
import { Navigation, Loader2, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Venue } from '@/lib/supabase/types'
import { VenueCard } from '@/components/venues/venue-card'
import { useGeolocation } from '@/hooks/use-geolocation'

export function NearbySection() {
  const { geoState, requestGeo } = useGeolocation()
  const [nearbyVenues, setNearbyVenues] = useState<Array<Venue & { distance_km: number }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (geoState.status !== 'success') return

    const { lat, lng } = geoState
    setLoading(true)

    fetch(`/api/venues/nearby?lat=${lat}&lng=${lng}&radius=15&limit=8`)
      .then(r => r.json())
      .then(data => setNearbyVenues(Array.isArray(data) ? data : []))
      .catch(() => setNearbyVenues([]))
      .finally(() => setLoading(false))
  }, [geoState])

  if (geoState.status === 'idle' || geoState.status === 'loading') {
    return (
      <section className="py-6 px-4 md:px-0">
        <div className="flex items-center gap-2 mb-4">
          <Loader2 className="w-4 h-4 text-ocean animate-spin" />
          <span className="text-sm text-gray-500">מאתר את המיקום שלך...</span>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-shrink-0 w-72 h-64 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (geoState.status === 'denied' || geoState.status === 'error') {
    return (
      <section className="py-6 px-4 md:px-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-deep-ocean">קרוב אליך</h2>
        </div>
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-ocean/5 border border-ocean/10">
          <div className="w-10 h-10 rounded-full bg-ocean/10 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5 text-ocean" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-deep-ocean">הפעלי מיקום לחללים הקרובים אליך</p>
            <p className="text-xs text-gray-500 mt-0.5">נשתמש במיקום רק כדי למצוא את החללים הכי קרובים</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-ocean text-ocean hover:bg-ocean hover:text-white flex-shrink-0"
            onClick={requestGeo}
          >
            <Navigation className="w-3.5 h-3.5 ml-1.5" />
            אפשרי
          </Button>
        </div>
      </section>
    )
  }

  if (geoState.status === 'success') {
    return (
      <section className="py-6">
        <div className="flex items-end justify-between mb-4 px-4 md:px-0">
          <div>
            <h2 className="text-xl font-bold text-deep-ocean">קרוב אליך</h2>
            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-ocean" />
              חללים עד 15 ק&quot;מ ממך
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex gap-4 overflow-hidden px-4 md:px-0">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex-shrink-0 w-72 h-64 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : nearbyVenues.length > 0 ? (
          <div
            className="flex gap-4 overflow-x-auto pb-4 px-4 md:px-0 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {nearbyVenues.map((venue) => (
              <div key={venue.id} className="flex-shrink-0 w-72 snap-start">
                <VenueCard
                  venue={venue}
                  compact
                  distanceKm={Math.round(venue.distance_km * 10) / 10}
                  badgeType="nearby"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 text-center py-8 text-gray-400">
            <p className="text-sm">אין חללים פעילים בטווח 15 ק&quot;מ כרגע</p>
            <p className="text-xs mt-1">בדקי גם בערים סמוכות</p>
          </div>
        )}
      </section>
    )
  }

  return null
}
