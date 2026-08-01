'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

async function markSelfPaid(enrollmentId: string) {
  'use server'
  // This inline server action marks student's enrollment as paid
  // We'll use a fetch call to an API route instead since inline actions in components have limitations
}

export function MarkPaidButton({ enrollmentId }: { enrollmentId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleMark = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/enrollments/mark-paid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enrollment_id: enrollmentId }),
        })
        if (res.ok) {
          router.refresh()
        }
      } catch {
        // silent fail — user can try again
      }
    })
  }

  return (
    <Button
      onClick={handleMark}
      disabled={isPending}
      className="w-full font-bold text-white"
      style={{
        height: 48,
        borderRadius: 50,
        background: 'linear-gradient(135deg, #5c8c6e, #3d7a56)',
        border: 'none',
      }}
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          <CheckCircle className="w-4 h-4 ml-2" />
          סימנתי שהעברתי תשלום
        </>
      )}
    </Button>
  )
}
