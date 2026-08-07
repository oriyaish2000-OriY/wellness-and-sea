/**
 * WELLNESS&SEA — Cardcom Payment Gateway Service
 *
 * LowProfile (hosted payment page) + Meaged (aggregator/marketplace) split payments.
 *
 * Environment variables:
 *   CARDCOM_TERMINAL_NUMBER  — integer terminal number (from Cardcom dashboard)
 *   CARDCOM_API_NAME         — API Name credential
 *   CARDCOM_API_PASSWORD     — API Password credential (used for refunds)
 *   NEXT_PUBLIC_APP_URL      — canonical app URL for callbacks
 *
 * Split mechanism:
 *   AdvancedDefinition.SapakMutav = vendor sapak number
 *   Commission percentage configured in the Cardcom Meaged terminal dashboard.
 *
 * Spec: https://secure.cardcom.solutions/swagger/v11/swagger.json
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
  checkoutUrl:  string
  lowProfileId: string
  rawResponse:  Record<string, unknown>
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
    const desc = json.Description ?? text
    console.error(`[Cardcom] LowProfile/Create error ${json.ResponseCode}: ${desc}`)
    throw new Error(`Cardcom error ${json.ResponseCode}: ${desc}`)
  }

  const url = json.Url as string | undefined
  if (!url) throw new Error(`Cardcom LowProfile/Create: no Url in response — ${text}`)

  return {
    checkoutUrl:  url,
    lowProfileId: (json.LowProfileId as string) ?? '',
    rawResponse:  json,
  }
}

// ─── GetLpResult ─────────────────────────────────────────────────────────────

export interface GetLpResultResponse {
  ResponseCode:  number
  Description:   string
  TranzactionId: number | null
  Operation:     string
  DocumentInfo?: {
    DocumentType?:   string
    DocumentNumber?: number
  } | null
  TokenInfo?: {
    Token?:                   string
    CardYear?:                number
    CardMonth?:               number
    TokenApprovalNumber?:     string
    CardOwnerIdentityNumber?: string
  } | null
}

/**
 * Calls CardCom GetLpResult to validate a webhook transaction.
 * Retries once on HTTP error. 5-second timeout per attempt.
 */
export async function getLpResult(lowProfileId: string): Promise<GetLpResultResponse> {
  const { terminalNumber, apiName } = cardcomEnv()

  const payload = JSON.stringify({
    TerminalNumber: terminalNumber,
    ApiName:        apiName,
    LowProfileId:   lowProfileId,
  })

  async function attempt(): Promise<GetLpResultResponse> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch(`${CARDCOM_BASE}/LowProfile/GetLpResult`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    payload,
        signal:  controller.signal,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      try {
        return JSON.parse(text) as GetLpResultResponse
      } catch {
        throw new Error(`GetLpResult non-JSON: ${text}`)
      }
    } finally {
      clearTimeout(timer)
    }
  }

  try {
    return await attempt()
  } catch (err) {
    // One retry on HTTP/network error
    console.warn('[Cardcom] GetLpResult first attempt failed, retrying:', err instanceof Error ? err.message : err)
    return await attempt()
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CardcomPaymentResult {
  checkoutUrl:  string
  lowProfileId: string
  rawResponse:  Record<string, unknown>
}

export interface SpaceRentalParams {
  bookingId:         string
  instructorId:      string
  /** What the instructor pays (base + 5%), ILS */
  totalILS:          number
  /** Host's Cardcom Sapak number (grow_merchant_id column) — optional; omit when Meaged not activated */
  hostSapakNumber?:  string
  venueName:         string
  /** Instructor (payer) details for Document */
  customerName:      string
  customerEmail:     string
  customerPhone?:    string
}

export interface ClassBookingParams {
  enrollmentId:            string
  studentId:               string
  /** What the student pays (base + 5%), ILS */
  studentPaysILS:          number
  /** Instructor's Cardcom Sapak number — optional; omit when Meaged not activated */
  instructorSapakNumber?:  string
  className:               string
  bookingDate:             string
  /** Student (payer) details for Document */
  customerName:            string
  customerEmail:           string
  customerPhone?:          string
}

// ─── Flow 1: Space Rental ─────────────────────────────────────────────────────

/**
 * Creates a Cardcom LowProfile (hosted payment page) for a space-rental booking.
 *
 * SapakMutav routes the charge through the host's Meaged sub-account.
 * The platform commission percentage is configured once in the Cardcom dashboard.
 *
 * Returns checkoutUrl and lowProfileId — caller must save lowProfileId to DB.
 */
export async function createSpaceRentalPayment(
  params: SpaceRentalParams
): Promise<CardcomPaymentResult> {
  const { terminalNumber, apiName, appUrl } = cardcomEnv()

  return createLowProfile({
    TerminalNumber:     terminalNumber,
    ApiName:            apiName,
    Operation:          'ChargeOnly',
    Amount:             params.totalILS,
    ISOCoinId:          1,             // NIS (Israeli Shekel)
    Language:           'he',
    ReturnValue:        params.bookingId, // reference only — do NOT use for order matching
    SuccessRedirectUrl: `${appUrl}/booking/confirm/${params.bookingId}`,
    FailedRedirectUrl:  `${appUrl}/booking/pay/${params.bookingId}?error=1`,
    WebHookUrl:         `${appUrl}/api/cardcom/webhook`,
    UIDefinition: {
      CardOwnerNameValue:  params.customerName  || undefined,
      CardOwnerEmailValue: params.customerEmail || undefined,
      CardOwnerPhoneValue: params.customerPhone || undefined,
    },
    Document: {
      DocumentTypeToCreate: 'Auto',
      IsAllowEditDocument:  true,
      Name:                 params.customerName || 'לקוח',
      Email:                params.customerEmail || undefined,
      Mobile:               params.customerPhone || undefined,
      Language:             'he',
      Products: [
        {
          Description: `הזמנת חלל: ${params.venueName}`,
          UnitCost:    params.totalILS,
          Quantity:    1,
        },
      ],
    },
    // Only include Meaged split when host has a registered Sapak number
    ...(params.hostSapakNumber ? {
      AdvancedDefinition: { SapakMutav: params.hostSapakNumber },
    } : {}),
  })
}

// ─── Flow 2: Class Booking ────────────────────────────────────────────────────

/**
 * Creates a Cardcom LowProfile for a student enrolling in a class.
 *
 * SapakMutav routes the charge through the instructor's Meaged sub-account.
 * Student is charged base + 5%; instructor receives base − 5% (set in dashboard).
 *
 * Returns checkoutUrl and lowProfileId — caller must save lowProfileId to DB.
 */
export async function createClassBookingPayment(
  params: ClassBookingParams
): Promise<CardcomPaymentResult> {
  const { terminalNumber, apiName, appUrl } = cardcomEnv()

  return createLowProfile({
    TerminalNumber:     terminalNumber,
    ApiName:            apiName,
    Operation:          'ChargeOnly',
    Amount:             params.studentPaysILS,
    ISOCoinId:          1,             // NIS
    Language:           'he',
    ReturnValue:        params.enrollmentId, // reference only — do NOT use for order matching
    SuccessRedirectUrl: `${appUrl}/classes/${params.enrollmentId}/success`,
    FailedRedirectUrl:  `${appUrl}/classes?error=1`,
    WebHookUrl:         `${appUrl}/api/cardcom/webhook`,
    UIDefinition: {
      CardOwnerNameValue:  params.customerName  || undefined,
      CardOwnerEmailValue: params.customerEmail || undefined,
      CardOwnerPhoneValue: params.customerPhone || undefined,
    },
    Document: {
      DocumentTypeToCreate: 'Auto',
      IsAllowEditDocument:  true,
      Name:                 params.customerName || 'לקוח',
      Email:                params.customerEmail || undefined,
      Mobile:               params.customerPhone || undefined,
      Language:             'he',
      Products: [
        {
          Description: `${params.className} — ${params.bookingDate}`,
          UnitCost:    params.studentPaysILS,
          Quantity:    1,
        },
      ],
    },
    // Only include Meaged split when instructor has a registered Sapak number
    ...(params.instructorSapakNumber ? {
      AdvancedDefinition: { SapakMutav: params.instructorSapakNumber },
    } : {}),
  })
}

// ─── Token Registration (CreateTokenOnly) ────────────────────────────────────

export interface TokenRegistrationResult {
  registrationUrl: string
  lowProfileId:    string
}

/**
 * Creates a LowProfile page for an instructor or host to register their credit card.
 * No charge is made — the card is tokenized for future commission deductions.
 * The returned lowProfileId must be saved to profiles.cardcom_token_lp_id.
 */
export async function createTokenRegistration(params: {
  userId:       string
  fullName:     string
  email?:       string
  phone?:       string
  successPath?: string
}): Promise<TokenRegistrationResult> {
  const { terminalNumber, apiName, appUrl } = cardcomEnv()
  const successUrl = `${appUrl}${params.successPath ?? '/dashboard?token=registered'}`

  const res = await fetch(`${CARDCOM_BASE}/LowProfile/Create`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      TerminalNumber:     terminalNumber,
      ApiName:            apiName,
      Operation:          'CreateTokenOnly',
      Amount:             0,
      ISOCoinId:          1,
      Language:           'he',
      ReturnValue:        params.userId,   // reference; order matching uses LowProfileId
      SuccessRedirectUrl: successUrl,
      FailedRedirectUrl:  `${appUrl}/dashboard?token=failed`,
      WebHookUrl:         `${appUrl}/api/cardcom/webhook`,
      UIDefinition: {
        CardOwnerNameValue:  params.fullName  || undefined,
        CardOwnerEmailValue: params.email     || undefined,
        CardOwnerPhoneValue: params.phone     || undefined,
      },
      Document: {
        DocumentTypeToCreate: 'Auto',
        IsAllowEditDocument:  true,
        Name:                 params.fullName || 'לקוח',
        Email:                params.email    || undefined,
        Language:             'he',
        Products: [
          { Description: 'רישום אמצעי תשלום לעמלות', UnitCost: 0, Quantity: 1 },
        ],
      },
    }),
  })

  const text = await res.text()
  let json: Record<string, unknown>
  try { json = JSON.parse(text) as Record<string, unknown> }
  catch { throw new Error(`Cardcom CreateTokenOnly non-JSON: ${text}`) }

  if (json.ResponseCode !== 0) {
    throw new Error(`Cardcom CreateTokenOnly error ${json.ResponseCode}: ${json.Description ?? text}`)
  }

  return {
    registrationUrl: json.Url as string,
    lowProfileId:    json.LowProfileId as string,
  }
}

// ─── Token Commission Charge ──────────────────────────────────────────────────

export interface ChargeTokenResult {
  success:        boolean
  transactionId:  number
  responseCode:   number
  description:    string
  documentNumber: number | null
  documentType:   string | null
}

/**
 * Charges a provider's (instructor or host) stored Cardcom token for the
 * platform commission. Called after a Bit/PayBox payment is self-reported.
 *
 * amount should be the platformRevenue value from commissionUtils
 * (e.g. base ₪100 → charge ₪10).
 */
export async function chargeProviderToken(params: {
  token:         string
  cardMonth:     number
  cardYear:      number
  amountILS:     number
  providerName:  string
  providerEmail?: string
  description:   string
}): Promise<ChargeTokenResult> {
  const { terminalNumber, apiName } = cardcomEnv()

  // Format expiry: MM (zero-padded 2 digits) + YY (zero-padded 2 digits)
  const mm = String(params.cardMonth).padStart(2, '0')
  const yy = String(params.cardYear).padStart(2, '0')

  const res = await fetch(`${CARDCOM_BASE}/Transactions/Transaction`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      TerminalNumber:        terminalNumber,
      ApiName:               apiName,
      Amount:                params.amountILS,
      Token:                 params.token,
      CardExpirationMMYY:    `${mm}${yy}`,
      NumOfPayments:         1,
      ISOCoinId:             1,
      CardOwnerInformation: {
        FullName:        params.providerName,
        CardOwnerEmail:  params.providerEmail ?? '',
      },
      Document: {
        DocumentTypeToCreate: 'Auto',
        IsAllowEditDocument:  true,
        Name:                 params.providerName,
        Email:                params.providerEmail ?? undefined,
        Language:             'he',
        Products: [
          {
            Description: params.description,
            UnitCost:    params.amountILS,
            Quantity:    1,
          },
        ],
      },
    }),
  })

  const text = await res.text()
  let json: Record<string, unknown>
  try { json = JSON.parse(text) as Record<string, unknown> }
  catch { throw new Error(`Cardcom Transactions/Transaction non-JSON: ${text}`) }

  const responseCode = (json.ResponseCode as number) ?? -1

  if (responseCode !== 0) {
    console.error(
      `[Cardcom] chargeProviderToken error ${responseCode}: ${json.Description} ` +
      `(provider: ${params.providerName}, amount: ₪${params.amountILS})`
    )
  }

  return {
    success:        responseCode === 0,
    transactionId:  (json.TranzactionId as number) ?? 0,
    responseCode,
    description:    (json.Description as string) ?? '',
    documentNumber: (json.DocumentNumber as number) ?? null,
    documentType:   (json.DocumentType as string)  ?? null,
  }
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
 * On success, store the returned SapakNumber in profiles.grow_merchant_id.
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
        Mcc: '7941',   // Sports/recreation
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
