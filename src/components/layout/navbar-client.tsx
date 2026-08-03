'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, LogOut, LayoutDashboard, ChevronDown } from 'lucide-react'
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

            {/* Drawer */}
            <div className="fixed top-[68px] right-0 left-0 z-50 md:hidden bg-white shadow-xl border-t-2 border-ocean/20">
              {/* Nav links */}
              <nav className="px-5 py-3">
                <Link
                  href="/venues"
                  className="flex items-center gap-3 py-4 border-b border-gray-100 text-gray-900 font-semibold text-base active:bg-gray-50 rounded"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="text-xl">🔍</span>
                  חיפוש חללים
                </Link>
                <Link
                  href="/how-it-works"
                  className="flex items-center gap-3 py-4 border-b border-gray-100 text-gray-900 font-semibold text-base active:bg-gray-50 rounded"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="text-xl">💡</span>
                  איך זה עובד
                </Link>
                <Link
                  href="/host"
                  className="flex items-center gap-3 py-4 border-b border-gray-100 text-gray-900 font-semibold text-base active:bg-gray-50 rounded"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="text-xl">🏠</span>
                  להשכיר חלל
                </Link>
              </nav>

              {/* Auth section */}
              <div className="px-5 pt-2 pb-6">
                {user ? (
                  <div className="space-y-2">
                    {user.fullName && (
                      <p className="text-xs text-gray-400 mb-3">מחובר/ת כ: <strong className="text-gray-700">{user.fullName}</strong></p>
                    )}
                    <Link
                      href={user.dashboardUrl}
                      className="flex items-center gap-3 w-full bg-ocean/8 hover:bg-ocean/15 text-ocean font-semibold text-base py-3 px-4 rounded-xl transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      <LayoutDashboard className="w-5 h-5" />
                      {user.role === 'host' ? 'לוח בקרה' : 'האזור שלי'}
                    </Link>
                    <form action={signOut} className="mt-2">
                      <button
                        type="submit"
                        className="flex items-center gap-3 w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-base py-3 px-4 rounded-xl transition-colors border border-red-200"
                      >
                        <LogOut className="w-5 h-5" />
                        התנתקות
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <Link
                      href="/auth/login"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center justify-center w-full border-2 border-ocean text-ocean font-semibold text-base py-3 rounded-xl hover:bg-ocean/5 transition-colors"
                    >
                      התחברות
                    </Link>
                    <Link
                      href="/auth/signup"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center justify-center w-full bg-ocean text-white font-semibold text-base py-3 rounded-xl hover:bg-deep-ocean transition-colors shadow-sm"
                    >
                      הצטרפות חינמית
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
