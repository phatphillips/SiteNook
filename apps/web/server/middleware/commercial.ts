import { isCommercialEnabled } from '../utils/commercial'

const COMMERCIAL_API_PREFIXES = [
  '/api/stripe',
  '/api/billing',
  '/api/licence'
]

/**
 * When SITENOOK_COMMERCIAL is off (OSS default), commercial HTTP APIs 404.
 * Set SITENOOK_COMMERCIAL=1 to re-enable Stripe / Polar / signed-licence routes.
 */
export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  const isCommercialRoute = COMMERCIAL_API_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )
  if (!isCommercialRoute) return
  if (isCommercialEnabled()) return
  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
})
