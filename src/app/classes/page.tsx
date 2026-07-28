import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { HappeningNowSection } from '@/components/venues/happening-now-section'
import Link from 'next/link'

export default function ClassesPage() {
  return (
    <div className="min-h-screen" style={{ background: '#faf5ee' }}>
      <Navbar />
      <div style={{ paddingTop: 68 }}>
        {/* Hero */}
        <div className="relative overflow-hidden" style={{ background: 'linear-gradient(145deg, #0a4a4a 0%, #0d6e6e 55%, #1a9090 100%)', padding: '52px 24px 72px' }}>
          <div className="absolute" style={{ width: 300, height: 300, background: 'rgba(92,140,110,0.18)', borderRadius: '50%', filter: 'blur(70px)', top: -80, right: -80 }} />
          <div className="relative z-10 max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e07a5f', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              <span className="text-white text-xs font-semibold">שיעורים מתקיימים ברגע זה</span>
            </div>
            <h1 className="font-black text-white mb-3" style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontFamily: "'Playfair Display', serif", lineHeight: 1.15 }}>
              מצאי שיעור<br /><span style={{ color: '#e8b870' }}>ליד הים</span>
            </h1>
            <p className="mb-8" style={{ color: 'rgba(255,255,255,0.70)', fontSize: 15, lineHeight: 1.7 }}>
              מדריכות יוגה ופילאטיס שמקיימות שיעורים על קו הים — מצאי, הירשמי ושלמי ישירות
            </p>
            <Link href="/instructors" className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm" style={{ background: '#c8944a', color: 'white' }}>
              כל המדריכות
            </Link>
          </div>
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 48" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
              <path d="M0,24 C360,0 1080,48 1440,24 L1440,48 L0,48 Z" fill="#faf5ee" />
            </svg>
          </div>
        </div>
        <HappeningNowSection />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <p className="text-sm mb-4" style={{ color: '#6b7c7c' }}>רוצה למצוא מדריכה ספציפית?</p>
          <Link href="/instructors" className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm border-2" style={{ borderColor: '#0d6e6e', color: '#0d6e6e' }}>
            גלריית המדריכות
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
