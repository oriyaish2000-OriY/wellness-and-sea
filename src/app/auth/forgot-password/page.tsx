'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Waves, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { resetPassword } from '@/lib/actions/auth'

export default function ForgotPasswordPage() {
  const [state, action, isPending] = useActionState(resetPassword, null)

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
          <h1 className="text-2xl font-bold text-deep-ocean mt-4">איפוס סיסמה</h1>
          <p className="text-sm text-gray-500 mt-1">נשלח לך קישור לאיפוס הסיסמה</p>
        </div>

        <Card className="p-6 border-0 shadow-xl">
          {state?.success ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-700 font-medium mb-2">האימייל נשלח!</p>
              <p className="text-sm text-gray-500">{state.success}</p>
              <Link href="/auth/login" className="mt-4 inline-block text-ocean hover:underline text-sm">
                חזרה להתחברות
              </Link>
            </div>
          ) : (
            <form action={action} className="space-y-4">
              {state?.error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 text-right">
                  {state.error}
                </div>
              )}
              <div>
                <Label htmlFor="email" className="text-sm">כתובת אימייל</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  className="text-right mt-1"
                  required
                  disabled={isPending}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-ocean hover:bg-deep-ocean text-white h-11"
                disabled={isPending}
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שלחי קישור לאיפוס'}
              </Button>
            </form>
          )}
        </Card>

        <Link
          href="/auth/login"
          className="flex items-center justify-center gap-1 text-sm text-gray-500 mt-4 hover:text-ocean"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה להתחברות
        </Link>
      </div>
    </div>
  )
}
