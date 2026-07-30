import Link from 'next/link'
import { Waves } from 'lucide-react'

export const metadata = {
  title: 'מדיניות פרטיות | WELLNESS&SEA',
  description: 'מדיניות הפרטיות של פלטפורמת WELLNESS&SEA',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen" style={{ background: '#faf5ee' }}>
      {/* Header */}
      <header className="border-b border-sand/60 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 ocean-gradient rounded-full flex items-center justify-center">
              <Waves className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-deep-ocean" style={{ fontFamily: "'Playfair Display', serif" }}>
              WELLNESS<span className="text-coral">&amp;</span>SEA
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12" dir="rtl">
        <h1 className="text-3xl font-black text-deep-ocean mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
          מדיניות פרטיות
        </h1>
        <p className="text-sm text-gray-400 mb-10">עדכון אחרון: יולי 2026</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">1. מבוא</h2>
            <p>
              WELLNESS&amp;SEA ("הפלטפורמה", "אנחנו") מפעילה מרקטפלייס המחבר בין מדריכות יוגה ופילאטיס לבין מסעדות וחללים על קו החוף.
              מדיניות זו מסבירה אילו מידע אנו אוספים, כיצד אנו משתמשים בו ומה הזכויות שלך.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">2. המידע שאנו אוספים</h2>
            <ul className="list-disc list-inside space-y-1 pr-2">
              <li><strong>פרטי חשבון:</strong> שם, כתובת אימייל, תמונת פרופיל (בהתחברות דרך Google).</li>
              <li><strong>פרטי הזמנות:</strong> תאריכים, שעות, חלל שהוזמן ופרטי תשלום (מעובדים דרך Tranzila — איננו שומרים פרטי כרטיס אשראי).</li>
              <li><strong>תוכן שהועלה:</strong> תמונות של חללים, תיאורים ופרופילים.</li>
              <li><strong>נתוני שימוש:</strong> דפים שנצפו, חיפושים וזמני כניסה — לצורך שיפור השירות.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">3. כיצד אנו משתמשים במידע</h2>
            <ul className="list-disc list-inside space-y-1 pr-2">
              <li>הפעלת שירות ההזמנות וביצוע תשלומים.</li>
              <li>שליחת אישורי הזמנה והתראות רלוונטיות.</li>
              <li>שיפור חוויית המשתמש על בסיס נתוני שימוש.</li>
              <li>עמידה בדרישות חוקיות ורגולטוריות.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">4. שיתוף מידע עם צדדים שלישיים</h2>
            <p>אנו לא מוכרים את המידע שלך. אנו משתפים מידע רק עם:</p>
            <ul className="list-disc list-inside space-y-1 pr-2 mt-2">
              <li><strong>Supabase</strong> — אחסון מסד נתונים ואימות זהות.</li>
              <li><strong>Tranzila</strong> — עיבוד תשלומים מאובטח.</li>
              <li><strong>Google</strong> — בעת התחברות דרך Google OAuth.</li>
              <li><strong>Resend</strong> — שליחת אימיילים עסקיים.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">5. אבטחת מידע</h2>
            <p>
              המידע שלך מאוחסן בשרתים מאובטחים עם הצפנה. גישה למידע מוגבלת לעובדים וספקים הנדרשים לצורך הפעלת השירות בלבד.
              פרטי תשלום מעובדים אך ורק דרך Tranzila ואינם נשמרים במערכותינו.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">6. זכויותיך</h2>
            <ul className="list-disc list-inside space-y-1 pr-2">
              <li>גישה לכל המידע השמור עליך.</li>
              <li>תיקון מידע שגוי.</li>
              <li>מחיקת חשבונך וכל המידע הקשור אליו.</li>
              <li>ביטול הסכמה לקבלת הודעות שיווקיות.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">7. עוגיות (Cookies)</h2>
            <p>
              אנו משתמשים בעוגיות הכרחיות לניהול סשן התחברות בלבד. אין אנו משתמשים בעוגיות פרסומיות או ב-tracking של צד שלישי.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">8. יצירת קשר</h2>
            <p>
              לכל שאלה בנוגע למדיניות הפרטיות, ניתן לפנות אלינו בדוא"ל:{' '}
              <a href="mailto:privacy@wellness-and-sea.com" className="text-ocean hover:underline">
                privacy@wellness-and-sea.com
              </a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-sand/60 text-center text-xs text-gray-400">
          © 2026 WELLNESS&amp;SEA · כל הזכויות שמורות ·{' '}
          <Link href="/" className="hover:underline">חזרה לדף הבית</Link>
        </div>
      </main>
    </div>
  )
}
