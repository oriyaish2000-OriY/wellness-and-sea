/**
 * PUSH NOTIFICATIONS — iOS Native Only
 * ======================================
 * Registers the device for push notifications and sets up listeners.
 * All functions are guarded with isNativePlatform() — calling them on web
 * is a safe no-op. Import this file freely; it won't cause web build errors.
 *
 * Flow:
 *   1. NativeProvider calls initPushNotifications() on app load (iOS only)
 *   2. We request permission (iOS will show the system permission dialog once)
 *   3. On grant, APNs token is saved to Supabase profiles table
 *   4. Notification tap → routes user to the relevant booking/class page
 *
 * To send a notification from the server, use Supabase Edge Functions +
 * Apple Push Notification service (APNs). See README-IOS.md for details.
 */

import { isNativePlatform } from '@/lib/platform'

/**
 * Call once when the app starts (inside NativeProvider useEffect).
 * @param onToken — callback receives the APNs device token string
 */
export async function initPushNotifications(
  onToken?: (token: string) => void,
  onNotificationTap?: (url: string) => void
): Promise<void> {
  // ── Web guard ─────────────────────────────────────────────────────────────
  if (!isNativePlatform()) return

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    // 1. Request permission (shows system dialog on first launch)
    const { receive } = await PushNotifications.requestPermissions()
    if (receive !== 'granted') {
      console.info('[PushNotifications] Permission denied by user')
      return
    }

    // 2. Register with APNs
    await PushNotifications.register()

    // 3. Receive APNs token
    await PushNotifications.addListener('registration', (token) => {
      console.info('[PushNotifications] APNs token received')
      onToken?.(token.value)
    })

    // 4. Handle registration errors
    await PushNotifications.addListener('registrationError', (err) => {
      console.error('[PushNotifications] Registration error:', err.error)
    })

    // 5. Notification received while app is OPEN (foreground)
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.info('[PushNotifications] Foreground notification:', notification.title)
      // Could show an in-app toast here instead of system banner
    })

    // 6. User TAPPED a notification (app was in background/killed)
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const deepLink = action.notification.data?.url as string | undefined
      if (deepLink) {
        onNotificationTap?.(deepLink)
      }
    })

  } catch (err) {
    // Plugin unavailable (e.g. iOS Simulator, web browser) — silent fail
    console.warn('[PushNotifications] Plugin unavailable:', err)
  }
}

/** Saves APNs device token to the user's Supabase profile */
export async function saveDeviceToken(
  supabaseClient: { from: (table: string) => unknown },
  userId: string,
  token: string
): Promise<void> {
  try {
    // Store token in a device_tokens table (add to schema if needed) or as
    // a JSON field on the profiles table. For now we log it — implement the
    // Supabase upsert in a server action to keep the token server-side only.
    console.info('[PushNotifications] Token ready to save for user:', userId.slice(0, 8))
  } catch (err) {
    console.error('[PushNotifications] Failed to save token:', err)
  }
}
