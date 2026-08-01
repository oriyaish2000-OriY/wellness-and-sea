'use client'

import { useState } from 'react'
import { CreditCard, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  bookingId: string
  totalPrice: number
  venueTitle: string
  hostPayout: number
}

export function PaymentActions({ bookingId, totalPrice, venueTitle, hostPayout }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCardPayment = async () => {
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
          instructor_id: '', // server verifies from session
        }),
      })

      const data = await res.json()

      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        setError('שגיאה בהפניה לתשלום. נסי שוב.')
        setLoading(false)
      }
    } catch {
      setError('שגיאת רשת. בדקי חיבור ונסי שוב.')
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-3 text-right">{error}</p>
      )}
      <button
        onClick={handleCardPayment}
        disabled={loading}
        className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: 'linear-gradient(135deg, #0a4a4a, #0d6e6e)', boxShadow: '0 4px 16px rgba(10,74,74,0.3)' }}
      >
        {loading ? (
          <Loader2 className="w-6 h-6 text-white animate-spin flex-shrink-0" />
        ) : (
          <CreditCard className="w-6 h-6 text-white flex-shrink-0" />
        )}
        <div className="flex-1 text-right">
          <p className="font-black text-white text-base">תשלום בכרטיס אשראי</p>
          <p className="text-white/70 text-sm">Bit · Google Pay · Apple Pay</p>
          <p className="text-white/90 text-base font-bold mt-0.5">₪{totalPrice}</p>
        </div>
        <div className="text-white/60 text-xs flex-shrink-0">מאובטח →</div>
      </button>
      <p className="text-xs text-center text-gray-400 mt-2">מעובד על ידי Tranzila · מוצפן ומאובטח</p>
    </div>
  )
}
