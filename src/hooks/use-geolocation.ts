'use client'

import { useState, useEffect } from 'react'

// Israeli coastal cities with approximate coordinates
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'תל אביב': { lat: 32.0853, lng: 34.7818 },
  'חיפה': { lat: 32.7940, lng: 34.9896 },
  'נתניה': { lat: 32.3226, lng: 34.8553 },
  'הרצליה': { lat: 32.1651, lng: 34.8500 },
  'אשדוד': { lat: 31.8044, lng: 34.6553 },
  'אשקלון': { lat: 31.6658, lng: 34.5664 },
  'נהריה': { lat: 33.0077, lng: 35.0996 },
  'עכו': { lat: 32.9244, lng: 35.0762 },
  'ראשון לציון': { lat: 31.9730, lng: 34.7925 },
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function getNearestCity(lat: number, lng: number): { city: string; distanceKm: number } {
  let nearest = ''
  let minDist = Infinity

  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
    const dist = haversineKm(lat, lng, coords.lat, coords.lng)
    if (dist < minDist) {
      minDist = dist
      nearest = city
    }
  }

  return { city: nearest, distanceKm: Math.round(minDist * 10) / 10 }
}

export function getDistanceToCity(userLat: number, userLng: number, city: string): number {
  const coords = CITY_COORDINATES[city]
  if (!coords) return 999
  return Math.round(haversineKm(userLat, userLng, coords.lat, coords.lng) * 10) / 10
}

export type GeoState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; lat: number; lng: number; city: string }
  | { status: 'denied' }
  | { status: 'error'; message: string }

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: 'idle' })

  const request = () => {
    if (!navigator.geolocation) {
      setState({ status: 'error', message: 'Geolocation not supported' })
      return
    }
    setState({ status: 'loading' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        const { city } = getNearestCity(lat, lng)
        setState({ status: 'success', lat, lng, city })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState({ status: 'denied' })
        } else {
          setState({ status: 'error', message: err.message })
        }
      },
      { timeout: 8000, maximumAge: 300000 }
    )
  }

  // Auto-request on mount
  useEffect(() => {
    request()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { geoState: state, requestGeo: request }
}
