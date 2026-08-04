/**
 * POST /api/checkout
 *
 * Flow 1 — Space Rental (Instructor → Space Owner)
 * Creates a Grow Marketplace payment link with split:
 *   - Host sub-merchant receives hostPayoutAgorot
 *   - Platform main account receives the rest (= 10% of base price)
 *
 * Commission model:
 *   Instructor pays: base_price + 5%
 *   Host receives:   base_price − 5%
 *   Platform earns:  10% of base_price
 *
 * The booking's total_price / host_payout / platform_fee are set during booking
 * creation (see booking actions). This route reads those server-side values and
 * never trusts amounts from the client.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  isGrowConfigured,
  createSpaceRentalPaymentLink,
} from '@/lib/grow/growPaymentService'
import {
  sendBookingConfirmedEmailToInstructor,
  sendNewBookingEmailToHost,
} from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const bookingId: string = body.booking_id

    // ── Auth ──────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!bookingId) return NextResponse.json({ error: 'Missing booking_id' }, { status: 400 })

    // ── Load booking (server-verified amounts only) ────────────────────────
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

    const venue = booking.venue as {
      id?: string
      title?: string
      host?: { id?: string; full_name?: string; grow_merchant_id?: string }
    } | null

    const totalILS      = booking.total_price   // what instructor pays (base + 5%)
    const hostPayoutILS = booking.host_payout    // what host receives (base − 5%)
    const appUrl        = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    if (!totalILS || !hostPayoutILS) {
      return NextResponse.json({ error: 'Invalid booking amounts' }, { status: 400 })
    }

    const hostGrowMerchantId = venue?.host?.grow_merchant_id ?? ''

    // ── Grow configured + host has sub-merchant ID → use split payment link ─
    if (isGrowConfigured() && hostGrowMerchantId) {
      try {
        const { checkoutUrl } = await createSpaceRentalPaymentLink({
          bookingId,
          instructorId:       booking.instructor_id,
          totalILS,
          totalAgorot:        Math.round(totalILS * 100),
          hostPayoutAgorot:   Math.round(hostPayoutILS * 100),
          hostGrowMerchantId,
          venueName:          venue?.title ?? 'חלל',
        })

        console.log(`[Grow Flow1] Payment link created for booking ${bookingId}`)
        return NextResponse.json({ checkout_url: checkoutUrl })
      } catch (growErr) {
        // Log but fall through to fallback — never leave instructor stuck
        console.error('[Grow Flow1] CreatePaymentLink failed:', growErr)
      }
    }

    // ── Grow configured but host not yet onboarded → direct payment link ───
    if (isGrowConfigured() && !hostGrowMerchantId) {
      console.warn(
        `[Grow Flow1] Host ${venue?.host?.id} has no grow_merchant_id — ` +
        'falling back to no-split link. Host must complete KYC at /host-dashboard/kyc'
      )
      // TODO: create a non-split link or prompt host to complete KYC
    }

    // ── Fallback: no Grow / link creation failed → confirm server-side ──────
    console.warn('[checkout] Falling back to direct confirmation (no gateway)')

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
        .single()

      await admin
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId)
        .eq('status', 'pending')

      if (fullBooking) {
        const fVenue = fullBooking.venue as {
          title?: string; location_address?: string; location_city?: string
          host?: { id?: string; full_name?: string }
        } | null
        const fInstructor = fullBooking.instructor as { id?: string; full_name?: string } | null

        let instructorEmail = user.email ?? ''
        let hostEmail = ''
        if (fVenue?.host?.id) {
          const { data: hostUser } = await admin.auth.admin.getUserById(fVenue.host.id)
          hostEmail = hostUser?.user?.email ?? ''
        }

        const emailData = {
          instructorName: fInstructor?.full_name ?? '',
          instructorEmail,
          hostName:       fVenue?.host?.full_name ?? '',
          hostEmail,
          venueName:      fVenue?.title ?? '',
          venueAddress:   fVenue?.location_address ?? '',
          venueCity:      fVenue?.location_city ?? '',
          bookingDate:    fullBooking.booking_date,
          startTime:      fullBooking.start_time,
          endTime:        fullBooking.end_time,
          totalPrice:     fullBooking.total_price,
          hostPayout:     fullBooking.host_payout,
          classType:      fullBooking.class_type ?? undefined,
          participantsCount: fullBooking.participants_count ?? undefined,
          bookingId,
        }

        Promise.all([
          instructorEmail ? sendBookingConfirmedEmailToInstructor(emailData) : Promise.resolve(),
          hostEmail       ? sendNewBookingEmailToHost(emailData)             : Promise.resolve(),
        ]).catch(err => console.error('[checkout fallback] email error:', err))
      }
    }

    return NextResponse.json({ checkout_url: `${appUrl}/booking/confirm/${bookingId}` })
  } catch (e) {
    console.error('[checkout] Unhandled error:', e)
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
