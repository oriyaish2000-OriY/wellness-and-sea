/**
 * WELLNESS&SEA — Summit Payment Gateway Service
 *
 * Marketplace split-payment integration.
 * Platform model: intermediary only — invoices commission alone,
 * routes the remainder directly to the beneficiary.
 *
 * Environment variables:
 *   SUMMIT_API_KEY        — platform API key
 *   SUMMIT_API_BASE       — base URL  (e.g. https://api.summit-pay.co.il/v1)
 *   SUMMIT_WEBHOOK_SECRET — secret for webhook HMAC verification
 *   NEXT_PUBLIC_APP_URL   — canonical app URL for callbacks
 */

// ─── Env ─────────────────────────────────────────────────────────────────────

function summitEnv() {
  return {
    apiKey:        process.env.SUMMIT_API_KEY ?? '',
    apiBase:       process.env.SUMMIT_API_BASE ?? '',
    webhookSecret: process.env.SUMMIT_WEBHOOK_SECRET ?? '',
    appUrl:        process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  }
}

export function isSummitConfigured(): boolean {
  const { apiKey, apiBase } = summitEnv()
  return Boolean(apiKey && apiBase)
}

// ─── Shared request helper ────────────────────────────────────────────────────

async function callSummit(
  endpoint: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { apiKey, apiBase } = summitEnv()
  if (!apiKey)  throw new Error('SUMMIT_API_KEY not configured')
  if (!apiBase) throw new Error('SUMMIT_API_BASE not configured')

  const res = await fetch(`${apiBase}/${endpoint}`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()

  if (!res.ok) {
    throw new Error(`Summit ${endpoint} HTTP ${res.status}: ${text}`)
  }

  let json: Record<string, unknown>
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`Summit ${endpoint} non-JSON: ${text}`)
  }

  // Summit returns { success: false, error: "..." } on logical failure
  if (json.success === false) {
    throw new Error(`Summit ${endpoint} error: ${json.error ?? JSON.stringify(json)}`)
  }

  return json
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SummitPaymentResult {
  checkoutUrl: string
  paymentId:   string
  rawResponse: Record<string, unknown>
}

export interface SpaceRentalParams {
  bookingId:          string
  instructorId:       string
  /** What the instructor actually pays (base + 5%), ILS */
  totalILS:           number
  /** Host's payout (base − 5%) in agorot */
  hostPayoutAgorot:   number
  /** Host's Summit merchant ID */
  hostMerchantId:     string
  venueName:          string
}

export interface ClassBookingParams {
  enrollmentId:            string
  studentId:               string
  /** What the student actually pays (base + 5%), ILS */
  studentPaysILS:          number
  /** Instructor's payout (base − 5%) in agorot */
  instructorPayoutAgorot:  number
  /** Instructor's Summit merchant ID */
  instructorMerchantId:    string
  className:               string
  bookingDate:             string
}

// ─── Flow 1: Space Rental ─────────────────────────────────────────────────────

/**
 * Creates a payment session for a space-rental booking.
 *
 * Split:
 *   hostPayoutAgorot → routed to host sub-merchant
 *   remainder        → stays with platform (= 10% of base)
 */
export async function createSpaceRentalPayment(
  params: SpaceRentalParams
): Promise<SummitPaymentResult> {
  const { appUrl } = summitEnv()

  const data = await callSummit('payments/create', {
    amount:      Math.round(params.totalILS * 100),   // agorot
    currency:    'ILS',
    description: `WELLNESS&SEA — הזמנת חלל: ${params.venueName}`,
    successUrl:  `${appUrl}/booking/confirm/${params.bookingId}`,
    cancelUrl:   `${appUrl}/booking/${params.bookingId}`,
    notifyUrl:   `${appUrl}/api/webhooks/payment`,

    // Marketplace split — host receives their payout
    split: {
      merchantId: params.hostMerchantId,
      amount:     params.hostPayoutAgorot,   // agorot
    },

    // Custom fields for webhook correlation
    metadata: {
      bookingId:    params.bookingId,
      instructorId: params.instructorId,
      flowType:     'space_rental',
    },
  })

  const checkoutUrl = (data.checkoutUrl ?? data.url ?? data.paymentUrl) as string | undefined
  const paymentId   = (data.paymentId  ?? data.id) as string | undefined

  if (!checkoutUrl) throw new Error(`Summit createSpaceRentalPayment: no checkout URL — ${JSON.stringify(data)}`)

  return { checkoutUrl, paymentId: paymentId ?? '', rawResponse: data }
}

// ─── Flow 2: Class Booking ────────────────────────────────────────────────────

/**
 * Creates a payment session for a student enrolling in a class.
 *
 * Split:
 *   instructorPayoutAgorot → routed to instructor sub-merchant (base − 5%)
 *   remainder              → stays with platform (10% of base)
 *
 * Student is charged base + 5% (studentPaysILS).
 * Instructor receives base − 5%.
 * Platform nets base × 10%.
 */
export async function createClassBookingPayment(
  params: ClassBookingParams
): Promise<SummitPaymentResult> {
  const { appUrl } = summitEnv()

  const data = await callSummit('payments/create', {
    amount:      Math.round(params.studentPaysILS * 100),  // agorot
    currency:    'ILS',
    description: `WELLNESS&SEA — שיעור: ${params.className} (${params.bookingDate})`,
    successUrl:  `${appUrl}/classes/${params.enrollmentId}/success`,
    cancelUrl:   `${appUrl}/classes`,
    notifyUrl:   `${appUrl}/api/webhooks/payment`,

    // Marketplace split — instructor receives their payout
    split: {
      merchantId: params.instructorMerchantId,
      amount:     params.instructorPayoutAgorot,  // agorot
    },

    metadata: {
      enrollmentId: params.enrollmentId,
      studentId:    params.studentId,
      flowType:     'class_booking',
    },
  })

  const checkoutUrl = (data.checkoutUrl ?? data.url ?? data.paymentUrl) as string | undefined
  const paymentId   = (data.paymentId  ?? data.id) as string | undefined

  if (!checkoutUrl) throw new Error(`Summit createClassBookingPayment: no checkout URL — ${JSON.stringify(data)}`)

  return { checkoutUrl, paymentId: paymentId ?? '', rawResponse: data }
}

// ─── Sub-merchant Registration ────────────────────────────────────────────────

export type BusinessType = 'private' | 'company' | 'non_profit'

export interface SubMerchantParams {
  businessType:  BusinessType
  idNumber:      string       // Israeli ID / Company reg. number
  fullName:      string
  businessName?: string
  email:         string
  phone:         string
  bankCode:      string
  branchNumber:  string
  accountNumber: string
}

export interface SubMerchantResult {
  merchantId:  string
  rawResponse: Record<string, unknown>
}

export async function registerSubMerchant(
  params: SubMerchantParams
): Promise<SubMerchantResult> {
  const data = await callSummit('merchants/register', {
    businessType:  params.businessType,
    idNumber:      params.idNumber,
    fullName:      params.fullName,
    businessName:  params.businessName,
    email:         params.email,
    phone:         params.phone.replace(/\D/g, ''),
    bankDetails: {
      bankCode:      params.bankCode,
      branchNumber:  params.branchNumber,
      accountNumber: params.accountNumber,
    },
  })

  const merchantId = (
    data.merchantId ?? data.subMerchantId ?? data.id
  ) as string | undefined

  if (!merchantId) throw new Error(`Summit registerSubMerchant: no merchantId — ${JSON.stringify(data)}`)

  return { merchantId, rawResponse: data }
}

// ─── Webhook verification ─────────────────────────────────────────────────────

/**
 * Verify the HMAC signature on incoming Summit webhooks.
 * Call this at the top of the webhook handler.
 */
export function verifySummitWebhook(
  rawBody: string,
  signatureHeader: string
): boolean {
  const { webhookSecret } = summitEnv()
  if (!webhookSecret) return true  // Not configured — skip in dev

  // TODO: implement HMAC-SHA256 verification once Summit confirms the exact header name
  // and hashing algorithm. Typical pattern:
  //   const hmac = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
  //   return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signatureHeader))
  return true
}
