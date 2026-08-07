/**
 * POST /api/enrollments/mark-paid
 * Student self-reports payment via Bit or PayBox.
 *
 * Flow:
 *  1. Mark enrollment as paid
 *  2. Charge instructor's saved Cardcom token for the platform commission (10% of base)
 *     — non-blocking: failure is logged but does NOT fail the response
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { chargeProviderToken } from '@/lib/payments/cardcomPaymentService'
import { calcClassBookingSplit } from '@/lib/payments/commissionUtils'

export async function POST(request: NextRequest) {
  try {
    const { enrollment_id } = await request.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Load enrollment + class price + instructor token
    const { data: enrollment } = await supabase
      .from('class_enrollments')
      .select(`
        id, student_id, payment_status,
        booking:bookings(
          id, price_per_student,
          instructor:profiles!bookings_instructor_id_fkey(
            id, full_name,
            cardcom_token, cardcom_token_card_month, cardcom_token_card_year
          )
        )
      `)
      .eq('id', enrollment_id)
      .eq('student_id', user.id)
      .single()

    if (!enrollment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (enrollment.payment_status === 'paid') return NextResponse.json({ ok: true })

    const booking    = enrollment.booking as unknown as { id?: string; price_per_student?: number; instructor?: { id?: string; full_name?: string; cardcom_token?: string; cardcom_token_card_month?: number; cardcom_token_card_year?: number } } | null

    // ── Security gate: instructor must have Cardcom token registered ──────────
    if (!booking?.instructor?.cardcom_token) {
      console.warn(`[enrollments/mark-paid] Blocked: instructor has no token for enrollment ${enrollment_id}`)
      return NextResponse.json({
        error: 'המדריכה טרם רשמה כרטיס לניכוי עמלות. יש לפנות לתמיכה.',
        code: 'INSTRUCTOR_TOKEN_MISSING',
      }, { status: 402 })
    }
    const baseILS    = booking?.price_per_student ?? 0
    const instructor = booking?.instructor

    // Mark as paid
    const { error } = await supabase
      .from('class_enrollments')
      .update({ payment_status: 'paid', payment_method: 'direct' })
      .eq('id', enrollment_id)
      .eq('student_id', user.id)

    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

    // ── Commission charge via instructor's saved token ────────────────────────
    // Bit/PayBox: student paid instructor directly → platform collects commission via token
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (instructor?.cardcom_token && instructor.cardcom_token_card_month && instructor.cardcom_token_card_year && baseILS > 0) {
      const commission = calcClassBookingSplit(baseILS).platformRevenue

      let instructorEmail = ''
      if (instructor.id && serviceKey && supabaseUrl) {
        try {
          const admin = createServiceClient(supabaseUrl, serviceKey)
          const { data: iUser } = await admin.auth.admin.getUserById(instructor.id)
          instructorEmail = iUser?.user?.email ?? ''
        } catch { /* non-critical */ }
      }

      chargeProviderToken({
        token:         instructor.cardcom_token,
        cardMonth:     instructor.cardcom_token_card_month,
        cardYear:      instructor.cardcom_token_card_year,
        amountILS:     commission,
        providerName:  instructor.full_name ?? '',
        providerEmail: instructorEmail,
        description:   `עמלת פלטפורמה — הרשמה ${enrollment_id.substring(0, 8)}`,
      }).then(result => {
        if (result.success) {
          console.log(
            `[enrollments/mark-paid] Commission ₪${commission} charged from instructor ${instructor.id} — TxId ${result.transactionId}`
          )
          if (serviceKey && supabaseUrl) {
            const admin = createServiceClient(supabaseUrl, serviceKey)
            admin
              .from('class_enrollments')
              .update({
                commission_charged_at: new Date().toISOString(),
                commission_tx_id:      result.transactionId,
              })
              .eq('id', enrollment_id)
              .then(() => {}, e => console.error('[enrollments/mark-paid] commission DB error:', e))
          }
        } else {
          console.error(
            `[enrollments/mark-paid] Commission charge FAILED for enrollment ${enrollment_id}: ` +
            `ResponseCode=${result.responseCode} — ${result.description}`
          )
        }
      }).catch(err => console.error('[enrollments/mark-paid] commission charge error:', err))
    } else {
      if (baseILS > 0) {
        console.warn(
          `[enrollments/mark-paid] Instructor ${instructor?.id ?? 'unknown'} has no Cardcom token — ` +
          `commission of enrollment ${enrollment_id} must be collected manually`
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
