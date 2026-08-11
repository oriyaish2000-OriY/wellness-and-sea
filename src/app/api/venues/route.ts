import { NextRequest, NextResponse } from 'next/server'
import { getVenues } from '@/lib/supabase/queries'
import { checkRateLimitDB } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  // L-3: Rate-limit public venue search — 60 per IP per minute
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await checkRateLimitDB(`venues_search:${ip}`, 60, 60)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const city        = searchParams.get('city')        ?? undefined
  const minCapacity = searchParams.get('minCapacity') ? Number(searchParams.get('minCapacity')) : undefined
  const maxPrice    = searchParams.get('maxPrice')    ? Number(searchParams.get('maxPrice'))    : undefined
  const limit       = Math.min(Number(searchParams.get('limit') ?? 20), 50) // cap at 50

  const venues = await getVenues({ city, minCapacity, maxPrice })
  return NextResponse.json(venues.slice(0, limit))
}
