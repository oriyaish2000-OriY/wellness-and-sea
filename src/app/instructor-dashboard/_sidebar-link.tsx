'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

export function SidebarLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
      style={{ color: 'rgba(255,255,255,0.75)' }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement
        el.style.color = '#c8944a'
        el.style.background = 'rgba(255,255,255,0.08)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement
        el.style.color = 'rgba(255,255,255,0.75)'
        el.style.background = 'transparent'
      }}
    >
      {children}
      {label}
    </Link>
  )
}
