/**
 * POST /api/admin/session
 *
 * Validates ADMIN_SECRET (from POST body — never from URL query params)
 * and sets an HttpOnly session cookie so the admin dashboard never needs
 * to pass the secret to client-side JavaScript.
 *
 * Cookie value: HMAC-SHA256(ADMIN_SECRET, 'wellness-sea:admin-session:v1')
 * The raw secret is never stored in the cookie — only its HMAC.
 * Even if the cookie is leaked, an attacker cannot reverse-engineer the secret.
 *
 * Flow:
 *   1. Admin visits /admin/payouts → sees a login form (no secret in URL)
 *   2. Form POSTs here with secret in request body
 *   3. We validate, set HttpOnly HMAC cookie, redirect to /admin/payouts
 *   4. Subsequent visits use the cookie — secret never appears in any URL or log
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { checkRateLimitDB } from '@/lib/rate-limit'

export function makeAdminSessionToken(secret: string): string {
  return createHmac('sha256', secret).update('wellness-sea:admin-session:v1').digest('hex')
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const adminSecret = process.env.ADMIN_SECRET
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (!adminSecret) {
    return NextResponse.redirect(`${appUrl}/admin/login?error=misconfigured`)
  }

  // Rate-limit login attempts by IP — 5 per 15 minutes
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await checkRateLimitDB(`admin_login:${ip}`, 5, 900)
  if (!rl.allowed) {
    return NextResponse.redirect(`${appUrl}/admin/login?error=rate_limited`)
  }

  // Read secret from form body — never from URL
  let secret: string | null = null
  let next = '/admin/payouts'
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    secret = form.get('secret') as string | null
    next   = (form.get('next') as string | null) ?? '/admin/payouts'
  } else {
    try {
      const body = await request.json()
      secret = body.secret ?? null
      next   = body.next   ?? '/admin/payouts'
    } catch {
      return NextResponse.redirect(`${appUrl}/admin/login?error=invalid_request`)
    }
  }

  if (!secret || secret !== adminSecret) {
    return NextResponse.redirect(`${appUrl}/admin/login?error=invalid_secret`)
  }

  // Sanitise `next` to prevent open redirect
  const safePaths = ['/admin/payouts', '/admin']
  const safePath  = safePaths.find(p => next.startsWith(p)) ?? '/admin/payouts'

  // Store HMAC of the secret — never the raw secret itself
  const sessionToken = makeAdminSessionToken(adminSecret)

  const response = NextResponse.redirect(`${appUrl}${safePath}`)
  response.cookies.set('admin_session', sessionToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/admin',
    maxAge:   60 * 60 * 8, // 8 hours
  })

  return response
}
