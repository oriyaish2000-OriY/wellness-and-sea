import { NextResponse } from 'next/server'
import { getHappeningNowVenues } from '@/lib/supabase/queries'

export const runtime = 'nodejs'
// Revalidate every 2 minutes — live data but cached briefly
export const revalidate = 120

export async function GET() {
  const venues = await getHappeningNowVenues(6)
  return NextResponse.json(venues)
}
