import { isMarketingApexPath } from '~/utils/marketingSite'

/** Paths reachable on the apex host when NUXT_PUBLIC_TENANT_ONLY is enabled. */
export const TENANT_ONLY_APEX_PATHS = new Set([
  '/find-account',
  '/sign-in',
  '/signup',
  '/start',
  '/account-not-found',
  '/reset-password'
])

export function parseTenantOnlyFlag(value: unknown): boolean {
  if (value === true) return true
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

/**
 * When tenant-only mode is on, block dashboard and auth pages on the apex host.
 * Dev apex (localhost) is never blocked — see shouldEnforceTenantOnlyApex.
 */
export function resolveTenantOnlyApexRedirect(
  path: string,
  tenantOnly: boolean,
  isApexHost: boolean,
  appDomain: string,
  marketingSite = false
): string | null {
  if (!shouldEnforceTenantOnlyApex(tenantOnly, isApexHost, appDomain)) {
    return null
  }

  if (TENANT_ONLY_APEX_PATHS.has(path)) {
    return null
  }

  if (marketingSite && isMarketingApexPath(path)) {
    return null
  }

  return '/sign-in'
}

/** Production tenant-only applies to non-localhost apex only (dev keeps localhost:3000). */
export function shouldEnforceTenantOnlyApex(
  tenantOnly: boolean,
  isApexHost: boolean,
  appDomain: string
): boolean {
  if (!tenantOnly || !isApexHost) return false
  return appDomain.trim().toLowerCase() !== 'localhost'
}

export function formatTenantLoginExample(appDomain: string): string {
  const domain = appDomain.trim().toLowerCase() || 'accessiq.com'
  return `your-organization.${domain}`
}
