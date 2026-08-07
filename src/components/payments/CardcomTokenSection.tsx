'use client'

import { useState } from 'react'
import { CreditCard, CheckCircle2, AlertTriangle, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  hasToken:    boolean
  cardMonth?:  number | null
  cardYear?:   number | null
  role:        'instructor' | 'host'
}

/**
 * Displays Cardcom token registration status.
 * Requires the provider (instructor/host) to register their credit card ONCE
 * so the platform can deduct the 10% commission automatically after each booking.
 *
 * If token missing → booking confirmation is blocked on the server side.
 */
export function CardcomTokenSection({ hasToken, cardMonth, cardYear, role }: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const label      = role === 'instructor' ? 'מדריכה' : 'בעלת חלל'
  const dashPrefix = role === 'instructor' ? 'instructor' : 'host'

  async function handleRegister() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/cardcom/register-token', { method: 'POST' })
      const data = await res.json()
      if (data.registrationUrl) {
        window.location.href = data.registrationUrl
      } else {
        setError(data.error ?? 'שגיאה ביצירת דף הרישום')
        setLoading(false)
      }
    } catch {
      setError('שגיאת רשת — נסי שוב')
      setLoading(false)
    }
  }

  const expiryLabel = (cardMonth && cardYear)
    ? `${String(cardMonth).padStart(2, '0')}/${String(cardYear).padStart(2, '0')}`
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-ocean" />
        <h2 className="text-base font-bold text-deep-ocean">
          {hasToken ? 'כרטיס עמלות רשום ✓' : 'רישום כרטיס לניכוי עמלות'}
        </h2>
      </div>

      {hasToken ? (
        /* ── Token registered ── */
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">כרטיס רשום ופעיל</p>
            {expiryLabel && (
              <p className="text-xs text-green-600 mt-0.5">תוקף: {expiryLabel}</p>
            )}
            <p className="text-xs text-green-700 mt-1">
              עמלת הפלטפורמה (10%) תנוכה אוטומטית לאחר כל הזמנה מאושרת.
            </p>
            <button
              type="button"
              onClick={handleRegister}
              disabled={loading}
              className="text-xs text-ocean underline mt-2 hover:text-deep-ocean transition"
            >
              {loading ? 'מעבד...' : 'עדכון כרטיס'}
            </button>
          </div>
        </div>
      ) : (
        /* ── No token — registration required ── */
        <div className="space-y-3">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">נדרש רישום כרטיס לפני קבלת הזמנות</p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                כ{label}, הפלטפורמה גובה 10% עמלה מכל הזמנה מאושרת ישירות מהכרטיס שלך.
                רישום הכרטיס הוא חד-פעמי ולא יחויב כרגע.
              </p>
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ ללא רישום — הזמנות לא יאושרו.
              </p>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </p>
          )}

          <Button
            type="button"
            onClick={handleRegister}
            disabled={loading}
            className="w-full h-11 bg-ocean hover:bg-deep-ocean text-white font-bold"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin ml-2" /> מכין דף רישום…</>
            ) : (
              <><ShieldCheck className="w-4 h-4 ml-2" /> רשום כרטיס אשראי לעמלות</>
            )}
          </Button>

          <p className="text-center text-xs text-gray-400">
            מאובטח · Cardcom PCI DSS · לא יחויב כרגע
          </p>
        </div>
      )}

      {/* What happens after registration */}
      {!hasToken && (
        <div className="rounded-xl bg-ocean/5 border border-ocean/15 p-3 text-xs text-gray-600 space-y-1 leading-relaxed">
          <p className="font-semibold text-ocean">איך זה עובד:</p>
          <p>1. הכניסי פרטי כרטיס אשראי → נשמר כטוקן מוצפן (ללא חיוב)</p>
          <p>2. כל הזמנה שמאושרת → {role === 'instructor' ? 'המתאמנת' : 'המדריכה'} משלמת לך ישירות</p>
          <p>3. הפלטפורמה מנכה 10% עמלה מהכרטיס שלך אוטומטית</p>
          <p>4. את שומרת 90% מכל הזמנה</p>
        </div>
      )}
    </div>
  )
}
