/**
 * In-memory rate limiter for /api/vendor/sumit/connect
 *
 * Limits credential-validation attempts to prevent brute-force attacks on the
 * SUMIT API and protect platform quota.
 *
 * Limits: 5 attempts per IP per 15 minutes (sliding window).
 *
 * NOTE: This is an in-process store — each Vercel serverless instance maintains
 * its own counter. In multi-instance deployments this is best-effort protection
 * (a single IP can exceed the limit by hitting multiple instances). A Redis-based
 * solution (e.g. Upstash) would provide exact global limiting but is out of scope.
 */

const WINDOW_MS   = 15 * 60 * 1000  // 15 minutes in milliseconds
const MAX_ATTEMPTS = 5               // max requests per window

interface RateLimitEntry {
  attempts: number
  windowStart: number
}

// Global Map persists across requests within the same serverless instance
const store = new Map<string, RateLimitEntry>()

// Purge stale entries to prevent unbounded memory growth.
// Called on every request — O(n) but the store is small in practice.
function cleanupExpired(): void {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart >= WINDOW_MS) {
      store.delete(key)
    }
  }
}

/**
 * Check whether an IP is allowed to make a request.
 *
 * @param ip - Client IP address (or 'unknown')
 * @returns `{ allowed: true }` if within limit,
 *          `{ allowed: false, retryAfter: <seconds until reset> }` if exceeded.
 */
export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  cleanupExpired()

  const now  = Date.now()
  const entry = store.get(ip)

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    // First request in this window (or window expired)
    store.set(ip, { attempts: 1, windowStart: now })
    return { allowed: true }
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    const windowEndsAt  = entry.windowStart + WINDOW_MS
    const retryAfterMs  = windowEndsAt - now
    const retryAfterSec = Math.ceil(retryAfterMs / 1000)
    return { allowed: false, retryAfter: retryAfterSec }
  }

  // Increment counter within existing window
  entry.attempts += 1
  store.set(ip, entry)
  return { allowed: true }
}
