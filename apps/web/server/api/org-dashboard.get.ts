import { createError, getHeader } from 'h3'
import PocketBase from 'pocketbase'
import { requirePbUser } from '../utils/requirePbUser'
import { requireUserOrganizationId } from '~/utils/orgAccess'
import { resolveServerPocketBaseUrl } from '../utils/resolvePbUrl'
import { queryOrgDashboard } from '../utils/orgDashboardQueries'

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event)
  const orgId = requireUserOrganizationId(user)
  const authHeader = getHeader(event, 'authorization')?.trim()
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  try {
    const pb = new PocketBase(resolveServerPocketBaseUrl(event))
    pb.autoCancellation(false)
    pb.authStore.save(token, user)
    const result = await queryOrgDashboard(pb, orgId)
    return result
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load org dashboard'
    })
  }
})
