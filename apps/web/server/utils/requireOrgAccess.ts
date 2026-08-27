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

export interface OrgAccessContext {
  user: Awaited<ReturnType<typeof requirePbUser>>
  orgId: string
  pb: PocketBase
}

export async function requireOrgAccess(event: H3Event): Promise<OrgAccessContext> {
  const user = await requirePbUser(event)
  const orgId = requireUserOrganizationId(user)
  const token = extractAuthToken(event)
  const pb = new PocketBase(resolveServerPocketBaseUrl(event))
  pb.autoCancellation(false)
  pb.authStore.save(token, user)
  return { user, orgId, pb }
}
