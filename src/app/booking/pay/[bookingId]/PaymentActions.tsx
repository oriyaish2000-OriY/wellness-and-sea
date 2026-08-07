'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, CreditCard, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from 'lucide-react'

interface Props {
  bookingId: string
  totalPrice: number
  venueTitle: string
  hostPayout: number
  hostBitPhone: string | null
  hostPayboxPhone: string | null
}

type Method = 'bit' | 'paybox' | 'credit' | null

export function PaymentActions({
  bookingId,
  totalPrice,
  venueTitle,
  hostPayout,
  hostBitPhone,
  hostPayboxPhone,
}: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Method>(null)
  const [creditLoading, setCreditLoading] = useState(false)
  const [creditError, setCreditError] = useState<string | null>(null)

  // After clicking a Bit/PayBox deep link — "I've paid" self-report
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportDone, setReportDone] = useState(false)

  const amountFmt = totalPrice.toLocaleString('he-IL')

  // ─── Deep link builders ────────────────────────────────────────────────────
  function buildBitLink(phone: string) {
    const clean = phone.replace(/\D/g, '')
    return `https://www.bitpay.co.il/app/pay?phone=${clean}&amount=${totalPrice}&note=${encodeURIComponent(`הזמנה: ${venueTitle}`)}`
  }

  function buildPayboxLink(phone: string) {
    const clean = phone.replace(/\D/g, '')
    return `https://payboxapp.page.link/?phone=${clean}&amount=${totalPrice}`
  }

  // ─── Credit card via Cardcom ──────────────────────────────────────────────
  async function handleCreditPay() {
    setCreditLoading(true)
    setCreditError(null)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId,
          venue_title: venueTitle,
          total_price: totalPrice,
          host_payout: hostPayout,
        }),
      })
      const data = await res.json()
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        setCreditError(data.error ? `שגיאה: ${data.error}` : 'שגיאה בהפניה לתשלום. נסי שוב.')
        setCreditLoading(false)
      }
    } catch {
      setCreditError('שגיאת רשת. בדקי חיבור לאינטרנט ונסי שוב.')
      setCreditLoading(false)
    }
  }

  // ─── Self-report after Bit/PayBox transfer ─────────────────────────────────
  async function handleMarkPaid(method: 'bit' | 'paybox') {
    setReportLoading(true)
    setReportError(null)
    try {
      const res = await fetch('/api/bookings/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, method }),
      })
      const data = await res.json()
      if (data.ok) {
        setReportDone(true)
        router.push(`/booking/confirm/${bookingId}`)
      } else if (res.status === 402 && data.code === 'HOST_TOKEN_MISSING') {
        setReportError('בעל החלל טרם השלים את תהליך ההרשמה לפלטפורמה. אנא צרי קשר עם התמיכה.')
        setReportLoading(false)
      } else {
        setReportError(data.error ?? 'שגיאה. נסי שוב.')
        setReportLoading(false)
      }
    } catch {
      setReportError('שגיאת רשת. נסי שוב.')
      setReportLoading(false)
    }
  }

  // ─── Method button ─────────────────────────────────────────────────────────
  function MethodButton({
    id,
    icon,
    label,
    sublabel,
    available,
  }: {
    id: Method
    icon: string
    label: string
    sublabel?: string
    available: boolean
  }) {
    const active = selected === id
    return (
      <button
        type="button"
        onClick={() => setSelected(active ? null : id)}
        disabled={!available}
        className={[
          'w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-right',
          active
            ? 'border-ocean bg-ocean/5 shadow-sm'
            : available
              ? 'border-gray-200 bg-white hover:border-ocean/40 hover:bg-ocean/3'
              : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed',
        ].join(' ')}
      >
        <span className="text-3xl leading-none flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm ${active ? 'text-ocean' : 'text-gray-800'}`}>{label}</p>
          {sublabel && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{sublabel}</p>
          )}
          {!available && (
            <p className="text-xs text-gray-400 mt-0.5">לא זמין לחלל זה</p>
          )}
        </div>
        {available && (
          active
            ? <ChevronUp className="w-4 h-4 text-ocean flex-shrink-0" />
            : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>
    )
  }

  // ─── Bit panel ─────────────────────────────────────────────────────────────
  function BitPanel() {
    if (!hostBitPhone) return null
    const link = buildBitLink(hostBitPhone)
    return (
      <div className="rounded-2xl border-2 border-ocean/20 bg-blue-50/60 p-4 space-y-3">
        <div className="text-sm text-gray-700 space-y-1">
          <p>העבירי <strong>₪{amountFmt}</strong> דרך Bit למספר:</p>
          <p className="text-2xl font-black text-deep-ocean tracking-widest dir-ltr text-left">
            {hostBitPhone}
          </p>
          <p className="text-xs text-gray-500">הוסיפי בהערה: {venueTitle}</p>
        </div>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-white text-sm"
          style={{ background: 'linear-gradient(135deg,#2563eb,#3b82f6)' }}
        >
          <span className="text-lg">🔵</span>
          פתחי את אפליקציית Bit
        </a>
        {reportDone ? (
          <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>מעבירה לדף אישור…</span>
          </div>
        ) : (
          <>
            {reportError && (
              <p className="text-xs text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{reportError}
              </p>
            )}
            <button
              type="button"
              onClick={() => handleMarkPaid('bit')}
              disabled={reportLoading}
              className="w-full py-2.5 rounded-xl border-2 border-blue-300 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition disabled:opacity-60"
            >
              {reportLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> מאמתת…
                </span>
              ) : (
                'העברתי את התשלום ✓'
              )}
            </button>
          </>
        )}
      </div>
    )
  }

  // ─── PayBox panel ──────────────────────────────────────────────────────────
  function PayBoxPanel() {
    if (!hostPayboxPhone) return null
    const link = buildPayboxLink(hostPayboxPhone)
    return (
      <div className="rounded-2xl border-2 border-orange-200 bg-orange-50/60 p-4 space-y-3">
        <div className="text-sm text-gray-700 space-y-1">
          <p>העבירי <strong>₪{amountFmt}</strong> דרך PayBox למספר:</p>
          <p className="text-2xl font-black text-deep-ocean tracking-widest dir-ltr text-left">
            {hostPayboxPhone}
          </p>
          <p className="text-xs text-gray-500">הוסיפי בהערה: {venueTitle}</p>
        </div>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-white text-sm"
          style={{ background: 'linear-gradient(135deg,#ea580c,#f97316)' }}
        >
          <span className="text-lg">🟠</span>
          פתחי את אפליקציית PayBox
        </a>
        {reportDone ? (
          <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>מעבירה לדף אישור…</span>
          </div>
        ) : (
          <>
            {reportError && (
              <p className="text-xs text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{reportError}
              </p>
            )}
            <button
              type="button"
              onClick={() => handleMarkPaid('paybox')}
              disabled={reportLoading}
              className="w-full py-2.5 rounded-xl border-2 border-orange-300 text-orange-700 text-sm font-semibold hover:bg-orange-100 transition disabled:opacity-60"
            >
              {reportLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> מאמתת…
                </span>
              ) : (
                'העברתי את התשלום ✓'
              )}
            </button>
          </>
        )}
      </div>
    )
  }

  // ─── Credit card panel ─────────────────────────────────────────────────────
  function CreditPanel() {
    return (
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm text-gray-600">
          תועברי לדף תשלום מאובטח לתשלום ב:
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          {[['💳', 'כרטיס אשראי'], ['🍎', 'Apple Pay'], ['🔍', 'Google Pay']].map(([icon, label]) => (
            <span key={label} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-gray-50 border border-gray-200">
              {icon} {label}
            </span>
          ))}
        </div>
        {creditError && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{creditError}
          </p>
        )}
        <button
          type="button"
          onClick={handleCreditPay}
          disabled={creditLoading}
          className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl font-bold text-white text-sm transition disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#0a3d3d,#0d6e6e)' }}
        >
          {creditLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> מתחבר לדף תשלום…</>
          ) : (
            <><Lock className="w-4 h-4" /> תשלום מאובטח — ₪{amountFmt}</>
          )}
        </button>
        <p className="text-center text-xs text-gray-400">מוצפן ומאובטח · Cardcom PCI DSS</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 font-medium text-center mb-1">בחרי אמצעי תשלום</p>

      {/* Bit */}
      <div>
        <MethodButton
          id="bit"
          icon="🔵"
          label="Bit"
          sublabel={hostBitPhone ? `העברה ישירה למספר ${hostBitPhone}` : undefined}
          available={!!hostBitPhone}
        />
        {selected === 'bit' && <div className="mt-2"><BitPanel /></div>}
      </div>

      {/* PayBox */}
      <div>
        <MethodButton
          id="paybox"
          icon="🟠"
          label="PayBox"
          sublabel={hostPayboxPhone ? `העברה ישירה למספר ${hostPayboxPhone}` : undefined}
          available={!!hostPayboxPhone}
        />
        {selected === 'paybox' && <div className="mt-2"><PayBoxPanel /></div>}
      </div>

      {/* Credit card */}
      <div>
        <MethodButton
          id="credit"
          icon="💳"
          label="כרטיס אשראי / Apple Pay / Google Pay"
          sublabel="תשלום מאובטח דרך Cardcom"
          available={true}
        />
        {selected === 'credit' && <div className="mt-2"><CreditPanel /></div>}
      </div>

      {/* Trust badge */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 pt-1">
        <Lock className="w-3 h-3" />
        <span>תשלום מאובטח · Wellness&amp;Sea</span>
      </div>
    </div>
  )
}
