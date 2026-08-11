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
import { refundSumitPayment } from '@/lib/payments/SumitMarketplace'

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

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = adminClient()

    // Load booking with venue host
    const { data: booking } = await db
      .from('bookings')
      .select(`
        id, status, instructor_id, tranzila_transaction_id,
        venue:venues(host_id)
      `)
      .eq('id', bookingId)
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'הזמנה לא נמצאה.' }, { status: 404 })
    }

    const venue      = booking.venue as { host_id?: string } | null
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
      const txId = booking.tranzila_transaction_id as string | null
      if (txId) {
        refundAttempted = true
        const paymentId = parseInt(txId, 10)
        if (!isNaN(paymentId)) {
          const refundResult = await refundSumitPayment(paymentId)
          refundSuccess = refundResult.success
          if (!refundSuccess) {
            console.warn(
              `[cancel] SUMIT refund failed for booking ${bookingId} (paymentId=${paymentId}): ${refundResult.reason}`
            )
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
