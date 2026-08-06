/**
 * POST /api/grow/register-merchant
 *
 * Onboards a host or instructor as a Cardcom Meaged sub-merchant (KYC).
 * On success, stores the returned Sapak number in profiles.grow_merchant_id.
 * (column name kept for DB compatibility — stores Cardcom Sapak number)
 *
 * Required body:
 * {
 *   idNumber:      string,   // ת.ז / ח.פ / מס' עוסק
 *   fullName:      string,
 *   businessName?: string,
 *   phone:         string,
 *   email:         string,   // defaults to user's email if omitted
 *   bankCode:      string,
 *   branchNumber:  string,
 *   accountNumber: string,
 * }
 *
 * NOTE: Requires CARDCOM_SUPPLIER_USERNAME + CARDCOM_SUPPLIER_SECRET env vars.
 * These are Meaged operator credentials — different from CARDCOM_API_NAME/PASSWORD.
 * Contact Cardcom support (support@cardcom.solutions) to obtain them.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { registerSubMerchant, isCardcomConfigured } from '@/lib/payments/cardcomPaymentService'

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

    // ── Parse & validate ──────────────────────────────────────────────────────
    const body = await request.json()
    const { idNumber, fullName, businessName, phone, bankCode, branchNumber, accountNumber } = body
    const email = (body.email as string | undefined) || user.email || ''

    if (!idNumber || !fullName || !phone || !bankCode || !branchNumber || !accountNumber) {
      return NextResponse.json({ error: 'Missing required KYC fields' }, { status: 400 })
    }

    const idDigits = String(idNumber).replace(/\D/g, '')
    if (idDigits.length < 5 || idDigits.length > 15) {
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
        sapakNumber: profile.grow_merchant_id,
        message: 'Already registered',
      })
    }

    // ── Call Cardcom MeagedAddCompany ─────────────────────────────────────────
    const { sapakNumber } = await registerSubMerchant({
      idNumber:     idDigits,
      fullName,
      businessName: businessName ?? undefined,
      email,
      phone,
      bankCode,
      branchNumber,
      accountNumber,
    })

    // ── Store Sapak number in profiles ────────────────────────────────────────
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ grow_merchant_id: sapakNumber })
      .eq('id', user.id)

    if (updateError) {
      console.error('[register-merchant] Failed to save Sapak number:', updateError)
      return NextResponse.json({
        ok: true,
        sapakNumber,
        warning: 'Registered with Cardcom but could not save to profile. Contact support.',
      })
    }

    console.log(`[register-merchant] User ${user.id} registered as Cardcom sub-merchant, Sapak: ${sapakNumber}`)
    return NextResponse.json({ ok: true, sapakNumber })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[register-merchant] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
