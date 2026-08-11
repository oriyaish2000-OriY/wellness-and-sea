/**
 * POST /api/cardcom/webhook
 *
 * Cardcom LowProfile webhook handler — follows the official Cardcom integration spec.
 *
 * Handles three types of LowProfile completions:
 *  A. ChargeOnly payment → bookings or class_enrollments (looked up by cardcom_low_profile_id)
 *  B. CreateTokenOnly registration → profiles (looked up by cardcom_token_lp_id)
 *
 * Flow:
 *  1. Verify TerminalNumber
 *  2. Find record by LowProfileId (bookings → enrollments → profiles)
 *  3. If not found → error log, return 200
 *  4. Idempotency: if already processed → return 200
 *  5. Call GetLpResult to validate
 *  6. Update DB based on Operation + ResponseCode
 *
 * Security: TerminalNumber in payload must match CARDCOM_TERMINAL_NUMBER env var.
 * IMPORTANT: Always return HTTP 200 to Cardcom — even on internal errors.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getLpResult, chargeProviderToken } from '@/lib/payments/cardcomPaymentService'
import { encryptApiKey, decryptApiKey, isEncrypted } from '@/lib/encryption'
import {
  sendBookingConfirmedEmailToInstructor,
  sendNewBookingEmailToHost,
  sendBookingCancelledEmailToInstructor,
  sendBookingCancelledEmailToHost,
} from '@/lib/email'

// ─── Supabase admin client (bypasses RLS) ─────────────────────────────────────

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Security constants ───────────────────────────────────────────────────────

/**
 * Maximum commission amount (ILS) that can be charged via a saved token in one webhook call.
 * Guard against corrupted DB data causing runaway charges.
 * A booking total above ₪50,000 is operationally impossible for this platform.
 */
const MAX_COMMISSION_ILS = 5000

// ─── Webhook body ─────────────────────────────────────────────────────────────

interface CardcomWebhookBody {
  ResponseCode:   number
  Description:    string
  TerminalNumber: number
  LowProfileId:   string
  Operation:      string
}

// ─── Webhook verification ────────────────────────────────────────────────────
//
// Cardcom does NOT use HMAC-SHA256 header signatures like Stripe.
// Instead, Cardcom webhooks are validated via two mechanisms:
//
//  1. TerminalNumber in the JSON payload must match CARDCOM_TERMINAL_NUMBER.
//     This is the primary guard against spoofed payloads.
//
//  2. Optional shared-secret token (CARDCOM_WEBHOOK_TOKEN).
//     Set the WebHookUrl in Cardcom dashboard to include this token:
//       https://<your-domain>/api/cardcom/webhook?token=CARDCOM_WEBHOOK_TOKEN
//     If the env var is set, we require it to appear in the query string or
//     in the POST body (key: "token"). This provides replay-attack protection.
//
// If CARDCOM_WEBHOOK_TOKEN is not set, the token check is skipped (backwards
// compatible — safe to enable incrementally without breaking existing setups).

function verifyTerminal(payload: CardcomWebhookBody): boolean {
  const expected = parseInt(process.env.CARDCOM_TERMINAL_NUMBER ?? '0', 10)
  if (expected <= 0) {
    // Env var not configured — reject all webhooks to prevent spoofing
    console.error('[cardcom/webhook] CARDCOM_TERMINAL_NUMBER not configured — rejecting webhook')
    return false
  }
  return payload.TerminalNumber === expected
}

function verifyWebhookToken(
  request: NextRequest,
  payload: CardcomWebhookBody & Record<string, unknown>
): boolean {
  const expectedToken = process.env.CARDCOM_WEBHOOK_TOKEN
  if (!expectedToken) {
    // M-A: CARDCOM_WEBHOOK_TOKEN is MANDATORY. Without it, anyone who knows the terminal
    // number can forge webhook payloads and confirm bookings without payment.
    // Set CARDCOM_WEBHOOK_TOKEN in Vercel env vars AND append ?token=<value> to the
    // Cardcom dashboard webhook URL.
    console.error('[cardcom/webhook] SECURITY: CARDCOM_WEBHOOK_TOKEN not configured — rejecting all webhooks')
    return false
  }

  // Accept token from query param (?token=...) or from POST body field "token"
  const queryToken = request.nextUrl.searchParams.get('token')
  const bodyToken  = typeof payload['token'] === 'string' ? payload['token'] : undefined
  const receivedToken = queryToken ?? bodyToken

  if (receivedToken !== expectedToken) {
    console.warn('[cardcom/webhook] Invalid CARDCOM_WEBHOOK_TOKEN — rejecting webhook')
    return false
  }

  return true
}

// ─── Email helper ─────────────────────────────────────────────────────────────

async function getUserEmail(
  supabase: ReturnType<typeof adminClient>,
  userId: string
): Promise<string> {
  const { data } = await supabase.auth.admin.getUserById(userId)
  return data?.user?.email ?? ''
}

// ─── A1. Space-rental booking — confirmed ─────────────────────────────────────

async function confirmSpaceRentalBooking(
  supabase: ReturnType<typeof adminClient>,
  bookingId: string,
  txId: number,
  documentType: string | null,
  documentNumber: number | null,
  responseCode: number,
  description: string
): Promise<void> {
  await supabase
    .from('bookings')
    .update({
      status:                  'confirmed',
      cardcom_transaction_id:  txId,
      cardcom_document_type:   documentType,
      cardcom_document_number: documentNumber,
      cardcom_response_code:   String(responseCode),
      cardcom_description:     description,
    })
    .eq('id', bookingId)
    .eq('status', 'pending')

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      *,
      venue:venues(title, location_address, location_city,
        host:profiles!venues_host_id_fkey(
          id, full_name, grow_merchant_id,
          cardcom_token, cardcom_token_card_month, cardcom_token_card_year
        )),
      instructor:profiles!bookings_instructor_id_fkey(id, full_name)
    `)
    .eq('id', bookingId)
    .single()

  if (!booking) return

  const venue      = booking.venue      as { title?: string; location_address?: string; location_city?: string; host?: { id?: string; full_name?: string; grow_merchant_id?: string; cardcom_token?: string; cardcom_token_card_month?: number; cardcom_token_card_year?: number } } | null
  const instructor = booking.instructor as { id?: string; full_name?: string } | null

  const [instructorEmail, hostEmail] = await Promise.all([
    instructor?.id  ? getUserEmail(supabase, instructor.id)  : Promise.resolve(''),
    venue?.host?.id ? getUserEmail(supabase, venue.host.id)  : Promise.resolve(''),
  ])

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
    bookingId,
  }

  await Promise.all([
    instructorEmail ? sendBookingConfirmedEmailToInstructor(emailData) : Promise.resolve(),
    hostEmail       ? sendNewBookingEmailToHost(emailData)             : Promise.resolve(),
  ])

  // ── Commission charge via host's saved Cardcom token ─────────────────────
  // When SapakMutav was used (host has grow_merchant_id), the full payment went
  // directly to the host's Cardcom sub-account. Platform charges the host's saved
  // token for the full 10% commission (payer's 5% markup + host's 5% deduction).
  // If host has no Sapak, money landed on platform terminal — no token charge needed.
  const host = venue?.host
  if (host?.grow_merchant_id && host.cardcom_token && host.cardcom_token_card_month && host.cardcom_token_card_year) {
    const { calcSpaceRentalSplit } = await import('@/lib/payments/commissionUtils')
    const totalILS   = booking.total_price ?? 0
    const baseILS    = Math.round(totalILS / 1.05)
    const commission = calcSpaceRentalSplit(baseILS).platformRevenue  // 10% of base

    // Bounds check: never charge more than MAX_COMMISSION_ILS.
    // Guards against corrupted DB data causing runaway token charges.
    if (commission <= 0 || commission > MAX_COMMISSION_ILS) {
      console.error(
        `[webhook] Commission amount ₪${commission} out of bounds for booking ${bookingId} — ` +
        `skipping token charge. Investigate immediately.`
      )
      return
    }

    // M-E: Decrypt token if encrypted (new tokens); use as-is if legacy plaintext
    const rawHostToken = isEncrypted(host.cardcom_token)
      ? (() => { try { return decryptApiKey(host.cardcom_token!) } catch { return host.cardcom_token! } })()
      : host.cardcom_token

    chargeProviderToken({
      token:         rawHostToken,
      cardMonth:     host.cardcom_token_card_month,
      cardYear:      host.cardcom_token_card_year,
      amountILS:     commission,
      providerName:  host.full_name ?? '',
      providerEmail: hostEmail,
      description:   `עמלת פלטפורמה — הזמנה ${bookingId.substring(0, 8)} (כרטיס אשראי)`,
    }).then(result => {
      if (result.success) {
        console.log(`[webhook] Commission ₪${commission} charged from host ${host.id} — TxId ${result.transactionId}`)
        supabase.from('bookings').update({
          commission_charged_at: new Date().toISOString(),
          commission_tx_id:      result.transactionId,
        }).eq('id', bookingId).then(() => {}, e => console.error('[webhook] commission DB error:', e))
      } else {
        console.error(`[webhook] Commission charge FAILED for booking ${bookingId}: ${result.responseCode} — ${result.description}`)
      }
    }).catch(e => console.error('[webhook] commission charge error:', e))
  } else {
    // No SapakMutav: money is on platform terminal — commission already embedded in collected amount
    console.log(`[webhook] Booking ${bookingId} confirmed (no SapakMutav). Platform holds ₪${booking.total_price}; will pay host ₪${booking.host_payout} manually.`)
  }
}

// ─── A2. Space-rental booking — failed ───────────────────────────────────────

async function failSpaceRentalBooking(
  supabase: ReturnType<typeof adminClient>,
  bookingId: string,
  responseCode: number,
  description: string
): Promise<void> {
  await supabase
    .from('bookings')
    .update({
      status:               'cancelled',
      cancelled_at:         new Date().toISOString(),
      cancellation_reason:  'תשלום נכשל',
      cardcom_response_code: String(responseCode),
      cardcom_description:   description,
    })
    .eq('id', bookingId)
    .eq('status', 'pending')

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      *,
      venue:venues(title, location_address, location_city,
        host:profiles!venues_host_id_fkey(id, full_name)),
      instructor:profiles!bookings_instructor_id_fkey(id, full_name)
    `)
    .eq('id', bookingId)
    .single()

  if (!booking) return

  const venue      = booking.venue      as { title?: string; location_address?: string; location_city?: string; host?: { id?: string; full_name?: string } } | null
  const instructor = booking.instructor as { id?: string; full_name?: string } | null

  const [instructorEmail, hostEmail] = await Promise.all([
    instructor?.id  ? getUserEmail(supabase, instructor.id)  : Promise.resolve(''),
    venue?.host?.id ? getUserEmail(supabase, venue.host.id)  : Promise.resolve(''),
  ])

  const emailData = {
    instructorName: instructor?.full_name ?? '',
    instructorEmail,
    hostName:       venue?.host?.full_name ?? '',
    hostEmail,
    venueName:      venue?.title ?? '',
    venueAddress:   venue?.location_address ?? '',
    venueCity:      venue?.location_city ?? '',
    bookingDate:    booking.booking_date,
    startTime:      booking.start_time,
    endTime:        booking.end_time,
    totalPrice:     booking.total_price,
    hostPayout:     booking.host_payout,
    bookingId,
  }

  await Promise.all([
    instructorEmail ? sendBookingCancelledEmailToInstructor(emailData, 'תשלום נכשל') : Promise.resolve(),
    hostEmail       ? sendBookingCancelledEmailToHost(emailData, 'תשלום נכשל')       : Promise.resolve(),
  ])
}

// ─── A3. Class enrollment — confirmed ────────────────────────────────────────

async function confirmClassEnrollment(
  supabase: ReturnType<typeof adminClient>,
  enrollmentId: string,
  txId: number,
  documentType: string | null,
  documentNumber: number | null,
  responseCode: number,
  description: string
): Promise<void> {
  const { data: enrollment } = await supabase
    .from('class_enrollments')
    .select(`
      id, booking_id,
      booking:bookings(
        price_per_student,
        instructor:profiles!bookings_instructor_id_fkey(
          id, full_name, grow_merchant_id,
          cardcom_token, cardcom_token_card_month, cardcom_token_card_year
        )
      )
    `)
    .eq('id', enrollmentId)
    .single()

  if (!enrollment) throw new Error(`Enrollment ${enrollmentId} not found`)

  const booking    = enrollment.booking as { price_per_student?: number; instructor?: { id?: string; full_name?: string; grow_merchant_id?: string; cardcom_token?: string; cardcom_token_card_month?: number; cardcom_token_card_year?: number } } | null
  const basePrice  = booking?.price_per_student ?? 0
  const { calcClassBookingSplit } = await import('@/lib/payments/commissionUtils')
  const amountPaid = basePrice > 0 ? calcClassBookingSplit(basePrice).studentPays : 0

  await supabase
    .from('class_enrollments')
    .update({
      payment_status:          'paid',
      payment_method:          'cardcom',
      amount_paid:             amountPaid,
      cardcom_transaction_id:  txId,
      cardcom_document_type:   documentType,
      cardcom_document_number: documentNumber,
      cardcom_response_code:   String(responseCode),
      cardcom_description:     description,
    })
    .eq('id', enrollmentId)
    .neq('payment_status', 'cancelled')

  if (txId && enrollment.booking_id) {
    await supabase
      .from('bookings')
      .update({ cardcom_transaction_id: txId })
      .eq('id', enrollment.booking_id)
  }

  // ── Commission charge via instructor's saved Cardcom token ────────────────
  // When SapakMutav was used (instructor has grow_merchant_id), the full payment
  // went directly to the instructor's Cardcom sub-account. Platform charges the
  // instructor's saved token for the full 10% commission.
  // If no Sapak, money landed on platform terminal — no token charge needed.
  const instructor = booking?.instructor
  if (instructor?.grow_merchant_id && instructor.cardcom_token && instructor.cardcom_token_card_month && instructor.cardcom_token_card_year && basePrice > 0) {
    const commission      = calcClassBookingSplit(basePrice).platformRevenue  // 10% of base

    // Bounds check: never charge more than MAX_COMMISSION_ILS.
    if (commission <= 0 || commission > MAX_COMMISSION_ILS) {
      console.error(
        `[webhook] Commission amount ₪${commission} out of bounds for enrollment ${enrollmentId} — ` +
        `skipping token charge. Investigate immediately.`
      )
      return
    }

    const instructorEmail = instructor.id ? await getUserEmail(supabase, instructor.id) : ''

    // M-E: Decrypt token if encrypted (new tokens); use as-is if legacy plaintext
    const rawInstructorToken = isEncrypted(instructor.cardcom_token!)
      ? (() => { try { return decryptApiKey(instructor.cardcom_token!) } catch { return instructor.cardcom_token! } })()
      : instructor.cardcom_token!

    chargeProviderToken({
      token:         rawInstructorToken,
      cardMonth:     instructor.cardcom_token_card_month,
      cardYear:      instructor.cardcom_token_card_year,
      amountILS:     commission,
      providerName:  instructor.full_name ?? '',
      providerEmail: instructorEmail,
      description:   `עמלת פלטפורמה — הרשמה ${enrollmentId.substring(0, 8)} (כרטיס אשראי)`,
    }).then(result => {
      if (result.success) {
        console.log(`[webhook] Commission ₪${commission} charged from instructor ${instructor.id} — TxId ${result.transactionId}`)
        supabase.from('class_enrollments').update({
          commission_charged_at: new Date().toISOString(),
          commission_tx_id:      result.transactionId,
        }).eq('id', enrollmentId).then(() => {}, e => console.error('[webhook] commission DB error:', e))
      } else {
        console.error(`[webhook] Commission charge FAILED for enrollment ${enrollmentId}: ${result.responseCode} — ${result.description}`)
      }
    }).catch(e => console.error('[webhook] commission charge error:', e))
  } else {
    console.log(`[webhook] Enrollment ${enrollmentId} confirmed (no SapakMutav). Platform holds ₪${amountPaid}.`)
  }
}

// ─── A4. Class enrollment — failed ───────────────────────────────────────────

async function failClassEnrollment(
  supabase: ReturnType<typeof adminClient>,
  enrollmentId: string,
  responseCode: number,
  description: string
): Promise<void> {
  await supabase
    .from('class_enrollments')
    .update({
      payment_status:        'cancelled',
      cardcom_response_code: String(responseCode),
      cardcom_description:   description,
    })
    .eq('id', enrollmentId)
    .eq('payment_status', 'pending_direct')
}

// ─── B. Token registration — save card token to profile ──────────────────────

async function handleTokenRegistration(
  supabase: ReturnType<typeof adminClient>,
  profileId: string,
  lowProfileId: string
): Promise<void> {
  // Call GetLpResult to retrieve the TokenInfo
  const lpResult = await getLpResult(lowProfileId)

  if (lpResult.ResponseCode !== 0) {
    console.warn(
      `[cardcom/webhook] Token registration failed for profile ${profileId}: ` +
      `ResponseCode=${lpResult.ResponseCode} — ${lpResult.Description}`
    )
    // Clear the pending LowProfileId so they can try again
    await supabase
      .from('profiles')
      .update({ cardcom_token_lp_id: null })
      .eq('id', profileId)
    return
  }

  const token = lpResult.TokenInfo?.Token
  if (!token) {
    console.error(`[cardcom/webhook] Token registration: no token in GetLpResult for profile ${profileId}`)
    return
  }

  // M-E: Encrypt token before storing — protects against DB breach
  const encryptedToken = encryptApiKey(token)

  await supabase
    .from('profiles')
    .update({
      cardcom_token:            encryptedToken,
      cardcom_token_card_month: lpResult.TokenInfo?.CardMonth   ?? null,
      cardcom_token_card_year:  lpResult.TokenInfo?.CardYear    ?? null,
      cardcom_token_approval:   lpResult.TokenInfo?.TokenApprovalNumber ?? null,
      cardcom_token_lp_id:      null, // clear — registration complete
    })
    .eq('id', profileId)

  console.log(`[cardcom/webhook] Token registered for profile ${profileId} (encrypted at rest)`)
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let lowProfileId = ''
  try {
    const body = await request.json() as CardcomWebhookBody
    lowProfileId = body.LowProfileId ?? ''

    // ── 1. Verify terminal + optional webhook token ──────────────────────────
    if (!verifyTerminal(body)) {
      // Do NOT log the expected terminal number — that would expose the env var in logs.
      console.error(`[cardcom/webhook] Terminal mismatch: got ${body.TerminalNumber} — rejecting`)
      return NextResponse.json({ ok: false }, { status: 200 })
    }

    if (!verifyWebhookToken(request, body as CardcomWebhookBody & Record<string, unknown>)) {
      // Return 200 to Cardcom — don't reveal rejection reason externally
      return NextResponse.json({ ok: false }, { status: 200 })
    }

    if (!lowProfileId) {
      console.error('[cardcom/webhook] Missing LowProfileId in webhook body')
      return NextResponse.json({ ok: false }, { status: 200 })
    }

    const supabase = adminClient()

    // ── 2. Find record by LowProfileId ──────────────────────────────────────
    // Search order: bookings → class_enrollments → profiles (token registration)

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, cardcom_transaction_id')
      .eq('cardcom_low_profile_id', lowProfileId)
      .maybeSingle()

    const { data: enrollment } = !booking
      ? await supabase
          .from('class_enrollments')
          .select('id, payment_status, cardcom_transaction_id')
          .eq('cardcom_low_profile_id', lowProfileId)
          .maybeSingle()
      : { data: null }

    const { data: profile } = (!booking && !enrollment)
      ? await supabase
          .from('profiles')
          .select('id, cardcom_token')
          .eq('cardcom_token_lp_id', lowProfileId)
          .maybeSingle()
      : { data: null }

    if (!booking && !enrollment && !profile) {
      console.error(
        `[cardcom/webhook] CRITICAL: No record found for LowProfileId=${lowProfileId}. ` +
        'This requires immediate investigation.'
      )
      return NextResponse.json({ ok: false }, { status: 200 })
    }

    // ── B. Token registration (CreateTokenOnly) ──────────────────────────────
    if (profile) {
      // Idempotency: already has a token
      if (profile.cardcom_token) {
        console.log(`[cardcom/webhook] Profile ${profile.id} already has token — idempotent`)
        return NextResponse.json({ ok: true }, { status: 200 })
      }
      await handleTokenRegistration(supabase, profile.id, lowProfileId)
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    // ── A. Payment (ChargeOnly) ──────────────────────────────────────────────
    // Idempotency: already processed
    const existingTxId = booking?.cardcom_transaction_id ?? enrollment?.cardcom_transaction_id
    if (existingTxId != null && existingTxId !== 0) {
      console.log(`[cardcom/webhook] Already processed LowProfileId=${lowProfileId} (TranzactionId=${existingTxId})`)
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    // Validate via GetLpResult
    let lpResult
    try {
      lpResult = await getLpResult(lowProfileId)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[cardcom/webhook] GetLpResult failed after retry: ${errMsg}`)
      return NextResponse.json({ error: errMsg }, { status: 500 })
    }

    const {
      ResponseCode:  responseCode,
      Description:   description,
      TranzactionId: tranzactionId,
      Operation:     operation,
      DocumentInfo:  docInfo,
    } = lpResult

    const documentType   = docInfo?.DocumentType   ?? null
    const documentNumber = docInfo?.DocumentNumber  ?? null
    const txId           = tranzactionId ?? 0

    if (booking) {
      const bookingId = booking.id
      if (responseCode !== 0) {
        console.warn(`[cardcom/webhook] Payment failed for booking ${bookingId}: ${description}`)
        await failSpaceRentalBooking(supabase, bookingId, responseCode, description)
      } else if (operation === 'ChargeOnly') {
        console.log(`[cardcom/webhook] Booking ${bookingId} confirmed — TranzactionId ${txId}`)
        await confirmSpaceRentalBooking(supabase, bookingId, txId, documentType, documentNumber, responseCode, description)
      }
    } else if (enrollment) {
      const enrollmentId = enrollment.id
      if (responseCode !== 0) {
        console.warn(`[cardcom/webhook] Payment failed for enrollment ${enrollmentId}: ${description}`)
        await failClassEnrollment(supabase, enrollmentId, responseCode, description)
      } else if (operation === 'ChargeOnly') {
        console.log(`[cardcom/webhook] Enrollment ${enrollmentId} confirmed — TranzactionId ${txId}`)
        await confirmClassEnrollment(supabase, enrollmentId, txId, documentType, documentNumber, responseCode, description)
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    console.error(
      '[cardcom/webhook] Unhandled error' +
      (lowProfileId ? ` (LowProfileId=${lowProfileId})` : '') + ':',
      e instanceof Error ? e.message : e
    )
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}
