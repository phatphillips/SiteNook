import type { H3Event } from 'h3'
import { getRequestURL } from 'h3'

function toQueryString(query: Record<string, string>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    params.set(key, value)
  }
  return params.toString()
}

/**
 * Build a Stripe return URL that works reliably in localhost tenant mode.
 * Stripe returns to localhost first, then the app forwards to tenant.localhost.
 */
export function buildStripeReturnUrl(
  event: H3Event,
  path: string,
  query: Record<string, string>
): string {
  const requestUrl = getRequestURL(event)
  const targetQuery = toQueryString(query)
  const localTarget = `${path}${targetQuery ? `?${targetQuery}` : ''}`
  const host = requestUrl.hostname.toLowerCase()

  if (host.endsWith('.localhost')) {
    const tenant = host.slice(0, -'.localhost'.length)
    const bridgeParams = new URLSearchParams({
      tenant,
      path
    })
    if (targetQuery) {
      bridgeParams.set('query', targetQuery)
    }
    const bridgeOrigin = `${requestUrl.protocol}//localhost${requestUrl.port ? `:${requestUrl.port}` : ''}`
    return `${bridgeOrigin}/stripe-return?${bridgeParams.toString()}`
  }

  return `${requestUrl.origin}${localTarget}`
}
