import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
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

    // Auth check via user client
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch full booking — verify ownership and pending status
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        id, status, instructor_id, total_price, host_payout,
        booking_date, start_time, end_time, class_type, participants_count,
        venue:venues(
          title, location_address, location_city,
          host:profiles!venues_host_id_fkey(id, full_name)
        ),
        instructor:profiles!bookings_instructor_id_fkey(id, full_name)
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

    // Fetch emails from auth.users via service role (emails are not in profiles table)
    const venue = booking.venue as {
      title?: string; location_address?: string; location_city?: string;
      host?: { id?: string; full_name?: string }
    } | null
    const instructor = booking.instructor as { id?: string; full_name?: string } | null

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    let instructorEmail = user.email ?? ''
    let hostEmail = ''

    if (serviceKey && supabaseUrl && venue?.host?.id) {
      try {
        const adminClient = createServiceClient(supabaseUrl, serviceKey)
        const { data: hostUser } = await adminClient.auth.admin.getUserById(venue.host.id)
        hostEmail = hostUser?.user?.email ?? ''
      } catch (e) {
        console.error('[mark-paid] failed to fetch host email:', e)
      }
    }

    const emailData = {
      instructorName: instructor?.full_name ?? '',
      instructorEmail,
      hostName: venue?.host?.full_name ?? '',
      hostEmail,
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

    // Non-blocking — never fail the response over email
    Promise.all([
      instructorEmail ? sendBookingConfirmedEmailToInstructor(emailData) : Promise.resolve(),
      hostEmail ? sendNewBookingEmailToHost(emailData) : Promise.resolve(),
    ]).catch(err => console.error('[mark-paid] email error:', err))

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[mark-paid] error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
