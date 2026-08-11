/**
 * POST /api/vendor/sumit/connect
 *
 * Allows an instructor or host to register their own SUMIT account credentials
 * with the platform. The platform validates the credentials by calling the SUMIT
 * API, then stores them in vendor_payment_config for future split-payment use.
 *
 * Body: { sumit_company_id: number, sumit_api_key: string }
 * Returns: { status: 'verified' | 'failed', message?: string }
 *
 * Security:
 *   - Auth required (service role writes, but user must be authenticated)
 *   - sumit_api_key is stored server-side only — never returned to client
 *   - Credentials validated via live SUMIT API call before storage
 *   - Rate-limiting should be added at the infra level (Vercel edge)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { validateVendorCredentials } from '@/lib/payments/SumitMarketplace'
import { encryptApiKey } from '@/lib/encryption'
import { checkRateLimit } from './rate-limit'

const WINDOW_SECONDS = 15 * 60  // 15 minutes

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ── Rate limiting ─────────────────────────────────────────────────────────
    // Max 5 credential-validation attempts per IP per 15 minutes.
    // Uses in-memory store (best-effort per Vercel instance — see rate-limit.ts).
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'

    const rateCheck = await checkRateLimit(`vendor_connect:ip:${clientIp}`, 5, WINDOW_SECONDS)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `יותר מדי ניסיונות — נסי שוב בעוד ${Math.ceil((rateCheck.retryAfter ?? 900) / 60)} דקות`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.retryAfter ?? 900),
          },
        }
      )
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // M2: Read role from profiles table (source of truth) — not JWT user_metadata
    // which can be stale if a role change was made after the token was issued.
    const db = adminClient()
    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role
    if (role !== 'instructor' && role !== 'host') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: { sumit_company_id?: unknown; sumit_api_key?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const rawCompanyId = body.sumit_company_id
    const rawApiKey    = body.sumit_api_key

    if (typeof rawCompanyId !== 'number' || !Number.isInteger(rawCompanyId) || rawCompanyId <= 0) {
      return NextResponse.json({ error: 'מזהה חברה (CompanyID) חייב להיות מספר חיובי' }, { status: 400 })
    }
    if (typeof rawApiKey !== 'string' || rawApiKey.trim().length < 10 || rawApiKey.trim().length > 500) {
      return NextResponse.json({ error: 'מפתח API חייב להיות בין 10 ל-500 תווים' }, { status: 400 })
    }

    const sumitCompanyId = rawCompanyId as number
    const sumitApiKey    = rawApiKey.trim()

    // ── Guard: CompanyID must not already belong to a DIFFERENT user ─────────
    // Prevents an attacker from registering another vendor's stolen SUMIT credentials
    // under their own account and redirecting payments to that vendor's SUMIT account.
    const { data: existingConfig } = await db
      .from('vendor_payment_config')
      .select('profile_id')
      .eq('sumit_company_id', sumitCompanyId)
      .neq('profile_id', user.id)
      .maybeSingle()

    if (existingConfig) {
      console.error(
        `[vendor/sumit/connect] CompanyID ${sumitCompanyId} already registered to a different user — ` +
        `rejected attempt by user ${user.id}`
      )
      return NextResponse.json(
        { error: 'מזהה החברה כבר רשום על ידי משתמש אחר — אנא פנה לתמיכה' },
        { status: 409 }
      )
    }

    // ── Validate credentials via live SUMIT API ───────────────────────────────
    let validationResult: { valid: boolean; companyName?: string; reason?: string }
    try {
      validationResult = await validateVendorCredentials(sumitCompanyId, sumitApiKey)
    } catch (err) {
      console.error('[vendor/sumit/connect] Validation call failed:', err)
      return NextResponse.json(
        { error: 'שגיאה בתקשורת עם שרתי SUMIT — אנא נסי שוב' },
        { status: 502 }
      )
    }

    // ── Upsert into vendor_payment_config ─────────────────────────────────────
    const now = new Date().toISOString()

    if (validationResult.valid) {
      const { error: dbError } = await db
        .from('vendor_payment_config')
        .upsert(
          {
            profile_id:        user.id,
            sumit_company_id:  sumitCompanyId,
            sumit_api_key:     encryptApiKey(sumitApiKey),
            onboarding_status: 'verified',
            last_verified_at:  now,
            failure_reason:    null,
            updated_at:        now,
          },
          { onConflict: 'profile_id' }
        )

      if (dbError) {
        console.error('[vendor/sumit/connect] DB upsert failed:', dbError.message)
        return NextResponse.json({ error: 'שגיאת מסד נתונים — נסי שוב' }, { status: 500 })
      }

      console.log(
        `[vendor/sumit/connect] Vendor ${user.id} connected SUMIT CompanyID ${sumitCompanyId}` +
        (validationResult.companyName ? ` (${validationResult.companyName})` : '')
      )

      return NextResponse.json({
        status:      'verified',
        companyName: validationResult.companyName,
        message:     'החשבון אומת בהצלחה — תשלומים מפוצלים מופעלים',
      })
    } else {
      // Store failed attempt for audit (don't store the bad API key)
      try {
        await db
          .from('vendor_payment_config')
          .upsert(
            {
              profile_id:        user.id,
              sumit_company_id:  sumitCompanyId,
              sumit_api_key:     '', // blank — credentials invalid
              onboarding_status: 'failed',
              last_verified_at:  null,
              failure_reason:    validationResult.reason ?? 'פרטי הזדהות שגויים',
              updated_at:        now,
            },
            { onConflict: 'profile_id' }
          )
          .throwOnError()
      } catch (e) {
        console.error('[vendor/sumit/connect] Failed-state upsert error:', (e as Error).message)
      }

      return NextResponse.json(
        {
          status:  'failed',
          message: validationResult.reason ?? 'פרטי הזדהות שגויים — בדקי את ה-Company ID ומפתח ה-API',
        },
        { status: 422 }
      )
    }
  } catch (err) {
    console.error('[vendor/sumit/connect] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
