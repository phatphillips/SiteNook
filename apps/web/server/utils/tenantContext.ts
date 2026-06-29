import { getRequestHost, type H3Event } from 'h3'
import type { TenantContext } from '~/types/tenant'
import { parseHostSubdomain } from '~/utils/subdomain'

/** Resolve tenant context in-process (avoids SSR deadlock from internal HTTP fetch). */
export async function resolveTenantContextFromEvent(event: H3Event): Promise<TenantContext> {
  const config = useRuntimeConfig(event)
  const host = getRequestHost(event, { xForwardedHost: true })
  const parsed = parseHostSubdomain(host, config.public.appDomain)

  if (parsed.isApex || !parsed.subdomain) {
    return {
      mode: 'apex',
      subdomain: null,
      organization: null
    }
  }

  const organization = await resolveOrgBySubdomain(parsed.subdomain, event)
  if (!organization) {
    return {
      mode: 'unknown',
      subdomain: parsed.subdomain,
      organization: null
    }
  }

  return {
    mode: 'tenant',
    subdomain: parsed.subdomain,
    organization
  }
}
