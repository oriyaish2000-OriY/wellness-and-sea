import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  sendBookingConfirmedEmailToInstructor,
  sendNewBookingEmailToHost,
  sendBookingCancelledEmailToInstructor,
  sendBookingCancelledEmailToHost,
} from '@/lib/email'

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

/**
 * Parse Grow webhook body — Grow may send JSON or application/x-www-form-urlencoded.
 * Returns a plain object with string values.
 */
function parsePayload(rawBody: string, contentType: string): Record<string, string> {
  const ct = contentType.toLowerCase()

  // Try JSON first
  if (ct.includes('application/json')) {
    try {
      return JSON.parse(rawBody) as Record<string, string>
    } catch {
      // fall through to form parse
    }
  }

  // Try form-encoded
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const params = new URLSearchParams(rawBody)
    const obj: Record<string, string> = {}
    params.forEach((v, k) => { obj[k] = v })
    return obj
  }

  // Last resort — try JSON parse on any content type
  try {
    return JSON.parse(rawBody) as Record<string, string>
  } catch {
    // Try form parse as final fallback
    const params = new URLSearchParams(rawBody)
    const obj: Record<string, string> = {}
    params.forEach((v, k) => { obj[k] = v })
    return obj
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const contentType = request.headers.get('content-type') ?? ''

    const payload = parsePayload(rawBody, contentType)

    // Verify webhookKey if configured
    const expectedKey = process.env.GROW_WEBHOOK_KEY
    if (expectedKey) {
      const receivedKey = payload.webhookKey ?? payload.webhook_key ?? ''
      if (receivedKey !== expectedKey) {
        console.warn('[Grow webhook] Invalid webhookKey — rejecting')
        return NextResponse.json({ error: 'Invalid webhook key' }, { status: 401 })
      }
    }

    const supabase = createServiceClient()

    // --- Payment completed (Grow success event) ---
    // Grow sends status/event in various fields; check all known patterns
    const status = payload.status ?? payload.event ?? ''
    const isSuccess =
      status === 'payment.completed' ||
      status === 'completed' ||
      status === 'success' ||
      status === 'paid' ||
      payload.paymentStatus === 'completed' ||
      payload.paymentStatus === 'success'

    const isFailed =
      status === 'payment.failed' ||
      status === 'payment.cancelled' ||
      status === 'failed' ||
      status === 'cancelled' ||
      payload.paymentStatus === 'failed' ||
      payload.paymentStatus === 'cancelled'

    if (isSuccess) {
      const bookingId = payload.cField1
      const transactionId = payload.transactionCode ?? payload.transaction_id ?? null

      if (!bookingId) {
        return NextResponse.json({ error: 'Missing booking_id (cField1)' }, { status: 400 })
      }

      const { error: dbError } = await supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          tranzila_transaction_id: transactionId, // column reused for Grow transaction code
        })
        .eq('id', bookingId)
        .eq('status', 'pending')

      if (dbError) {
        console.error('[Grow webhook] Failed to confirm booking', bookingId, dbError)
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
      }

      // Send notification emails (non-blocking)
      try {
        const booking = await getBookingDetails(supabase, bookingId)
        if (booking) {
          const venue = booking.venue as {
            title?: string
            location_address?: string
            location_city?: string
            host?: { id?: string; full_name?: string }
          } | null
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
            bookingId,
          }

          await Promise.all([
            instructorEmail ? sendBookingConfirmedEmailToInstructor(emailData) : Promise.resolve(),
            hostEmail ? sendNewBookingEmailToHost(emailData) : Promise.resolve(),
          ])
        }
      } catch (emailErr) {
        console.error('[Grow webhook] Email send error (non-fatal):', emailErr)
      }

      console.log(`[Grow webhook] Booking ${bookingId} confirmed. Transaction: ${transactionId ?? 'n/a'}`)
    }

    if (isFailed) {
      const bookingId = payload.cField1
      if (bookingId) {
        await supabase
          .from('bookings')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancellation_reason: 'תשלום נכשל',
          })
          .eq('id', bookingId)
          .eq('status', 'pending')

        // Send cancellation emails (non-blocking)
        try {
          const booking = await getBookingDetails(supabase, bookingId)
          if (booking) {
            const venue = booking.venue as {
              title?: string
              location_address?: string
              location_city?: string
              host?: { id?: string; full_name?: string }
            } | null
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
              bookingId,
            }

            await Promise.all([
              instructorEmail
                ? sendBookingCancelledEmailToInstructor(emailData, 'תשלום נכשל')
                : Promise.resolve(),
              hostEmail
                ? sendBookingCancelledEmailToHost(emailData, 'תשלום נכשל')
                : Promise.resolve(),
            ])
          }
        } catch (emailErr) {
          console.error('[Grow webhook] Cancellation email error (non-fatal):', emailErr)
        }

        console.log(`[Grow webhook] Booking ${bookingId} cancelled due to failed payment`)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[Grow webhook] Processing error:', e)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
