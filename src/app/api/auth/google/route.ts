import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * GET /api/auth/google
 * ====================
 * Initiates Google OAuth via a Route Handler instead of a Server Action.
 *
 * WHY NOT A SERVER ACTION:
 * In Next.js 16, Server Actions that call redirect() may not reliably commit
 * Set-Cookie headers for the PKCE code_verifier before the redirect fires.
 * A Route Handler returns a NextResponse.redirect() which attaches cookies
 * directly to the HTTP response — guaranteeing the verifier cookie is sent
 * to the browser before Google's OAuth screen opens.
 *
 * Usage: <a href="/api/auth/google?role=instructor">התחברות עם Google</a>
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams, origin } = new URL(request.url)
  const role = searchParams.get('role') ?? 'instructor'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?role=${role}`,
    },
  })

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/auth/login?error=google_oauth_failed`)
  }

  // NextResponse.redirect preserves Set-Cookie headers from the Supabase client
  // (the PKCE code_verifier cookie is included in this response)
  return NextResponse.redirect(data.url)
}
