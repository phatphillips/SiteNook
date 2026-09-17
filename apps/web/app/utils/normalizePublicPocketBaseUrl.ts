/**
 * PocketBase JS SDK appends `/api/...` to the base URL.
 * Env docs sometimes set NUXT_PUBLIC_POCKETBASE_URL=/api for nginx, which
 * produces `/api/api/collections/...`. Strip a trailing `/api` so both forms work.
 */
export function normalizePublicPocketBaseUrl(url: string): string {
  const trimmed = String(url || '').trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (trimmed === '/api') return ''
  if (trimmed.endsWith('/api')) {
    const origin = trimmed.slice(0, -4).replace(/\/+$/, '')
    return origin || ''
  }
  return trimmed
}
