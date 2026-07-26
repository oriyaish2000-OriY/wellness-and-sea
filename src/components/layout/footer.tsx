import Link from 'next/link'
import { Waves } from 'lucide-react'

export function Footer() {
  return (
    <footer style={{ background: '#1a2a2a', color: 'white', padding: '60px 24px 32px' }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 ocean-gradient rounded-full flex items-center justify-center">
                <Waves className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif", color: 'white' }}>
                WELLNESS<span className="text-coral">&amp;</span>SEA
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
              מחברים בין מסעדות חוף למדריכי יוגה וכושר. הפכו שעות מתות להכנסה פסיבית.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-4 text-sm uppercase tracking-wider" style={{ color: '#c8944a' }}>לבעלי מסעדות</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/host', label: 'השכרת החלל' },
                { href: '/host-dashboard', label: 'ניהול הזמנות' },
                { href: '/pricing', label: 'מחירים ועמלות' },
              ].map(item => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4 text-sm uppercase tracking-wider" style={{ color: '#c8944a' }}>למדריכים</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/venues', label: 'חיפוש חללים' },
                { href: '/instructor-dashboard', label: 'ההזמנות שלי' },
                { href: '/insurance', label: 'ביטוח ורישוי' },
              ].map(item => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}>
          <span>© 2026 WELLNESS&amp;SEA. כל הזכויות שמורות.</span>
          <div className="flex gap-5">
            <Link href="/terms" className="hover:text-white transition-colors">תנאי שימוש</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">פרטיות</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
