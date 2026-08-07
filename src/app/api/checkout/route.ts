/**
 * POST /api/checkout
 *
 * Flow 1 — Space Rental (Instructor → Host)
 *
 * Commission model (symmetric — platform earns 10% of base):
 *   Instructor pays:  base_price × 1.05  (5% markup)
 *   Host receives:    base_price × 0.95  (5% deduction, via Cardcom Meaged dashboard config)
 *   Platform earns:   10% of base_price
 *
 * Amounts (total_price / host_payout) are set during booking creation — never trusted from client.
 *
 * Returns { checkout_url } on success.
 * Falls back to direct confirmation when Cardcom is not configured or host has no Sapak number.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  isCardcomConfigured,
  createSpaceRentalPayment,
} from '@/lib/payments/cardcomPaymentService'
import {
  sendBookingConfirmedEmailToInstructor,
  sendNewBookingEmailToHost,
} from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body      = await request.json()
    const bookingId = body.booking_id as string

    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user)      return NextResponse.json({ error: 'Unauthorized' },      { status: 401 })
    if (!bookingId) return NextResponse.json({ error: 'Missing booking_id' }, { status: 400 })

    // ── Load booking (server-side amounts only) ────────────────────────────────
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        id, total_price, host_payout, platform_fee, instructor_id,
        venue:venues(
          id, title,
          host:profiles!venues_host_id_fkey(id, full_name, grow_merchant_id)
        )
      `)
      .eq('id', bookingId)
      .eq('instructor_id', user.id)
      .eq('status', 'pending')
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found or already processed' }, { status: 404 })
    }

    // Load instructor profile for Document customer info
    const { data: instructorProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const venue = booking.venue as {
      id?: string
      title?: string
      host?: { id?: string; full_name?: string; grow_merchant_id?: string }
    } | null

    const totalILS        = booking.total_price  // instructor pays (base + 5%)
    const hostPayoutILS   = booking.host_payout  // host receives  (base − 5%)
    const hostSapakNumber = venue?.host?.grow_merchant_id ?? ''

    if (!totalILS || !hostPayoutILS) {
      return NextResponse.json({ error: 'Invalid booking amounts' }, { status: 400 })
    }

    // ── Cardcom configured + host has Sapak → LowProfile payment ─────────────
    if (isCardcomConfigured() && hostSapakNumber) {
      try {
        const { checkoutUrl, lowProfileId } = await createSpaceRentalPayment({
          bookingId,
          instructorId:    booking.instructor_id,
          totalILS,
          hostSapakNumber,
          venueName:       venue?.title ?? 'חלל',
          customerName:    instructorProfile?.full_name ?? '',
          customerEmail:   user.email ?? '',
        })

        // Save LowProfileId to DB — must be done before redirecting buyer
        if (lowProfileId) {
          const serviceClient = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
          await serviceClient
            .from('bookings')
            .update({ cardcom_low_profile_id: lowProfileId })
            .eq('id', bookingId)
        }

        console.log(
          `[Cardcom Flow1] LowProfile ${lowProfileId} created for booking ${bookingId}. ` +
          `Instructor pays ₪${totalILS}, Host receives ₪${hostPayoutILS}`
        )
        return NextResponse.json({ checkout_url: checkoutUrl })
      } catch (err) {
        console.error('[Cardcom Flow1] createSpaceRentalPayment failed:', err)
        // Fall through to direct fallback
      }
    }

    if (isCardcomConfigured() && !hostSapakNumber) {
      console.warn(
        `[Cardcom Flow1] Host ${venue?.host?.id ?? 'unknown'} has no Sapak number — needs KYC registration`
      )
    }

    // ── Fallback: confirm directly (host not onboarded / Cardcom not configured) ──
    console.warn('[checkout] Falling back to direct confirmation')

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceKey) {
      const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

      const { data: fullBooking } = await admin
        .from('bookings')
        .select(`
          *,
          venue:venues(title, location_address, location_city,
            host:profiles!venues_host_id_fkey(id, full_name)),
          instructor:profiles!bookings_instructor_id_fkey(id, full_name)
        `)
        .eq('id', bookingId)
        .eq('instructor_id', user.id)
        .single()

      await admin
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId)
        .eq('instructor_id', user.id)
        .eq('status', 'pending')

      if (fullBooking) {
        const fVenue      = fullBooking.venue      as { title?: string; location_address?: string; location_city?: string; host?: { id?: string; full_name?: string } } | null
        const fInstructor = fullBooking.instructor as { id?: string; full_name?: string } | null

        let hostEmail = ''
        if (fVenue?.host?.id) {
          const { data: hostUser } = await admin.auth.admin.getUserById(fVenue.host.id)
          hostEmail = hostUser?.user?.email ?? ''
        }

        const emailData = {
          instructorName:    fInstructor?.full_name ?? '',
          instructorEmail:   user.email ?? '',
          hostName:          fVenue?.host?.full_name ?? '',
          hostEmail,
          venueName:         fVenue?.title ?? '',
          venueAddress:      fVenue?.location_address ?? '',
          venueCity:         fVenue?.location_city ?? '',
          bookingDate:       fullBooking.booking_date,
          startTime:         fullBooking.start_time,
          endTime:           fullBooking.end_time,
          totalPrice:        fullBooking.total_price,
          hostPayout:        fullBooking.host_payout,
          classType:         fullBooking.class_type ?? undefined,
          participantsCount: fullBooking.participants_count ?? undefined,
          bookingId,
        }

        Promise.all([
          user.email ? sendBookingConfirmedEmailToInstructor(emailData) : Promise.resolve(),
          hostEmail  ? sendNewBookingEmailToHost(emailData)             : Promise.resolve(),
        ]).catch(err => console.error('[checkout fallback] email error:', err))
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    return NextResponse.json({ checkout_url: `${appUrl}/booking/confirm/${bookingId}` })
  } catch (e) {
    console.error('[checkout] Unhandled error:', e)
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
