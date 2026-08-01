'use client'

import { useState } from 'react'
import { Loader2, Lock } from 'lucide-react'

interface Props {
  bookingId: string
  totalPrice: number
  venueTitle: string
  hostPayout: number
}

export function PaymentActions({ bookingId, totalPrice, venueTitle, hostPayout }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePayment = async () => {
    setLoading(true)
    setError(null)
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
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 text-right">{error}</p>
      )}

      {/* Main CTA button */}
      <button
        onClick={handlePayment}
        disabled={loading}
        className="w-full flex items-center gap-4 p-5 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        style={{
          background: 'linear-gradient(135deg, #0a3d3d 0%, #0d6e6e 60%, #0e8080 100%)',
          boxShadow: '0 6px 24px rgba(10,74,74,0.35)',
        }}
      >
        {loading ? (
          <Loader2 className="w-6 h-6 text-white animate-spin flex-shrink-0" />
        ) : (
          <Lock className="w-6 h-6 text-white flex-shrink-0" />
        )}
        <div className="flex-1 text-right">
          <p className="font-black text-white text-lg leading-tight">
            {loading ? 'מתחבר לדף תשלום...' : 'תשלום מאובטח'}
          </p>
          <p className="text-white/70 text-sm mt-0.5">
            ₪{totalPrice.toLocaleString('he-IL')} — חיוב חד פעמי
          </p>
        </div>
        {!loading && (
          <span className="text-white/50 text-sm flex-shrink-0">←</span>
        )}
      </button>

      {/* Supported payment methods */}
      <div className="rounded-xl border border-gray-100 p-4 bg-white/70">
        <p className="text-xs text-gray-500 text-center mb-3">אמצעי תשלום נתמכים</p>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {[
            { icon: '💳', label: 'כרטיס אשראי' },
            { icon: '🔵', label: 'Bit' },
            { icon: '🟠', label: 'PayBox' },
            { icon: '🍎', label: 'Apple Pay' },
            { icon: '🔍', label: 'Google Pay' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="text-base leading-none">{icon}</span>
              <span className="font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trust badge */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mt-1">
        <Lock className="w-3 h-3" />
        <span>מוצפן ומאובטח · מעובד על ידי Grow by Meshulam</span>
      </div>
    </div>
  )
}
