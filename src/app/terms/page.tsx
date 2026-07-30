import Link from 'next/link'
import { Waves } from 'lucide-react'

export const metadata = {
  title: 'תנאי שימוש | WELLNESS&SEA',
  description: 'תנאי השימוש של פלטפורמת WELLNESS&SEA',
}

export default function TermsPage() {
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
          תנאי שימוש
        </h1>
        <p className="text-sm text-gray-400 mb-10">עדכון אחרון: יולי 2026</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">1. תיאור הפלטפורמה</h2>
            <p>
              WELLNESS&amp;SEA ("הפלטפורמה", "אנחנו") היא מרקטפלייס המחבר בין מדריכות יוגה ופילאטיס לבין מסעדות וחללים על קו החוף.
              הפלטפורמה מאפשרת למדריכות לאתר ולהזמין חללים לפעילות, ולבעלי חללים לפרסם את המקום שלהם ולקבל הכנסה בשעות הבוקר.
              השימוש בפלטפורמה מהווה הסכמה מלאה לתנאים אלו.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">2. אחריות המשתמשים</h2>
            <ul className="list-disc list-inside space-y-1 pr-2">
              <li>כל משתמש אחראי לדיוק המידע שמסר בעת ההרשמה.</li>
              <li>אסור להעביר את פרטי החשבון לאחרים.</li>
              <li>המשתמש מתחייב לעמוד בכל חוק ותקנה חלים בישראל.</li>
              <li>כל תוכן שמועלה לפלטפורמה חייב להיות אמיתי ולא מטעה.</li>
              <li>אסור לבצע שימוש לרעה, פריצה או ניסיון לפגיעה בתשתית הפלטפורמה.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">3. תנאי הזמנות</h2>
            <h3 className="font-semibold text-deep-ocean/80 mb-1 mt-3">מדיניות ביטול</h3>
            <ul className="list-disc list-inside space-y-1 pr-2">
              <li>ביטול עד 48 שעות לפני השיעור — החזר מלא.</li>
              <li>ביטול בין 24 ל-48 שעות לפני השיעור — החזר של 50% ממחיר ההזמנה.</li>
              <li>ביטול פחות מ-24 שעות לפני השיעור — אין החזר.</li>
              <li>ביטול מצד בעל החלל יחויב בהחזר מלא למדריכה ועמלה לפלטפורמה.</li>
            </ul>
            <h3 className="font-semibold text-deep-ocean/80 mb-1 mt-3">תשלום</h3>
            <p>
              התשלום מבוצע דרך שירות Tranzila המאובטח. עמלת הפלטפורמה מחושבת בהתאם לגודל החלל ומנוכית מהסכום המועבר לבעל החלל.
              המדריכה רואה את המחיר הכולל בלבד; בעל החלל רואה את סכום התשלום נטו.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">4. התחייבויות בעלי חללים (Hosts)</h2>
            <ul className="list-disc list-inside space-y-1 pr-2">
              <li>המידע על החלל (תמונות, מיקום, שעות זמינות, מחיר) חייב להיות מדויק ועדכני.</li>
              <li>החלל חייב לעמוד בדרישות הבטיחות, הניקיון וההיגיינה הנדרשות לפעילות גופנית.</li>
              <li>על בעל החלל לוודא שקיים ביטוח מתאים לפעילות בחלל.</li>
              <li>אין לבטל הזמנות מאושרות ללא סיבה מוצדקת. ביטולים חוזרים עלולים להוביל להשעיית החשבון.</li>
              <li>בעל החלל נושא באחריות לתשתיות ולציוד שהוצהר כקיים בחלל.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">5. התחייבויות מדריכות (Instructors)</h2>
            <ul className="list-disc list-inside space-y-1 pr-2">
              <li>על המדריכה להחזיק בתעודות הסמכה רלוונטיות לסוג הפעילות המוצעת.</li>
              <li>חובה לדאוג לביטוח אחריות מקצועית בתוקף.</li>
              <li>על המדריכה לקבל הצהרת בריאות מהמשתתפים לפני כל שיעור.</li>
              <li>יש להגיע לחלל בזמן ולעזוב אותו נקי ומסודר כפי שנמצא.</li>
              <li>אסור להיכנס לחלל מחוץ לשעות ההזמנה המאושרת.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">6. אחריות תלמידות / משתתפות</h2>
            <ul className="list-disc list-inside space-y-1 pr-2">
              <li>על המשתתפת להצהיר בכנות על מצבה הבריאותי לפני כל שיעור.</li>
              <li>ההשתתפות בשיעורי כושר מהווה אחריות אישית. הפלטפורמה, בעלי החללים והמדריכות אינם אחראים לפציעות הנובעות מהשתתפות פעילה.</li>
              <li>יש לפנות לאישור רופא לפני תחילת פעילות גופנית אם קיים ספק רפואי.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">7. שימושים אסורים</h2>
            <ul className="list-disc list-inside space-y-1 pr-2">
              <li>פרסום מידע כוזב, מטעה או הונאה.</li>
              <li>איסוף מידע על משתמשים אחרים ללא הסכמתם.</li>
              <li>שיגור ספאם, הודעות פרסומיות לא מבוקשות.</li>
              <li>ניסיון לעקוף את מנגנון התשלום של הפלטפורמה.</li>
              <li>שימוש בפלטפורמה לפעילות בלתי חוקית מכל סוג.</li>
              <li>העלאת תוכן פוגעני, גזעני, מיני או בלתי הולם.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">8. קניין רוחני</h2>
            <p>
              כל תוכן המופיע בפלטפורמה — לוגו, עיצוב, טקסטים וקוד — הוא קניינה של WELLNESS&amp;SEA, אלא אם צוין אחרת.
              תוכן שמועלה על ידי משתמשים (תמונות, תיאורים) נשאר בבעלות המשתמש,
              אולם המשתמש מעניק לפלטפורמה רשיון לשימוש בו לצרכי תפעול השירות.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">9. הגבלת אחריות</h2>
            <p>
              הפלטפורמה פועלת כמתווכת בין בעלי חללים למדריכות ואינה צד לחוזה ביניהם.
              WELLNESS&amp;SEA אינה אחראית לנזקים ישירים, עקיפים או תוצאתיים הנובעים משימוש בשירות,
              לרבות ביטולי הזמנות, נזקי רכוש, פציעות גופניות או כל נזק אחר.
              האחריות הכוללת של הפלטפורמה לא תעלה על סכום דמי העמלה שנגבו בגין ההזמנה הרלוונטית.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">10. הדין החל וסמכות שיפוט</h2>
            <p>
              תנאים אלו כפופים לדין הישראלי. כל מחלוקת תתברר בבתי המשפט המוסמכים במחוז תל אביב-יפו בלבד.
              הצדדים מסכימים לנסות ליישב מחלוקות תחילה בדרכי פשרה בתוך 30 יום לפני פנייה לבית המשפט.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">11. שינויים בתנאים</h2>
            <p>
              הפלטפורמה רשאית לעדכן תנאים אלו בכל עת. שינויים מהותיים יפורסמו 14 יום מראש.
              המשך השימוש לאחר כניסת השינויים לתוקף מהווה הסכמה אליהם.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-deep-ocean mb-2">12. יצירת קשר</h2>
            <p>
              לשאלות בנוגע לתנאי השימוש, ניתן לפנות אלינו בדוא&quot;ל:{' '}
              <a href="mailto:legal@wellness-and-sea.com" className="text-ocean hover:underline">
                legal@wellness-and-sea.com
              </a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-sand/60 text-center text-xs text-gray-400">
          © 2026 WELLNESS&amp;SEA · כל הזכויות שמורות ·{' '}
          <Link href="/" className="hover:underline">חזרה לדף הבית</Link>
          {' · '}
          <Link href="/privacy-policy" className="hover:underline">מדיניות פרטיות</Link>
        </div>
      </main>
    </div>
  )
}
