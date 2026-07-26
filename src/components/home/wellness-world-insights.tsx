// Static section — server component, no 'use client' needed

const STATS = [
  {
    value: '500M+',
    label: 'מתרגלי יוגה ופילאטיס בעולם',
    sub: 'הגידול הגדול ביותר מאז 2012 (Global Wellness Institute)',
    emoji: '🌍',
    color: 'bg-ocean/5 border-ocean/15',
    textColor: 'text-ocean',
  },
  {
    value: '87$B',
    label: 'תיירות וולנס עולמית',
    sub: 'שוק שגדל פי 3 מהתיירות הרגילה בעשור האחרון',
    emoji: '📈',
    color: 'bg-teal/5 border-teal/15',
    textColor: 'text-teal',
  },
  {
    value: '40%',
    label: 'מעדיפים שיעורים בחוץ / ים',
    sub: 'סביבת טבע מגבירה מוטיבציה ב-50% לעומת אולמות סגורים',
    emoji: '🌊',
    color: 'bg-coral/5 border-coral/15',
    textColor: 'text-coral',
  },
  {
    value: '3.5X',
    label: 'שיעורי חזרה גבוהים יותר',
    sub: 'מדריכות שמשתמשות בחללים ייחודיים שומרות 3.5× יותר תלמידים',
    emoji: '🔁',
    color: 'bg-golden/5 border-golden/15',
    textColor: 'text-golden',
  },
]

const DIFFERENTIATORS = [
  {
    icon: '🌅',
    title: 'רק חללי חוף',
    desc: 'בניגוד לאולמות סגורים — אנחנו מתמקדים אך ורק בחוויית הים. כל חלל עם נוף, אוויר ים, ואנרגיה ייחודית.',
  },
  {
    icon: '🍋',
    title: 'בונוסים ייחודיים',
    desc: 'כל הזמנה כוללת בונוס מהמסעדה לתלמידים — מיץ טרי, פרי עונתי, או קפה. בידול שאף פלטפורמה אחרת לא מציעה.',
  },
  {
    icon: '✅',
    title: 'מאומת ומבוטח',
    desc: 'כל חלל עובר בדיקת איכות, ביטוח מלא, ותנאים ברורים. אנחנו ערבים לחוויה — לא רק לחדר.',
  },
  {
    icon: '🤖',
    title: 'AI שמכיר אותך',
    desc: 'הסוכן שלנו לומד את הפרופיל שלך ומציע חללים לפי גודל הקבוצה, השעה, והסגנון שלך.',
  },
]

export function WellnessWorldInsights() {
  return (
    <section className="py-14 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Title */}
        <div className="text-center mb-10">
          <p className="text-xs font-semibold text-ocean uppercase tracking-widest mb-2">מחקר עולמי · בידול הפלטפורמה</p>
          <h2 className="text-2xl font-bold text-deep-ocean">
            למה WELLNESS&SEA שונה?
          </h2>
          <p className="text-gray-500 text-sm mt-2 max-w-lg mx-auto">
            הנתונים מדברים בעד עצמם — מדריכות שמשתמשות בחללי חוף בונות קהילה חזקה יותר
          </p>
        </div>

        {/* Global stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {STATS.map((stat) => (
            <div
              key={stat.value}
              className={`rounded-2xl border p-5 ${stat.color} flex flex-col gap-2`}
            >
              <span className="text-3xl">{stat.emoji}</span>
              <p className={`text-2xl font-bold ${stat.textColor}`}>{stat.value}</p>
              <p className="text-sm font-semibold text-gray-800 leading-tight">{stat.label}</p>
              <p className="text-xs text-gray-400 leading-snug">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Differentiators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {DIFFERENTIATORS.map((d) => (
            <div key={d.title} className="group p-5 rounded-2xl bg-gray-50 hover:bg-ocean/5 border border-transparent hover:border-ocean/15 transition-all">
              <span className="text-3xl mb-3 block">{d.icon}</span>
              <h3 className="font-semibold text-deep-ocean text-sm mb-1.5 group-hover:text-ocean transition-colors">
                {d.title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">{d.desc}</p>
            </div>
          ))}
        </div>

        {/* Source note */}
        <p className="text-center text-xs text-gray-300 mt-8">
          מקורות: Global Wellness Institute 2024, Yoga Alliance World Report, McKinsey Wellness Survey
        </p>
      </div>
    </section>
  )
}
