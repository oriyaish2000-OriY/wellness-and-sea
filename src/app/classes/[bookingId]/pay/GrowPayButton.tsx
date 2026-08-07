'use client'

import { useState } from 'react'
import { Loader2, CreditCard } from 'lucide-react'

export function GrowPayButton({ enrollmentId, amount }: { enrollmentId: string; amount: number }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const handlePay = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout/class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollment_id: enrollmentId }),
      })

      const data = await res.json() as { checkout_url?: string | null; error?: string }

      if (!res.ok) {
        setError(data.error ?? 'שגיאה ביצירת קישור תשלום')
        return
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        setError('לא ניתן ליצור קישור תשלום. נסו שיטת תשלום אחרת.')
      }
    } catch {
      setError('שגיאת רשת. נסו שוב.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full flex items-center gap-4 p-4 rounded-2xl hover:scale-[1.01] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        style={{
          background: 'linear-gradient(135deg, #0d6e6e, #0a4a4a)',
          boxShadow: '0 4px 16px rgba(13,110,110,0.35)',
        }}
      >
        {loading ? (
          <Loader2 className="w-6 h-6 text-white animate-spin mx-auto" />
        ) : (
          <>
            <span className="text-3xl">💳</span>
            <div className="flex-1 text-right">
              <p className="font-black text-white text-base">תשלום מאובטח</p>
              <p className="text-white/70 text-sm">כרטיס אשראי · Apple Pay · Google Pay</p>
              <p className="text-white/90 text-base font-bold mt-0.5">₪{amount}</p>
            </div>
            <CreditCard className="w-5 h-5 text-white/60" />
          </>
        )}
      </button>
      {error && (
        <p className="text-red-500 text-xs text-center mt-2">{error}</p>
      )}
    </div>
  )
}
