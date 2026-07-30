/**
 * PLATFORM DETECTION UTILITIES
 * ==============================
 * SSR-safe helpers for distinguishing web vs. native iOS context.
 *
 * IMPORTANT: All functions return `false` during server-side rendering.
 * Use these only inside `useEffect`, event handlers, or client components
 * after hydration. Never use them to conditionally skip a Server Component.
 *
 * How it works:
 *   When the Capacitor runtime initialises on iOS it sets:
 *     window.Capacitor.isNativePlatform() → true
 *     window.Capacitor.getPlatform()      → 'ios'
 *   On plain browser or SSR these are undefined → we return false safely.
 */

/** True only inside the Capacitor iOS WebView — never on the web browser */
export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false // SSR guard
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(window as any).Capacitor?.isNativePlatform?.()
}

/** True only when running on iOS specifically (not Android) */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).Capacitor?.getPlatform?.() === 'ios'
}

/** True in any browser (web or iOS WebView) — useful for browser-only APIs */
export function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

/**
 * Returns the current platform label for logging / analytics.
 * Possible values: 'ios' | 'android' | 'web'
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).Capacitor?.getPlatform?.() ?? 'web'
}
