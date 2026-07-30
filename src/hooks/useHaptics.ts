'use client'

/**
 * useHaptics — Haptic feedback hook (iOS native only)
 * =====================================================
 * Wraps @capacitor/haptics with graceful fallback on web.
 * On web: all calls are silent no-ops — zero errors, zero console noise.
 * On iOS: triggers real UIKit haptic feedback via the Taptic Engine.
 *
 * Usage:
 *   const { impact, notification, selection } = useHaptics()
 *   <button onClick={() => impact('medium')}>Book Now</button>
 */

import { isNativePlatform } from '@/lib/platform'

type ImpactStyle = 'light' | 'medium' | 'heavy'
type NotificationType = 'success' | 'warning' | 'error'

export function useHaptics() {
  /**
   * impact — general-purpose tap feedback
   * Use 'light' for most taps, 'medium' for confirmations, 'heavy' for destructive actions
   */
  async function impact(style: ImpactStyle = 'light') {
    if (!isNativePlatform()) return

    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      const styleMap = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      }
      await Haptics.impact({ style: styleMap[style] })
    } catch {
      // Plugin unavailable (e.g. simulator) — silent fail
    }
  }

  /**
   * notification — semantic feedback for outcomes
   * 'success' for completed booking, 'error' for failed payment, 'warning' for alerts
   */
  async function notification(type: NotificationType = 'success') {
    if (!isNativePlatform()) return

    try {
      const { Haptics, NotificationType: NT } = await import('@capacitor/haptics')
      const typeMap = {
        success: NT.Success,
        warning: NT.Warning,
        error: NT.Error,
      }
      await Haptics.notification({ type: typeMap[type] })
    } catch {
      // Silent fail
    }
  }

  /**
   * selection — subtle feedback for scrolling through lists or selecting options
   */
  async function selection() {
    if (!isNativePlatform()) return

    try {
      const { Haptics } = await import('@capacitor/haptics')
      await Haptics.selectionStart()
      await Haptics.selectionEnd()
    } catch {
      // Silent fail
    }
  }

  return { impact, notification, selection }
}
