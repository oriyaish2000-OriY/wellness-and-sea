'use client'

import { useState } from 'react'
import { Loader2, Lock, AlertCircle } from 'lucide-react'

interface Props {
  bookingId:  string
  totalPrice: number
  venueTitle: string
  hostPayout: number
}

export function PaymentActions({ bookingId, totalPrice, venueTitle, hostPayout }: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const amountFmt = totalPrice.toLocaleString('he-IL')

  async function handlePay() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          booking_id:  bookingId,
          venue_title: venueTitle,
          total_price: totalPrice,
          host_payout: hostPayout,
        }),
      })
      const data = await res.json()
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        setError(data.error ? `שגיאה: ${data.error}` : 'שגיאה בהפניה לתשלום. נסי שוב.')
        setLoading(false)
      }
    } catch {
      setError('שגיאת רשת. בדקי חיבור לאינטרנט ונסי שוב.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1.5 px-1">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
        </p>
      )}

      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-white text-base transition disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg,#0a3d3d,#0d6e6e)', boxShadow: '0 4px 16px rgba(13,110,110,0.35)' }}
      >
        {loading ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> מתחבר לדף תשלום…</>
        ) : (
          <><Lock className="w-4 h-4" /> תשלום מאובטח — ₪{amountFmt}</>
        )}
      </button>

      <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-500">
        {[['💳', 'כרטיס אשראי'], ['🍎', 'Apple Pay'], ['🔍', 'Google Pay']].map(([icon, label]) => (
          <span key={label} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-gray-50 border border-gray-200">
            {icon} {label}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 pt-1">
        <Lock className="w-3 h-3" />
        <span>תשלום מאובטח · Cardcom PCI DSS · Wellness&amp;Sea</span>
      </div>
    </div>
  )
}
