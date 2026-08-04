/**
 * WELLNESS&SEA — Grow (Meshulam) Payment Gateway Service
 *
 * Handles:
 *   1. Creating payment links with Marketplace split-payments
 *   2. Registering new sub-merchants (KYC for hosts & instructors)
 *
 * All monetary amounts sent to Grow are in AGOROT (integer).
 * All API calls use multipart/form-data as required by Grow's server API.
 *
 * Environment variables required:
 *   GROW_API_KEY        — platform's main API key
 *   GROW_USER_ID        — platform's main Grow user ID
 *   GROW_PAGE_CODE      — payment page code for credit-card / ApplePay flows
 *   GROW_API_BASE       — e.g. https://api.grow.link/api/light/server/1.0
 *                         (sandbox: http://sandboxapi.grow.link/api/light/server/1.0)
 *   NEXT_PUBLIC_APP_URL — canonical app URL for success/notify callbacks
 */

// ─── Env helpers ─────────────────────────────────────────────────────────────

function growEnv() {
  const apiKey   = process.env.GROW_API_KEY
  const userId   = process.env.GROW_USER_ID
  const pageCode = process.env.GROW_PAGE_CODE
  const apiBase  = process.env.GROW_API_BASE ?? 'http://sandboxapi.grow.link/api/light/server/1.0'
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return { apiKey, userId, pageCode, apiBase, appUrl }
}

export function isGrowConfigured(): boolean {
  const { apiKey, userId, pageCode } = growEnv()
  return Boolean(apiKey && userId && pageCode)
}

// ─── Shared API call ─────────────────────────────────────────────────────────

async function callGrow(endpoint: string, formData: FormData): Promise<Record<string, unknown>> {
  const { apiKey, apiBase } = growEnv()
  if (!apiKey) throw new Error('GROW_API_KEY not configured')

  const res = await fetch(`${apiBase}/${endpoint}`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: formData,
  })

  const text = await res.text()

  if (!res.ok) {
    throw new Error(`Grow API ${endpoint} failed ${res.status}: ${text}`)
  }

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`Grow API ${endpoint} returned non-JSON: ${text}`)
  }
}

/** Extract the checkout URL from various Grow response shapes */
function extractUrl(data: Record<string, unknown>): string | null {
  const d = data?.data as Record<string, unknown> | undefined
  return (
    d?.url          as string ??
    d?.link         as string ??
    d?.paymentLink  as string ??
    data?.url       as string ??
    data?.link      as string ??
    data?.paymentLink as string ??
    null
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GrowPaymentLinkResult {
  checkoutUrl: string
  rawResponse: Record<string, unknown>
}

export interface SpaceRentalLinkParams {
  bookingId:          string
  instructorId:       string
  /** Total the instructor pays — in ILS */
  totalILS:           number
  /** Total in agorot (integer) */
  totalAgorot:        number
  /** Host's share in agorot — routed to host sub-merchant */
  hostPayoutAgorot:   number
  /** Host's Grow sub-merchant user ID */
  hostGrowMerchantId: string
  venueName:          string
}

export interface ClassPaymentLinkParams {
  enrollmentId:             string
  studentId:                string
  /** Price per student — in ILS */
  priceILS:                 number
  /** Price in agorot */
  priceAgorot:              number
  /** Instructor's share in agorot — routed to instructor sub-merchant */
  instructorPayoutAgorot:   number
  /** Instructor's Grow sub-merchant user ID */
  instructorGrowMerchantId: string
  className:                string
  bookingDate:              string   // YYYY-MM-DD
}

// ─── Flow 1: Space Rental Payment Link ───────────────────────────────────────

/**
 * Create a one-time Grow payment link for a space rental booking.
 *
 * Split:
 *   hostPayoutAgorot  → Host's sub-merchant account
 *   remainder         → Platform's main account (= instructor markup + host deduction)
 *
 * The split is declared in Grow's `splitPayments` array.
 * Grow routes the declared amount to the sub-merchant and the remainder stays
 * in the platform's main account — no second split entry is needed for the platform.
 */
export async function createSpaceRentalPaymentLink(
  params: SpaceRentalLinkParams
): Promise<GrowPaymentLinkResult> {
  const { userId, pageCode, appUrl } = growEnv()
  if (!userId || !pageCode) throw new Error('Grow not fully configured')

  const fd = new FormData()
  fd.append('userId',    userId)
  fd.append('pageCode',  pageCode)

  // ── Product ──────────────────────────────────────────────────────────────
  fd.append('title', `WELLNESS&SEA — ${params.venueName}`)
  fd.append('products[data][0][name]',     `הזמנת חלל: ${params.venueName}`)
  fd.append('products[data][0][price]',    String(params.totalAgorot))  // agorot
  fd.append('products[data][0][quantity]', '1')
  fd.append('products[data][0][vatType]',  '3') // VAT exempt (sports/fitness)

  // ── Accepted payment methods ─────────────────────────────────────────────
  fd.append('transactionType[0]', '1')  // Credit card
  fd.append('transactionType[1]', '5')  // PayBox
  fd.append('transactionType[2]', '6')  // Bit
  fd.append('transactionType[3]', '13') // Apple Pay
  fd.append('transactionType[4]', '14') // Google Pay

  // ── Marketplace split — host sub-merchant receives their payout ───────────
  fd.append('splitPayments[0][userId]', params.hostGrowMerchantId)
  fd.append('splitPayments[0][amount]', String(params.hostPayoutAgorot))
  // Platform automatically receives: totalAgorot − hostPayoutAgorot

  // ── Link settings ─────────────────────────────────────────────────────────
  fd.append('paymentLinkType', '2')  // one-time use
  fd.append('isActive',        '1')

  // ── Callbacks ─────────────────────────────────────────────────────────────
  fd.append('successUrl', `${appUrl}/booking/confirm/${params.bookingId}`)
  fd.append('notifyUrl',  `${appUrl}/api/webhooks/payment`)

  // ── Custom fields for webhook correlation ─────────────────────────────────
  fd.append('cField1', params.bookingId)       // booking UUID
  fd.append('cField2', params.instructorId)    // instructor UUID
  fd.append('cField3', 'space_rental')         // flow type discriminator

  const data = await callGrow('CreatePaymentLink', fd)
  const checkoutUrl = extractUrl(data)

  if (!checkoutUrl) {
    throw new Error(`Grow CreatePaymentLink returned no URL: ${JSON.stringify(data)}`)
  }

  return { checkoutUrl, rawResponse: data }
}

// ─── Flow 2: Class Booking Payment Link ──────────────────────────────────────

/**
 * Create a one-time Grow payment link for a student enrolling in a class.
 *
 * Split:
 *   instructorPayoutAgorot → Instructor's sub-merchant account (90%)
 *   remainder              → Platform's main account (10%)
 */
export async function createClassPaymentLink(
  params: ClassPaymentLinkParams
): Promise<GrowPaymentLinkResult> {
  const { userId, pageCode, appUrl } = growEnv()
  if (!userId || !pageCode) throw new Error('Grow not fully configured')

  const fd = new FormData()
  fd.append('userId',   userId)
  fd.append('pageCode', pageCode)

  // ── Product ──────────────────────────────────────────────────────────────
  fd.append('title', `WELLNESS&SEA — ${params.className}`)
  fd.append('products[data][0][name]',     `שיעור: ${params.className} — ${params.bookingDate}`)
  fd.append('products[data][0][price]',    String(params.priceAgorot))
  fd.append('products[data][0][quantity]', '1')
  fd.append('products[data][0][vatType]',  '3')

  // ── Accepted payment methods ─────────────────────────────────────────────
  fd.append('transactionType[0]', '1')
  fd.append('transactionType[1]', '5')
  fd.append('transactionType[2]', '6')
  fd.append('transactionType[3]', '13')
  fd.append('transactionType[4]', '14')

  // ── Marketplace split — instructor sub-merchant receives their payout ─────
  fd.append('splitPayments[0][userId]', params.instructorGrowMerchantId)
  fd.append('splitPayments[0][amount]', String(params.instructorPayoutAgorot))
  // Platform receives: priceAgorot − instructorPayoutAgorot (= 10%)

  // ── Link settings ─────────────────────────────────────────────────────────
  fd.append('paymentLinkType', '2')
  fd.append('isActive',        '1')

  // ── Callbacks ─────────────────────────────────────────────────────────────
  fd.append('successUrl', `${appUrl}/classes/${params.enrollmentId}/success`)
  fd.append('notifyUrl',  `${appUrl}/api/webhooks/payment`)

  // ── Custom fields ─────────────────────────────────────────────────────────
  fd.append('cField1', params.enrollmentId) // enrollment UUID
  fd.append('cField2', params.studentId)    // student UUID
  fd.append('cField3', 'class_booking')     // flow type discriminator

  const data = await callGrow('CreatePaymentLink', fd)
  const checkoutUrl = extractUrl(data)

  if (!checkoutUrl) {
    throw new Error(`Grow CreatePaymentLink (class) returned no URL: ${JSON.stringify(data)}`)
  }

  return { checkoutUrl, rawResponse: data }
}

// ─── Sub-merchant Registration (KYC) ─────────────────────────────────────────

export type BusinessType = 'private' | 'company' | 'non_profit'

export interface SubMerchantKYCParams {
  businessType:  BusinessType
  /** Israeli ID (ת.ז.) for private / Company registration number */
  idNumber:      string
  fullName:      string
  businessName?: string     // Required for businessType = 'company'
  email:         string
  phone:         string     // Israeli mobile: 05X-XXXXXXX
  /** Bank code — Israeli standard: 12=Hapoalim, 10=Leumi, 11=Discount, 20=Mizrahi */
  bankCode:      string
  branchNumber:  string
  accountNumber: string
}

export interface SubMerchantResult {
  /** The Grow sub-merchant user ID — store in profiles.grow_merchant_id */
  subMerchantId: string
  rawResponse:   Record<string, unknown>
}

/**
 * Register a new sub-merchant (host or instructor) with Grow for KYC/split-payment.
 *
 * After success, store `subMerchantId` in `profiles.grow_merchant_id`.
 * This ID is required in splitPayments when creating payment links.
 *
 * Grow endpoint: CreateSubUser (exact name may vary — check Grow sandbox docs)
 */
export async function registerSubMerchant(
  params: SubMerchantKYCParams
): Promise<SubMerchantResult> {
  const { userId } = growEnv()
  if (!userId) throw new Error('GROW_USER_ID not configured')

  const fd = new FormData()
  fd.append('userId',        userId)
  fd.append('businessType',  params.businessType)
  fd.append('idNumber',      params.idNumber)
  fd.append('fullName',      params.fullName)
  fd.append('email',         params.email)
  fd.append('phone',         params.phone.replace(/\D/g, '')) // digits only
  fd.append('bankCode',      params.bankCode)
  fd.append('branchNumber',  params.branchNumber)
  fd.append('accountNumber', params.accountNumber)

  if (params.businessType === 'company' && params.businessName) {
    fd.append('businessName', params.businessName)
  }

  const data = await callGrow('CreateSubUser', fd)

  // Grow returns subMerchantId under various keys
  const d = data?.data as Record<string, unknown> | undefined
  const subMerchantId =
    (d?.subMerchantId ?? d?.userId ?? d?.sub_merchant_id ?? data?.subMerchantId) as string | undefined

  if (!subMerchantId) {
    throw new Error(`Grow CreateSubUser returned no subMerchantId: ${JSON.stringify(data)}`)
  }

  return { subMerchantId, rawResponse: data }
}
