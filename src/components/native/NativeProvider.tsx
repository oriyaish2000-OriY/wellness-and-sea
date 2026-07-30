'use client'

/**
 * NativeProvider — Initialises all Capacitor native features
 * ===========================================================
 * Mounted once in RootLayout. On web browsers, all native initialisations
 * are no-ops (guarded internally by isNativePlatform()). Zero web impact.
 *
 * Responsibilities:
 *   • Initialises push notifications on iOS
 *   • Sets status bar style (dark content on light background)
 *   • Listens for app resume events (re-sync auth session)
 *   • Handles deep link URLs from push notification taps
 *   • Renders an offline banner when network is lost
 *
 * DO NOT add any UI that should appear on the web here.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isNativePlatform } from '@/lib/platform'
import { initPushNotifications } from '@/lib/native/push-notifications'
import { useNetwork } from '@/hooks/useNetwork'

export function NativeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isOnline } = useNetwork()

  useEffect(() => {
    // ── Only runs on iOS device, not on web ──────────────────────────────────
    if (!isNativePlatform()) return

    let cleanup: (() => void)[] = []

    async function initNative() {
      // 1. Push notifications
      await initPushNotifications(
        // onToken: save APNs device token (implement server action when ready)
        (token) => {
          console.info('[Native] APNs token received — length:', token.length)
          // TODO: call savePushToken server action with token
        },
        // onNotificationTap: navigate to deep-linked page
        (url) => {
          // url format: '/booking/abc123' or '/instructor-dashboard'
          router.push(url)
        }
      )

      // 2. Status bar — ensure dark icons on light sand background
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar' as never as string) as never as {
          StatusBar: { setStyle(o: unknown): Promise<void>; setBackgroundColor(o: unknown): Promise<void> }
          Style: { Light: string }
        }
        await StatusBar.setStyle({ style: Style.Light })
        await StatusBar.setBackgroundColor({ color: '#faf5ee' })
      } catch {
        // StatusBar plugin not installed — safe to ignore
      }

      // 3. App lifecycle — re-validate session when app comes back to foreground
      try {
        const { App } = await import('@capacitor/app')
        const handle = await App.addListener('appStateChange', async ({ isActive }) => {
          if (isActive) {
            // Trigger a soft refresh to re-check auth state
            router.refresh()
          }
        })
        cleanup.push(() => handle.remove())
      } catch {
        // Silent fail
      }
    }

    initNative()
    return () => { cleanup.forEach(fn => fn()) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {/* ── Offline banner — renders on BOTH web and native ─────────────────
          Positioned fixed at top so it works on all screen sizes.
          Uses inline styles to avoid Tailwind class purging issues.       */}
      {!isOnline && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: '#1a1a1a',
            color: '#fff',
            textAlign: 'center',
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          אין חיבור לאינטרנט — חלק מהתכונות אינן זמינות
        </div>
      )}

      {children}
    </>
  )
}
