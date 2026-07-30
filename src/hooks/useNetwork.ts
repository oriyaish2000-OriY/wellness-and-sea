'use client'

/**
 * useNetwork — Network status hook with offline banner
 * =====================================================
 * On iOS native: uses @capacitor/network for accurate connectivity detection
 * (more reliable than browser `navigator.onLine` which can give false positives
 * on captive portals and LTE handoffs).
 *
 * On web: falls back to browser `navigator.onLine` + online/offline events.
 *
 * Usage:
 *   const { isOnline, connectionType } = useNetwork()
 *   if (!isOnline) return <OfflineBanner />
 */

import { useState, useEffect } from 'react'
import { isNativePlatform } from '@/lib/platform'

interface NetworkState {
  /** False when the device has no internet connectivity */
  isOnline: boolean
  /** 'wifi' | 'cellular' | 'none' | 'unknown' */
  connectionType: string
}

export function useNetwork(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isOnline: true, // optimistic default — avoids flash of offline UI on load
    connectionType: 'unknown',
  })

  useEffect(() => {
    if (isNativePlatform()) {
      // ── Native iOS: use Capacitor Network plugin ──────────────────────────
      let removeListener: (() => void) | null = null

      async function initNativeNetwork() {
        try {
          const { Network } = await import('@capacitor/network')

          // Get initial status
          const status = await Network.getStatus()
          setState({
            isOnline: status.connected,
            connectionType: status.connectionType,
          })

          // Listen for changes
          const handle = await Network.addListener('networkStatusChange', (s) => {
            setState({ isOnline: s.connected, connectionType: s.connectionType })
          })
          removeListener = () => handle.remove()
        } catch {
          // Plugin unavailable — fall back to browser API
          setState({ isOnline: navigator.onLine, connectionType: 'unknown' })
        }
      }

      initNativeNetwork()
      return () => { removeListener?.() }

    } else {
      // ── Web browser: use navigator.onLine + events ────────────────────────
      function handleOnline() { setState({ isOnline: true, connectionType: 'unknown' }) }
      function handleOffline() { setState({ isOnline: false, connectionType: 'none' }) }

      setState({ isOnline: navigator.onLine, connectionType: 'unknown' })

      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  return state
}
