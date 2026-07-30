import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateTimeSlots } from '@/lib/booking-engine'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: venueId } = await params
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') // YYYY-MM-DD

  if (!date) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Get venue's weekly availabilities
  const { data: availabilities } = await supabase
    .from('availabilities')
    .select('*')
    .eq('venue_id', venueId)

  if (!availabilities || availabilities.length === 0) {
    return NextResponse.json({ slots: [] })
  }

  // Get existing bookings on this date
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('start_time, end_time')
    .eq('venue_id', venueId)
    .eq('booking_date', date)
    .not('status', 'eq', 'cancelled')

  const dayOfWeek = new Date(date).getDay()
  const dayAvailability = availabilities.find(a => a.day_of_week === dayOfWeek)

  if (!dayAvailability) {
    return NextResponse.json({ slots: [] })
  }

  const durationParam = searchParams.get('duration')
  const durationMinutes = durationParam ? Math.round(parseFloat(durationParam) * 60) : 60

  const slots = generateTimeSlots(
    dayAvailability.start_time,
    dayAvailability.end_time,
    existingBookings ?? [],
    durationMinutes
  )

  return NextResponse.json({ slots })
}
