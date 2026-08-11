/**
 * Rate limiter for /api/vendor/sumit/connect
 *
 * Delegates to the shared Supabase-backed distributed rate limiter so limits
 * are enforced globally across all Vercel serverless instances.
 *
 * Limits: 5 credential-validation attempts per IP per 15 minutes.
 */

export { checkRateLimitDB as checkRateLimit } from '@/lib/rate-limit'
