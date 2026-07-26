'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Waves, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { signIn, signInWithGoogle } from '@/lib/actions/auth'

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

export default function LoginPage() {
  const [state, action, isPending] = useActionState(signIn, null)

  return (
    <div className="min-h-screen flex" style={{ background: '#faf5ee' }}>
      {/* Left panel — brand (hidden on mobile) */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 ocean-gradient p-12 relative overflow-hidden">
        <div className="absolute" style={{ width: 400, height: 400, background: 'rgba(92,140,110,0.18)', borderRadius: '50%', filter: 'blur(80px)', top: -100, left: -100 }} />
        <Link href="/" className="flex items-center gap-2.5 relative z-10">
          <div className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center">
            <Waves className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            WELLNESS<span style={{ color: '#e8b870' }}>&amp;</span>SEA
          </span>
        </Link>
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#e8b870' }}>ברוכה הבאה</p>
          <h2 className="font-black text-white text-3xl leading-tight mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            שיעורי יוגה<br />על קו הים
          </h2>
          <p className="text-white/65 text-sm leading-relaxed">
            הצטרפי לאלפי מדריכות שכבר מחברות עם חללים יוקרתיים על קו החוף.
          </p>
        </div>
        <div className="relative z-10 text-white/40 text-xs">© 2026 WELLNESS&amp;SEA</div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 ocean-gradient rounded-full flex items-center justify-center">
                <Waves className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-deep-ocean" style={{ fontFamily: "'Playfair Display', serif" }}>
                WELLNESS<span className="text-coral">&amp;</span>SEA
              </span>
            </Link>
          </div>

          <h1 className="text-2xl font-black text-deep-ocean mb-1">התחברות</h1>
          <p className="text-sm text-gray-400 mb-7">ברוכה הבאה חזרה</p>

          <Card className="p-6 border-0" style={{ boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius)' }}>
            <form action={action} className="space-y-4">
              {state?.error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 text-right">
                  {state.error}
                </div>
              )}

              <div>
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-ocean">אימייל</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  className="text-right mt-1.5"
                  style={{ background: '#faf5ee', border: '1.5px solid #f0e6d3', borderRadius: 10 }}
                  required
                  disabled={isPending}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Link href="/auth/forgot-password" className="text-xs text-ocean hover:underline">
                    שכחת סיסמה?
                  </Link>
                  <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-ocean">סיסמה</Label>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="הסיסמה שלך"
                  style={{ background: '#faf5ee', border: '1.5px solid #f0e6d3', borderRadius: 10 }}
                  required
                  disabled={isPending}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-ocean hover:bg-deep-ocean text-white font-semibold rounded-full"
                style={{ height: 44 }}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'התחברות'}
              </Button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full" style={{ borderTop: '1px solid #f0e6d3' }} />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 text-gray-400" style={{ background: 'white' }}>או</span>
              </div>
            </div>

            <form action={signInWithGoogle}>
              <Button variant="outline" className="w-full font-medium" style={{ borderRadius: 50, borderColor: '#f0e6d3' }} type="submit" disabled={isPending}>
                <GoogleIcon />
                התחברות עם Google
              </Button>
            </form>
          </Card>

          <p className="text-center text-sm text-gray-500 mt-5">
            אין לך חשבון?{' '}
            <Link href="/auth/signup" className="text-ocean font-semibold hover:underline">
              הצטרפות חינמית
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
