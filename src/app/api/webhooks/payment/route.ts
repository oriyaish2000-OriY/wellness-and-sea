import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  sendBookingConfirmedEmailToInstructor,
  sendNewBookingEmailToHost,
  sendBookingCancelledEmailToInstructor,
  sendBookingCancelledEmailToHost,
} from '@/lib/email'

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.TRANZILA_WEBHOOK_SECRET
  if (!secret) return true // dev mode: no secret configured, allow all
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  return expected === signature
}

// Uses SERVICE_ROLE_KEY to bypass RLS — only for webhook use
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getBookingDetails(supabase: ReturnType<typeof createServiceClient>, bookingId: string) {
  const { data } = await supabase
    .from('bookings')
    .select(`
      *,
      venue:venues(id, title, location_address, location_city, host:profiles(id, full_name)),
      instructor:profiles(id, full_name)
    `)
    .eq('id', bookingId)
    .single()
  return data
}

async function getProfileEmail(supabase: ReturnType<typeof createServiceClient>, userId: string): Promise<string> {
  const { data } = await supabase.auth.admin.getUserById(userId)
  return data?.user?.email ?? ''
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-tranzila-signature')

    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)
    const supabase = createServiceClient()

    if (body.event === 'payment.completed') {
      const { booking_id, transaction_id } = body.metadata ?? body

      if (!booking_id) {
        return NextResponse.json({ error: 'Missing booking_id' }, { status: 400 })
      }

      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          tranzila_transaction_id: transaction_id ?? null,
        })
        .eq('id', booking_id)
        .eq('status', 'pending')

      if (error) {
        console.error('Webhook: failed to confirm booking', booking_id, error)
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
      }

      // Send notification emails (non-blocking)
      try {
        const booking = await getBookingDetails(supabase, booking_id)
        if (booking) {
          const venue = booking.venue as { title?: string; location_address?: string; location_city?: string; host?: { id?: string; full_name?: string } } | null
          const instructor = booking.instructor as { id?: string; full_name?: string } | null

          const [instructorEmail, hostEmail] = await Promise.all([
            instructor?.id ? getProfileEmail(supabase, instructor.id) : Promise.resolve(''),
            venue?.host?.id ? getProfileEmail(supabase, venue.host.id) : Promise.resolve(''),
          ])

          const emailData = {
            instructorName: instructor?.full_name ?? 'מדריכה',
            instructorEmail,
            hostName: venue?.host?.full_name ?? 'מארח',
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

          await Promise.all([
            instructorEmail ? sendBookingConfirmedEmailToInstructor(emailData) : Promise.resolve(),
            hostEmail ? sendNewBookingEmailToHost(emailData) : Promise.resolve(),
          ])
        }
      } catch (emailErr) {
        console.error('Email send error (non-fatal):', emailErr)
      }

      console.log(`✅ Booking ${booking_id} confirmed via Tranzila webhook`)
    }

    if (body.event === 'payment.failed') {
      const { booking_id } = body.metadata ?? body
      if (booking_id) {
        await supabase
          .from('bookings')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancellation_reason: 'תשלום נכשל',
          })
          .eq('id', booking_id)
          .eq('status', 'pending')

        // Send cancellation emails
        try {
          const booking = await getBookingDetails(supabase, booking_id)
          if (booking) {
            const venue = booking.venue as { title?: string; location_address?: string; location_city?: string; host?: { id?: string; full_name?: string } } | null
            const instructor = booking.instructor as { id?: string; full_name?: string } | null

            const [instructorEmail, hostEmail] = await Promise.all([
              instructor?.id ? getProfileEmail(supabase, instructor.id) : Promise.resolve(''),
              venue?.host?.id ? getProfileEmail(supabase, venue.host.id) : Promise.resolve(''),
            ])

            const emailData = {
              instructorName: instructor?.full_name ?? 'מדריכה',
              instructorEmail,
              hostName: venue?.host?.full_name ?? 'מארח',
              hostEmail,
              venueName: venue?.title ?? '',
              venueAddress: venue?.location_address ?? '',
              venueCity: venue?.location_city ?? '',
              bookingDate: booking.booking_date,
              startTime: booking.start_time,
              endTime: booking.end_time,
              totalPrice: booking.total_price,
              hostPayout: booking.host_payout,
              bookingId: booking_id,
            }

            await Promise.all([
              instructorEmail ? sendBookingCancelledEmailToInstructor(emailData, 'תשלום נכשל') : Promise.resolve(),
              hostEmail ? sendBookingCancelledEmailToHost(emailData, 'תשלום נכשל') : Promise.resolve(),
            ])
          }
        } catch (emailErr) {
          console.error('Email send error (non-fatal):', emailErr)
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (e) {
    console.error('Webhook processing error:', e)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
