/**
 * POST /api/checkout/card
 *
 * Flow 1 — Space Rental (Instructor → Host) — form POST handler.
 *
 * Called by SUMIT's payments.js after card tokenization. The form POSTs here
 * with `og-token` (SingleUseToken) + `booking_id` as form fields.
 *
 * Calls /billing/payments/multivendorcharge/ to split the charge:
 *   • Host's portion  (base × 0.95) → host's own SUMIT account (direct)
 *   • Platform fee    (base × 0.10) → platform's SUMIT account
 *
 * On success: updates booking status → 'confirmed', redirects to confirm page.
 * On failure: redirects back to pay page with ?error=... query param.
 *
 * Security:
 *   - Auth required (must be the booking's instructor)
 *   - All amounts loaded server-side — never from form data
 *   - Vendor API key decrypted in memory only, never logged or persisted in plain text
 *   - Idempotency: already-confirmed bookings redirect without re-charging
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { chargeMultiVendor }   from '@/lib/payments/SumitMarketplace'
import { calcSpaceRentalSplit } from '@/lib/payments/commissionUtils'
import { decryptApiKey, isEncrypted } from '@/lib/encryption'
import {
  sendBookingConfirmedEmailToInstructor,
  sendNewBookingEmailToHost,
} from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getUserEmail(
  supabase: ReturnType<typeof adminClient>,
  userId: string
): Promise<string> {
  const { data } = await supabase.auth.admin.getUserById(userId)
  return data?.user?.email ?? ''
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payPageBase = `${APP_URL}/booking/pay`

  try {
    // ── Parse form data ───────────────────────────────────────────────────────
    const formData  = await request.formData()
    const ogToken   = formData.get('og-token')   as string | null
    const bookingId = formData.get('booking_id') as string | null

    if (!ogToken || !bookingId) {
      console.warn('[checkout/card] Missing og-token or booking_id in form data')
      return NextResponse.redirect(`${APP_URL}/?error=invalid_request`)
    }

    // Basic UUID validation
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!UUID_RE.test(bookingId)) {
      return NextResponse.redirect(`${APP_URL}/?error=invalid_request`)
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(`${APP_URL}/auth/login?next=/booking/pay/${bookingId}`)
    }

    // ── Load booking (server-side amounts only) ────────────────────────────────
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        id, status, total_price, host_payout, platform_fee, instructor_id,
        booking_date, start_time, end_time, class_type, participants_count,
        tranzila_transaction_id,
        venue:venues(
          id, title, location_address, location_city,
          host:profiles!venues_host_id_fkey(id, full_name)
        ),
        instructor:profiles!bookings_instructor_id_fkey(id, full_name)
      `)
      .eq('id', bookingId)
      .eq('instructor_id', user.id)
      .single()

    if (!booking) {
      return NextResponse.redirect(`${APP_URL}/instructor-dashboard/bookings?error=not_found`)
    }

    // Idempotency: already confirmed → go straight to confirm page
    if (booking.status === 'confirmed' || booking.status === 'completed') {
      return NextResponse.redirect(`${APP_URL}/booking/confirm/${bookingId}`)
    }

    if (booking.status !== 'pending') {
      return NextResponse.redirect(`${payPageBase}/${bookingId}?error=invalid_status`)
    }

    const venue = booking.venue as {
      id?: string; title?: string; location_address?: string; location_city?: string
      host?: { id?: string; full_name?: string }
    } | null
    const instructor = booking.instructor as { id?: string; full_name?: string } | null

    // ── Verify host has a verified SUMIT account ───────────────────────────────
    const hostId = venue?.host?.id
    if (!hostId) {
      return NextResponse.redirect(`${payPageBase}/${bookingId}?error=host_not_found`)
    }

    const db = adminClient()
    const { data: hostConfig } = await db
      .from('vendor_payment_config')
      .select('sumit_company_id, sumit_api_key, onboarding_status')
      .eq('profile_id', hostId)
      .maybeSingle()

    if (!hostConfig || hostConfig.onboarding_status !== 'verified') {
      return NextResponse.redirect(`${payPageBase}/${bookingId}?error=host_sumit_unverified`)
    }

    if (!hostConfig.sumit_api_key || !isEncrypted(hostConfig.sumit_api_key)) {
      console.error(`[checkout/card] Host ${hostId} has no valid encrypted API key`)
      return NextResponse.redirect(`${payPageBase}/${bookingId}?error=host_key_missing`)
    }

    // Decrypt vendor key in memory — never logged, never persisted
    let hostApiKey: string
    try {
      hostApiKey = decryptApiKey(hostConfig.sumit_api_key)
    } catch (err) {
      console.error('[checkout/card] Failed to decrypt host API key:', err)
      return NextResponse.redirect(`${payPageBase}/${bookingId}?error=internal`)
    }

    // ── Re-compute split from server-side amounts (never trust form data) ─────
    // Use stored total_price / host_payout — these were set at booking creation
    // via calcSpaceRentalSplit. Recompute platformRevenue from the difference.
    const totalILS       = booking.total_price  as number
    const hostPayoutILS  = booking.host_payout  as number
    const platformFeeILS = totalILS - hostPayoutILS  // exact (was calc'd this way)

    if (totalILS <= 0 || hostPayoutILS <= 0 || platformFeeILS < 0) {
      console.error(`[checkout/card] Invalid booking amounts for ${bookingId}`)
      return NextResponse.redirect(`${payPageBase}/${bookingId}?error=invalid_amounts`)
    }

    // ── Fetch instructor email once, reuse for charge + emails ────────────────
    const instructorEmail = await getUserEmail(db, user.id)

    // ── Call SUMIT multivendorcharge ──────────────────────────────────────────
    let chargeResult: Awaited<ReturnType<typeof chargeMultiVendor>>
    try {
      chargeResult = await chargeMultiVendor({
        singleUseToken: ogToken,
        customerName:   instructor?.full_name ?? 'מדריכה',
        customerEmail:  instructorEmail,
        vendorItem: {
          name:        'השכרת שטח',
          description: venue?.title ?? bookingId,
          unitPrice:   hostPayoutILS,
          companyId:   hostConfig.sumit_company_id,
          apiKey:      hostApiKey,
        },
        platformCommissionILS: platformFeeILS,
        documentDescription:   `השכרת חלל — ${venue?.title ?? bookingId}`,
        externalIdentifier:    `space_rental:${bookingId}`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[checkout/card] chargeMultiVendor failed for booking ${bookingId}:`, msg)
      return NextResponse.redirect(`${payPageBase}/${bookingId}?error=payment_failed`)
    }

    if (!chargeResult.valid) {
      console.warn(`[checkout/card] Payment not valid for booking ${bookingId} — paymentId ${chargeResult.paymentId}`)
      return NextResponse.redirect(`${payPageBase}/${bookingId}?error=payment_invalid`)
    }

    // ── Update booking to confirmed ────────────────────────────────────────────
    const { error: dbError } = await db
      .from('bookings')
      .update({
        status:                  'confirmed',
        tranzila_transaction_id: String(chargeResult.paymentId),
        confirmed_at:            new Date().toISOString(),
        vendor_sumit_company_id: hostConfig.sumit_company_id,
      })
      .eq('id', bookingId)
      .eq('status', 'pending')

    if (dbError) {
      // Payment was charged but DB update failed — critical: log for manual recovery
      console.error(
        `[checkout/card] CRITICAL: Payment ${chargeResult.paymentId} charged but ` +
        `booking ${bookingId} DB update failed: ${dbError.message}`
      )
      // Still redirect to confirm (payment succeeded) — support can fix the DB record
      return NextResponse.redirect(`${APP_URL}/booking/confirm/${bookingId}?warn=db_sync`)
    }

    console.log(
      `[checkout/card] Booking ${bookingId} confirmed — ` +
      `SUMIT PaymentID ${chargeResult.paymentId}, ` +
      `₪${totalILS} charged (host ₪${hostPayoutILS} + platform ₪${platformFeeILS}). ` +
      `Host (CompanyID ${hostConfig.sumit_company_id}) received their share directly.`
    )

    // ── Send confirmation emails (best-effort) ────────────────────────────────
    try {
      const hostEmail = venue?.host?.id ? await getUserEmail(db, venue.host.id) : ''

      await Promise.all([
        instructorEmail ? sendBookingConfirmedEmailToInstructor({
          instructorName:    instructor?.full_name ?? '',
          instructorEmail,
          hostName:          venue?.host?.full_name ?? '',
          hostEmail,
          venueName:         venue?.title ?? '',
          venueAddress:      venue?.location_address ?? '',
          venueCity:         venue?.location_city ?? '',
          bookingDate:       booking.booking_date as string,
          startTime:         booking.start_time   as string,
          endTime:           booking.end_time     as string,
          totalPrice:        totalILS,
          hostPayout:        hostPayoutILS,
          classType:         (booking.class_type as string | undefined) ?? undefined,
          participantsCount: (booking.participants_count as number | undefined) ?? undefined,
          bookingId,
        }) : Promise.resolve(),
        hostEmail ? sendNewBookingEmailToHost({
          instructorName:    instructor?.full_name ?? '',
          instructorEmail,
          hostName:          venue?.host?.full_name ?? '',
          hostEmail,
          venueName:         venue?.title ?? '',
          venueAddress:      venue?.location_address ?? '',
          venueCity:         venue?.location_city ?? '',
          bookingDate:       booking.booking_date as string,
          startTime:         booking.start_time   as string,
          endTime:           booking.end_time     as string,
          totalPrice:        totalILS,
          hostPayout:        hostPayoutILS,
          bookingId,
        }) : Promise.resolve(),
      ])
    } catch (emailErr) {
      console.error('[checkout/card] Email send failed (non-fatal):', emailErr)
    }

    return NextResponse.redirect(`${APP_URL}/booking/confirm/${bookingId}`)

  } catch (err) {
    console.error('[checkout/card] Unhandled error:', err instanceof Error ? err.message : err)
    return NextResponse.redirect(`${APP_URL}/?error=internal`)
  }
}
