import { isCommercialEnabled } from '../utils/commercial'

const COMMERCIAL_API_PREFIXES = [
  '/api/stripe',
  '/api/billing',
  '/api/licence'
]

/** Onboarding milestones are OSS — not gated by commercial billing. */
const COMMERCIAL_API_ALLOWLIST = new Set([
  '/api/billing/onboarding-state'
])

/**
 * When SITENOOK_COMMERCIAL is off (OSS default), commercial HTTP APIs 404.
 * Set SITENOOK_COMMERCIAL=1 to re-enable Stripe / Polar / signed-licence routes.
 */
export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  if (COMMERCIAL_API_ALLOWLIST.has(path)) return
  const isCommercialRoute = COMMERCIAL_API_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )
  if (!isCommercialRoute) return
  if (isCommercialEnabled()) return
  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
})
