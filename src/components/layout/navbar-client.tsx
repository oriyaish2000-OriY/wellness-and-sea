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
          className="md:hidden p-2"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="תפריט"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {isOpen && (
          <div className="fixed inset-0 top-16 z-40 md:hidden bg-white/98 backdrop-blur border-t border-gray-100 px-4 py-4 space-y-2">
            <Link href="/venues" className="block text-sm text-gray-600 py-3 border-b border-gray-100" onClick={() => setIsOpen(false)}>
              חיפוש חללים
            </Link>
            <Link href="/how-it-works" className="block text-sm text-gray-600 py-3 border-b border-gray-100" onClick={() => setIsOpen(false)}>
              איך זה עובד
            </Link>
            <Link href="/host" className="block text-sm text-gray-600 py-3 border-b border-gray-100" onClick={() => setIsOpen(false)}>
              להשכיר חלל
            </Link>

            <div className="pt-2">
              {user ? (
                <div className="space-y-2">
                  <Link
                    href={user.dashboardUrl}
                    className="flex items-center gap-2 text-sm text-ocean font-medium py-2"
                    onClick={() => setIsOpen(false)}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    {user.role === 'host' ? 'לוח בקרה' : 'האזור שלי'}
                  </Link>
                  <form action={signOut}>
                    <button type="submit" className="flex items-center gap-2 text-sm text-red-500 py-2">
                      <LogOut className="w-4 h-4" />
                      התנתקות
                    </button>
                  </form>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href="/auth/login" onClick={() => setIsOpen(false)}>התחברות</Link>
                  </Button>
                  <Button size="sm" className="flex-1 bg-ocean hover:bg-deep-ocean text-white" asChild>
                    <Link href="/auth/signup" onClick={() => setIsOpen(false)}>הצטרפות</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    )
  }

  return null
}
