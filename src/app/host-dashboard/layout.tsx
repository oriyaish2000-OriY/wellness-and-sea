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

  // Derive initials for avatar circle
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen hd-root" dir="rtl">

      {/*
        ── Scoped CSS ─────────────────────────────────────────────────────
        All hover / active states that can't be expressed with Tailwind
        custom colours are handled here via plain <style> tags.
        Server Components may render <style> tags; they are hoisted by
        Next.js into the <head> automatically.
      */}
      <style>{`
        .hd-root {
          background: #f0f4f4;
        }

        /* Sidebar nav link — default */
        .hd-nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.80);
          transition: background 0.15s, color 0.15s;
          position: relative;
        }

        /* Gold left-border slot (RTL: right side acts as visual "left" marker) */
        .hd-nav-link::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 60%;
          border-radius: 0 2px 2px 0;
          background: #c8944a;
          opacity: 0;
          transition: opacity 0.15s;
        }

        .hd-nav-link:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
        }

        .hd-nav-link:hover::before {
          opacity: 1;
        }

        /* Mobile nav link */
        .hd-mobile-nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.85);
          transition: background 0.15s, color 0.15s;
        }

        .hd-mobile-nav-link:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
        }

        /* Sign-out button */
        .hd-signout-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          color: #e87c6a;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          text-align: right;
        }

        .hd-signout-btn:hover {
          background: rgba(232, 124, 106, 0.12);
          color: #ff9b8a;
        }

        /* Mobile sign-out */
        .hd-mobile-signout-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.875rem;
          color: #e87c6a;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: color 0.15s;
          padding: 0;
        }

        .hd-mobile-signout-btn:hover {
          color: #ff9b8a;
        }
      `}</style>

      {/* ── Mobile top bar ────────────────────────────────────────────── */}
      <header
        className="lg:hidden sticky top-0 z-40 border-b shadow-md"
        style={{ background: '#ffffff', borderColor: '#d8e4e4' }}
      >
        <div className="flex items-center justify-between px-4 h-14">

          {/* Logo */}
          <Link href="/host-dashboard" className="flex items-center gap-2">
            <Waves className="w-6 h-6" style={{ color: '#0a4a4a' }} />
            <span
              className="font-bold text-sm tracking-wide"
              style={{ color: '#0a4a4a', fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              WELLNESS&amp;SEA
            </span>
          </Link>

          <span className="text-xs" style={{ color: '#6b8e8e' }}>לוח מארחת</span>

          {/* Hamburger — CSS-only toggle, no client JS */}
          <label
            htmlFor="mobile-menu-toggle"
            className="cursor-pointer p-1 rounded"
            style={{ color: '#0a4a4a' }}
          >
            <Menu className="w-5 h-5" />
          </label>
        </div>

        {/* CSS-only slide-down drawer */}
        <input type="checkbox" id="mobile-menu-toggle" className="hidden peer" />
        <nav
          className="hidden peer-checked:block pb-3"
          style={{ background: '#0a4a4a', borderTop: '1px solid rgba(255,255,255,0.1)' }}
        >
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="hd-mobile-nav-link">
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: '#c8944a' }} />
              {label}
            </Link>
          ))}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '6px 20px' }} />

          <form action={signOut} className="px-5 pt-1">
            <button type="submit" className="hd-mobile-signout-btn">
              <LogOut className="w-4 h-4" />
              התנתקות
            </button>
          </form>
        </nav>
      </header>

      <div className="lg:flex">

        {/* ── Desktop sidebar ───────────────────────────────────────────── */}
        <aside
          className="hidden lg:flex lg:flex-col w-64 min-h-screen fixed top-0 right-0 z-30"
          style={{
            background: '#0a4a4a',
            boxShadow: '-2px 0 16px rgba(0,0,0,0.22)',
          }}
        >

          {/* Logo block */}
          <div
            className="flex items-center gap-3 px-6 py-6"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Waves className="w-7 h-7 flex-shrink-0" style={{ color: '#c8944a' }} />
            <div>
              <p
                className="font-bold text-base leading-tight tracking-wide"
                style={{
                  color: '#ffffff',
                  fontFamily: "'Playfair Display', Georgia, serif",
                }}
              >
                WELLNESS&amp;SEA
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                לוח ניהול מארחת
              </p>
            </div>
          </div>

          {/* User info */}
          <div
            className="flex items-center gap-3 px-6 py-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
          >
            {/* Avatar with gold gradient */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold select-none"
              style={{
                background: 'linear-gradient(135deg, #c8944a 0%, #e0b87a 100%)',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(200,148,74,0.40)',
                fontFamily: "'Playfair Display', Georgia, serif",
                letterSpacing: '0.05em',
              }}
            >
              {initials || <UserCircle className="w-5 h-5" />}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#ffffff' }}>
                {fullName}
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                מארחת
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="hd-nav-link">
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: '#c8944a' }} />
                {label}
              </Link>
            ))}
          </nav>

          {/* Separator */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0 12px' }} />

          {/* Sign-out */}
          <div className="px-3 py-5">
            <form action={signOut}>
              <button type="submit" className="hd-signout-btn">
                <LogOut className="w-4 h-4" />
                התנתקות
              </button>
            </form>
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <main className="flex-1 lg:mr-64 p-4 lg:p-8 min-h-screen">
          {children}
        </main>

      </div>
    </div>
  )
}
