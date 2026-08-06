/**
 * POST /api/grow/register-merchant
 *
 * Onboards a host or instructor as a Summit sub-merchant (KYC).
 * On success, stores the returned merchantId in profiles.grow_merchant_id.
 * (field name kept for DB compatibility — stores Summit merchant ID)
 *
 * Required body:
 * {
 *   businessType:  'private' | 'company' | 'non_profit',
 *   idNumber:      string,
 *   fullName:      string,
 *   businessName?: string,   // required if businessType = 'company'
 *   phone:         string,
 *   bankCode:      string,
 *   branchNumber:  string,
 *   accountNumber: string,
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { registerSubMerchant, isSummitConfigured } from '@/lib/payments/summitPaymentService'

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = user.user_metadata?.role as string | undefined
    if (!['host', 'instructor'].includes(role ?? '')) {
      return NextResponse.json({ error: 'Only hosts and instructors can register as merchants' }, { status: 403 })
    }

    if (!isSummitConfigured()) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 })
    }

    // ── Parse & validate ──────────────────────────────────────────────────────
    const body = await request.json()
    const { businessType, idNumber, fullName, businessName, phone, bankCode, branchNumber, accountNumber } = body

    if (!businessType || !idNumber || !fullName || !phone || !bankCode || !branchNumber || !accountNumber) {
      return NextResponse.json({ error: 'Missing required KYC fields' }, { status: 400 })
    }

    if (!['private', 'company', 'non_profit'].includes(businessType)) {
      return NextResponse.json({ error: 'Invalid businessType' }, { status: 400 })
    }

    const idDigits = String(idNumber).replace(/\D/g, '')
    if (idDigits.length < 5 || idDigits.length > 9) {
      return NextResponse.json({ error: 'Invalid ID number format' }, { status: 400 })
    }

    // ── Already registered? ───────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('grow_merchant_id')
      .eq('id', user.id)
      .single()

    if (profile?.grow_merchant_id) {
      return NextResponse.json({
        ok: true,
        merchantId: profile.grow_merchant_id,
        message: 'Already registered',
      })
    }

    // ── Call Summit API ───────────────────────────────────────────────────────
    const { merchantId } = await registerSubMerchant({
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

    // ── Store in profiles ─────────────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ grow_merchant_id: merchantId })
      .eq('id', user.id)

    if (updateError) {
      console.error('[register-merchant] Failed to save merchant ID:', updateError)
      return NextResponse.json({
        ok: true,
        merchantId,
        warning: 'Registered with Summit but could not save to profile. Contact support.',
      })
    }

    console.log(`[register-merchant] User ${user.id} registered as Summit sub-merchant ${merchantId}`)
    return NextResponse.json({ ok: true, merchantId })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[register-merchant] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
