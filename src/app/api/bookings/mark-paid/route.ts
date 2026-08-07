import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  sendBookingConfirmedEmailToInstructor,
  sendNewBookingEmailToHost,
} from '@/lib/email'
import { chargeProviderToken } from '@/lib/payments/cardcomPaymentService'
import { calcSpaceRentalSplit } from '@/lib/payments/commissionUtils'

/**
 * POST /api/bookings/mark-paid
 * Instructor self-reports payment via Bit or PayBox.
 *
 * Flow:
 *  1. Confirm booking (pending → confirmed)
 *  2. Send confirmation emails
 *  3. Charge host's saved Cardcom token for the platform commission (10% of base)
 *     — non-blocking: failure is logged but does NOT fail the response
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

    // Fetch booking — verify ownership, pending status, and load host token data
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        id, status, instructor_id, total_price, host_payout,
        booking_date, start_time, end_time, class_type, participants_count,
        venue:venues(
          id, title, location_address, location_city,
          host:profiles!venues_host_id_fkey(
            id, full_name,
            cardcom_token, cardcom_token_card_month, cardcom_token_card_year
          )
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

    // ── Security gate: host must have Cardcom token registered ───────────────
    const host = (booking.venue as { host?: { cardcom_token?: string } } | null)?.host
    if (!host?.cardcom_token) {
      console.warn(`[mark-paid] Blocked: host has no Cardcom token for booking ${booking_id}`)
      return NextResponse.json({
        error: 'בעל החלל טרם רשם כרטיס לניכוי עמלות. יש לפנות לתמיכה.',
        code: 'HOST_TOKEN_MISSING',
      }, { status: 402 })
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

    const venue      = booking.venue      as { id?: string; title?: string; location_address?: string; location_city?: string; host?: { id?: string; full_name?: string; cardcom_token?: string; cardcom_token_card_month?: number; cardcom_token_card_year?: number } } | null
    const instructor = booking.instructor as { id?: string; full_name?: string } | null

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    let instructorEmail = user.email ?? ''
    let hostEmail = ''

    if (serviceKey && supabaseUrl && venue?.host?.id) {
      try {
        const adminSupa = createServiceClient(supabaseUrl, serviceKey)
        const { data: hostUser } = await adminSupa.auth.admin.getUserById(venue.host.id)
        hostEmail = hostUser?.user?.email ?? ''
      } catch (e) {
        console.error('[mark-paid] failed to fetch host email:', e)
      }
    }

    const emailData = {
      instructorName:    instructor?.full_name ?? '',
      instructorEmail,
      hostName:          venue?.host?.full_name ?? '',
      hostEmail,
      venueName:         venue?.title ?? '',
      venueAddress:      venue?.location_address ?? '',
      venueCity:         venue?.location_city ?? '',
      bookingDate:       booking.booking_date,
      startTime:         booking.start_time,
      endTime:           booking.end_time,
      totalPrice:        booking.total_price,
      hostPayout:        booking.host_payout,
      classType:         booking.class_type ?? undefined,
      participantsCount: booking.participants_count ?? undefined,
      bookingId:         booking_id,
    }

    Promise.all([
      instructorEmail ? sendBookingConfirmedEmailToInstructor(emailData) : Promise.resolve(),
      hostEmail       ? sendNewBookingEmailToHost(emailData)             : Promise.resolve(),
    ]).catch(err => console.error('[mark-paid] email error:', err))

    // ── Commission charge via host's saved token ─────────────────────────────
    // Bit/PayBox: money went directly to host → platform collects commission via token
    const hostForCharge = venue?.host
    if (hostForCharge?.cardcom_token && hostForCharge.cardcom_token_card_month && hostForCharge.cardcom_token_card_year) {
      // base price = total instructor paid / 1.05 (instructor paid base + 5%)
      const totalILS   = booking.total_price ?? 0
      const baseILS    = totalILS / 1.05
      const commission = calcSpaceRentalSplit(Math.round(baseILS)).platformRevenue

      chargeProviderToken({
        token:         hostForCharge.cardcom_token,
        cardMonth:     hostForCharge.cardcom_token_card_month,
        cardYear:      hostForCharge.cardcom_token_card_year,
        amountILS:     commission,
        providerName:  hostForCharge.full_name ?? '',
        providerEmail: hostEmail,
        description:   `עמלת פלטפורמה — הזמנה ${booking_id.substring(0, 8)} (${method.toUpperCase()})`,
      }).then(result => {
        if (result.success) {
          console.log(
            `[mark-paid] Commission ₪${commission} charged from host ${hostForCharge.id} — TranzactionId ${result.transactionId}`
          )
          // Record the commission transaction
          if (serviceKey && supabaseUrl) {
            const admin2 = createServiceClient(supabaseUrl, serviceKey)
            admin2
              .from('bookings')
              .update({
                commission_charged_at: new Date().toISOString(),
                commission_tx_id:      result.transactionId,
              })
              .eq('id', booking_id)
              .then(() => {}, e => console.error('[mark-paid] commission DB update error:', e))
          }
        } else {
          console.error(
            `[mark-paid] Commission charge FAILED for booking ${booking_id}: ` +
            `ResponseCode=${result.responseCode} — ${result.description}`
          )
        }
      }).catch(err => console.error('[mark-paid] commission charge error:', err))
    } else {
      console.warn(
        `[mark-paid] Host ${hostForCharge?.id ?? 'unknown'} has no Cardcom token — ` +
        `commission of booking ${booking_id} must be collected manually`
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[mark-paid] error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
