'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Navigation, MapPin, Clock, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Venue } from '@/lib/supabase/types'

// Israel's coastal cities with lat/lng
const COASTAL_CITIES: Record<string, { lat: number; lng: number; label: string }> = {
  'תל אביב': { lat: 32.0853, lng: 34.7818, label: 'תל אביב' },
  'הרצליה': { lat: 32.1663, lng: 34.8435, label: 'הרצליה' },
  'נתניה': { lat: 32.3215, lng: 34.8532, label: 'נתניה' },
  'חיפה': { lat: 32.7940, lng: 34.9896, label: 'חיפה' },
  'עכו': { lat: 32.9282, lng: 35.0828, label: 'עכו' },
  'אשדוד': { lat: 31.8040, lng: 34.6553, label: 'אשדוד' },
  'אשקלון': { lat: 31.6693, lng: 34.5711, label: 'אשקלון' },
  'אילת': { lat: 29.5577, lng: 34.9519, label: 'אילת' },
  'נהריה': { lat: 33.0042, lng: 35.0963, label: 'נהריה' },
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function nearestCity(lat: number, lng: number) {
  let best = { city: 'תל אביב', dist: Infinity }
  for (const [city, coords] of Object.entries(COASTAL_CITIES)) {
    const dist = haversineKm(lat, lng, coords.lat, coords.lng)
    if (dist < best.dist) best = { city, dist }
  }
  return best
}

export function NearbyInstructorSection() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'denied'>('idle')
  const [venues, setVenues] = useState<Venue[]>([])
  const [cityLabel, setCityLabel] = useState('')
  const [distKm, setDistKm] = useState<number | null>(null)
  const [isWorkout, setIsWorkout] = useState(false)

  useEffect(() => {
    const h = new Date().getHours()
    setIsWorkout(h >= 6 && h <= 12)
  }, [])

  function requestLocation() {
    if (!navigator.geolocation) {
      setStatus('denied')
      return
    }
    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        const { city, dist } = nearestCity(latitude, longitude)
        setCityLabel(city)
        setDistKm(Math.round(dist))

        try {
          const res = await fetch(`/api/venues?city=${encodeURIComponent(city)}&limit=4`)
          if (res.ok) {
            const data = await res.json()
            setVenues(Array.isArray(data) ? data.slice(0, 4) : [])
          }
        } catch {
          setVenues([])
        }
        setStatus('done')
      },
      () => setStatus('denied'),
      { timeout: 8000, maximumAge: 300000 }
    )
  }

  if (status === 'idle') {
    return (
      <Card className="border-0 shadow-sm border-dashed border-2 border-ocean/20 bg-ocean/2">
        <CardContent className="py-6 text-center">
          <Navigation className="w-8 h-8 text-ocean mx-auto mb-3" />
          <h3 className="font-semibold text-deep-ocean text-sm mb-1">חללים קרובים אליך</h3>
          <p className="text-xs text-gray-400 mb-4 max-w-xs mx-auto">
            אפשרי גישה למיקום ונמצא את החללים הקרובים ביותר אליך{isWorkout ? ' — יש שיעורים בוקר פנויים עכשיו!' : ''}
          </p>
          <Button
            onClick={requestLocation}
            className="bg-ocean hover:bg-deep-ocean text-white text-sm h-9"
          >
            <Navigation className="w-3.5 h-3.5 ml-1.5" />
            אכן מיקום
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (status === 'loading') {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-6 text-center">
          <Loader2 className="w-6 h-6 text-ocean mx-auto animate-spin mb-2" />
          <p className="text-sm text-gray-400">מאתרת חללים קרובים...</p>
        </CardContent>
      </Card>
    )
  }

  if (status === 'denied') {
    return (
      <Card className="border-0 shadow-sm bg-gray-50">
        <CardContent className="py-5 text-center">
          <p className="text-sm text-gray-400">לא ניתן לאתר מיקום. בחרי עיר בחיפוש.</p>
          <Button className="mt-3 text-xs h-8" variant="outline" asChild>
            <Link href="/venues">חיפוש לפי עיר</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-deep-ocean flex items-center gap-2">
            <Navigation className="w-4 h-4 text-ocean" />
            קרוב אליך — {cityLabel}
            {distKm !== null && (
              <span className="text-xs font-normal text-gray-400">({distKm} ק"מ)</span>
            )}
          </CardTitle>
          <Link
            href={`/venues?city=${encodeURIComponent(cityLabel)}`}
            className="text-sm text-ocean hover:text-deep-ocean transition-colors"
          >
            עוד ›
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {venues.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            אין חללים פעילים ב{cityLabel} כרגע
          </p>
        ) : (
          <div className="space-y-2">
            {venues.map((venue) => (
              <Link
                key={venue.id}
                href={`/venues/${venue.id}`}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                {/* Thumbnail */}
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                  {venue.images?.[0] ? (
                    <img src={venue.images[0]} alt={venue.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl">🌊</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-ocean transition-colors">
                    {venue.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />
                      {venue.location_city}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      ₪{venue.hourly_price}/ש&quot;ה
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
