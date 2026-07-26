import Link from 'next/link'
import { Waves } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { NavbarClient } from './navbar-client'

export async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = user?.user_metadata?.role as string | undefined
  const fullName = user?.user_metadata?.full_name as string | undefined
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const dashboardUrl = role === 'host' ? '/host-dashboard' : '/instructor-dashboard'

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 glass-card border-b border-teal\/8" style={{ height: '68px' }}>
      <div className="max-w-7xl mx-auto px-6 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 text-decoration-none">
            <div className="w-9 h-9 ocean-gradient rounded-full flex items-center justify-center flex-shrink-0">
              <Waves className="w-4 h-4 text-white" />
            </div>
            <span className="text-deep-ocean font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif", letterSpacing: '0.3px' }}>
              WELLNESS<span className="text-coral">&amp;</span>SEA
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-7">
            <Link href="/venues" className="text-sm font-medium text-gray-600 hover:text-ocean transition-colors">
              חיפוש חללים
            </Link>
            <Link href="/how-it-works" className="text-sm font-medium text-gray-600 hover:text-ocean transition-colors">
              איך זה עובד
            </Link>
            <Link href="/host" className="text-sm font-medium text-gray-600 hover:text-ocean transition-colors">
              להשכיר חלל
            </Link>
          </div>

          {/* Auth section — server-rendered */}
          {user ? (
            <NavbarClient
              user={{ fullName, avatarUrl, dashboardUrl, role }}
            />
          ) : (
            <div className="hidden md:flex items-center gap-3">
              <Button variant="ghost" size="sm" className="text-deep-ocean hover:text-ocean" asChild>
                <Link href="/auth/login">התחברות</Link>
              </Button>
              <Button size="sm" className="bg-ocean hover:bg-deep-ocean text-white rounded-full px-5" asChild>
                <Link href="/auth/signup">הצטרפות חינמית</Link>
              </Button>
            </div>
          )}

          {/* Mobile menu — client component handles toggle */}
          <NavbarClient
            user={user ? { fullName, avatarUrl, dashboardUrl, role } : null}
            mobileOnly
          />
        </div>
      </div>
    </nav>
  )
}
