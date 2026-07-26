import { NextRequest, NextResponse } from 'next/server'
import { getVenues } from '@/lib/supabase/queries'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const city = searchParams.get('city') ?? undefined
  const minCapacity = searchParams.get('minCapacity') ? Number(searchParams.get('minCapacity')) : undefined
  const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 20

  const venues = await getVenues({ city, minCapacity, maxPrice })
  return NextResponse.json(venues.slice(0, limit))
}
