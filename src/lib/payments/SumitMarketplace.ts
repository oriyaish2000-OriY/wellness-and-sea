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
 */
async function sumitPost<T>(
  path:  string,
  body:  Record<string, unknown>
): Promise<T> {
  const { companyID, apiKey } = sumitEnv()

  const payload = {
    Credentials: { CompanyID: companyID, APIKey: apiKey },
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
  bookingId:      string
  instructorId:   string
  /** What the instructor pays (base + 5%), ILS */
  totalILS:       number
  /** What the host receives (base − 5%), ILS — stored in DB, paid out separately */
  hostPayout:     number
  venueName:      string
  customerName:   string
  customerEmail:  string
}

/**
 * Creates a SUMIT hosted payment page for a space-rental booking.
 *
 * Charges totalILS to the platform.
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
      ExternalIdentifier:        `space_rental:${params.bookingId}`,
      RedirectURL:               `${appUrl}/api/webhooks/sumit/return`,
      CancelRedirectURL:         `${appUrl}/booking/${params.bookingId}?cancelled=true`,
      SendUpdateByEmailAddress:  params.customerEmail || undefined,
      UpdateOrganizationOnSuccess: true,
      DocumentDescription:       `השכרת שטח - ${params.venueName}`,
      VATIncluded:               true,
      MaximumPayments:           0,
      ExpirationHours:           2,
    }
  )

  return { checkoutUrl: data.RedirectURL }
}

// ─── Flow 2: Class Booking ────────────────────────────────────────────────────

export interface ClassBookingParams {
  enrollmentId:   string
  studentId:      string
  /** What the student pays (base + 5%), ILS */
  totalILS:       number
  /** What the instructor receives (base − 5%), ILS — stored in DB */
  instructorPayout: number
  className:      string
  bookingDate:    string
  customerName:   string
  customerEmail:  string
}

/**
 * Creates a SUMIT hosted payment page for a class enrollment.
 *
 * Charges totalILS to the platform.
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
      ExternalIdentifier:        `class_booking:${params.enrollmentId}`,
      RedirectURL:               `${appUrl}/api/webhooks/sumit/return`,
      CancelRedirectURL:         `${appUrl}/classes?cancelled=true`,
      SendUpdateByEmailAddress:  params.customerEmail || undefined,
      UpdateOrganizationOnSuccess: true,
      DocumentDescription:       `${params.className} - ${params.bookingDate}`,
      VATIncluded:               true,
      MaximumPayments:           0,
      ExpirationHours:           2,
    }
  )

  return { checkoutUrl: data.RedirectURL }
}

// ─── Payment Verification ─────────────────────────────────────────────────────

/**
 * Verifies a SUMIT payment via the payments/get endpoint.
 *
 * Checks:
 *   - ValidPayment === true
 *   - Amount >= expectedAmountILS (tolerance 0.01 ILS)
 *
 * SECURITY: Never trust query params from the return URL —
 * always call this before confirming any booking.
 */
export async function verifySumitPayment(
  paymentId:         number,
  expectedAmountILS: number
): Promise<{ valid: boolean; amount: number; paymentId: number }> {
  try {
    const data = await sumitPost<GetPaymentData>(
      '/billing/payments/get/',
      { PaymentID: paymentId }
    )

    const payment     = data.Payment
    const valid       = payment.ValidPayment && payment.Amount >= expectedAmountILS - 0.01

    if (!payment.ValidPayment) {
      console.warn(`[SUMIT] verifySumitPayment: PaymentID ${paymentId} ValidPayment=false, Status=${payment.Status}`)
    } else if (payment.Amount < expectedAmountILS - 0.01) {
      console.warn(
        `[SUMIT] verifySumitPayment: Amount mismatch — got ₪${payment.Amount}, expected ₪${expectedAmountILS}`
      )
    }

    return { valid, amount: payment.Amount, paymentId: payment.ID }
  } catch (err) {
    console.error('[SUMIT] verifySumitPayment failed:', err instanceof Error ? err.message : err)
    return { valid: false, amount: 0, paymentId }
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
