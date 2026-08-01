'use client'

import { useActionState, useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Waves, Loader2, UtensilsCrossed, Dumbbell, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { signUp } from '@/lib/actions/auth'

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 ml-2" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function SignupForm() {
  const searchParams = useSearchParams()
  const urlRole = searchParams.get('role') as 'instructor' | 'host' | 'student' | null
  const nextUrl = searchParams.get('next') ?? ''
  const [role, setRole] = useState<'instructor' | 'host' | 'student'>(urlRole ?? 'instructor')
  const [state, action, isPending] = useActionState(signUp, null)

  // Sync role if URL param changes (e.g. navigating from host flow)
  useEffect(() => {
    if (urlRole && ['instructor', 'host', 'student'].includes(urlRole)) {
      setRole(urlRole)
    }
  }, [urlRole])

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
          <h1 className="text-2xl font-bold text-deep-ocean mt-4">הצטרפות חינמית</h1>
          <p className="text-sm text-gray-500 mt-1">בחרי את סוג החשבון שלך</p>
        </div>

        <Card className="p-6 border-0 shadow-xl">
          {/* Role Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setRole('instructor')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                role === 'instructor'
                  ? 'border-ocean bg-ocean/5 text-ocean'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <Dumbbell className="w-6 h-6" />
              <span className="text-sm font-medium">מדריכת כושר</span>
              <span className="text-xs text-center leading-tight opacity-70">חפשי ובקשי חללים לשיעורים</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('host')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                role === 'host'
                  ? 'border-ocean bg-ocean/5 text-ocean'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <UtensilsCrossed className="w-6 h-6" />
              <span className="text-sm font-medium">בעלת מסעדה</span>
              <span className="text-xs text-center leading-tight opacity-70">פרסמי את החלל שלך וקבלי הכנסה</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('student')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                role === 'student'
                  ? 'border-ocean bg-ocean/5 text-ocean'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <Users className="w-6 h-6" />
              <span className="text-sm font-medium">מתאמנת / תלמידה</span>
              <span className="text-xs text-center leading-tight opacity-70">מצאי שיעורים פעילים והירשמי בקלות</span>
            </button>
          </div>

          <form action={action} className="space-y-4">
            <input type="hidden" name="role" value={role} />
            {nextUrl && <input type="hidden" name="next" value={nextUrl} />}

            {state?.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 text-right">
                {state.error}
              </div>
            )}

            <div>
              <Label htmlFor="full_name" className="text-sm">שם מלא</Label>
              <Input
                id="full_name"
                name="full_name"
                type="text"
                placeholder="שם פרטי ושם משפחה"
                className="text-right mt-1"
                required
                disabled={isPending}
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-sm">אימייל</Label>
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

            <div>
              <Label htmlFor="password" className="text-sm">סיסמה</Label>
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

            <div className="flex items-start gap-2 mt-2">
              <input
                type="checkbox"
                id="terms_accepted"
                name="terms_accepted"
                required
                className="mt-0.5 w-4 h-4 accent-ocean flex-shrink-0"
                disabled={isPending}
              />
              <label htmlFor="terms_accepted" className="text-xs text-gray-500 text-right leading-relaxed">
                קראתי ומסכימה ל<Link href="/terms" className="underline text-ocean">תנאי השימוש</Link> ו<Link href="/privacy-policy" className="underline text-ocean">מדיניות הפרטיות</Link>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full bg-ocean hover:bg-deep-ocean text-white h-11"
              disabled={isPending}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'יצירת חשבון חינמי'}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400">או</span>
            </div>
          </div>

          {/* Route Handler — fixes PKCE cookie timing bug in Next.js 16 */}
          <a href={`/api/auth/google?role=${role}`} className="block w-full">
            <Button variant="outline" className="w-full" type="button">
              <GoogleIcon />
              הצטרפות עם Google
            </Button>
          </a>

        </Card>

        <p className="text-center text-sm text-gray-500 mt-4">
          כבר יש לך חשבון?{' '}
          <Link href="/auth/login" className="text-ocean font-medium hover:underline">
            התחברות
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
