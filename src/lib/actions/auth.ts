'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(
  _prevState: { error?: string } | null,
  formData: FormData
) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'אימייל או סיסמה שגויים. אנא נסי שוב.' }
  }

  const role = data.user?.user_metadata?.role as string | undefined
  if (role === 'host') redirect('/host-dashboard')
  else if (role === 'instructor') redirect('/instructor-dashboard')
  else redirect('/student-dashboard')
}

export async function signUp(
  _prevState: { error?: string } | null,
  formData: FormData
) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const role = formData.get('role') as 'host' | 'instructor' | 'student'

  const termsAccepted = formData.get('terms_accepted')
  if (!termsAccepted) {
    return { error: 'יש לאשר את תנאי השימוש ומדיניות הפרטיות.' }
  }

  if (!fullName || fullName.trim().length < 2) {
    return { error: 'נא להזין שם מלא (לפחות 2 תווים).' }
  }
  if (password.length < 8) {
    return { error: 'הסיסמה חייבת להכיל לפחות 8 תווים.' }
  }
  if (!['host', 'instructor', 'student'].includes(role)) {
    return { error: 'נא לבחור סוג משתמש.' }
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, full_name: fullName },
    },
  })

  if (error) {
    if (error.message.includes('already registered')) {
      return { error: 'כתובת האימייל הזו כבר רשומה. נסי להתחבר.' }
    }
    return { error: 'שגיאה בהרשמה. אנא נסי שוב.' }
  }

  if (role === 'host') redirect('/host-dashboard')
  else if (role === 'instructor') redirect('/instructor-dashboard')
  else redirect('/student-dashboard')
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const role = formData.get('role') as string | null

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      queryParams: role ? { role } : undefined,
    },
  })

  if (!error && data.url) {
    redirect(data.url)
  }
}

/**
 * signInWithOtp — Email OTP for iOS native (bypasses Apple Guideline 4.8)
 * =========================================================================
 * Step 1: Send a 6-digit one-time code to the user's email.
 * Step 2: User enters the code → call verifyOtp to establish a session.
 *
 * This flow is used on iOS instead of Google Sign-In to comply with
 * Apple Guideline 4.8 (which mandates "Sign in with Apple" if ANY third-party
 * social login is present). By using email OTP exclusively on iOS we have
 * zero social logins on the native app → no Apple sign-in requirement.
 */
export async function sendOtp(
  _prevState: { error?: string; success?: string } | null,
  formData: FormData
): Promise<{ error?: string; success?: string; email?: string }> {
  const supabase = await createClient()
  const email = (formData.get('email') as string)?.trim().toLowerCase()

  if (!email || !email.includes('@')) {
    return { error: 'נא להזין כתובת אימייל תקינה.' }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // shouldCreateUser: false means only existing users can log in via OTP.
      // Set to true if you also want signup via OTP (useful for iOS onboarding).
      shouldCreateUser: true,
      // Auth callback runs in the WebView normally — no custom scheme needed.
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) {
    return { error: 'שגיאה בשליחת הקוד. אנא נסי שוב.' }
  }

  return { success: 'שלחנו קוד אימות לאימייל שלך. הקוד תקף ל-10 דקות.', email }
}

/** Step 2 of OTP flow: verify the 6-digit code and create a session */
export async function verifyOtp(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const token = (formData.get('token') as string)?.trim()

  if (!token || token.length !== 6) {
    return { error: 'נא להזין קוד בן 6 ספרות.' }
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error) {
    return { error: 'הקוד שגוי או פג תוקף. בקשי קוד חדש.' }
  }

  const role = data.user?.user_metadata?.role as string | undefined
  if (role === 'host') redirect('/host-dashboard')
  else if (role === 'instructor') redirect('/instructor-dashboard')
  else redirect('/student-dashboard')

  return {}
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function resetPassword(
  _prevState: { error?: string; success?: string } | null,
  formData: FormData
) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/update-password`,
  })

  if (error) {
    return { error: 'לא הצלחנו לשלוח אימייל לאיפוס. בדקי שהכתובת נכונה.' }
  }

  return { success: 'שלחנו אליך אימייל לאיפוס הסיסמה. בדקי את תיבת הדואר שלך.' }
}

export async function updatePassword(
  _prevState: { error?: string } | null,
  formData: FormData
) {
  const supabase = await createClient()
  const password = formData.get('password') as string

  if (password.length < 8) {
    return { error: 'הסיסמה חייבת להכיל לפחות 8 תווים.' }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: 'שגיאה בעדכון הסיסמה. אנא נסי שוב.' }
  }

  redirect('/instructor-dashboard')
}
