'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function HostDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[HostDashboard Error]', error.message, error.stack)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(224,122,95,0.1)' }}
        >
          <AlertTriangle className="w-8 h-8" style={{ color: '#e07a5f' }} />
        </div>

        <h1 className="text-xl font-bold mb-2" style={{ color: '#0a4a4a' }}>
          אופס, משהו השתבש
        </h1>
        <p className="text-sm text-gray-500 mb-2">
          הלוח נתקל בשגיאה. נסה לרענן את הדף.
        </p>

        {error.message && (
          <div
            className="text-xs text-left mt-3 mb-4 p-3 rounded-lg overflow-auto"
            style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', direction: 'ltr', maxHeight: 120 }}
          >
            {error.message}
            {error.digest && <div className="mt-1 opacity-60">digest: {error.digest}</div>}
          </div>
        )}

        <div className="flex gap-3 justify-center mt-4">
          <Button
            onClick={reset}
            className="text-white font-semibold"
            style={{ background: '#0d6e6e' }}
          >
            <RefreshCw className="w-4 h-4 ml-1.5" />
            נסה שוב
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              <Home className="w-4 h-4 ml-1.5" />
              עמוד הבית
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
