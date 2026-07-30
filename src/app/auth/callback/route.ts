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
      const existingRole = data.user.user_metadata?.role
      const userRole = existingRole ?? role

      // New Google OAuth user — set role in JWT metadata and sync profiles table
      if (!existingRole && role) {
        await supabase.auth.updateUser({ data: { role } })
        // Also update profiles.role (trigger only runs on INSERT with default 'instructor')
        await supabase
          .from('profiles')
          .update({ role })
          .eq('id', data.user.id)
      }

      const dashboard = userRole === 'host' ? '/host-dashboard' : userRole === 'student' ? '/student-dashboard' : '/instructor-dashboard'

      return NextResponse.redirect(`${origin}${next === '/' ? dashboard : next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`)
}
