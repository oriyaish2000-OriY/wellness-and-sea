/**
 * POST /api/cardcom/register-token
 *
 * Creates a Cardcom CreateTokenOnly LowProfile page so an instructor or host
 * can register their credit card for automatic commission deductions.
 *
 * Flow:
 *  1. Client POSTs here
 *  2. Server creates CreateTokenOnly LowProfile (₪0 charge)
 *  3. Saves LowProfileId to profiles.cardcom_token_lp_id
 *  4. Returns { registrationUrl } — client redirects user to Cardcom page
 *  5. User enters card → Cardcom fires /api/cardcom/webhook
 *  6. Webhook saves TokenInfo to profile (token, expiry)
 *  7. User redirected to success page
 *
 * Only instructors and hosts may call this.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createTokenRegistration } from '@/lib/payments/cardcomPaymentService'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Load profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, role, cardcom_token')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    if (!['instructor', 'host'].includes(profile.role ?? '')) {
      return NextResponse.json({ error: 'Only instructors and hosts can register payment tokens' }, { status: 403 })
    }

    const successPath = profile.role === 'instructor'
      ? '/instructor-dashboard/profile?token=success'
      : '/host-dashboard/profile?token=success'

    const { registrationUrl, lowProfileId } = await createTokenRegistration({
      userId:       user.id,
      fullName:     profile.full_name ?? '',
      email:        user.email ?? '',
      successPath,
    })

    // Save pending LowProfileId so the webhook can find this profile
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await admin
      .from('profiles')
      .update({ cardcom_token_lp_id: lowProfileId })
      .eq('id', user.id)

    return NextResponse.json({ registrationUrl, lowProfileId })
  } catch (e) {
    console.error('[register-token] Error:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Failed to create token registration page' }, { status: 500 })
  }
}
