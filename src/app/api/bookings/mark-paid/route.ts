import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  sendBookingConfirmedEmailToInstructor,
  sendNewBookingEmailToHost,
} from '@/lib/email'

/**
 * POST /api/bookings/mark-paid
 * Instructor self-reports that they transferred payment via Bit or PayBox.
 * Confirms the booking (pending → confirmed) and sends confirmation emails.
 *
 * Body: { booking_id: string, method: 'bit' | 'paybox' }
 */
export async function POST(request: NextRequest) {
  try {
    const { booking_id, method } = await request.json()

    if (!booking_id || !['bit', 'paybox'].includes(method)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch full booking — verify ownership and pending status
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        id, status, instructor_id, total_price, host_payout, platform_fee,
        booking_date, start_time, end_time, class_type, participants_count,
        venue:venues(
          id, title, location_address, location_city,
          host:profiles!venues_host_id_fkey(id, full_name, email)
        ),
        instructor:profiles!bookings_instructor_id_fkey(id, full_name, email)
      `)
      .eq('id', booking_id)
      .eq('instructor_id', user.id)
      .eq('status', 'pending')
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found or already processed' }, { status: 404 })
    }

    // Confirm the booking
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', booking_id)
      .eq('instructor_id', user.id)
      .eq('status', 'pending')

    if (updateError) {
      console.error('[mark-paid] update error:', updateError)
      return NextResponse.json({ error: 'Failed to confirm booking' }, { status: 500 })
    }

    // Send confirmation emails (non-blocking)
    const venue = booking.venue as {
      title?: string; location_address?: string; location_city?: string;
      host?: { id?: string; full_name?: string; email?: string }
    } | null
    const instructor = booking.instructor as { id?: string; full_name?: string; email?: string } | null

    const emailData = {
      instructorName: instructor?.full_name ?? '',
      instructorEmail: instructor?.email ?? user.email ?? '',
      hostName: venue?.host?.full_name ?? '',
      hostEmail: venue?.host?.email ?? '',
      venueName: venue?.title ?? '',
      venueAddress: venue?.location_address ?? '',
      venueCity: venue?.location_city ?? '',
      bookingDate: booking.booking_date,
      startTime: booking.start_time,
      endTime: booking.end_time,
      totalPrice: booking.total_price,
      hostPayout: booking.host_payout,
      classType: booking.class_type ?? undefined,
      participantsCount: booking.participants_count ?? undefined,
      bookingId: booking_id,
    }

    Promise.all([
      instructor?.email
        ? sendBookingConfirmedEmailToInstructor(emailData)
        : Promise.resolve(),
      venue?.host?.email
        ? sendNewBookingEmailToHost(emailData)
        : Promise.resolve(),
    ]).catch(err => console.error('[mark-paid] email error:', err))

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[mark-paid] error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
