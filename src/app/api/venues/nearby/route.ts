import { NextRequest, NextResponse } from 'next/server'
import { getNearbyVenues } from '@/lib/supabase/queries'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  const radius = parseFloat(searchParams.get('radius') ?? '10')
  const limit = parseInt(searchParams.get('limit') ?? '8')

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  const venues = await getNearbyVenues(lat, lng, radius, limit)
  return NextResponse.json(venues)
}
