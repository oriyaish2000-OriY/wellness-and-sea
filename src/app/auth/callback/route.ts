import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const role = searchParams.get('role') ?? 'instructor'
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // If user registered via Google OAuth, set role in metadata if not already set
      const existingRole = data.user.user_metadata?.role
      if (!existingRole && role) {
        await supabase.auth.updateUser({ data: { role } })
      }

      const userRole = existingRole ?? role
      const dashboard = userRole === 'host' ? '/host-dashboard' : userRole === 'student' ? '/student-dashboard' : '/instructor-dashboard'

      return NextResponse.redirect(`${origin}${next === '/' ? dashboard : next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`)
}
