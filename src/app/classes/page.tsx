import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { getOpenClasses } from '@/lib/supabase/queries'
import Link from 'next/link'
import { MapPin, Clock, Users } from 'lucide-react'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export default async function ClassesPage() {
  const openClasses = await getOpenClasses(30)

  return (
    <div className="min-h-screen" style={{ background: '#faf5ee' }}>
      <Navbar />
      <div style={{ paddingTop: 68 }}>
        {/* Hero */}
        <div className="relative overflow-hidden" style={{ background: 'linear-gradient(145deg, #0a4a4a 0%, #0d6e6e 55%, #1a9090 100%)', padding: '52px 24px 72px' }}>
          <div className="absolute" style={{ width: 300, height: 300, background: 'rgba(92,140,110,0.18)', borderRadius: '50%', filter: 'blur(70px)', top: -80, right: -80 }} />
          <div className="relative z-10 max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e07a5f', display: 'inline-block' }} />
              <span className="text-white text-xs font-semibold">שיעורים פתוחים להרשמה</span>
            </div>
            <h1 className="font-black text-white mb-3" style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontFamily: "'Playfair Display', serif", lineHeight: 1.15 }}>
              שיעורים ליד הים<br /><span style={{ color: '#e8b870' }}>הירשמי עכשיו</span>
            </h1>
            <p className="mb-8" style={{ color: 'rgba(255,255,255,0.70)', fontSize: 15, lineHeight: 1.7 }}>
              מדריכות יוגה ופילאטיס שפתחו את השיעורים שלהן להרשמה — מצאי, הירשמי ושלמי ישירות למדריכה
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 48" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
              <path d="M0,24 C360,0 1080,48 1440,24 L1440,48 L0,48 Z" fill="#faf5ee" />
            </svg>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-10">
          {openClasses.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🌊</div>
              <h2 className="text-xl font-bold text-deep-ocean mb-2">אין שיעורים פתוחים כרגע</h2>
              <p className="text-gray-500 text-sm mb-6">בדקי שוב בקרוב — מדריכות מוסיפות שיעורים כל הזמן</p>
              <Link href="/instructors" className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm" style={{ background: '#0d6e6e', color: 'white' }}>
                גלריית המדריכות
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 mb-6">{openClasses.length} שיעורים זמינים</p>
              {openClasses.map((cls) => {
                const venue = cls.venue as { id?: string; title?: string; location_city?: string; location_address?: string; images?: string[] } | null
                const instructor = cls.instructor as { id?: string; full_name?: string; avatar_url?: string; bio?: string; bit_phone?: string; paybox_phone?: string } | null
                const dateObj = new Date(cls.booking_date)

                return (
                  <div key={cls.id} className="rounded-2xl overflow-hidden bg-white" style={{ boxShadow: '0 2px 16px rgba(10,74,74,0.08)' }}>
                    <div className="flex gap-0">
                      {/* Date sidebar */}
                      <div className="flex-shrink-0 w-20 flex flex-col items-center justify-center py-5 text-white text-center" style={{ background: 'linear-gradient(145deg, #0a4a4a, #0d6e6e)' }}>
                        <div className="text-2xl font-black leading-none">{dateObj.getDate()}</div>
                        <div className="text-[11px] opacity-80 mt-0.5">{dateObj.toLocaleDateString('he-IL', { month: 'short' })}</div>
                        <div className="text-[10px] opacity-60 mt-1">{dateObj.toLocaleDateString('he-IL', { weekday: 'short' })}</div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            {cls.class_type && (
                              <h3 className="font-bold text-lg text-deep-ocean">{cls.class_type}</h3>
                            )}
                            <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{cls.start_time?.slice(0,5)} — {cls.end_time?.slice(0,5)}</span>
                            </div>
                          </div>

                          {/* Price */}
                          {cls.price_per_student != null && (
                            <div className="text-right flex-shrink-0">
                              <span className="font-black text-ocean text-xl">₪{cls.price_per_student}</span>
                              <span className="text-xs text-gray-400 block">לשיעור</span>
                            </div>
                          )}
                        </div>

                        {/* Venue */}
                        {venue && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span>{venue.title}{venue.location_city ? ` · ${venue.location_city}` : ''}</span>
                          </div>
                        )}

                        {/* Instructor */}
                        {instructor && (
                          <div className="flex items-center gap-2 mb-3">
                            {instructor.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={instructor.avatar_url} alt={instructor.full_name ?? ''} className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <div className="w-7 h-7 rounded-full ocean-gradient flex items-center justify-center text-white text-xs font-bold">
                                {instructor.full_name?.charAt(0)}
                              </div>
                            )}
                            <Link href={`/instructors/${instructor.id}`} className="text-sm font-semibold text-ocean hover:underline">
                              {instructor.full_name}
                            </Link>
                          </div>
                        )}

                        {/* Spots left */}
                        {cls.max_students != null && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 mb-4">
                            <Users className="w-3 h-3" />
                            <span>עד {cls.max_students} משתתפות</span>
                          </div>
                        )}

                        {/* Payment info + CTA */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <Link
                            href={`/classes/${cls.id}`}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm text-white"
                            style={{ background: 'linear-gradient(135deg, #c8944a, #e8b870)' }}
                          >
                            הירשמי לשיעור
                          </Link>
                          {instructor?.bit_phone && (
                            <span className="text-xs text-gray-400">💙 Bit: {instructor.bit_phone}</span>
                          )}
                          {instructor?.paybox_phone && (
                            <span className="text-xs text-gray-400">💛 PayBox: {instructor.paybox_phone}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-12 text-center">
            <p className="text-sm mb-4" style={{ color: '#6b7c7c' }}>רוצה למצוא מדריכה ספציפית?</p>
            <Link href="/instructors" className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm border-2" style={{ borderColor: '#0d6e6e', color: '#0d6e6e' }}>
              גלריית המדריכות
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
