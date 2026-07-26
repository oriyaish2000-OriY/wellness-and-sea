import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  UserCircle,
  LogOut,
  Waves,
  Menu,
} from 'lucide-react'

const navLinks = [
  { href: '/host-dashboard', label: 'סקירה כללית', icon: LayoutDashboard },
  { href: '/host-dashboard/venues', label: 'החללים שלי', icon: Building2 },
  { href: '/host-dashboard/bookings', label: 'הזמנות', icon: CalendarDays },
  { href: '/host-dashboard/profile', label: 'פרופיל', icon: UserCircle },
]

export default async function HostDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const role = user.user_metadata?.role
  if (role !== 'host') redirect('/instructor-dashboard')

  const fullName = user.user_metadata?.full_name ?? user.email ?? 'מארחת'

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/host-dashboard" className="flex items-center gap-2">
            <Waves className="w-6 h-6 text-ocean" />
            <span className="font-bold text-deep-ocean text-sm">WELLNESS&SEA</span>
          </Link>
          <span className="text-xs text-gray-500">לוח מארחת</span>
          {/* Mobile menu toggle — pure CSS, no client state needed */}
          <label htmlFor="mobile-menu-toggle" className="cursor-pointer p-1">
            <Menu className="w-5 h-5 text-gray-600" />
          </label>
        </div>

        {/* Mobile nav — CSS-only drawer using hidden checkbox */}
        <input type="checkbox" id="mobile-menu-toggle" className="hidden peer" />
        <nav className="hidden peer-checked:block bg-white border-t border-gray-100 pb-2">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-ocean/5 hover:text-ocean transition-colors"
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
          <form action={signOut} className="px-5 pt-2">
            <button
              type="submit"
              className="flex items-center gap-3 text-sm text-red-500 hover:text-red-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              התנתקות
            </button>
          </form>
        </nav>
      </header>

      <div className="lg:flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col w-64 min-h-screen bg-white border-l border-gray-200 shadow-sm fixed top-0 right-0 z-30">
          {/* Logo */}
          <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-100">
            <Waves className="w-7 h-7 text-ocean" />
            <div>
              <p className="font-bold text-deep-ocean text-sm leading-tight">WELLNESS&SEA</p>
              <p className="text-xs text-gray-400">לוח ניהול מארחת</p>
            </div>
          </div>

          {/* User info */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full ocean-gradient flex items-center justify-center flex-shrink-0">
                <UserCircle className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{fullName}</p>
                <p className="text-xs text-gray-400">מארחת</p>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-ocean/8 hover:text-ocean transition-colors font-medium"
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            ))}
          </nav>

          {/* Sign out */}
          <div className="px-3 pb-6 border-t border-gray-100 pt-4">
            <form action={signOut}>
              <button
                type="submit"
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors font-medium"
              >
                <LogOut className="w-4 h-4" />
                התנתקות
              </button>
            </form>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 lg:mr-64 p-4 lg:p-8 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}
