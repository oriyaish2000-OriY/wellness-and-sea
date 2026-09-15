import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/cron/keepalive
 * =======================
 * Lightweight ping to Supabase to prevent free-tier project from pausing.
 * Vercel cron runs this daily — see vercel.json for schedule.
 * Protected by CRON_SECRET (set in Vercel env vars).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').select('id').limit(1).single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found — that's fine, DB is alive
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}
