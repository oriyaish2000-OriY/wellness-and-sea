/**
 * POST /api/checkout
 *
 * Flow 1 — Space Rental (Instructor → Host)
 *
 * Commission model (symmetric — platform earns 10% of base):
 *   Instructor pays:  base_price × 1.05  (5% markup — payer's commission)
 *   Host receives:    base_price × 0.95  (5% deduction — provider's commission)
 *   Platform earns:   10% of base_price total
 *
 * Credit card (no Meaged): all money lands on platform terminal.
 *   Webhook then charges host's saved token 5% (their portion).
 *   Platform already holds payer's 5% from the markup.
 *
 * Bit/PayBox: money goes directly to host → mark-paid charges host token 10%.
 *
 * Amounts (total_price / host_payout) are set during booking creation — never trusted from client.
 * Returns { checkout_url } on success. Returns 4xx/5xx on failure — NO free confirmation fallback.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  isCardcomConfigured,
  createSpaceRentalPayment,
} from '@/lib/payments/cardcomPaymentService'

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

    const venue = booking.venue as {
      id?: string
      title?: string
      host?: { id?: string; full_name?: string; grow_merchant_id?: string }
    } | null

    const totalILS      = booking.total_price  // instructor pays (base + 5%)
    const hostPayoutILS = booking.host_payout  // host receives  (base − 5%)

    if (!totalILS || !hostPayoutILS) {
      return NextResponse.json({ error: 'Invalid booking amounts' }, { status: 400 })
    }

    // ── Require Cardcom to be configured ─────────────────────────────────────
    if (!isCardcomConfigured()) {
      console.error('[checkout] Cardcom is not configured — cannot process payment')
      return NextResponse.json({ error: 'מערכת התשלומים אינה זמינה. אנא נסי שוב מאוחר יותר.' }, { status: 503 })
    }

    // Load instructor profile for Document customer info
    const { data: instructorProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    // Sapak number is optional — if present, Meaged routes payment to host sub-account
    const hostSapakNumber = venue?.host?.grow_merchant_id || undefined

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
        `Instructor pays ₪${totalILS}, Host receives ₪${hostPayoutILS}` +
        (hostSapakNumber ? ` (Meaged split via Sapak ${hostSapakNumber})` : ' (platform terminal, host token charge pending)')
      )
      return NextResponse.json({ checkout_url: checkoutUrl })
    } catch (err) {
      console.error('[Cardcom Flow1] createSpaceRentalPayment failed:', err)
      return NextResponse.json({ error: 'שגיאה ביצירת דף התשלום. אנא נסי שוב.' }, { status: 502 })
    }
  } catch (e) {
    console.error('[checkout] Unhandled error:', e)
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
