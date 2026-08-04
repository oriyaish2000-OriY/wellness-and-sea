'use client'

import { useState } from 'react'
import { CheckCircle, ChevronDown, Loader2, AlertCircle, CreditCard } from 'lucide-react'

const BANK_OPTIONS = [
  { code: '12', label: 'בנק הפועלים (12)' },
  { code: '10', label: 'בנק לאומי (10)' },
  { code: '11', label: 'בנק דיסקונט (11)' },
  { code: '20', label: 'בנק מזרחי-טפחות (20)' },
  { code: '31', label: 'הבנק הבינלאומי (31)' },
  { code: '04', label: 'בנק יהב (04)' },
  { code: '09', label: 'בנק הדואר (09)' },
  { code: '13', label: 'בנק אגוד (13)' },
  { code: '14', label: 'בנק אוצר החייל (14)' },
  { code: '17', label: 'בנק מרכנתיל דיסקונט (17)' },
  { code: '46', label: 'בנק מסד (46)' },
]

interface Props {
  initialFullName?: string
  initialPhone?: string
  existingMerchantId?: string
}

export function GrowKycForm({ initialFullName = '', initialPhone = '', existingMerchantId }: Props) {
  const [businessType, setBusinessType] = useState<'private' | 'company'>('private')
  const [idNumber,      setIdNumber]      = useState('')
  const [fullName,      setFullName]      = useState(initialFullName)
  const [businessName,  setBusinessName]  = useState('')
  const [phone,         setPhone]         = useState(initialPhone)
  const [bankCode,      setBankCode]      = useState('')
  const [branchNumber,  setBranchNumber]  = useState('')
  const [accountNumber, setAccountNumber] = useState('')

  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(!!existingMerchantId)
  const [merchantId, setMerchantId] = useState(existingMerchantId ?? '')
  const [error,    setError]    = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/grow/register-merchant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessType,
          idNumber,
          fullName,
          businessName: businessType === 'company' ? businessName : undefined,
          phone,
          bankCode,
          branchNumber,
          accountNumber,
        }),
      })

      const data = await res.json() as { ok?: boolean; subMerchantId?: string; error?: string; warning?: string }

      if (!res.ok || !data.ok) {
        setError(data.error ?? 'שגיאה ברישום. נסו שוב.')
        return
      }

      setMerchantId(data.subMerchantId ?? '')
      setSuccess(true)
    } catch {
      setError('שגיאת רשת. בדקו את החיבור ונסו שוב.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Already registered ── */
  if (success) {
    return (
      <div className="flex items-start gap-4 p-5 rounded-2xl"
        style={{ background: 'rgba(92,140,110,0.1)', border: '1.5px solid rgba(92,140,110,0.3)' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(92,140,110,0.15)' }}>
          <CheckCircle className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <p className="font-bold text-green-800 text-sm">מחובר לGrow ✓</p>
          <p className="text-xs text-green-700 mt-0.5">
            קבלת תשלומי כרטיס אשראי מופעלת. תשלומים מועברים לחשבונך ישירות.
          </p>
          {merchantId && (
            <p className="text-xs text-gray-400 mt-1 font-mono">מזהה: {merchantId}</p>
          )}
        </div>
      </div>
    )
  }

  /* ── Registration form ── */
  return (
    <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">

      {/* Info banner */}
      <div className="flex gap-3 p-4 rounded-xl text-sm"
        style={{ background: 'rgba(13,110,110,0.07)', border: '1px solid rgba(13,110,110,0.15)' }}>
        <CreditCard className="w-4 h-4 text-ocean flex-shrink-0 mt-0.5" />
        <p className="text-gray-600 leading-relaxed">
          כדי לקבל תשלומים מכרטיסי אשראי דרך הפלטפורמה, יש לעבור תהליך KYC קצר.
          הפרטים נשמרים בצורה מאובטחת אצל Grow (Meshulam) ולא נשמרים אצלנו.
        </p>
      </div>

      {/* Business type */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">סוג עסק</label>
        <div className="grid grid-cols-2 gap-3">
          {(['private', 'company'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setBusinessType(type)}
              className="py-3 px-4 rounded-xl text-sm font-medium border-2 transition-all"
              style={{
                borderColor: businessType === type ? '#0d6e6e' : '#e5e7eb',
                background:  businessType === type ? 'rgba(13,110,110,0.07)' : 'white',
                color:       businessType === type ? '#0a4a4a' : '#6b7280',
              }}
            >
              {type === 'private' ? '👤 עצמאי/ת' : '🏢 חברה'}
            </button>
          ))}
        </div>
      </div>

      {/* Full name */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">שם מלא</label>
        <input
          type="text"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          required
          placeholder="ישראל ישראלי"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
        />
      </div>

      {/* Business name — only for company */}
      {businessType === 'company' && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">שם החברה</label>
          <input
            type="text"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
            required
            placeholder="חברה בע״מ"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
          />
        </div>
      )}

      {/* ID number */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          {businessType === 'company' ? 'ח.פ. / ע.מ.' : 'תעודת זהות'}
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={idNumber}
          onChange={e => setIdNumber(e.target.value.replace(/\D/g, ''))}
          required
          maxLength={9}
          placeholder={businessType === 'company' ? '500000000' : '012345678'}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">מספר נייד</label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          required
          placeholder="050-0000000"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
          dir="ltr"
        />
      </div>

      {/* Bank details */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">פרטי חשבון בנק</label>
        <div className="space-y-3">

          {/* Bank selector */}
          <div className="relative">
            <select
              value={bankCode}
              onChange={e => setBankCode(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean bg-white"
            >
              <option value="">בחרו בנק</option>
              {BANK_OPTIONS.map(b => (
                <option key={b.code} value={b.code}>{b.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Branch + Account in a row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                type="text"
                inputMode="numeric"
                value={branchNumber}
                onChange={e => setBranchNumber(e.target.value.replace(/\D/g, ''))}
                required
                placeholder="סניף (למשל 001)"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
                dir="ltr"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">מספר סניף</p>
            </div>
            <div>
              <input
                type="text"
                inputMode="numeric"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                required
                placeholder="מספר חשבון"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
                dir="ltr"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">מספר חשבון</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl"
          style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-full font-bold text-white text-sm transition-opacity disabled:opacity-70"
        style={{ background: 'linear-gradient(135deg, #0d6e6e, #0a4a4a)' }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            מעבד רישום...
          </span>
        ) : (
          'הגשת בקשה לקבלת תשלומים'
        )}
      </button>

      <p className="text-xs text-center text-gray-400">
        הפרטים מועברים בצורה מוצפנת לGrow (Meshulam) — ספק סליקה מורשה בישראל
      </p>
    </form>
  )
}
