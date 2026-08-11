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
    companyID:  parseInt(process.env.SUMIT_COMPANY_ID ?? '0', 10),
    apiKey:     process.env.SUMIT_API_PRIVATE_KEY ?? '',
    appUrl:     process.env.NEXT_PUBLIC_APP_URL   ?? 'http://localhost:3000',
  }
}

export function isSumitConfigured(): boolean {
  const { companyID, apiKey } = sumitEnv()
  return Boolean(companyID > 0 && apiKey)
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

interface BeginRedirectData {
  RedirectURL: string
}

interface GetPaymentData {
  Payment: {
    ID:            number
    Amount:        number
    ValidPayment:  boolean
    Status:        string
    CustomerID:    number
  }
}

interface CreateCustomerData {
  CustomerID:         number
  CustomerHistoryURL: string
}

// ─── Flow 1: Space Rental ─────────────────────────────────────────────────────

export interface SpaceRentalParams {
  bookingId:       string
  instructorId:    string
  totalILS:        number  // instructor pays (base + 5%)
  hostPayout:      number  // host will receive (base - 5%), stored in DB
  venueName:       string
  customerName:    string
  customerEmail:   string
  // vendorCompanyId and vendorApiKey REMOVED — platform creds used instead
}

/**
 * Creates a SUMIT hosted payment page for a space-rental booking.
 *
 * Uses PLATFORM credentials (env vars) so that totalILS lands in the platform's
 * SUMIT account. Platform keeps 10% commission and owes host the remainder
 * (tracked in DB via vendor_payout_status).
 *
 * ExternalIdentifier = "space_rental:{bookingId}"
 */
export async function createSpaceRentalPaymentUrl(
  params: SpaceRentalParams
): Promise<{ checkoutUrl: string }> {
  const { appUrl } = sumitEnv()

  const data = await sumitPost<BeginRedirectData>(
    '/billing/payments/beginredirect/',
    {
      Customer: {
        Name:  params.customerName || 'לקוח',
        Email: params.customerEmail || undefined,
      },
      Items: [
        {
          Item:        { Name: 'השכרת שטח לשיעור יוגה' },
          Description: params.venueName,
          UnitPrice:   params.totalILS,
          Quantity:    1,
        },
      ],
      ExternalIdentifier:          `space_rental:${params.bookingId}`,
      RedirectURL:                 `${appUrl}/api/webhooks/sumit/return`,
      CancelRedirectURL:           `${appUrl}/booking/${params.bookingId}?cancelled=true`,
      SendUpdateByEmailAddress:    params.customerEmail || undefined,
      UpdateOrganizationOnSuccess: true,
      DocumentDescription:         `השכרת שטח - ${params.venueName}`,
      VATIncluded:                 true,
      MaximumPayments:             0,
      ExpirationHours:             2,
    }
  )

  return { checkoutUrl: data.RedirectURL }
}

// ─── Flow 2: Class Booking ────────────────────────────────────────────────────

export interface ClassBookingParams {
  enrollmentId:      string
  studentId:         string
  totalILS:          number  // student pays (base + 5%)
  instructorPayout:  number  // instructor will receive (base - 5%), stored in DB
  className:         string
  bookingDate:       string
  customerName:      string
  customerEmail:     string
  // vendorCompanyId and vendorApiKey REMOVED — platform creds used instead
}

/**
 * Creates a SUMIT hosted payment page for a class enrollment.
 *
 * Uses PLATFORM credentials (env vars) so that totalILS lands in the platform's
 * SUMIT account. Platform keeps 10% commission and owes instructor the remainder
 * (tracked in DB via vendor_payout_status).
 *
 * ExternalIdentifier = "class_booking:{enrollmentId}"
 */
export async function createClassBookingPaymentUrl(
  params: ClassBookingParams
): Promise<{ checkoutUrl: string }> {
  const { appUrl } = sumitEnv()

  const data = await sumitPost<BeginRedirectData>(
    '/billing/payments/beginredirect/',
    {
      Customer: {
        Name:  params.customerName || 'לקוח',
        Email: params.customerEmail || undefined,
      },
      Items: [
        {
          Item:        { Name: 'שיעור יוגה' },
          Description: `${params.className} - ${params.bookingDate}`,
          UnitPrice:   params.totalILS,
          Quantity:    1,
        },
      ],
      ExternalIdentifier:          `class_booking:${params.enrollmentId}`,
      RedirectURL:                 `${appUrl}/api/webhooks/sumit/return`,
      CancelRedirectURL:           `${appUrl}/classes?cancelled=true`,
      SendUpdateByEmailAddress:    params.customerEmail || undefined,
      UpdateOrganizationOnSuccess: true,
      DocumentDescription:         `${params.className} - ${params.bookingDate}`,
      VATIncluded:                 true,
      MaximumPayments:             0,
      ExpirationHours:             2,
    }
  )

  return { checkoutUrl: data.RedirectURL }
}

// ─── Payment Verification ─────────────────────────────────────────────────────

/**
 * Verifies a SUMIT payment via the payments/get endpoint using PLATFORM credentials.
 *
 * Since payments now go to the platform's SUMIT account, verification uses
 * platform credentials (env vars). This is the primary verification path.
 */
export async function verifySumitPayment(
  paymentId:         number,
  expectedAmountILS: number
): Promise<{ valid: boolean; amount: number; paymentId: number }> {
  const { companyID, apiKey } = sumitEnv()
  return verifySumitPaymentWith(paymentId, expectedAmountILS, companyID, apiKey)
}

/**
 * Verifies a SUMIT payment using explicit vendor credentials.
 *
 * Since beginredirect uses vendor credentials, payments live in the vendor's
 * SUMIT account and must be verified using their CompanyID + APIKey.
 *
 * Checks:
 *   - ValidPayment === true
 *   - Amount >= expectedAmountILS (tolerance 0.01 ILS)
 *
 * SECURITY: Never trust query params from the return URL —
 * always call this before confirming any booking.
 */
export async function verifySumitPaymentWith(
  paymentId:         number,
  expectedAmountILS: number,
  vendorCompanyId:   number,
  vendorApiKey:      string
): Promise<{ valid: boolean; amount: number; paymentId: number }> {
  try {
    const data = await sumitPostWith<GetPaymentData>(
      '/billing/payments/get/',
      { PaymentID: paymentId },
      vendorCompanyId,
      vendorApiKey
    )

    const payment = data.Payment
    const valid   = payment.ValidPayment && payment.Amount >= expectedAmountILS - 0.01

    if (!payment.ValidPayment) {
      console.warn(`[SUMIT] verifySumitPaymentWith: PaymentID ${paymentId} ValidPayment=false, Status=${payment.Status}`)
    } else if (payment.Amount < expectedAmountILS - 0.01) {
      console.warn(
        `[SUMIT] verifySumitPaymentWith: Amount mismatch — got ₪${payment.Amount}, expected ₪${expectedAmountILS}`
      )
    }

    return { valid, amount: payment.Amount, paymentId: payment.ID }
  } catch (err) {
    console.error('[SUMIT] verifySumitPaymentWith failed:', err instanceof Error ? err.message : err)
    return { valid: false, amount: 0, paymentId }
  }
}

// ─── Vendor Credential Validation ────────────────────────────────────────────

/**
 * Validates vendor-supplied SUMIT credentials by making a read-only API call
 * with their CompanyID + APIKey.
 *
 * Strategy: Call /accounting/customers/search/ with the vendor's credentials.
 * - Status === 0 → credentials are valid (may return empty list — that's fine)
 * - Status !== 0 → credentials invalid or account issues
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
      // Minimal search — returns fast even on empty account
      Filter: { PageSize: 1 },
    }

    const res = await fetch(`${SUMIT_BASE}/accounting/customers/search/`, {
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

// ─── Commission invoice (platform bills vendor) ───────────────────────────────

/**
 * Creates a commission invoice in the PLATFORM's SUMIT account
 * for the amount the vendor owes the platform.
 *
 * Since payments now go directly to vendor's SUMIT account, the platform
 * must separately collect its commission from each vendor.
 * This creates a Document Type 305 (Invoice) in the PLATFORM's account
 * with the vendor as customer, so the platform can track and collect it.
 *
 * Returns { success, reason? } — never throws.
 */
export async function createCommissionInvoice(params: {
  vendorName:      string
  commissionILS:   number
  referenceId:     string
  description:     string
}): Promise<{ success: boolean; reason?: string }> {
  const { vendorName, commissionILS, referenceId, description } = params

  try {
    const data = await sumitPost<unknown>(
      '/documents/create/',
      {
        Document: {
          Type:               305, // Invoice (חשבונית)
          Description:        description,
          ExternalIdentifier: referenceId,
          VATIncluded:        true,
          Currency:           'ILS',
        },
        Customer: {
          Name: vendorName,
        },
        Items: [
          {
            Item:      { Name: `עמלת פלטפורמה — ${description}` },
            UnitPrice: commissionILS,
            Quantity:  1,
          },
        ],
      }
    )

    console.log(
      `[SUMIT] createCommissionInvoice: ₪${commissionILS} invoice created for "${vendorName}", ref ${referenceId}`
    )
    void data
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[SUMIT] createCommissionInvoice failed:', msg)
    return { success: false, reason: msg }
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

  // Use the vendor (first) result's payment ID for our records
  const vendorResult = data.Vendors[0]

  return {
    paymentId:    vendorResult.Payment.ID,
    totalCharged: vendorResult.Payment.Amount + (data.Vendors[1]?.Payment?.Amount ?? 0),
    valid:        allValid,
  }
}

// ─── Refund ───────────────────────────────────────────────────────────────────

/**
 * Attempts to refund a SUMIT payment using platform credentials.
 *
 * Returns { success: true } on success, or { success: false, reason } if the
 * refund fails (e.g. endpoint unavailable, already refunded).
 * Never throws — caller handles graceful degradation.
 */
export async function refundSumitPayment(
  paymentId: number
): Promise<{ success: boolean; reason?: string }> {
  try {
    await sumitPost<unknown>('/billing/payments/refund/', { PaymentID: paymentId })
    console.log(`[SUMIT] refundSumitPayment: PaymentID ${paymentId} refunded successfully`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[SUMIT] refundSumitPayment failed for PaymentID ${paymentId}:`, msg)
    return { success: false, reason: msg }
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
