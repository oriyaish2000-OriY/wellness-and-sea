import Link from 'next/link'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { Search, CalendarCheck, Waves, Building2, CreditCard, Star } from 'lucide-react'

const instructorSteps = [
  {
    icon: Search,
    num: '1',
    title: 'חפשי חלל',
    desc: 'סננו לפי עיר, קיבולת, שעות ומתקנים. כל חלל מציג תמונות, מחיר ומה כלול.',
  },
  {
    icon: CalendarCheck,
    num: '2',
    title: 'בחרי תאריך ושעה',
    desc: 'בחרו יום ושעה פנויים ישירות מלוח הזמינות של החלל.',
  },
  {
    icon: CreditCard,
    num: '3',
    title: 'שלמי ואשרי',
    desc: 'תשלום מאובטח. לאחר האישור תקבלי אישור במייל עם כל פרטי ההזמנה.',
  },
  {
    icon: Waves,
    num: '4',
    title: 'תנהיגי שיעור מדהים',
    desc: 'הגיעי לחלל, תנהיגי שיעור עם נוף לים, והמשתתפים יחזרו שוב ושוב.',
  },
]

const hostSteps = [
  {
    icon: Building2,
    num: '1',
    title: 'פרסמי את החלל',
    desc: 'רישום חינמי ב-5 דקות. העלי תמונות, קבעי מחיר ושעות זמינות.',
  },
  {
    icon: CalendarCheck,
    num: '2',
    title: 'קבלי הזמנות',
    desc: 'מדריכות מוצאות את החלל שלך ומזמינות ישירות דרך הפלטפורמה.',
  },
  {
    icon: CreditCard,
    num: '3',
    title: 'קבלי תשלום',
    desc: 'התשלום עובר אלייך אוטומטית לאחר כל שיעור מאושר. ללא טרחה.',
  },
  {
    icon: Star,
    num: '4',
    title: 'בני מוניטין',
    desc: 'חללים עם ביקורות טובות מושכים יותר מדריכות ומניבים הכנסה קבועה.',
  },
]

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-cream" dir="rtl">
      <Navbar />

      {/* Hero */}
      <section className="ocean-gradient pt-28 pb-16 text-center px-4">
        <div className="max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <Waves className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            איך WELLNESS&amp;SEA עובד?
          </h1>
          <p className="text-white/80 text-lg max-w-xl mx-auto">
            פלטפורמה ישראלית המחברת מדריכות יוגה ופילאטיס עם חללי חוף ומסעדות בוטיק — בשעות הבוקר המתות.
          </p>
        </div>
      </section>

      {/* For instructors */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block bg-ocean/10 text-ocean font-semibold text-sm px-4 py-1.5 rounded-full mb-3">למדריכות</span>
            <h2 className="text-2xl font-bold text-deep-ocean">מצאי את חלל השיעור שלך</h2>
            <p className="text-gray-500 text-sm mt-2">מבחר חללים עם נוף לים בערים הגדולות בישראל</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {instructorSteps.map((step) => (
              <div key={step.num} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex gap-4">
                <div className="w-11 h-11 ocean-gradient rounded-xl flex items-center justify-center flex-shrink-0">
                  <step.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-ocean bg-ocean/8 px-2 py-0.5 rounded-full">שלב {step.num}</span>
                    <h3 className="font-bold text-gray-900 text-base">{step.title}</h3>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button className="bg-ocean hover:bg-deep-ocean text-white px-8 rounded-full" asChild>
              <Link href="/venues">חיפוש חללים עכשיו</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-ocean/20 to-transparent mx-8" />

      {/* For hosts */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block bg-golden/15 text-golden font-semibold text-sm px-4 py-1.5 rounded-full mb-3">לבעלי עסקים</span>
            <h2 className="text-2xl font-bold text-deep-ocean">הפכי שעות בוקר ריקות להכנסה</h2>
            <p className="text-gray-500 text-sm mt-2">ממוצע ₪280/שעה, ללא עמלות מראש</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {hostSteps.map((step) => (
              <div key={step.num} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #c9a84c, #e8c86d)' }}>
                  <step.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-golden bg-golden/10 px-2 py-0.5 rounded-full">שלב {step.num}</span>
                    <h3 className="font-bold text-gray-900 text-base">{step.title}</h3>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button className="text-white px-8 rounded-full" style={{ background: 'linear-gradient(135deg, #c9a84c, #e8c86d)' }} asChild>
              <Link href="/host/list-space">רשמי את החלל שלך חינם</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ strip */}
      <section className="bg-white py-12 px-4">
        <div className="max-w-2xl mx-auto space-y-5">
          <h2 className="text-xl font-bold text-deep-ocean text-center mb-8">שאלות נפוצות</h2>
          {[
            { q: 'כמה עולה להצטרף?', a: 'הצטרפות חינמית לחלוטין. עמלת הפלטפורמה נגבית רק כשהזמנה מאושרת.' },
            { q: 'האם צריך ביטוח?', a: 'כן. כל מדריכה נדרשת להציג ביטוח אחריות מקצועית בתוקף לפני ביצוע הזמנה.' },
            { q: 'מה שעות הזמינות?', a: 'החללים פתוחים בדרך כלל בין 06:00–12:00. כל בעל חלל קובע את שעותיו.' },
            { q: 'איך בוטלת הזמנה?', a: 'ביטול עד 24 שעות לפני השיעור מחזיר 100% מהתשלום.' },
          ].map(({ q, a }) => (
            <div key={q} className="border-b border-gray-100 pb-5">
              <p className="font-semibold text-gray-900 mb-1">{q}</p>
              <p className="text-gray-500 text-sm">{a}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  )
}
