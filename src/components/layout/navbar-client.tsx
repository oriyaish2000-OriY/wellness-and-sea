'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, LogOut, LayoutDashboard, ChevronDown, Search, HelpCircle, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/actions/auth'

interface UserInfo {
  fullName?: string
  avatarUrl?: string
  dashboardUrl: string
  role?: string
}

interface NavbarClientProps {
  user: UserInfo | null
  mobileOnly?: boolean
}

export function NavbarClient({ user, mobileOnly = false }: NavbarClientProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // Desktop user menu (not shown in mobileOnly mode)
  if (!mobileOnly && user) {
    return (
      <div className="hidden md:flex items-center gap-3 relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 hover:shadow-sm transition-shadow"
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.fullName ?? ''}
              className="w-7 h-7 rounded-full object-cover"
            />
          ) : (
            <div className="w-7 h-7 rounded-full ocean-gradient flex items-center justify-center text-white text-xs font-bold">
              {user.fullName?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate">
            {user.fullName}
          </span>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute top-10 left-0 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
              <Link
                href={user.dashboardUrl}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setMenuOpen(false)}
              >
                <LayoutDashboard className="w-4 h-4" />
                {user.role === 'host' ? 'לוח בקרה' : 'האזור שלי'}
              </Link>
              <div className="border-t border-gray-100 mt-1 pt-1">
                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" />
                    התנתקות
                  </button>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // Mobile menu button (always rendered; shows mobile menu regardless of auth state)
  if (mobileOnly) {
    return (
      <>
        <button
          className="md:hidden p-2 text-gray-700"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="תפריט"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 top-[68px] z-40 bg-black/40 md:hidden"
              onClick={() => setIsOpen(false)}
            />

            {/* Drawer — same card style as desktop dropdown */}
            <div className="fixed top-[68px] right-0 left-0 z-50 md:hidden bg-white shadow-xl border-t border-gray-100">

              {/* User identity strip (when logged in) */}
              {user?.fullName && (
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-2.5">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.fullName} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full ocean-gradient flex items-center justify-center text-white text-sm font-bold">
                        {user.fullName[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{user.fullName}</p>
                      <p className="text-xs text-gray-400">{user.role === 'host' ? 'בעלת עסק' : 'מדריכה'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Nav links */}
              <nav className="py-1">
                <Link
                  href="/venues"
                  className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <Search className="w-4 h-4 text-gray-400" />
                  חיפוש חללים
                </Link>
                <Link
                  href="/how-it-works"
                  className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <HelpCircle className="w-4 h-4 text-gray-400" />
                  איך זה עובד
                </Link>
                <Link
                  href="/host"
                  className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <Building2 className="w-4 h-4 text-gray-400" />
                  להשכיר חלל
                </Link>
              </nav>

              {/* Divider */}
              <div className="border-t border-gray-100 my-1" />

              {/* Auth section */}
              <div className="py-1">
                {user ? (
                  <>
                    <Link
                      href={user.dashboardUrl}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      <LayoutDashboard className="w-4 h-4 text-gray-400" />
                      {user.role === 'host' ? 'לוח בקרה' : 'האזור שלי'}
                    </Link>
                    <form action={signOut}>
                      <button
                        type="submit"
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        התנתקות
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="px-4 py-3 flex gap-3">
                    <Link
                      href="/auth/login"
                      onClick={() => setIsOpen(false)}
                      className="flex-1 text-center border border-gray-200 text-deep-ocean font-medium text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      התחברות
                    </Link>
                    <Link
                      href="/auth/signup"
                      onClick={() => setIsOpen(false)}
                      className="flex-1 text-center bg-ocean text-white font-medium text-sm py-2.5 rounded-xl hover:bg-deep-ocean transition-colors"
                    >
                      הצטרפות
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </>
    )
  }

  return null
}
