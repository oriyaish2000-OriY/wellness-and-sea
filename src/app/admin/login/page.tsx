/**
 * /admin/login — Admin login form
 *
 * The secret is submitted via POST body (never appears in URL / server logs).
 */

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const { error, next } = await searchParams

  const errorMsg =
    error === 'invalid_secret' ? 'סיסמה שגויה.' :
    error === 'rate_limited'   ? 'יותר מדי ניסיונות — נסה שוב בעוד 15 דקות.' :
    error === 'misconfigured'  ? 'ADMIN_SECRET לא מוגדר.' :
    null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl border shadow-sm p-8 max-w-sm w-full">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Admin Login</h1>
        <p className="text-sm text-gray-500 mb-6">WELLNESS&SEA Dashboard</p>

        {errorMsg && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <form method="POST" action="/api/admin/session" className="space-y-4">
          <input type="hidden" name="next" value={next ?? '/admin/payouts'} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admin Secret
            </label>
            <input
              type="password"
              name="secret"
              required
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="••••••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#0d6e6e' }}
          >
            כניסה
          </button>
        </form>
      </div>
    </div>
  )
}
