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
 * All money lands on PLATFORM's SUMIT account. Platform owes host base×0.95
 * (tracked in DB via vendor_payout_status = 'pending').
 *
 * Amounts (total_price / host_payout) are set during booking creation — never trusted from client.
 * Returns { checkout_url } on success. Returns 4xx/5xx on failure — NO free confirmation fallback.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  isSumitConfigured,
  createSpaceRentalPaymentUrl,
} from '@/lib/payments/SumitMarketplace'

// Service client for vendor_payment_config lookups (bypasses RLS)
function makeServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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
          host:profiles!venues_host_id_fkey(id, full_name)
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
      host?: { id?: string; full_name?: string }
    } | null

    const totalILS      = booking.total_price  // instructor pays (base + 5%)
    const hostPayoutILS = booking.host_payout  // host receives  (base − 5%)

    if (!totalILS || !hostPayoutILS) {
      return NextResponse.json({ error: 'Invalid booking amounts' }, { status: 400 })
    }

    // Load instructor profile for customer info
    const { data: instructorProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    // ── SUMIT check ───────────────────────────────────────────────────────────
    if (!isSumitConfigured()) {
      console.error('[checkout] SUMIT is not configured — cannot process payment')
      return NextResponse.json({ error: 'מערכת התשלומים אינה זמינה. אנא נסי שוב מאוחר יותר.' }, { status: 503 })
    }

    // ── Check host has a verified SUMIT account (trust check) ─────────────────
    const hostId = venue?.host?.id
    if (!hostId) {
      return NextResponse.json({ error: 'לא נמצא בעל החלל.' }, { status: 400 })
    }

    const svcClient = makeServiceClient()
    const { data: hostPaymentConfig } = await svcClient
      .from('vendor_payment_config')
      .select('onboarding_status, sumit_company_id')
      .eq('profile_id', hostId)
      .maybeSingle()

    if (!hostPaymentConfig || hostPaymentConfig.onboarding_status !== 'verified') {
      return NextResponse.json(
        {
          error:
            'בעל החלל טרם חיבר חשבון SUMIT מאומת. ' +
            'לא ניתן לאשר הזמנה עד שהמארח ישלים את תהליך ההצטרפות.',
          code: 'HOST_SUMIT_NOT_VERIFIED',
        },
        { status: 422 }
      )
    }

    try {
      // Payment goes to PLATFORM's SUMIT account via platform credentials
      const { checkoutUrl } = await createSpaceRentalPaymentUrl({
        bookingId,
        instructorId:  booking.instructor_id,
        totalILS,
        hostPayout:    hostPayoutILS,
        venueName:     venue?.title ?? 'חלל',
        customerName:  instructorProfile?.full_name ?? '',
        customerEmail: user.email ?? '',
      })
      // Store vendor SUMIT company ID on the booking for payout tracking
      await svcClient
        .from('bookings')
        .update({ vendor_sumit_company_id: hostPaymentConfig.sumit_company_id })
        .eq('id', bookingId)
      console.log(
        `[SUMIT Flow1] Payment URL created for booking ${bookingId}. ` +
        `Instructor pays ₪${totalILS} to PLATFORM account. Host (CompanyID ${hostPaymentConfig.sumit_company_id}) payout pending.`
      )
      return NextResponse.json({ checkout_url: checkoutUrl })
    } catch (err) {
      console.error('[SUMIT Flow1] createSpaceRentalPaymentUrl failed:', err)
      return NextResponse.json({ error: 'שגיאה ביצירת דף התשלום. אנא נסי שוב.' }, { status: 502 })
    }
  } catch (e) {
    console.error('[checkout] Unhandled error:', e)
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
