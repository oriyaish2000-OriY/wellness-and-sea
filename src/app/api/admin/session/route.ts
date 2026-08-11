/**
 * GET /api/admin/session
 *
 * Validates ADMIN_SECRET and sets an HttpOnly session cookie so the admin
 * dashboard never needs to pass the secret to client-side JavaScript.
 *
 * Cookie value: HMAC-SHA256(ADMIN_SECRET, 'wellness-sea:admin-session:v1')
 * The raw secret is never stored in the cookie — only its HMAC.
 * Even if the cookie is leaked, an attacker cannot reverse-engineer the secret. (M-D)
 *
 * Flow:
 *   1. Admin visits /admin/payouts?secret=XXX
 *   2. Server component redirects here with ?secret=XXX&next=/admin/payouts
 *   3. We validate, set HttpOnly HMAC cookie, redirect to /admin/payouts (no secret in URL)
 *   4. Subsequent visits use the cookie — raw secret stays server-side only
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

export function makeAdminSessionToken(secret: string): string {
  return createHmac('sha256', secret).update('wellness-sea:admin-session:v1').digest('hex')
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const adminSecret = process.env.ADMIN_SECRET
  const secret = request.nextUrl.searchParams.get('secret')
  const next   = request.nextUrl.searchParams.get('next') ?? '/admin/payouts'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (!adminSecret || secret !== adminSecret) {
    return NextResponse.redirect(`${appUrl}/`)
  }

  // Store HMAC of the secret — never the raw secret itself
  const sessionToken = makeAdminSessionToken(adminSecret)

  const response = NextResponse.redirect(`${appUrl}${next}`)
  response.cookies.set('admin_session', sessionToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/admin',
    maxAge:   60 * 60 * 8, // 8 hours
  })

  return response
}
