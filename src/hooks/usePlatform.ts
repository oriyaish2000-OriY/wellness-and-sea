'use client'

/**
 * usePlatform — React hook for platform detection
 * ================================================
 * Returns platform flags after client-side hydration.
 * Always returns `isNative: false` on first SSR render to prevent
 * hydration mismatch, then updates via useEffect on the client.
 *
 * Usage:
 *   const { isNative, isIOS } = usePlatform()
 *   if (isNative) { // iOS-only UI }
 */

import { useState, useEffect } from 'react'
import { isNativePlatform, isIOS, getPlatform } from '@/lib/platform'

interface PlatformState {
  /** True when running inside Capacitor iOS WebView */
  isNative: boolean
  /** True specifically on iOS device */
  isIOS: boolean
  /** 'ios' | 'android' | 'web' */
  platform: 'ios' | 'android' | 'web'
  /** False during SSR / initial hydration — wait for this before rendering native UI */
  isReady: boolean
}

export function usePlatform(): PlatformState {
  const [state, setState] = useState<PlatformState>({
    isNative: false,
    isIOS: false,
    platform: 'web',
    isReady: false,
  })

  useEffect(() => {
    setState({
      isNative: isNativePlatform(),
      isIOS: isIOS(),
      platform: getPlatform(),
      isReady: true,
    })
  }, [])

  return state
}
