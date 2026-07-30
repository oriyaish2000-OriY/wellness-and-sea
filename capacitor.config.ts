import { CapacitorConfig } from '@capacitor/cli'

/**
 * CAPACITOR CONFIGURATION — WELLNESS & SEA
 * =========================================
 * Architecture: "Live URL" mode — the iOS app loads the production Vercel
 * deployment inside a native WebView. This preserves all Next.js Server
 * Components, Server Actions, and API routes without requiring a static export.
 *
 * Native plugins (Haptics, Push Notifications, Network) are layered on top
 * of the web content and activate only when running on a real device.
 *
 * To add the iOS platform (requires macOS + Xcode):
 *   npx cap add ios
 *   npx cap sync
 *   npx cap open ios
 */
const config: CapacitorConfig = {
  /** Reverse-domain bundle ID — must match App ID in Apple Developer portal */
  appId: 'com.wellnessandsea.app',

  /** Display name shown under the icon on the Home Screen */
  appName: 'Wellness & Sea',

  /**
   * webDir is required by Capacitor CLI but unused in server.url mode.
   * Point it to `out` so `npx cap sync` doesn't complain; the developer
   * running on Mac can do `npm run build && npx cap sync` if ever switching
   * to static mode.
   */
  webDir: 'out',

  server: {
    /**
     * Live URL — iOS WebView loads this instead of a local bundle.
     * Change to staging URL for TestFlight builds:
     *   url: 'https://wellness-and-sea-git-staging.vercel.app'
     */
    url: 'https://wellness-and-sea.vercel.app',

    /** Never allow cleartext HTTP — App Transport Security requires HTTPS */
    cleartext: false,
  },

  ios: {
    /**
     * Custom URL scheme for deep links (push notification taps, shared links).
     * Registered in Xcode → Info → URL Types → URL Schemes.
     * Does NOT affect auth flow — auth runs via normal HTTPS callbacks in WebView.
     */
    scheme: 'wellness-and-sea',

    /** Content mode of the WKWebView — recommended: mobile */
    contentInset: 'automatic',

    /**
     * Allow Supabase auth cookies to persist across app restarts.
     * Required for session persistence in WKWebView.
     */
    allowsLinkPreview: false,
    scrollEnabled: true,
  },

  plugins: {
    PushNotifications: {
      /**
       * presentationOptions controls how notifications appear when the app
       * is in the foreground. Badge updates the app icon count.
       */
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#1a6b8a',
    },
  },
}

export default config
