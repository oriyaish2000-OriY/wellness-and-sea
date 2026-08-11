/**
 * GET /api/vendor/sumit/status
 *
 * Returns the current SUMIT onboarding status for the authenticated user.
 * Never returns the stored API key — only safe metadata.
 *
 * Returns:
 *   { status: 'not_connected' }                                   — no record
 *   { status: 'verified',  sumit_company_id, last_verified_at }   — active
 *   { status: 'failed',    sumit_company_id, failure_reason }     — last attempt failed
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = adminClient()
    const { data: config } = await db
      .from('vendor_payment_config')
      .select('onboarding_status, sumit_company_id, last_verified_at, failure_reason')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!config) {
      return NextResponse.json({ status: 'not_connected' })
    }

    return NextResponse.json({
      status:            config.onboarding_status,
      sumit_company_id:  config.sumit_company_id,
      last_verified_at:  config.last_verified_at,
      failure_reason:    config.failure_reason ?? undefined,
    })
  } catch (err) {
    console.error('[vendor/sumit/status] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
