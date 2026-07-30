import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/actions/auth'
import { SidebarLink } from './_sidebar-link'
import {
  LayoutDashboard,
  CalendarDays,
  Heart,
  UserCircle,
  LogOut,
  Waves,
  Menu,
} from 'lucide-react'

const navLinks = [
  { href: '/instructor-dashboard', label: 'סקירה כללית', icon: LayoutDashboard },
  { href: '/instructor-dashboard/bookings', label: 'ההזמנות שלי', icon: CalendarDays },
  { href: '/instructor-dashboard/saved', label: 'חללים שמורים', icon: Heart },
  { href: '/instructor-dashboard/profile', label: 'פרופיל', icon: UserCircle },
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default async function InstructorDashboardLayout({
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
  if (role !== 'instructor') redirect('/host-dashboard')

  const fullName = user.user_metadata?.full_name ?? user.email ?? 'מדריכה'
  const initials = getInitials(fullName)

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f4' }} dir="rtl">

      {/* ── Mobile top header ── */}
      <header
        className="lg:hidden sticky top-0 z-40 border-b shadow-sm"
        style={{ background: '#ffffff', borderColor: '#d1dede' }}
      >
        <div className="flex items-center justify-between px-4 h-14">

          {/* Logo */}
          <Link href="/instructor-dashboard" className="flex items-center gap-2">
            <Waves className="w-5 h-5" style={{ color: '#0a4a4a' }} />
            <span
              className="font-bold text-sm tracking-wide"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                color: '#0a4a4a',
              }}
            >
              WELLNESS&amp;SEA
            </span>
          </Link>

          {/* Role badge */}
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: '#e8f0f0', color: '#0a4a4a' }}
          >
            לוח מדריכה
          </span>

          {/* Hamburger toggle — pure CSS, no JS */}
          <label htmlFor="instructor-menu-toggle" className="cursor-pointer p-1">
            <Menu className="w-5 h-5" style={{ color: '#0a4a4a' }} />
          </label>
        </div>

        <input type="checkbox" id="instructor-menu-toggle" className="hidden peer" />

        {/* Mobile drawer */}
        <nav
          className="hidden peer-checked:block border-t pb-3"
          style={{ background: '#ffffff', borderColor: '#e2eaea' }}
        >
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-5 py-3 text-sm font-medium"
              style={{ color: '#0a4a4a' }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}

          <form action={signOut} className="px-5 pt-2">
            <button
              type="submit"
              className="flex items-center gap-3 text-sm font-medium"
              style={{ color: '#c0392b' }}
            >
              <LogOut className="w-4 h-4" />
              התנתקות
            </button>
          </form>
        </nav>
      </header>

      {/* ── Desktop layout ── */}
      <div className="lg:flex">

        {/* ── Desktop sidebar ── */}
        <aside
          className="hidden lg:flex lg:flex-col w-64 min-h-screen fixed top-0 right-0 z-30"
          style={{ background: '#0a4a4a' }}
        >

          {/* Logo block */}
          <div
            className="flex items-center gap-3 px-6 py-5 border-b"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <Waves className="w-7 h-7 flex-shrink-0" style={{ color: '#c8944a' }} />
            <div>
              <p
                className="font-bold text-sm leading-tight tracking-widest"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  color: '#ffffff',
                }}
              >
                WELLNESS&amp;SEA
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                לוח ניהול מדריכה
              </p>
            </div>
          </div>

          {/* User avatar block */}
          <div
            className="flex items-center gap-3 px-6 py-4 border-b"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          >
            {/* Gold gradient initials circle */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold select-none"
              style={{
                background: 'linear-gradient(135deg, #c8944a 0%, #e8b96a 100%)',
                color: '#ffffff',
                letterSpacing: '0.05em',
              }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#ffffff' }}>
                {fullName}
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                מדריכה
              </p>
            </div>
          </div>

          {/* Nav links — icon rendered server-side, passed as children */}
          <nav className="flex-1 px-3 py-5 space-y-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <SidebarLink key={href} href={href} label={label}>
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: 'inherit' }} />
              </SidebarLink>
            ))}
          </nav>

          {/* Sign out */}
          <div
            className="px-3 pb-6 pt-4 border-t"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <form action={signOut}>
              <SignOutButton />
            </form>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 lg:mr-64 p-4 lg:p-8 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}

/* ── Inline server-renderable sign-out button ──────────────
   No hover interactivity needed — kept in this file.
   Uses a static style; real hover effect requires client.
   Providing a simple version is fine for a sign-out button.
─────────────────────────────────────────────────────────── */
function SignOutButton() {
  return (
    <button
      type="submit"
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
      style={{ color: 'rgba(255,255,255,0.55)' }}
    >
      <LogOut className="w-4 h-4 flex-shrink-0" />
      התנתקות
    </button>
  )
}
