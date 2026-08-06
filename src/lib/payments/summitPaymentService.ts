/**
 * WELLNESS&SEA — SUMIT Payment Gateway Service
 *
 * Marketplace split-payment integration via sumit.co.il
 * Platform model: intermediary only — invoices commission alone,
 * routes the remainder directly to the beneficiary.
 *
 * Environment variables:
 *   SUMMIT_API_ID         — account API ID   (public,  from SUMIT dashboard)
 *   SUMMIT_API_KEY        — account API key  (secret,  from SUMIT dashboard)
 *   SUMMIT_WEBHOOK_SECRET — secret for webhook HMAC verification
 *   NEXT_PUBLIC_APP_URL   — canonical app URL for callbacks
 *
 * Confirmed:
 *   Base URL : https://app.sumit.co.il
 *   Auth     : headers  account-api-id: {id}   account-api-key: {key}
 *   Charge   : POST /clearing/v1/charge
 */

// ─── Env ─────────────────────────────────────────────────────────────────────

function summitEnv() {
  return {
    apiId:         process.env.SUMMIT_API_ID  ?? '',
    apiKey:        process.env.SUMMIT_API_KEY ?? '',
    webhookSecret: process.env.SUMMIT_WEBHOOK_SECRET ?? '',
    appUrl:        process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  }
}

export function isSummitConfigured(): boolean {
  const { apiId, apiKey } = summitEnv()
  return Boolean(apiId && apiKey)
}

// ─── Shared request helper ────────────────────────────────────────────────────

async function callSumit(
  path: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { apiId, apiKey } = summitEnv()
  if (!apiId)  throw new Error('SUMMIT_API_ID not configured')
  if (!apiKey) throw new Error('SUMMIT_API_KEY not configured')

  const url = `https://app.sumit.co.il/${path}`

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':   'application/json',
      'account-api-id': apiId,
      'account-api-key': apiKey,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()

  if (!res.ok) {
    throw new Error(`SUMIT ${path} HTTP ${res.status}: ${text}`)
  }

  let json: Record<string, unknown>
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`SUMIT ${path} non-JSON response: ${text}`)
  }

  // SUMIT returns { Success: false, ErrorMessage: "..." } on logical failure
  if (json.Success === false || json.success === false) {
    const msg = (json.ErrorMessage ?? json.error ?? JSON.stringify(json)) as string
    throw new Error(`SUMIT ${path} error: ${msg}`)
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
  /** Host's SUMIT sub-merchant ID */
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
  /** Instructor's SUMIT sub-merchant ID */
  instructorMerchantId:    string
  className:               string
  bookingDate:             string
}

// ─── Flow 1: Space Rental ─────────────────────────────────────────────────────

/**
 * Creates a hosted-payment session for a space-rental booking.
 *
 * Split:
 *   hostPayoutAgorot → routed to host sub-merchant (base − 5%)
 *   remainder        → stays with platform (10% of base)
 */
export async function createSpaceRentalPayment(
  params: SpaceRentalParams
): Promise<SummitPaymentResult> {
  const { appUrl } = summitEnv()

  const amountAgorot = Math.round(params.totalILS * 100)

  const data = await callSumit('clearing/v1/charge', {
    Amount:      amountAgorot,          // agorot
    Currency:    'ILS',
    Description: `WELLNESS&SEA — הזמנת חלל: ${params.venueName}`,
    SuccessURL:  `${appUrl}/booking/confirm/${params.bookingId}`,
    FailureURL:  `${appUrl}/booking/${params.bookingId}`,
    NotifyURL:   `${appUrl}/api/webhooks/payment`,

    // Marketplace split — host receives their payout
    Split: {
      SellerId: params.hostMerchantId,
      Amount:   params.hostPayoutAgorot,  // agorot
    },

    // Custom fields for webhook correlation
    CustomFields: {
      Field1: params.bookingId,       // cField1 in webhook
      Field3: 'space_rental',         // cField3 — flow discriminator
    },

    // Also pass as metadata for JSON webhooks
    Metadata: {
      bookingId:    params.bookingId,
      instructorId: params.instructorId,
      flowType:     'space_rental',
    },
  })

  // SUMIT may return URL in different casing
  const checkoutUrl = (
    data.CheckoutUrl ?? data.checkoutUrl ?? data.Url ?? data.url ?? data.PaymentUrl ?? data.paymentUrl
  ) as string | undefined
  const paymentId = (
    data.PaymentId ?? data.paymentId ?? data.Id ?? data.id
  ) as string | undefined

  if (!checkoutUrl) {
    throw new Error(`SUMIT createSpaceRentalPayment: no checkout URL in response — ${JSON.stringify(data)}`)
  }

  return { checkoutUrl, paymentId: paymentId ?? '', rawResponse: data }
}

// ─── Flow 2: Class Booking ────────────────────────────────────────────────────

/**
 * Creates a hosted-payment session for a student enrolling in a class.
 *
 * Split:
 *   instructorPayoutAgorot → routed to instructor sub-merchant (base − 5%)
 *   remainder              → stays with platform (10% of base)
 *
 * Student is charged base + 5%.
 * Instructor receives base − 5%.
 * Platform nets 10% of base.
 */
export async function createClassBookingPayment(
  params: ClassBookingParams
): Promise<SummitPaymentResult> {
  const { appUrl } = summitEnv()

  const amountAgorot = Math.round(params.studentPaysILS * 100)

  const data = await callSumit('clearing/v1/charge', {
    Amount:      amountAgorot,           // agorot
    Currency:    'ILS',
    Description: `WELLNESS&SEA — שיעור: ${params.className} (${params.bookingDate})`,
    SuccessURL:  `${appUrl}/classes/${params.enrollmentId}/success`,
    FailureURL:  `${appUrl}/classes`,
    NotifyURL:   `${appUrl}/api/webhooks/payment`,

    // Marketplace split — instructor receives their payout
    Split: {
      SellerId: params.instructorMerchantId,
      Amount:   params.instructorPayoutAgorot,  // agorot
    },

    CustomFields: {
      Field1: params.enrollmentId,   // cField1 in webhook
      Field3: 'class_booking',       // cField3 — flow discriminator
    },

    Metadata: {
      enrollmentId: params.enrollmentId,
      studentId:    params.studentId,
      flowType:     'class_booking',
    },
  })

  const checkoutUrl = (
    data.CheckoutUrl ?? data.checkoutUrl ?? data.Url ?? data.url ?? data.PaymentUrl ?? data.paymentUrl
  ) as string | undefined
  const paymentId = (
    data.PaymentId ?? data.paymentId ?? data.Id ?? data.id
  ) as string | undefined

  if (!checkoutUrl) {
    throw new Error(`SUMIT createClassBookingPayment: no checkout URL in response — ${JSON.stringify(data)}`)
  }

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
  const data = await callSumit('sellers/v1/register', {
    BusinessType:  params.businessType,
    IdNumber:      params.idNumber,
    FullName:      params.fullName,
    BusinessName:  params.businessName,
    Email:         params.email,
    Phone:         params.phone.replace(/\D/g, ''),
    BankDetails: {
      BankCode:      params.bankCode,
      BranchNumber:  params.branchNumber,
      AccountNumber: params.accountNumber,
    },
  })

  const merchantId = (
    data.SellerId ?? data.MerchantId ?? data.merchantId ?? data.subMerchantId ?? data.Id ?? data.id
  ) as string | undefined

  if (!merchantId) {
    throw new Error(`SUMIT registerSubMerchant: no seller/merchant ID in response — ${JSON.stringify(data)}`)
  }

  return { merchantId, rawResponse: data }
}

// ─── Webhook verification ─────────────────────────────────────────────────────

/**
 * Verify the HMAC signature on incoming SUMIT webhooks.
 */
export function verifySummitWebhook(
  rawBody: string,
  signatureHeader: string
): boolean {
  const { webhookSecret } = summitEnv()
  if (!webhookSecret) return true  // Not configured — skip in dev

  // Implemented in the webhook route handler (crypto.createHmac)
  // This function kept for backwards-compatibility
  const { createHmac, timingSafeEqual } = require('crypto') as typeof import('crypto')
  try {
    const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
    const received = signatureHeader.replace(/^sha256=/, '')
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  } catch {
    return false
  }
}
