/**
 * WELLNESS&SEA — Grow (Meshulam) Payment Gateway Service
 *
 * Handles:
 *   1. Creating payment processes (createPaymentProcess)
 *   2. Registering sub-merchants for KYC (hosts & instructors)
 *
 * Auth: apiKey sent as a form-data field in every request body.
 * Amounts: sent in ILS (shekels), NOT in agorot.
 *
 * Environment variables required:
 *   GROW_API_KEY        — platform's API key (form-data field)
 *   GROW_USER_ID        — platform's Grow user ID
 *   GROW_PAGE_CODE      — payment page code
 *   GROW_API_BASE       — e.g. https://sandbox.meshulam.co.il/api/light/server/1.0
 *   NEXT_PUBLIC_APP_URL — canonical app URL for success/notify callbacks
 */

// ─── Env helpers ─────────────────────────────────────────────────────────────

function growEnv() {
  const apiKey   = process.env.GROW_API_KEY
  const userId   = process.env.GROW_USER_ID
  const pageCode = process.env.GROW_PAGE_CODE
  const apiBase  = process.env.GROW_API_BASE
    ?? 'https://sandbox.meshulam.co.il/api/light/server/1.0'
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return { apiKey, userId, pageCode, apiBase, appUrl }
}

export function isGrowConfigured(): boolean {
  const { apiKey, userId, pageCode } = growEnv()
  return Boolean(apiKey && userId && pageCode)
}

// ─── Shared API call ─────────────────────────────────────────────────────────

/**
 * POST to Grow API.
 * apiKey is injected into every FormData as required by Meshulam.
 */
async function callGrow(
  endpoint: string,
  formData: FormData
): Promise<Record<string, unknown>> {
  const { apiKey, userId, apiBase } = growEnv()
  if (!apiKey)  throw new Error('GROW_API_KEY not configured')
  if (!userId)  throw new Error('GROW_USER_ID not configured')

  // Auth fields go in the body (not headers)
  formData.set('apiKey',  apiKey)
  formData.set('userId',  userId)

  const res = await fetch(`${apiBase}/${endpoint}`, {
    method: 'POST',
    body:   formData,
  })

  const text = await res.text()

  if (!res.ok) {
    throw new Error(`Grow ${endpoint} HTTP ${res.status}: ${text}`)
  }

  let json: Record<string, unknown>
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`Grow ${endpoint} non-JSON response: ${text}`)
  }

  // Grow returns { status: 0, err: "..." } on logical failure
  if (json.status === 0) {
    throw new Error(`Grow ${endpoint} error: ${json.err ?? JSON.stringify(json)}`)
  }

  return json
}

/** Extract checkout URL from Grow response */
function extractUrl(data: Record<string, unknown>): string | null {
  const d = data?.data as Record<string, unknown> | undefined
  return (
    (d?.url         as string | undefined) ??
    (d?.link        as string | undefined) ??
    (data?.url      as string | undefined) ??
    null
  )
}

/** Convert agorot to ILS string with 2 decimal places */
function agorotToILS(agorot: number): string {
  return (agorot / 100).toFixed(2)
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GrowPaymentLinkResult {
  checkoutUrl: string
  processId:   number | null
  rawResponse: Record<string, unknown>
}

export interface SpaceRentalLinkParams {
  bookingId:          string
  instructorId:       string
  /** Total the instructor pays — in ILS */
  totalILS:           number
  /** Total in agorot */
  totalAgorot:        number
  /** Host's share in agorot */
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
  /** Instructor's share in agorot */
  instructorPayoutAgorot:   number
  /** Instructor's Grow sub-merchant user ID */
  instructorGrowMerchantId: string
  className:                string
  bookingDate:              string
}

// ─── Flow 1: Space Rental Payment ────────────────────────────────────────────

export async function createSpaceRentalPaymentLink(
  params: SpaceRentalLinkParams
): Promise<GrowPaymentLinkResult> {
  const { pageCode, appUrl } = growEnv()
  if (!pageCode) throw new Error('GROW_PAGE_CODE not configured')

  const fd = new FormData()
  fd.set('pageCode',    pageCode)
  fd.set('sum',         String(params.totalILS))            // ILS total
  fd.set('description', `הזמנת חלל: ${params.venueName}`)
  fd.set('successUrl',  `${appUrl}/booking/confirm/${params.bookingId}`)
  fd.set('cancelUrl',   `${appUrl}/booking/${params.bookingId}`)
  fd.set('notifyUrl',   `${appUrl}/api/webhooks/payment`)

  // Custom fields — used by webhook to identify the booking
  fd.set('cField1', params.bookingId)
  fd.set('cField2', params.instructorId)
  fd.set('cField3', 'space_rental')

  // Marketplace split — host receives their payout
  fd.set('splitPayments[0][userId]',  params.hostGrowMerchantId)
  fd.set('splitPayments[0][amount]',  agorotToILS(params.hostPayoutAgorot))

  const data       = await callGrow('createPaymentProcess', fd)
  const checkoutUrl = extractUrl(data)
  const d           = data?.data as Record<string, unknown> | undefined

  if (!checkoutUrl) {
    throw new Error(`Grow createPaymentProcess returned no URL: ${JSON.stringify(data)}`)
  }

  console.log(`[Grow Flow1] processId=${d?.processId ?? 'n/a'} url=${checkoutUrl}`)

  return {
    checkoutUrl,
    processId:   (d?.processId as number | undefined) ?? null,
    rawResponse: data,
  }
}

// ─── Flow 2: Class Booking Payment ───────────────────────────────────────────

export async function createClassPaymentLink(
  params: ClassPaymentLinkParams
): Promise<GrowPaymentLinkResult> {
  const { pageCode, appUrl } = growEnv()
  if (!pageCode) throw new Error('GROW_PAGE_CODE not configured')

  const fd = new FormData()
  fd.set('pageCode',    pageCode)
  fd.set('sum',         String(params.priceILS))            // ILS total
  fd.set('description', `שיעור: ${params.className} — ${params.bookingDate}`)
  fd.set('successUrl',  `${appUrl}/classes/${params.enrollmentId}/success`)
  fd.set('cancelUrl',   `${appUrl}/classes`)
  fd.set('notifyUrl',   `${appUrl}/api/webhooks/payment`)

  // Custom fields — used by webhook to identify the enrollment
  fd.set('cField1', params.enrollmentId)
  fd.set('cField2', params.studentId)
  fd.set('cField3', 'class_booking')

  // Marketplace split — instructor receives 90%
  fd.set('splitPayments[0][userId]',  params.instructorGrowMerchantId)
  fd.set('splitPayments[0][amount]',  agorotToILS(params.instructorPayoutAgorot))

  const data        = await callGrow('createPaymentProcess', fd)
  const checkoutUrl = extractUrl(data)
  const d           = data?.data as Record<string, unknown> | undefined

  if (!checkoutUrl) {
    throw new Error(`Grow createPaymentProcess (class) returned no URL: ${JSON.stringify(data)}`)
  }

  console.log(`[Grow Flow2] processId=${d?.processId ?? 'n/a'} url=${checkoutUrl}`)

  return {
    checkoutUrl,
    processId:   (d?.processId as number | undefined) ?? null,
    rawResponse: data,
  }
}

// ─── Sub-merchant Registration (KYC) ─────────────────────────────────────────

export type BusinessType = 'private' | 'company' | 'non_profit'

export interface SubMerchantKYCParams {
  businessType:  BusinessType
  idNumber:      string
  fullName:      string
  businessName?: string
  email:         string
  phone:         string
  bankCode:      string
  branchNumber:  string
  accountNumber: string
}

export interface SubMerchantResult {
  subMerchantId: string
  rawResponse:   Record<string, unknown>
}

export async function registerSubMerchant(
  params: SubMerchantKYCParams
): Promise<SubMerchantResult> {
  const fd = new FormData()
  fd.set('businessType',  params.businessType)
  fd.set('idNumber',      params.idNumber)
  fd.set('fullName',      params.fullName)
  fd.set('email',         params.email)
  fd.set('phone',         params.phone.replace(/\D/g, ''))
  fd.set('bankCode',      params.bankCode)
  fd.set('branchNumber',  params.branchNumber)
  fd.set('accountNumber', params.accountNumber)

  if (params.businessType === 'company' && params.businessName) {
    fd.set('businessName', params.businessName)
  }

  const data = await callGrow('createSubUser', fd)
  const d    = data?.data as Record<string, unknown> | undefined

  const subMerchantId = (
    (d?.subMerchantId ?? d?.userId ?? d?.sub_merchant_id ?? data?.subMerchantId) as string | undefined
  )

  if (!subMerchantId) {
    throw new Error(`Grow createSubUser returned no subMerchantId: ${JSON.stringify(data)}`)
  }

  return { subMerchantId, rawResponse: data }
}
