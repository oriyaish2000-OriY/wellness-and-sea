/**
 * WELLNESS&SEA — Cardcom Payment Gateway Service
 *
 * LowProfile (hosted payment page) + Meaged (aggregator/marketplace) split payments.
 *
 * Environment variables:
 *   CARDCOM_TERMINAL_NUMBER  — integer terminal number (from Cardcom dashboard)
 *   CARDCOM_API_NAME         — API Name credential
 *   CARDCOM_API_PASSWORD     — API Password credential (used for refunds)
 *   CARDCOM_WEBHOOK_SECRET   — optional secret for webhook verification
 *   NEXT_PUBLIC_APP_URL      — canonical app URL for callbacks
 *
 * Split mechanism:
 *   AdvancedDefinition.SapakMutav = vendor sapak number
 *   Commission percentage configured in the Cardcom Meaged terminal dashboard.
 *
 * Docs: https://secure.cardcom.solutions/swagger/v11/swagger.json
 */

const CARDCOM_BASE = 'https://secure.cardcom.solutions/api/v11'

// ─── Env ─────────────────────────────────────────────────────────────────────

function cardcomEnv() {
  return {
    terminalNumber: parseInt(process.env.CARDCOM_TERMINAL_NUMBER ?? '0', 10),
    apiName:        process.env.CARDCOM_API_NAME     ?? '',
    apiPassword:    process.env.CARDCOM_API_PASSWORD ?? '',
    appUrl:         process.env.NEXT_PUBLIC_APP_URL  ?? 'http://localhost:3000',
  }
}

export function isCardcomConfigured(): boolean {
  const { terminalNumber, apiName } = cardcomEnv()
  return Boolean(terminalNumber > 0 && apiName)
}

// ─── Shared LowProfile helper ─────────────────────────────────────────────────

interface LowProfileResult {
  checkoutUrl: string
  lowProfileId: string
  rawResponse: Record<string, unknown>
}

async function createLowProfile(
  body: Record<string, unknown>
): Promise<LowProfileResult> {
  const res = await fetch(`${CARDCOM_BASE}/LowProfile/Create`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  const text = await res.text()
  let json: Record<string, unknown>
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`Cardcom LowProfile/Create non-JSON: ${text}`)
  }

  if (json.ResponseCode !== 0) {
    throw new Error(`Cardcom error ${json.ResponseCode}: ${json.Description ?? text}`)
  }

  const url = json.Url as string | undefined
  if (!url) throw new Error(`Cardcom LowProfile/Create: no Url in response — ${text}`)

  return {
    checkoutUrl:  url,
    lowProfileId: (json.LowProfileId as string) ?? '',
    rawResponse:  json,
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CardcomPaymentResult {
  checkoutUrl:  string
  lowProfileId: string
  rawResponse:  Record<string, unknown>
}

export interface SpaceRentalParams {
  bookingId:        string
  instructorId:     string
  /** What the instructor pays (base + 5%), ILS */
  totalILS:         number
  /** Host's Cardcom Sapak number (grow_merchant_id column) */
  hostSapakNumber:  string
  venueName:        string
}

export interface ClassBookingParams {
  enrollmentId:            string
  studentId:               string
  /** What the student pays (base + 5%), ILS */
  studentPaysILS:          number
  /** Instructor's Cardcom Sapak number */
  instructorSapakNumber:   string
  className:               string
  bookingDate:             string
}

// ─── Flow 1: Space Rental ─────────────────────────────────────────────────────

/**
 * Creates a Cardcom LowProfile (hosted payment page) for a space-rental booking.
 *
 * SapakMutav routes the charge through the host's Meaged sub-account.
 * The platform commission percentage is configured once in the Cardcom dashboard.
 *
 * ReturnValue encoded as "space_rental:{bookingId}" — echoed back in webhook.
 */
export async function createSpaceRentalPayment(
  params: SpaceRentalParams
): Promise<CardcomPaymentResult> {
  const { terminalNumber, apiName, appUrl } = cardcomEnv()

  return createLowProfile({
    TerminalNumber:       terminalNumber,
    ApiName:              apiName,
    Amount:               params.totalILS,
    Language:             'he',
    SuccessRedirectUrl:   `${appUrl}/booking/confirm/${params.bookingId}`,
    FailedRedirectUrl:    `${appUrl}/booking/${params.bookingId}`,
    CancelRedirectUrl:    `${appUrl}/booking/${params.bookingId}`,
    WebHookUrl:           `${appUrl}/api/webhooks/payment`,
    // Echoed back in webhook — encodes flow + ID
    ReturnValue:          `space_rental:${params.bookingId}`,
    ProductName:          `WELLNESS&SEA — הזמנת חלל: ${params.venueName}`,
    AdvancedDefinition: {
      // Routes payment through host's Meaged sub-account
      SapakMutav: params.hostSapakNumber,
    },
  })
}

// ─── Flow 2: Class Booking ────────────────────────────────────────────────────

/**
 * Creates a Cardcom LowProfile for a student enrolling in a class.
 *
 * SapakMutav routes the charge through the instructor's Meaged sub-account.
 * Student is charged base + 5%; instructor receives base − 5% (set in dashboard).
 *
 * ReturnValue encoded as "class_booking:{enrollmentId}".
 */
export async function createClassBookingPayment(
  params: ClassBookingParams
): Promise<CardcomPaymentResult> {
  const { terminalNumber, apiName, appUrl } = cardcomEnv()

  return createLowProfile({
    TerminalNumber:       terminalNumber,
    ApiName:              apiName,
    Amount:               params.studentPaysILS,
    Language:             'he',
    SuccessRedirectUrl:   `${appUrl}/classes/${params.enrollmentId}/success`,
    FailedRedirectUrl:    `${appUrl}/classes`,
    CancelRedirectUrl:    `${appUrl}/classes`,
    WebHookUrl:           `${appUrl}/api/webhooks/payment`,
    ReturnValue:          `class_booking:${params.enrollmentId}`,
    ProductName:          `WELLNESS&SEA — שיעור: ${params.className} (${params.bookingDate})`,
    AdvancedDefinition: {
      SapakMutav: params.instructorSapakNumber,
    },
  })
}

// ─── Sub-merchant Registration (Meaged) ──────────────────────────────────────

export interface SubMerchantParams {
  /** ת.ז / מס' עוסק / ח.פ */
  idNumber:      string
  fullName:      string
  businessName?: string
  email:         string
  phone:         string
  /** Israeli bank code (e.g. "12" = Hapoalim) */
  bankCode:      string
  branchNumber:  string
  accountNumber: string
}

export interface SubMerchantResult {
  /** Cardcom Sapak number — store in profiles.grow_merchant_id */
  sapakNumber: string
  rawResponse: Record<string, unknown>
}

/**
 * Registers a host or instructor as a Meaged sub-merchant in Cardcom.
 *
 * Requires CARDCOM_SUPPLIER_USERNAME + CARDCOM_SUPPLIER_SECRET env vars
 * (different credentials used only for company operations — get from Cardcom support).
 *
 * On success, stores the returned SapakNumber in profiles.grow_merchant_id.
 */
export async function registerSubMerchant(
  params: SubMerchantParams
): Promise<SubMerchantResult> {
  const supplierUsername = process.env.CARDCOM_SUPPLIER_USERNAME ?? ''
  const supplierSecret   = process.env.CARDCOM_SUPPLIER_SECRET   ?? ''

  if (!supplierUsername || !supplierSecret) {
    throw new Error(
      'CARDCOM_SUPPLIER_USERNAME / CARDCOM_SUPPLIER_SECRET not configured. ' +
      'Contact Cardcom support to obtain Meaged operator credentials.'
    )
  }

  const res = await fetch(`${CARDCOM_BASE}/CompanyOperations/MeagedAddCompany`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      SupplierUserName: supplierUsername,
      Secret:           supplierSecret,
      CompnayInfo: {                     // Note: Cardcom typo — missing 'a'
        BusinessRegistrationNumber: params.idNumber,
        NameLegalCorporation:       params.businessName ?? params.fullName,
        NameLegalCorporationEng:    params.businessName ?? params.fullName,
        Email:                      params.email,
        PhoneNumber1:               params.phone.replace(/\D/g, ''),
      },
      PeopleInfo: [{
        RelationType:   'AuthorizedSignature',
        IdentityNumber: params.idNumber,
      }],
      KycInfo: {
        Mcc: '7941',   // Sports/recreation — update if Cardcom requires different MCC
      },
      BankInfo: {
        BankCode:          params.bankCode,
        BankBranchCode:    params.branchNumber,
        BankAccountNumber: params.accountNumber,
        BankHolderName:    params.businessName ?? params.fullName,
      },
    }),
  })

  const text = await res.text()
  let json: Record<string, unknown>
  try { json = JSON.parse(text) as Record<string, unknown> }
  catch { throw new Error(`Cardcom MeagedAddCompany non-JSON: ${text}`) }

  if (json.ResponseCode !== 0 && json.ResponseCode !== undefined) {
    throw new Error(`Cardcom MeagedAddCompany error ${json.ResponseCode}: ${json.Description ?? text}`)
  }

  const sapakNumber = (
    json.SapakNumber ?? json.sapakNumber ?? json.Sapak ?? json.CompanyId
  ) as string | undefined

  if (!sapakNumber) {
    throw new Error(`Cardcom MeagedAddCompany: no SapakNumber in response — ${text}`)
  }

  return { sapakNumber: String(sapakNumber), rawResponse: json }
}

// ─── Webhook payload parsing ──────────────────────────────────────────────────

export interface CardcomWebhookPayload {
  responseCode:    number
  description:     string
  returnValue:     string     // "space_rental:ID" or "class_booking:ID"
  transactionId:   number | null
  lowProfileId:    string
  terminalNumber:  number
}

/**
 * Parse and validate a Cardcom webhook POST body.
 * Cardcom sends JSON with ResponseCode === 0 for success.
 */
export function parseCardcomWebhook(
  body: Record<string, unknown>
): CardcomWebhookPayload {
  const info = (body.TranzactionInfo ?? {}) as Record<string, unknown>
  return {
    responseCode:   (body.ResponseCode   as number)  ?? -1,
    description:    (body.Description    as string)  ?? '',
    returnValue:    (body.ReturnValue     as string)  ?? '',
    transactionId:  (info.TranzactionId  as number   ?? body.TranzactionId as number) ?? null,
    lowProfileId:   (body.LowProfileId   as string)  ?? '',
    terminalNumber: (body.TerminalNumber as number)  ?? 0,
  }
}
