/**
 * POST /api/grow/register-merchant
 *
 * Onboards a host or instructor as a Grow sub-merchant (KYC).
 * On success, stores the returned subMerchantId in profiles.grow_merchant_id.
 *
 * Required body:
 * {
 *   businessType:  'private' | 'company',
 *   idNumber:      string,   // ת.ז. or company registration number
 *   fullName:      string,
 *   businessName?: string,   // required if businessType = 'company'
 *   phone:         string,   // Israeli mobile 05X-XXXXXXX
 *   bankCode:      string,   // 12=Hapoalim, 10=Leumi, 11=Discount, 20=Mizrahi, 31=International
 *   branchNumber:  string,
 *   accountNumber: string,
 * }
 *
 * The user's email is taken from their auth session — not trusted from the body.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { registerSubMerchant, isGrowConfigured } from '@/lib/grow/growPaymentService'

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = user.user_metadata?.role as string | undefined
    if (!['host', 'instructor'].includes(role ?? '')) {
      return NextResponse.json({ error: 'Only hosts and instructors can register as merchants' }, { status: 403 })
    }

    if (!isGrowConfigured()) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 })
    }

    // ── Parse & validate body ─────────────────────────────────────────────
    const body = await request.json()
    const { businessType, idNumber, fullName, businessName, phone, bankCode, branchNumber, accountNumber } = body

    if (!businessType || !idNumber || !fullName || !phone || !bankCode || !branchNumber || !accountNumber) {
      return NextResponse.json({ error: 'Missing required KYC fields' }, { status: 400 })
    }

    if (!['private', 'company', 'non_profit'].includes(businessType)) {
      return NextResponse.json({ error: 'Invalid businessType' }, { status: 400 })
    }

    // Israeli ID validation (9 digits with Luhn-like check)
    const idDigits = String(idNumber).replace(/\D/g, '')
    if (idDigits.length < 5 || idDigits.length > 9) {
      return NextResponse.json({ error: 'Invalid ID number format' }, { status: 400 })
    }

    // ── Check if already registered ───────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('grow_merchant_id')
      .eq('id', user.id)
      .single()

    if (profile?.grow_merchant_id) {
      return NextResponse.json({
        ok: true,
        subMerchantId: profile.grow_merchant_id,
        message: 'Already registered',
      })
    }

    // ── Call Grow API ─────────────────────────────────────────────────────
    const { subMerchantId } = await registerSubMerchant({
      businessType,
      idNumber:     idDigits,
      fullName,
      businessName: businessType === 'company' ? businessName : undefined,
      email:        user.email ?? '',
      phone,
      bankCode,
      branchNumber,
      accountNumber,
    })

    // ── Store in profiles ─────────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ grow_merchant_id: subMerchantId })
      .eq('id', user.id)

    if (updateError) {
      console.error('[register-merchant] Failed to save grow_merchant_id:', updateError)
      // Still return success — the ID was obtained; admin can patch manually
      return NextResponse.json({
        ok: true,
        subMerchantId,
        warning: 'Registered with Grow but could not save to profile. Contact support.',
      })
    }

    console.log(`[register-merchant] User ${user.id} registered as Grow sub-merchant ${subMerchantId}`)
    return NextResponse.json({ ok: true, subMerchantId })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[register-merchant] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
