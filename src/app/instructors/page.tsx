import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import Link from 'next/link'
type InstructorCard = {
  id: string
  full_name: string
  avatar_url?: string | null
  bio?: string | null
  specialties?: string[] | null
  bit_phone?: string | null
  paybox_phone?: string | null
}

export default async function InstructorsPage() {
  const supabase = await createClient()
  const { data: instructors } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, bio, specialties, bit_phone, paybox_phone')
    .eq('role', 'instructor')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen" style={{ background: '#faf5ee' }}>
      <Navbar />
      <div style={{ paddingTop: 68 }}>
        {/* Hero */}
        <div className="relative overflow-hidden" style={{ background: 'linear-gradient(145deg, #0a4a4a 0%, #0d6e6e 55%, #1a9090 100%)', padding: '48px 24px 64px' }}>
          <div className="relative z-10 max-w-2xl mx-auto text-center">
            <h1 className="font-black text-white mb-3" style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontFamily: "'Playfair Display', serif" }}>
              המדריכות שלנו
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.70)', fontSize: 15 }}>
              מדריכות יוגה ופילאטיס מוסמכות שמקיימות שיעורים על קו הים
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 48" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
              <path d="M0,24 C360,0 1080,48 1440,24 L1440,48 L0,48 Z" fill="#faf5ee" />
            </svg>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-10">
          {!instructors || instructors.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🧘</div>
              <h2 className="text-xl font-bold mb-2" style={{ color: '#0a4a4a', fontFamily: "'Playfair Display', serif" }}>
                עדיין אין מדריכות רשומות
              </h2>
              <p className="text-sm" style={{ color: '#6b7c7c' }}>בקרוב יצטרפו מדריכות מדהימות לפלטפורמה</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {instructors.map((instructor: InstructorCard) => (
                <Link key={instructor.id} href={`/instructors/${instructor.id}`}
                  className="block rounded-2xl overflow-hidden group"
                  style={{ background: 'white', boxShadow: '0 2px 16px rgba(10,74,74,0.08)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                >
                  {/* Avatar */}
                  <div className="relative h-48 flex items-center justify-center" style={{ background: 'linear-gradient(145deg, #0a4a4a, #1a9090)' }}>
                    {instructor.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={instructor.avatar_url} alt={instructor.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white" style={{ background: 'rgba(255,255,255,0.15)' }}>
                        {instructor.full_name?.charAt(0) ?? '?'}
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-5">
                    <h3 className="font-bold text-lg mb-1" style={{ color: '#0a4a4a', fontFamily: "'Playfair Display', serif" }}>
                      {instructor.full_name}
                    </h3>
                    {instructor.bio && (
                      <p className="text-sm mb-3 line-clamp-2" style={{ color: '#6b7c7c' }}>{instructor.bio}</p>
                    )}
                    {instructor.specialties && instructor.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {instructor.specialties.slice(0, 3).map((s: string) => (
                          <span key={s} className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(13,110,110,0.08)', color: '#0d6e6e' }}>{s}</span>
                        ))}
                      </div>
                    )}
                    {(instructor.bit_phone || instructor.paybox_phone) && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: '#c8944a' }}>
                        <span>💳</span>
                        <span className="font-semibold">תשלום ישיר זמין</span>
                      </div>
                    )}
                    <div className="mt-4 text-center py-2 rounded-full text-sm font-bold" style={{ background: 'rgba(13,110,110,0.08)', color: '#0d6e6e' }}>
                      לפרופיל המלא ←
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
