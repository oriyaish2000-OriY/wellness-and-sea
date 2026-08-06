import Link from 'next/link'
import { Waves } from 'lucide-react'

export const metadata = {
  title: 'מדיניות תשלומים ועמלות | WELLNESS&SEA',
  description: 'מדיניות התשלומים, העמלות ותנאי הסליקה של פלטפורמת WELLNESS&SEA',
}

export default function PaymentPolicyPage() {
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
          <span className="text-gray-400 text-sm mr-auto">
            <Link href="/terms" className="hover:text-deep-ocean transition-colors">תנאי שימוש</Link>
            {' '}·{' '}
            <Link href="/privacy-policy" className="hover:text-deep-ocean transition-colors">מדיניות פרטיות</Link>
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12" dir="rtl">
        <h1 className="text-3xl font-black text-deep-ocean mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
          מדיניות תשלומים ועמלות
        </h1>
        <p className="text-sm text-gray-400 mb-10">עדכון אחרון: אוגוסט 2026</p>

        {/* ── Section 1 ── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-deep-ocean mb-3 pb-2 border-b border-sand">
            1. כללי
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            WELLNESS&SEA (להלן: <strong>"הפלטפורמה"</strong>) מפעילה שוק דיגיטלי המחבר בין מאמני/ות כושר ויוגה לבין בעלי מקומות (מסעדות, חלליות ועסקים חוף-ימי). הפלטפורמה אינה גוף סולק, אינה מחזיקה כספים בנאמנות, ואינה צד לעסקה הבסיסית שבין הספקים לבין לקוחותיהם — אלא מתווכת טכנולוגית בלבד, בדומה למודל Airbnb.
          </p>
          <p className="text-gray-700 leading-relaxed">
            שירות עיבוד התשלומים מסופק על-ידי <strong>Cardcom</strong> (חברת א.מ.ל.ס שירותים פיננסיים בע"מ), גוף סולק מורשה לפי חוק שירותי תשלום, תשע"ט-2019, ובכפוף לתקן{' '}
            <strong>PCI DSS Level 1</strong>. פרטי כרטיס האשראי אינם נשמרים בשרתי הפלטפורמה.
          </p>
        </section>

        {/* ── Section 2 ── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-deep-ocean mb-3 pb-2 border-b border-sand">
            2. סוגי עסקאות ומבנה העמלות
          </h2>
          <p className="text-gray-700 leading-relaxed mb-5">
            הפלטפורמה גובה <strong>עמלת שירות משני הצדדים</strong> בכל עסקה. להלן פירוט מלא לפי סוג עסקה:
          </p>

          {/* Flow A */}
          <div className="bg-white rounded-2xl border border-sand/80 p-6 mb-6 shadow-sm">
            <h3 className="text-lg font-bold text-deep-ocean mb-1">
              א. הזמנת שיעור / פגישה (מתרגל/ת ← מאמן/ת)
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              מתרגל/ת רוכש/ת מקום בשיעור שמפרסמת מאמנ/ת בפלטפורמה.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-sand/30">
                    <th className="text-right p-3 font-semibold text-deep-ocean border-b border-sand">צד</th>
                    <th className="text-right p-3 font-semibold text-deep-ocean border-b border-sand">מנגנון</th>
                    <th className="text-right p-3 font-semibold text-deep-ocean border-b border-sand">אחוז עמלה</th>
                    <th className="text-right p-3 font-semibold text-deep-ocean border-b border-sand">דוגמה (מחיר בסיס 100 ₪)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-sand/50">
                    <td className="p-3 text-gray-700">מתרגל/ת (רוכש/ת)</td>
                    <td className="p-3 text-gray-600">תוספת על מחיר הבסיס</td>
                    <td className="p-3 font-bold text-coral">+5%</td>
                    <td className="p-3 text-gray-700">משלם/ת <strong>105 ₪</strong></td>
                  </tr>
                  <tr className="border-b border-sand/50">
                    <td className="p-3 text-gray-700">מאמן/ת (ספק/ת)</td>
                    <td className="p-3 text-gray-600">ניכוי מהתמורה</td>
                    <td className="p-3 font-bold text-coral">−5%</td>
                    <td className="p-3 text-gray-700">מקבל/ת <strong>95 ₪</strong></td>
                  </tr>
                  <tr className="bg-ocean/5">
                    <td className="p-3 font-semibold text-deep-ocean" colSpan={2}>סה"כ עמלת פלטפורמה</td>
                    <td className="p-3 font-bold text-deep-ocean">10% מהמחיר</td>
                    <td className="p-3 font-semibold text-deep-ocean">10 ₪</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Flow B */}
          <div className="bg-white rounded-2xl border border-sand/80 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-deep-ocean mb-1">
              ב. הזמנת חלל / מקום (בעל מקום ← מאמן/ת)
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              מאמן/ת שוכר/ת חלל מבית עסק (מסעדה, חלל חוף וכד') לצורך קיום שיעור.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-sand/30">
                    <th className="text-right p-3 font-semibold text-deep-ocean border-b border-sand">צד</th>
                    <th className="text-right p-3 font-semibold text-deep-ocean border-b border-sand">מנגנון</th>
                    <th className="text-right p-3 font-semibold text-deep-ocean border-b border-sand">אחוז עמלה</th>
                    <th className="text-right p-3 font-semibold text-deep-ocean border-b border-sand">דוגמה (מחיר בסיס 200 ₪)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-sand/50">
                    <td className="p-3 text-gray-700">מאמן/ת (שוכר/ת)</td>
                    <td className="p-3 text-gray-600">תוספת על מחיר הבסיס</td>
                    <td className="p-3 font-bold text-coral">+5%</td>
                    <td className="p-3 text-gray-700">משלם/ת <strong>210 ₪</strong></td>
                  </tr>
                  <tr className="border-b border-sand/50">
                    <td className="p-3 text-gray-700">בעל/ת המקום (ספק/ת)</td>
                    <td className="p-3 text-gray-600">ניכוי מהתמורה</td>
                    <td className="p-3 font-bold text-coral">−5%</td>
                    <td className="p-3 text-gray-700">מקבל/ת <strong>190 ₪</strong></td>
                  </tr>
                  <tr className="bg-ocean/5">
                    <td className="p-3 font-semibold text-deep-ocean" colSpan={2}>סה"כ עמלת פלטפורמה</td>
                    <td className="p-3 font-bold text-deep-ocean">10% מהמחיר</td>
                    <td className="p-3 font-semibold text-deep-ocean">20 ₪</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Section 3 ── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-deep-ocean mb-3 pb-2 border-b border-sand">
            3. תהליך התשלום
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700 leading-relaxed">
            <li>לאחר אישור ההזמנה, הצד המשלם מופנה לדף תשלום מאובטח של Cardcom (HTTPS / PCI DSS).</li>
            <li>התשלום מבוצע בכרטיס אשראי, Apple Pay, Google Pay או Bit (לפי זמינות).</li>
            <li>עם השלמת התשלום, הפלטפורמה מקבלת אישור אוטומטי מ-Cardcom, ההזמנה מאושרת ונשלחת הודעה לשני הצדדים.</li>
            <li>התמורה לספק/ת (אחרי ניכוי עמלת הפלטפורמה) מועברת לחשבון הבנק הרשום, במועדי הסליקה של Cardcom (בדרך כלל 3 ימי עסקים).</li>
          </ol>
        </section>

        {/* ── Section 4 ── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-deep-ocean mb-3 pb-2 border-b border-sand">
            4. מע"מ (מס ערך מוסף)
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            המחירים המוצגים בפלטפורמה הם <strong>ללא מע"מ</strong>, אלא אם צוין אחרת. כל ספק/ת אחראי/ת באופן בלעדי לתשלום מע"מ על הכנסותיו/ה לפי החוק הישראלי, לפי מעמדו/ה (עוסק מורשה / עוסק פטור).
          </p>
          <p className="text-gray-700 leading-relaxed">
            הפלטפורמה רשאית להוסיף מע"מ על עמלת השירות שלה בהתאם לדרישות החוק, ולהנפיק חשבונית מס על חלקה בעסקה בנפרד.
          </p>
        </section>

        {/* ── Section 5 ── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-deep-ocean mb-3 pb-2 border-b border-sand">
            5. ביטולים והחזרים
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            בהתאם לתקנות הגנת הצרכן (ביטול עסקה), תשע"א-2010:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700 leading-relaxed">
            <li>
              <strong>ביטול עד 14 ימים לפני מועד השיעור/ההשכרה:</strong> החזר מלא (בניכוי עמלת ביטול של 5% או 100 ₪ — הנמוך מביניהם, לפי תקנות הביטול).
            </li>
            <li>
              <strong>ביטול בין 14 ל-3 ימים לפני המועד:</strong> 50% החזר.
            </li>
            <li>
              <strong>ביטול פחות מ-3 ימים לפני המועד:</strong> אין החזר, אלא אם בוטל על-ידי הספק/ת.
            </li>
            <li>
              <strong>ביטול על-ידי הספק/ת:</strong> החזר מלא לצד המשלם. הפלטפורמה שומרת לעצמה את הזכות להשהות חשבונות של ספקים עם שיעור ביטול גבוה.
            </li>
            <li>
              <strong>תקלה טכנית בתשלום:</strong> ההזמנה תבוטל אוטומטית ולא יגבה תשלום.
            </li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-3">
            ההחזר יבוצע לאמצעי התשלום המקורי תוך עד 5 ימי עסקים מאישור הביטול.
          </p>
        </section>

        {/* ── Section 6 ── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-deep-ocean mb-3 pb-2 border-b border-sand">
            6. אבטחת תשלומים ואחריות
          </h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700 leading-relaxed">
            <li>כל העסקאות מוצפנות ב-TLS 1.2 ומעלה.</li>
            <li>פרטי כרטיסי אשראי אינם נשמרים בשרתי WELLNESS&SEA בשום שלב.</li>
            <li>הפלטפורמה פועלת בהתאם לתקן PCI DSS Level 1 דרך Cardcom.</li>
            <li>WELLNESS&SEA אינה אחראית לפעילות הסולקת Cardcom, לאי-אספקת שירות, או לכל נזק שנגרם כתוצאה מתקלה בחברת כרטיסי האשראי.</li>
          </ul>
        </section>

        {/* ── Section 7 ── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-deep-ocean mb-3 pb-2 border-b border-sand">
            7. רישום ספקים — KYC (הכר את לקוחך)
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            ספקים (מאמנים/ות ובעלי מקומות) המעוניינים לקבל תשלומים דרך הפלטפורמה נדרשים להשלים תהליך <strong>אימות זהות (KYC)</strong> לפי דרישות חוק שירותי תשלום ורגולציית Cardcom:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700 leading-relaxed">
            <li>מספר ת.ז / ח.פ / עוסק מורשה</li>
            <li>שם מלא / שם עסק</li>
            <li>פרטי חשבון בנק ישראלי</li>
            <li>טלפון ואימייל לאימות</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-3">
            עד השלמת אימות ה-KYC, ספקים יכולים לקבל תשלומים ישירות מהלקוחות מחוץ לפלטפורמה. הפלטפורמה אינה אחראית לעסקאות המתבצעות מחוץ למערכת.
          </p>
        </section>

        {/* ── Section 8 ── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-deep-ocean mb-3 pb-2 border-b border-sand">
            8. שינויים במדיניות
          </h2>
          <p className="text-gray-700 leading-relaxed">
            הפלטפורמה שומרת לעצמה את הזכות לשנות את מדיניות העמלות עם הודעה מראש של <strong>30 ימים</strong> לפחות, באמצעות הודעה בדואר אלקטרוני ו/או באתר. שינויים לא יחולו על עסקאות שכבר אושרו לפני כניסת השינוי לתוקף.
          </p>
        </section>

        {/* ── Section 9 ── */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-deep-ocean mb-3 pb-2 border-b border-sand">
            9. יצירת קשר
          </h2>
          <p className="text-gray-700 leading-relaxed">
            לשאלות בנוגע לתשלומים, עמלות או החזרים:{' '}
            <a href="mailto:support@wellnessandsea.com" className="text-ocean hover:underline">
              support@wellnessandsea.com
            </a>
          </p>
        </section>

        {/* Back links */}
        <div className="pt-8 border-t border-sand flex gap-6 text-sm text-gray-500">
          <Link href="/terms" className="hover:text-deep-ocean transition-colors">← תנאי שימוש</Link>
          <Link href="/privacy-policy" className="hover:text-deep-ocean transition-colors">מדיניות פרטיות</Link>
          <Link href="/" className="hover:text-deep-ocean transition-colors">חזרה לדף הבית</Link>
        </div>
      </main>
    </div>
  )
}
