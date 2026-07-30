import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * GET /api/auth/google
 * ====================
 * Initiates Google OAuth via a Route Handler instead of a Server Action.
 *
 * WHY NOT A SERVER ACTION:
 * In Next.js 16, Server Actions that call redirect() do not reliably commit
 * Set-Cookie headers for the Supabase PKCE code_verifier before the redirect.
 * A Route Handler returns NextResponse.redirect() which attaches cookies
 * directly to the HTTP response — guaranteeing the verifier cookie reaches
 * the browser before Google's OAuth screen opens.
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

  return NextResponse.redirect(data.url)
}
