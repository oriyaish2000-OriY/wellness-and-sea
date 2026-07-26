import Link from 'next/link'
import { Waves } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-deep-ocean text-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Waves className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg">WELLNESS<span className="text-coral">&</span>SEA</span>
            </div>
            <p className="text-white/70 text-sm leading-relaxed max-w-xs">
              מחברים בין מסעדות חוף למדריכי יוגה וכושר. הפכו שעות מתות להכנסה פסיבית.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-sand">לבעלי מסעדות</h4>
            <ul className="space-y-2 text-white/70 text-sm">
              <li><Link href="/host" className="hover:text-white transition-colors">השכרת החלל</Link></li>
              <li><Link href="/host-dashboard" className="hover:text-white transition-colors">ניהול הזמנות</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition-colors">מחירים ועמלות</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-sand">למדריכים</h4>
            <ul className="space-y-2 text-white/70 text-sm">
              <li><Link href="/venues" className="hover:text-white transition-colors">חיפוש חללים</Link></li>
              <li><Link href="/instructor-dashboard" className="hover:text-white transition-colors">ההזמנות שלי</Link></li>
              <li><Link href="/insurance" className="hover:text-white transition-colors">ביטוח ורישוי</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-white/50 text-xs">
          <span>© 2026 WELLNESS&SEA. כל הזכויות שמורות.</span>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-white transition-colors">תנאי שימוש</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">פרטיות</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
