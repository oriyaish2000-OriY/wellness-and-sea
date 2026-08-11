/**
 * Distributed rate limiter — backed by Supabase `rate_limit_attempts` table.
 *
 * Replaces the in-memory per-instance store that was ineffective on Vercel's
 * serverless platform (each cold start gets its own Map). All instances now
 * share a single source of truth via Postgres.
 *
 * Sliding window: counts attempts in the last `windowSeconds` seconds.
 * Old entries are cleaned up asynchronously to avoid table bloat.
 *
 * Usage:
 *   const result = await checkRateLimitDB('checkout:user:abc123', 5, 900)
 *   if (!result.allowed) return 429
 */

import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function checkRateLimitDB(
  key:           string,
  maxAttempts:   number,
  windowSeconds: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const db          = adminClient()
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString()

  // Count existing attempts in window
  const { count } = await db
    .from('rate_limit_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('key', key)
    .gte('attempted_at', windowStart)

  const attempts = count ?? 0

  if (attempts >= maxAttempts) {
    // Compute retry-after from the oldest attempt in the window
    const { data: oldest } = await db
      .from('rate_limit_attempts')
      .select('attempted_at')
      .eq('key', key)
      .gte('attempted_at', windowStart)
      .order('attempted_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const oldestMs    = oldest ? new Date(oldest.attempted_at).getTime() : Date.now() - windowSeconds * 1000
    const windowEnds  = oldestMs + windowSeconds * 1000
    const retryAfter  = Math.max(1, Math.ceil((windowEnds - Date.now()) / 1000))

    return { allowed: false, retryAfter }
  }

  // Record this attempt
  await db.from('rate_limit_attempts').insert({ key })

  // Cleanup entries older than 2× window (fire-and-forget — don't block response)
  const cleanupBefore = new Date(Date.now() - 2 * windowSeconds * 1000).toISOString()
  db.from('rate_limit_attempts').delete().lt('attempted_at', cleanupBefore).then(() => {})

  return { allowed: true }
}
