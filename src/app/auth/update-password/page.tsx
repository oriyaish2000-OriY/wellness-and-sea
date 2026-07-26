'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Waves, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { updatePassword } from '@/lib/actions/auth'

export default function UpdatePasswordPage() {
  const [state, action, isPending] = useActionState(updatePassword, null)

  return (
    <div className="min-h-screen sand-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 ocean-gradient rounded-full flex items-center justify-center">
              <Waves className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-deep-ocean">
              WELLNESS<span className="text-coral">&</span>SEA
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-deep-ocean mt-4">סיסמה חדשה</h1>
          <p className="text-sm text-gray-500 mt-1">בחרי סיסמה חדשה לחשבון שלך</p>
        </div>

        <Card className="p-6 border-0 shadow-xl">
          <form action={action} className="space-y-4">
            {state?.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 text-right">
                {state.error}
              </div>
            )}
            <div>
              <Label htmlFor="password" className="text-sm">סיסמה חדשה</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="לפחות 8 תווים"
                className="mt-1"
                required
                minLength={8}
                disabled={isPending}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-ocean hover:bg-deep-ocean text-white h-11"
              disabled={isPending}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'עדכני סיסמה'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
