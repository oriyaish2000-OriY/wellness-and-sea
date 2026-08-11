/**
 * POST /api/bookings/[id]/cancel
 *
 * Cancels a booking and attempts a SUMIT refund for confirmed bookings.
 *
 * Rules:
 *   - Pending bookings: cancelled immediately, no refund needed (payment wasn't taken)
 *   - Confirmed bookings: cancelled + SUMIT refund attempted (best-effort)
 *   - Completed bookings: cannot be cancelled
 *
 * Auth: must be the booking's instructor OR the host of the venue.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { refundMultiVendorPayment } from '@/lib/payments/SumitMarketplace'
import { checkRateLimitDB } from '@/lib/rate-limit'
import { decryptApiKey, isEncrypted } from '@/lib/encryption'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: bookingId } = await params
    const body = await request.json().catch(() => ({}))
    const reason = typeof body.reason === 'string' ? body.reason.trim() : undefined

    // Validate UUID format before hitting the database (C3)
    if (!UUID_RE.test(bookingId)) {
      return NextResponse.json({ error: 'Invalid booking ID.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // H3: Rate-limit cancel attempts — 10 per user per hour
    const rlCheck = await checkRateLimitDB(`cancel:user:${user.id}`, 10, 3600)
    if (!rlCheck.allowed) {
      return NextResponse.json(
        { error: 'יותר מדי ניסיונות ביטול — נסי שוב מאוחר יותר.' },
        { status: 429, headers: { 'Retry-After': String(rlCheck.retryAfter ?? 3600) } }
      )
    }

    const db = adminClient()

    // Load booking with venue host — use user-scoped client so RLS provides
    // defense-in-depth (ownership check below is the primary guard). (H6)
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        id, status, instructor_id,
        tranzila_transaction_id, platform_payment_id, vendor_sumit_company_id,
        venue:venues(host_id, host:profiles!venues_host_id_fkey(id))
      `)
      .eq('id', bookingId)
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'הזמנה לא נמצאה.' }, { status: 404 })
    }

    const venue      = booking.venue as { host_id?: string; host?: { id?: string } } | null
    const isInstructor = booking.instructor_id === user.id
    const isHost       = venue?.host_id === user.id

    if (!isInstructor && !isHost) {
      return NextResponse.json({ error: 'גישה נדחתה.' }, { status: 403 })
    }

    if (booking.status === 'completed') {
      return NextResponse.json({ error: 'לא ניתן לבטל הזמנה שהושלמה.' }, { status: 422 })
    }

    if (booking.status === 'cancelled') {
      return NextResponse.json({ error: 'ההזמנה כבר בוטלה.' }, { status: 409 })
    }

    // For confirmed bookings, attempt SUMIT refund
    let refundAttempted = false
    let refundSuccess   = false

    if (booking.status === 'confirmed') {
      const txId             = booking.tranzila_transaction_id as string | null
      const platformTxId     = booking.platform_payment_id     as string | null
      const vendorCompanyId  = booking.vendor_sumit_company_id as number | null
      const hostId           = venue?.host?.id

      if (txId && vendorCompanyId && hostId) {
        refundAttempted = true
        const vendorPaymentId   = parseInt(txId, 10)
        const platformPaymentId = platformTxId ? parseInt(platformTxId, 10) : null

        if (!isNaN(vendorPaymentId)) {
          // Load host's encrypted API key to refund their portion
          const { data: hostConfig } = await db
            .from('vendor_payment_config')
            .select('sumit_api_key')
            .eq('profile_id', hostId)
            .eq('onboarding_status', 'verified')
            .maybeSingle()

          if (hostConfig?.sumit_api_key && isEncrypted(hostConfig.sumit_api_key)) {
            let hostApiKey: string
            try {
              hostApiKey = decryptApiKey(hostConfig.sumit_api_key)
              const refundResult = await refundMultiVendorPayment(
                vendorPaymentId,
                platformPaymentId && !isNaN(platformPaymentId) ? platformPaymentId : null,
                vendorCompanyId,
                hostApiKey,
              )
              refundSuccess = refundResult.vendorRefunded && refundResult.platformRefunded
              if (!refundSuccess) {
                console.warn(
                  `[cancel] SUMIT refund partial/failed for booking ${bookingId}: ${refundResult.reason}`
                )
              }
            } catch (decryptErr) {
              console.error(`[cancel] Failed to decrypt host API key for booking ${bookingId}:`, decryptErr)
            }
          } else {
            console.warn(`[cancel] Host ${hostId} has no valid encrypted API key — skipping automatic refund for booking ${bookingId}`)
          }
        }
      }
    }

    // Update booking status
    const { error: updateError } = await db
      .from('bookings')
      .update({
        status:              'cancelled',
        cancelled_at:        new Date().toISOString(),
        cancellation_reason: reason ?? (isHost ? 'בוטל על ידי המארח' : 'בוטל על ידי המדריכה'),
        vendor_payout_status: 'na', // no payout needed on cancellation
      })
      .eq('id', bookingId)

    if (updateError) {
      return NextResponse.json({ error: 'שגיאה בביטול ההזמנה.' }, { status: 500 })
    }

    console.log(`[cancel] Booking ${bookingId} cancelled by user ${user.id}`)

    return NextResponse.json({
      success: true,
      refund: refundAttempted
        ? { attempted: true,  success: refundSuccess }
        : { attempted: false, success: false },
      message: refundAttempted
        ? (refundSuccess ? 'ההזמנה בוטלה והתשלום הוחזר.' : 'ההזמנה בוטלה. ההחזר יבוצע ידנית תוך 3-5 ימי עסקים.')
        : 'ההזמנה בוטלה.',
    })
  } catch (err) {
    console.error('[cancel] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
