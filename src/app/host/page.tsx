import Link from 'next/link'
import { TrendingUp, Shield, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
export default function HostLandingPage() {
  return (
    <div>
      <div className="pt-16">
        {/* Hero */}
        <section className="ocean-gradient py-20 text-center">
          <div className="max-w-4xl mx-auto px-4">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              הפוך שעות בוקר ריקות
              <br />
              <span className="text-golden">ל-₪2,000-4,000 בחודש</span>
            </h1>
            <p className="text-white/80 text-lg max-w-xl mx-auto mb-8">
              המסעדה שלך יכולה להכניס כסף גם כשהמטבח עדיין ישן.
              הצטרף ל-120+ בתי עסק שכבר נהנים מהכנסה פסיבית בוקרית.
            </p>
            <Button
              size="lg"
              className="bg-golden hover:bg-golden/90 text-white text-lg px-10 h-14"
              asChild
            >
              <Link href="/host/list-space">רשום את החלל שלך – חינמי</Link>
            </Button>
            <p className="text-white/50 text-sm mt-3">ללא עמלות מראש. תשלום רק כשמשהו מוזמן.</p>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 bg-cream">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-deep-ocean text-center mb-10">למה WELLNESS&amp;SEA?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: TrendingUp, title: 'הכנסה בשעות המתות', desc: 'ממוצע של ₪280 לשעה לחלל. שיעור יוגה של שעה וחצי = ₪420 ישירות לחשבון שלך.' },
                { icon: Shield, title: 'ביטוח ואחריות', desc: 'כל מדריך חייב ביטוח אחריות מקצועית. אנחנו מוודאים את זה לפני כל הזמנה.' },
                { icon: Clock, title: 'שליטה מלאה', desc: 'אתה מגדיר את השעות, המחיר, הקיבולת והתנאים. ביטול בכל עת ב-24 שעות.' },
              ].map((item) => (
                <Card key={item.title} className="p-6 border-0 shadow-md text-center">
                  <div className="w-12 h-12 ocean-gradient rounded-full flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-deep-ocean mb-2">{item.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How earning works */}
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-deep-ocean text-center mb-10">חישוב ההכנסה שלך</h2>
            <div className="bg-cream rounded-2xl p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                {[
                  { label: 'שיעורים בשבוע', value: '5', suffix: 'שיעורים' },
                  { label: 'מחיר ממוצע לשיעור', value: '₪420', suffix: '(1.5 שעות)' },
                  { label: 'הכנסה חודשית', value: '₪8,400', suffix: 'בממוצע', highlight: true },
                ].map((item) => (
                  <div key={item.label} className={`p-4 rounded-xl ${item.highlight ? 'bg-ocean text-white' : 'bg-white'}`}>
                    <p className={`text-sm mb-1 ${item.highlight ? 'text-white/70' : 'text-gray-500'}`}>{item.label}</p>
                    <p className={`text-2xl font-bold ${item.highlight ? 'text-white' : 'text-deep-ocean'}`}>{item.value}</p>
                    <p className={`text-xs mt-1 ${item.highlight ? 'text-white/60' : 'text-gray-400'}`}>{item.suffix}</p>
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-gray-400 mt-4">
                * חישוב לדוגמה. ההכנסה בפועל תלויה בביקוש, מיקום ומחיר שתגדיר
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-cream text-center">
          <div className="max-w-xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-deep-ocean mb-4">מוכן להתחיל?</h2>
            <p className="text-gray-600 mb-6">הרישום לוקח 5 דקות. תתחיל לקבל הזמנות עוד השבוע.</p>
            <Button size="lg" className="bg-ocean hover:bg-deep-ocean text-white px-10 h-12" asChild>
              <Link href="/host/list-space">רשום את החלל שלך עכשיו</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
