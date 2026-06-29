export type ParsedHost = {
  host: string
  subdomain: string | null
  isApex: boolean
}

/** Subdomains reserved for infrastructure — not treated as tenant slugs. */
export const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'admin', 'app', 'mail', 'smtp'])

export function normalizeAppDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^\.+|\.+$/g, '')
}

function isValidTenantSubdomain(subdomain: string): boolean {
  return !!subdomain
    && !subdomain.includes('.')
    && !RESERVED_SUBDOMAINS.has(subdomain)
}

/**
 * Extract a tenant subdomain from the request Host header.
 *
 * Examples (appDomain = accessiq.com):
 * - agency.accessiq.com → agency
 * - accessiq.com / www.accessiq.com → apex (null)
 *
 * Dev (appDomain = localhost):
 * - default.localhost → default
 * - localhost / 127.0.0.1 → apex (null)
 */
export function parseHostSubdomain(
  hostHeader: string | undefined | null,
  appDomain: string
): ParsedHost {
  const host = ((hostHeader || '').split(':')[0] ?? '').trim().toLowerCase()
  const domain = normalizeAppDomain(appDomain)

  if (!host) {
    return { host: '', subdomain: null, isApex: true }
  }

  if (host === domain || host === `www.${domain}`) {
    return { host, subdomain: null, isApex: true }
  }

  const domainSuffix = `.${domain}`
  if (domain && host.endsWith(domainSuffix)) {
    const subdomain = host.slice(0, -domainSuffix.length)
    if (isValidTenantSubdomain(subdomain)) {
      return { host, subdomain, isApex: false }
    }
    return { host, subdomain: null, isApex: true }
  }

  if (domain === 'localhost' && host.endsWith('.localhost')) {
    const subdomain = host.slice(0, -'.localhost'.length)
    if (isValidTenantSubdomain(subdomain)) {
      return { host, subdomain, isApex: false }
    }
  }

  if (host === 'localhost' || host === '127.0.0.1') {
    return { host, subdomain: null, isApex: true }
  }

  return { host, subdomain: null, isApex: true }
}
