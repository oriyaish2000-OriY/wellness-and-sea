'use client'

/**
 * SUMIT Payments — Custom Card Form
 *
 * Uses SUMIT's JavaScript Payments API (payments.js) for PCI-compliant card
 * tokenization. Card data is sent directly from the browser to SUMIT's servers;
 * our servers never see raw card numbers. SUMIT injects an `og-token`
 * (SingleUseToken) into the form, which is submitted to our checkout endpoint.
 *
 * Flow:
 *   1. User fills card details
 *   2. SUMIT's payments.js intercepts form submit
 *   3. SUMIT tokenizes card data server-side and returns a SingleUseToken
 *   4. payments.js injects <input name="og-token" value="..."> into the form
 *   5. Form POSTs to `action` URL with og-token + hidden fields
 *   6. Our server calls /billing/payments/multivendorcharge/ with the token
 *
 * Required env vars (NEXT_PUBLIC_):
 *   NEXT_PUBLIC_SUMIT_COMPANY_ID       — platform's SUMIT CompanyID
 *   NEXT_PUBLIC_SUMIT_API_PUBLIC_KEY   — public key (NOT the private API key)
 */

import { useEffect, useRef, useState } from 'react'
import { Lock, Loader2, AlertCircle, CreditCard } from 'lucide-react'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jQuery?: any
    OfficeGuy?: {
      Payments: {
        BindFormSubmit: (config: { CompanyID: number; APIPublicKey: string }) => void
      }
    }
  }
}

export interface SumitCardFormProps {
  /** Form action URL — must handle multipart/form-data POST with og-token */
  action: string
  /** Hidden fields to include in the form POST (e.g. booking_id, enrollment_id) */
  hiddenFields: Record<string, string>
  /** Amount to display on the submit button (ILS) */
  amountILS: number
  /** Optional custom button label */
  buttonLabel?: string
}

export function SumitCardForm({
  action,
  hiddenFields,
  amountILS,
  buttonLabel,
}: SumitCardFormProps) {
  const [scriptsReady, setScriptsReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const initDone = useRef(false)

  const companyId  = process.env.NEXT_PUBLIC_SUMIT_COMPANY_ID
  const publicKey  = process.env.NEXT_PUBLIC_SUMIT_API_PUBLIC_KEY

  useEffect(() => {
    if (initDone.current) return
    initDone.current = true

    const loadScript = (src: string): Promise<void> =>
      new Promise((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
        if (existing) {
          // If already appended by a previous render, just wait
          if (existing.dataset.loaded === 'true') { resolve(); return }
          existing.addEventListener('load', () => resolve())
          existing.addEventListener('error', () => reject())
          return
        }
        const el = document.createElement('script')
        el.src = src
        el.onload  = () => { el.dataset.loaded = 'true'; resolve() }
        el.onerror = () => reject(new Error(`Failed to load ${src}`))
        document.head.appendChild(el)
      })

    loadScript('https://code.jquery.com/jquery-3.7.1.min.js')
      .then(() => loadScript('https://app.sumit.co.il/scripts/payments.js'))
      .then(() => {
        const $ = window.jQuery
        const OG = window.OfficeGuy
        if ($ && OG && companyId && publicKey) {
          $(() => {
            OG.Payments.BindFormSubmit({
              CompanyID:    Number(companyId),
              APIPublicKey: publicKey,
            })
          })
          setScriptsReady(true)
        } else {
          setLoadError(true)
        }
      })
      .catch(() => setLoadError(true))
  }, [companyId, publicKey])

  const handleSubmit = () => {
    // SUMIT's BindFormSubmit handles the actual submission.
    // We just show a loading state so the user knows something is happening.
    setSubmitting(true)
  }

  if (loadError) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>לא ניתן לטעון את מערכת התשלומים. אנא רעננו את הדף ונסו שוב.</span>
      </div>
    )
  }

  return (
    <form
      ref={formRef}
      data-og="form"
      method="POST"
      action={action}
      onSubmit={handleSubmit}
      className="space-y-4"
      noValidate
    >
      {/* Hidden entity fields for our server */}
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {/* Card form fields with SUMIT's data-og attributes */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">

        {/* Card number */}
        <div className="px-4 py-3">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">מספר כרטיס</label>
          <input
            type="text"
            data-og="cardnumber"
            inputMode="numeric"
            maxLength={20}
            placeholder="0000 0000 0000 0000"
            className="w-full text-sm font-mono text-gray-900 placeholder-gray-300 focus:outline-none bg-transparent"
            dir="ltr"
            autoComplete="cc-number"
            disabled={submitting}
          />
        </div>

        {/* Expiry + CVV */}
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="col-span-2 px-4 py-3">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">תוקף (MM / YYYY)</label>
            <div className="flex items-center gap-1.5" dir="ltr">
              <input
                type="text"
                data-og="expirationmonth"
                inputMode="numeric"
                maxLength={2}
                placeholder="MM"
                className="w-12 text-sm font-mono text-gray-900 placeholder-gray-300 text-center focus:outline-none bg-transparent"
                autoComplete="cc-exp-month"
                disabled={submitting}
              />
              <span className="text-gray-300 text-sm">/</span>
              <input
                type="text"
                data-og="expirationyear"
                inputMode="numeric"
                maxLength={4}
                placeholder="YYYY"
                className="w-16 text-sm font-mono text-gray-900 placeholder-gray-300 text-center focus:outline-none bg-transparent"
                autoComplete="cc-exp-year"
                disabled={submitting}
              />
            </div>
          </div>
          <div className="px-4 py-3">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">CVV</label>
            <input
              type="text"
              data-og="cvv"
              inputMode="numeric"
              maxLength={4}
              placeholder="•••"
              className="w-full text-sm font-mono text-gray-900 placeholder-gray-300 text-center focus:outline-none bg-transparent"
              autoComplete="cc-csc"
              disabled={submitting}
            />
          </div>
        </div>

        {/* Israeli ID */}
        <div className="px-4 py-3">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">ת.ז. בעל הכרטיס</label>
          <input
            type="text"
            data-og="citizenid"
            inputMode="numeric"
            maxLength={9}
            placeholder="000000000"
            className="w-full text-sm font-mono text-gray-900 placeholder-gray-300 focus:outline-none bg-transparent"
            dir="ltr"
            autoComplete="off"
            disabled={submitting}
          />
        </div>
      </div>

      {/* SUMIT error container — library injects error messages here */}
      <div className="og-errors text-xs text-red-600 empty:hidden" />

      {/* Submit */}
      <button
        type="submit"
        disabled={!scriptsReady || submitting}
        className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-white text-base transition disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          background:  scriptsReady && !submitting
            ? 'linear-gradient(135deg,#0a3d3d,#0d6e6e)'
            : '#94a3b8',
          boxShadow:   scriptsReady && !submitting
            ? '0 4px 16px rgba(13,110,110,0.35)'
            : 'none',
        }}
      >
        {submitting ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> מעבד תשלום…</>
        ) : !scriptsReady ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> טוען מערכת תשלומים…</>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            {buttonLabel ?? `תשלום מאובטח — ₪${amountILS.toLocaleString('he-IL')}`}
          </>
        )}
      </button>

      {/* Trust signals */}
      <div className="flex items-center justify-center gap-4 text-xs text-gray-400 pt-1">
        <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> PCI DSS</span>
        <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> כרטיס אשראי</span>
        <span>Powered by SUMIT</span>
      </div>
    </form>
  )
}
