import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const role = user?.user_metadata?.role as string | undefined

  // Redirect logged-in users away from auth pages
  if (user && (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/signup'))) {
    const dashboard = role === 'host' ? '/host-dashboard' : role === 'instructor' ? '/instructor-dashboard' : '/student-dashboard'
    return NextResponse.redirect(new URL(dashboard, request.url))
  }

  // Protect all dashboard + booking routes
  const protectedRoutes = ['/host-dashboard', '/instructor-dashboard', '/booking', '/student-dashboard']
  const isProtected = protectedRoutes.some(r => pathname.startsWith(r))

  if (isProtected && !user) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Role-based access control
  if (user) {
    if (pathname.startsWith('/host-dashboard') && role !== 'host') {
      return NextResponse.redirect(new URL(role === 'student' ? '/classes' : '/instructor-dashboard', request.url))
    }
    if (pathname.startsWith('/instructor-dashboard') && role !== 'instructor') {
      return NextResponse.redirect(new URL(role === 'student' ? '/student-dashboard' : '/host-dashboard', request.url))
    }
    if (pathname.startsWith('/student-dashboard') && role !== 'student') {
      return NextResponse.redirect(new URL(role === 'host' ? '/host-dashboard' : '/instructor-dashboard', request.url))
    }
    if (pathname.startsWith('/host/list-space') && role !== 'host') {
      return NextResponse.redirect(new URL('/auth/signup?role=host', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)'],
}
