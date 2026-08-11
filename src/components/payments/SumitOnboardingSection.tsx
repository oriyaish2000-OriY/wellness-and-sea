'use client'

/**
 * SumitOnboardingSection
 *
 * מדריך הצטרפות עצמאי לספקים (מדריכות / בעלות חלל) לחיבור חשבון SUMIT.
 *
 * פלואו:
 *   loading       → טוען סטטוס מה-API
 *   not_connected → הסבר + שלבים + טופס הזנת פרטים
 *   verifying     → ספינר בזמן אימות מול SUMIT API
 *   verified      → מצב הצלחה — תשלומים פעילים
 *   failed        → שגיאה + אפשרות ניסיון חוזר
 *
 * אבטחה:
 *   - API Key מוזן בשדה סיסמה (לא נחשף אחרי שליחה)
 *   - נשלח רק ל-/api/vendor/sumit/connect (HTTPS)
 *   - לא נשמר ב-state אחרי אימות מוצלח
 */

import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Banknote,
  Eye,
  EyeOff,
  RefreshCw,
  Info,
  LogIn,
  Key,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ── Types ──────────────────────────────────────────────────────────────────────

type OnboardingStatus =
  | 'loading'
  | 'not_connected'
  | 'verifying'
  | 'verified'
  | 'failed'

interface StatusResponse {
  status:            'not_connected' | 'pending' | 'verified' | 'failed'
  sumit_company_id?: number
  last_verified_at?: string
  failure_reason?:   string
}

interface Props {
  role: 'instructor' | 'host'
}

// ── Component ──────────────────────────────────────────────────────────────────

export function SumitOnboardingSection({ role }: Props) {
  const [step,        setStep]        = useState<OnboardingStatus>('loading')
  const [companyIdStr, setCompanyIdStr] = useState('')
  const [apiKey,      setApiKey]      = useState('')
  const [showKey,     setShowKey]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [verifiedId,  setVerifiedId]  = useState<number | null>(null)
  const [verifiedAt,  setVerifiedAt]  = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ companyId?: string; apiKey?: string }>({})

  const roleLabel   = role === 'instructor' ? 'מדריכה'    : 'בעלת חלל'
  const payerLabel  = role === 'instructor' ? 'מתאמנות'   : 'מדריכות'
  const amountLabel = role === 'instructor' ? 'מהשיעור'   : 'מהשכרת החלל'

  // ── טעינת סטטוס בעלייה ──────────────────────────────────────────────────────
  const loadStatus = useCallback(async () => {
    setStep('loading')
    setError(null)
    try {
      const res = await fetch('/api/vendor/sumit/status')
      if (!res.ok) { setStep('not_connected'); return }
      const data: StatusResponse = await res.json()

      if (data.status === 'verified') {
        setVerifiedId(data.sumit_company_id ?? null)
        setVerifiedAt(data.last_verified_at ?? null)
        setStep('verified')
      } else if (data.status === 'failed') {
        setError(data.failure_reason ?? 'האימות נכשל — אנא נסי שוב')
        setVerifiedId(data.sumit_company_id ?? null)
        setStep('failed')
      } else {
        setStep('not_connected')
      }
    } catch {
      setStep('not_connected')
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  // ── וולידציית שדות ──────────────────────────────────────────────────────────
  function validateFields(): boolean {
    const errs: { companyId?: string; apiKey?: string } = {}
    const parsed = parseInt(companyIdStr.trim(), 10)
    if (!companyIdStr.trim() || isNaN(parsed) || parsed <= 0) {
      errs.companyId = 'הזיני מזהה חברה תקין (מספר חיובי)'
    }
    if (!apiKey.trim() || apiKey.trim().length < 10 || apiKey.trim().length > 500) {
      errs.apiKey = 'מפתח ה-API חייב להיות בין 10 ל-500 תווים'
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── שליחת פרטים לאימות ──────────────────────────────────────────────────────
  async function handleConnect() {
    if (!validateFields()) return
    setStep('verifying')
    setError(null)

    const parsed = parseInt(companyIdStr.trim(), 10)
    try {
      const res = await fetch('/api/vendor/sumit/connect', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          sumit_company_id: parsed,
          sumit_api_key:    apiKey.trim(),
        }),
      })
      const data = await res.json()

      if (res.ok && data.status === 'verified') {
        setApiKey('')   // מחיקת המפתח מה-state
        setVerifiedId(parsed)
        setVerifiedAt(new Date().toISOString())
        setStep('verified')
      } else {
        setError(data.message ?? data.error ?? 'אימות נכשל — בדקי את הפרטים')
        setStep('failed')
      }
    } catch {
      setError('שגיאת רשת — בדקי את החיבור ונסי שוב')
      setStep('failed')
    }
  }

  // ── איפוס לטופס ─────────────────────────────────────────────────────────────
  function handleRetry() {
    setError(null)
    setFieldErrors({})
    setStep('not_connected')
  }

  // ── תצוגה ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* כותרת */}
      <div className="flex items-center gap-2">
        <Banknote className="w-5 h-5 text-ocean" />
        <h2 className="text-base font-bold text-deep-ocean">
          {step === 'verified' ? 'קבלת תשלומים פעילה ✓' : 'הגדרת קבלת תשלומים — SUMIT'}
        </h2>
      </div>

      {/* ── טעינה ── */}
      {step === 'loading' && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-ocean" />
        </div>
      )}

      {/* ── אימות בתהליך ── */}
      {step === 'verifying' && (
        <div className="rounded-xl border border-ocean/20 bg-ocean/5 p-6 flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-ocean" />
          <p className="text-sm font-semibold text-deep-ocean">מאמתת פרטי חשבון מול SUMIT…</p>
          <p className="text-xs text-gray-500">תהליך זה אורך מספר שניות</p>
        </div>
      )}

      {/* ── מאומת ומחובר ── */}
      {step === 'verified' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800">חשבון SUMIT מחובר ופעיל</p>
              {verifiedId && (
                <p className="text-xs text-green-600 mt-0.5">Company ID: {verifiedId}</p>
              )}
              {verifiedAt && (
                <p className="text-xs text-green-600 mt-0.5">
                  אומת:{' '}
                  {new Date(verifiedAt).toLocaleDateString('he-IL', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                  })}
                </p>
              )}
              <p className="text-xs text-green-700 mt-2 leading-relaxed">
                תשלומים מ{payerLabel} מועברים לחשבון SUMIT שלך אוטומטית לאחר כל {amountLabel}.
                עמלת הפלטפורמה (5%) מנוכה אוטומטית.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-ocean/5 border border-ocean/15 p-3 text-xs text-gray-600 space-y-1 leading-relaxed">
            <p className="font-semibold text-ocean">תהליך התשלום:</p>
            <p>① {payerLabel.charAt(0).toUpperCase() + payerLabel.slice(1)} משלמות → כסף מגיע לפלטפורמה</p>
            <p>② הפלטפורמה מעבירה 95% לחשבון SUMIT שלך</p>
            <p>③ 5% נשמר כעמלת שירות</p>
          </div>

          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-1.5 text-xs text-ocean underline hover:text-deep-ocean transition"
          >
            <RefreshCw className="w-3 h-3" />
            עדכון פרטי חשבון
          </button>
        </div>
      )}

      {/* ── אימות נכשל ── */}
      {step === 'failed' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">האימות נכשל</p>
              <p className="text-xs text-red-700 mt-1 leading-relaxed">
                {error ?? 'בדקי שה-Company ID ומפתח ה-API נכונים ונסי שוב.'}
              </p>
              <p className="text-xs text-red-600 mt-1">
                ודאי שהשתמשת ב-<strong>מפתח פרטי (Private API Key)</strong> ולא במפתח ציבורי.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleRetry}
            className="w-full h-10 bg-ocean hover:bg-deep-ocean text-white font-semibold text-sm"
          >
            <RefreshCw className="w-4 h-4 ml-2" />
            נסי שוב
          </Button>
        </div>
      )}

      {/* ── לא מחובר — הוראות + טופס ── */}
      {step === 'not_connected' && (
        <div className="space-y-4">

          {/* באנר אזהרה */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                נדרש חיבור SUMIT לקבלת תשלומים
              </p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                כ{roleLabel}, כל תשלום מועבר ישירות לחשבון SUMIT שלך.
                ללא חיבור — לא ניתן לאשר הזמנות חדשות.
              </p>
            </div>
          </div>

          {/* שלב 1 — התחברות / הרשמה ל-SUMIT */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
            <p className="text-xs font-bold text-deep-ocean flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ocean text-white text-[10px] font-bold flex-shrink-0">
                1
              </span>
              <LogIn className="w-3.5 h-3.5 text-ocean" />
              התחברי ל-SUMIT (או פתחי חשבון חינמי)
            </p>
            <p className="text-xs text-gray-600 leading-relaxed pr-7">
              SUMIT היא מערכת חשבונאות ישראלית דרכה תקבלי את התשלומים.
              אם אין לך חשבון — לחצי על הקישור ובחרי <strong>הרשמה</strong>.
              פתיחת חשבון בסיסי <strong>חינמית לחלוטין</strong>.
            </p>
            <a
              href="https://app.sumit.co.il/users/login/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ocean underline hover:text-deep-ocean transition pr-7"
            >
              <ExternalLink className="w-3 h-3" />
              כניסה / הרשמה ל-SUMIT ←
            </a>
          </div>

          {/* שלב 2 — הגדרת ספק */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
            <p className="text-xs font-bold text-deep-ocean flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ocean text-white text-[10px] font-bold flex-shrink-0">
                2
              </span>
              <Key className="w-3.5 h-3.5 text-ocean" />
              קבלי את מפתח ה-API מהחשבון שלך
            </p>
            <p className="text-xs text-gray-600 leading-relaxed pr-7">
              בתוך SUMIT: לחצי על <strong>הגדרות</strong> (שם המשתמש למעלה) ← <strong>API</strong>.
            </p>
            <p className="text-xs text-gray-600 leading-relaxed pr-7">
              העתיקי שני פרטים:
            </p>
            <ul className="text-xs text-gray-600 pr-7 space-y-0.5 list-disc list-inside">
              <li><strong>מזהה חברה (Company ID)</strong> — מספר, לדוגמה: 1234567</li>
              <li><strong>מפתח פרטי (Private API Key)</strong> — מחרוזת ארוכה</li>
            </ul>
            <p className="text-xs text-amber-700 pr-7 mt-1">
              ⚠️ ודאי שהעתקת את ה<strong>מפתח הפרטי</strong> ולא את הציבורי.
            </p>
          </div>

          {/* שלב 3 — הזנת פרטים */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-deep-ocean flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ocean text-white text-[10px] font-bold flex-shrink-0">
                3
              </span>
              <Send className="w-3.5 h-3.5 text-ocean" />
              הזיני את הפרטים וחברי את החשבון
            </p>

            {/* Company ID */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                מזהה חברה (Company ID)
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={companyIdStr}
                onChange={(e) => {
                  setCompanyIdStr(e.target.value)
                  setFieldErrors((prev) => ({ ...prev, companyId: undefined }))
                }}
                placeholder="לדוגמה: 1234567"
                className={`w-full h-10 px-3 rounded-lg border text-sm bg-white text-right
                  focus:outline-none focus:ring-2 focus:ring-ocean/40 transition
                  ${fieldErrors.companyId ? 'border-red-400' : 'border-gray-300'}`}
              />
              {fieldErrors.companyId && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.companyId}</p>
              )}
            </div>

            {/* Private API Key */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                מפתח פרטי (Private API Key)
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    setFieldErrors((prev) => ({ ...prev, apiKey: undefined }))
                  }}
                  placeholder="הדבקי את המפתח הפרטי מ-SUMIT"
                  autoComplete="off"
                  dir="ltr"
                  className={`w-full h-10 pr-3 pl-10 rounded-lg border text-sm bg-white
                    focus:outline-none focus:ring-2 focus:ring-ocean/40 transition
                    ${fieldErrors.apiKey ? 'border-red-400' : 'border-gray-300'}`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showKey ? 'הסתרת מפתח' : 'הצגת מפתח'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.apiKey && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.apiKey}</p>
              )}
            </div>

            {/* הערת אבטחה */}
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 p-2.5">
              <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 leading-relaxed">
                הפרטים מוצפנים ונשמרים בשרת בלבד. המפתח משמש אך ורק להעברת תשלומים לחשבונך ואינו נחשף לאיש.
              </p>
            </div>

            {/* כפתור שליחה */}
            <Button
              type="button"
              onClick={handleConnect}
              className="w-full h-11 bg-ocean hover:bg-deep-ocean text-white font-bold"
            >
              <ShieldCheck className="w-4 h-4 ml-2" />
              אמתי וחברי את חשבון SUMIT
            </Button>

            <p className="text-center text-xs text-gray-400">
              מאובטח · SUMIT API · הפרטים לא נחשפים לאף גורם
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
