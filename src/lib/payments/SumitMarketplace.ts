/**
 * WELLNESS&SEA — SUMIT Payment Gateway Service
 *
 * Hosted payment pages (beginredirect) + payment verification.
 *
 * SUMIT API base: https://api.sumit.co.il
 * Auth: POST body { Credentials: { CompanyID, APIKey } } — NOT headers
 *
 * Environment variables (server-only — never expose to client):
 *   SUMIT_COMPANY_ID        — integer company ID
 *   SUMIT_API_PRIVATE_KEY   — private API key (never use NEXT_PUBLIC_ prefix)
 *   NEXT_PUBLIC_APP_URL     — canonical app URL for redirects
 */

const SUMIT_BASE = 'https://api.sumit.co.il'

// ─── Env ─────────────────────────────────────────────────────────────────────

function sumitEnv() {
  return {
    companyID: parseInt(process.env.SUMIT_COMPANY_ID ?? '0', 10),
    apiKey:    process.env.SUMIT_API_PRIVATE_KEY ?? '',
  }
}

// ─── Internal POST helper ─────────────────────────────────────────────────────

interface SumitResponse<T> {
  Status:          number
  UserErrorMessage?: string
  SystemMessage?:  string
  Data:            T
}

/**
 * POST to a SUMIT API path with credentials injected into the body.
 * Throws on HTTP error or Status !== 0.
 * Never exposes raw API keys in error messages.
 *
 * Two variants:
 *   sumitPost      — uses PLATFORM credentials (env vars)
 *   sumitPostWith  — uses explicit credentials (vendor's CompanyID + APIKey)
 *
 * Money flows to whichever account's credentials are used for beginredirect.
 * All vendor-facing payment pages use sumitPostWith so money lands in the
 * vendor's SUMIT account directly.
 */
async function sumitPost<T>(
  path:  string,
  body:  Record<string, unknown>
): Promise<T> {
  const { companyID, apiKey } = sumitEnv()
  return sumitPostWith<T>(path, body, companyID, apiKey)
}

async function sumitPostWith<T>(
  path:      string,
  body:      Record<string, unknown>,
  companyId: number,
  apiKey:    string
): Promise<T> {
  const payload = {
    Credentials: { CompanyID: companyId, APIKey: apiKey },
    ...body,
  }

  const res = await fetch(`${SUMIT_BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })

  const text = await res.text()
  let json: SumitResponse<T>
  try {
    json = JSON.parse(text) as SumitResponse<T>
  } catch {
    throw new Error(`SUMIT ${path}: non-JSON response (HTTP ${res.status})`)
  }

  if (json.Status !== 0) {
    const msg = json.UserErrorMessage ?? json.SystemMessage ?? `Status ${json.Status}`
    console.error(`[SUMIT] ${path} error — Status ${json.Status}: ${msg}`)
    throw new Error(`SUMIT error: ${msg}`)
  }

  return json.Data
}

// ─── SUMIT API types ──────────────────────────────────────────────────────────

interface CreateCustomerData {
  CustomerID:         number
  CustomerHistoryURL: string
}

// ─── Vendor Credential Validation ────────────────────────────────────────────

/**
 * Validates vendor-supplied SUMIT credentials by making a read-only API call
 * with their CompanyID + APIKey.
 *
 * Strategy: Call /accounting/documents/list/ with the vendor's credentials.
 * - Status === 0 → credentials are valid (returns empty list on new accounts — that's fine)
 * - Status !== 0 → credentials invalid or account issues
 *
 * Note: /accounting/customers/search/ redirects to help.sumit.co.il (blocked endpoint).
 * /accounting/documents/list/ is confirmed to return proper JSON from Vercel servers.
 *
 * Returns { valid, companyName?, reason? } — never throws.
 */
export async function validateVendorCredentials(
  companyId: number,
  apiKey:    string
): Promise<{ valid: boolean; companyName?: string; reason?: string }> {
  try {
    const payload = {
      Credentials: { CompanyID: companyId, APIKey: apiKey },
      // Minimal filter — returns fast even on empty account
      Filter: { PageSize: 1 },
    }

    const res = await fetch(`${SUMIT_BASE}/accounting/documents/list/`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })

    const text = await res.text()
    let json: SumitResponse<unknown>
    try {
      json = JSON.parse(text) as SumitResponse<unknown>
    } catch {
      return {
        valid:  false,
        reason: `תגובה לא תקינה מ-SUMIT (HTTP ${res.status})`,
      }
    }

    if (json.Status === 0) {
      return { valid: true }
    }

    // Map common SUMIT error codes to Hebrew user messages
    const msg = json.UserErrorMessage ?? json.SystemMessage ?? `Status ${json.Status}`
    const isAuthError =
      msg.toLowerCase().includes('unauthorized') ||
      msg.toLowerCase().includes('authentication') ||
      msg.toLowerCase().includes('credentials') ||
      json.Status === 1001 ||
      json.Status === 1002

    console.warn(
      `[SUMIT] validateVendorCredentials: CompanyID ${companyId} — Status ${json.Status}: ${msg}`
    )

    return {
      valid:  false,
      reason: isAuthError
        ? 'מזהה החברה או מפתח ה-API שגויים — בדקי שהזנת את הפרטים הנכונים'
        : `שגיאה מ-SUMIT: ${msg}`,
    }
  } catch (err) {
    console.error('[SUMIT] validateVendorCredentials network error:', err)
    return {
      valid:  false,
      reason: 'שגיאת רשת בתקשורת עם SUMIT — אנא נסי שוב',
    }
  }
}

// ─── Marketplace Split Charge ─────────────────────────────────────────────────

export interface MultiVendorChargeParams {
  /** SingleUseToken from SUMIT's JavaScript Payments API (payments.js / og-token) */
  singleUseToken:     string
  customerName:       string
  customerEmail?:     string
  /** Vendor's portion of the charge → routes directly to vendor's SUMIT account */
  vendorItem: {
    name:          string
    description?:  string
    unitPrice:     number   // in ILS
    companyId:     number   // vendor's SUMIT CompanyID
    apiKey:        string   // vendor's decrypted SUMIT private key
  }
  /** Platform's commission portion → stays in platform's SUMIT account */
  platformCommissionILS: number
  documentDescription?:  string
  externalIdentifier?:   string
}

export interface MultiVendorChargeResult {
  /** SUMIT payment ID (from the vendor item — underlying card transaction) */
  paymentId:          number
  /** SUMIT payment ID for the platform commission item (needed for platform-side refund) */
  platformPaymentId?: number
  /** Total amount charged to the card (vendorPortion + platformCommission) */
  totalCharged:       number
  /** Whether the payment is valid per SUMIT */
  valid:              boolean
}

interface MultiVendorChargeData {
  Vendors: Array<{
    Payment: {
      ID:           number
      Amount:       number
      ValidPayment: boolean
      Status?:      string
    }
    DocumentID?:         number
    DocumentNumber?:     number
    CustomerID?:         number
    DocumentDownloadURL?: string
  }>
}

/**
 * Charges the customer once and splits the money at the SUMIT level:
 *   • vendorItem.unitPrice  → routes to vendor's own SUMIT account
 *   • platformCommissionILS → stays in platform's SUMIT account (Credentials)
 *
 * Total card charge = vendorItem.unitPrice + platformCommissionILS
 *
 * Uses `AutoCapture: true` (J4 immediate settlement). The marketplace docs say
 * "J5 only" referring to credit-card type (vs debit/direct-debit), not deferred
 * capture. AutoCapture=true commits the authorization immediately on the card.
 *
 * Both items MUST carry a CompanyID per the MultiVendorChargeItem schema.
 * Platform item uses platform's own CompanyID (no APIKey needed since Credentials
 * already authenticate the platform account).
 */
export async function chargeMultiVendor(
  params: MultiVendorChargeParams
): Promise<MultiVendorChargeResult> {
  const { companyID, apiKey } = sumitEnv()

  const data = await sumitPost<MultiVendorChargeData>(
    '/billing/payments/multivendorcharge/',
    {
      SingleUseToken: params.singleUseToken,
      Customer: {
        Name:         params.customerName || 'לקוח',
        EmailAddress: params.customerEmail || undefined,
      },
      Items: [
        // 1. Vendor's portion — money routes to vendor's SUMIT account
        {
          Item:        { Name: params.vendorItem.name },
          Description: params.vendorItem.description ?? undefined,
          UnitPrice:   params.vendorItem.unitPrice,
          Quantity:    1,
          CompanyID:   params.vendorItem.companyId,
          APIKey:      params.vendorItem.apiKey,
        },
        // 2. Platform commission — stays in platform's own SUMIT account
        {
          Item:      { Name: 'עמלת פלטפורמה — Wellness&Sea' },
          UnitPrice: params.platformCommissionILS,
          Quantity:  1,
          CompanyID: companyID,   // platform's own CompanyID
          // No APIKey: Credentials already authenticate the platform
        },
      ],
      VATIncluded:         true,
      AutoCapture:         true,   // immediate settlement (not pre-auth hold)
      DocumentDescription: params.documentDescription ?? undefined,
      ExternalIdentifier:  params.externalIdentifier ?? undefined,
      SendDocumentByEmail: Boolean(params.customerEmail),
    }
  )

  if (!data.Vendors || data.Vendors.length === 0) {
    throw new Error('multivendorcharge returned no vendor results')
  }

  // All vendor results must be valid — they share the same underlying card charge
  const allValid = data.Vendors.every(v => v.Payment?.ValidPayment === true)
  if (!allValid) {
    const statuses = data.Vendors.map(v => `CompanyID: status=${v.Payment?.Status}`).join(', ')
    console.error(`[SUMIT multivendorcharge] Some vendors invalid: ${statuses}`)
  }

  // Vendors[0] = vendor portion, Vendors[1] = platform commission
  const vendorResult   = data.Vendors[0]
  const platformResult = data.Vendors[1]

  return {
    paymentId:        vendorResult.Payment.ID,
    platformPaymentId: platformResult?.Payment?.ID,
    totalCharged:     vendorResult.Payment.Amount + (platformResult?.Payment?.Amount ?? 0),
    valid:            allValid,
  }
}

// ─── Refund ───────────────────────────────────────────────────────────────────

/**
 * Refunds a multivendorcharge split payment.
 *
 * A multivendorcharge creates two separate SUMIT payment records:
 *   • vendorPaymentId    — vendor's portion (e.g. host or instructor)
 *   • platformPaymentId  — platform commission portion
 *
 * Each must be refunded with the credentials of the account that received it:
 *   • Vendor portion:   refunded via vendor's own CompanyID + APIKey
 *   • Platform portion: refunded via platform's env-var credentials
 *
 * Returns { vendorRefunded, platformRefunded } — never throws.
 * If platformPaymentId is not provided (legacy records), only vendor is refunded.
 */
export async function refundMultiVendorPayment(
  vendorPaymentId:    number,
  platformPaymentId:  number | null | undefined,
  vendorCompanyId:    number,
  vendorApiKey:       string,
): Promise<{ vendorRefunded: boolean; platformRefunded: boolean; reason?: string }> {
  let vendorRefunded   = false
  let platformRefunded = false
  const reasons: string[] = []

  // Refund vendor portion using vendor's own credentials
  try {
    await sumitPostWith<unknown>(
      '/billing/payments/refund/',
      { PaymentID: vendorPaymentId },
      vendorCompanyId,
      vendorApiKey,
    )
    vendorRefunded = true
    console.log(`[SUMIT] refundMultiVendorPayment: vendor PaymentID ${vendorPaymentId} refunded`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[SUMIT] refundMultiVendorPayment: vendor refund failed for PaymentID ${vendorPaymentId}:`, msg)
    reasons.push(`vendor: ${msg}`)
  }

  // Refund platform commission using platform's own credentials
  if (platformPaymentId) {
    try {
      await sumitPost<unknown>('/billing/payments/refund/', { PaymentID: platformPaymentId })
      platformRefunded = true
      console.log(`[SUMIT] refundMultiVendorPayment: platform PaymentID ${platformPaymentId} refunded`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[SUMIT] refundMultiVendorPayment: platform refund failed for PaymentID ${platformPaymentId}:`, msg)
      reasons.push(`platform: ${msg}`)
    }
  } else {
    // No platform payment ID recorded — skip platform refund (manual recovery needed)
    console.warn('[SUMIT] refundMultiVendorPayment: no platformPaymentId — platform portion not refunded automatically')
    platformRefunded = true // treat as non-blocking (old records pre-migration 007)
  }

  return {
    vendorRefunded,
    platformRefunded,
    reason: reasons.length > 0 ? reasons.join('; ') : undefined,
  }
}

// ─── Vendor Customer Creation ─────────────────────────────────────────────────

export interface VendorCustomerParams {
  name:           string
  email:          string
  phone:          string
  city?:          string
  address?:       string
  companyNumber?: string
  externalId?:    string
}

/**
 * Registers a vendor (host or instructor) as a SUMIT customer.
 * Stores the returned CustomerID for future payouts and reporting.
 */
export async function createVendorCustomer(
  vendor: VendorCustomerParams
): Promise<{ customerID: number; historyURL: string }> {
  const data = await sumitPost<CreateCustomerData>(
    '/accounting/customers/create/',
    {
      Details: {
        Name:               vendor.name,
        EmailAddress:       vendor.email,
        Phone:              vendor.phone,
        City:               vendor.city              ?? undefined,
        Address:            vendor.address           ?? undefined,
        CompanyNumber:      vendor.companyNumber     ?? undefined,
        ExternalIdentifier: vendor.externalId        ?? undefined,
      },
    }
  )

  return {
    customerID:  data.CustomerID,
    historyURL:  data.CustomerHistoryURL,
  }
}
