import PocketBase from 'pocketbase'
import { createError, getHeader, type H3Event } from 'h3'
import { requirePbUser } from './requirePbUser'
import { requireUserOrganizationId } from '~/utils/orgAccess'
import { resolveServerPocketBaseUrl } from './resolvePbUrl'

function extractAuthToken(event: H3Event): string {
  const header = getHeader(event, 'authorization')?.trim()
  if (!header) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  return token
}

export interface SiteAccessContext {
  user: Awaited<ReturnType<typeof requirePbUser>>
  orgId: string
  pb: PocketBase
  siteId: string
}

/** Verify the authenticated user belongs to the site's organization. */
export async function requireSiteAccess(event: H3Event, siteId: string): Promise<SiteAccessContext> {
  if (!siteId.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'siteId is required' })
  }

  const user = await requirePbUser(event)
  const orgId = requireUserOrganizationId(user)
  const token = extractAuthToken(event)
  const pb = new PocketBase(resolveServerPocketBaseUrl(event))
  pb.autoCancellation(false)
  pb.authStore.save(token, user)

  try {
    const site = await pb.collection('sites').getOne(siteId, {
      fields: 'id,organization,score_denominators,current_a11y,site_settings,default_scan_config'
    }) as { id: string, organization?: string }

    if (site.organization !== orgId) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }

    return { user, orgId, pb, siteId }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 404, statusMessage: 'Site not found' })
  }
}
