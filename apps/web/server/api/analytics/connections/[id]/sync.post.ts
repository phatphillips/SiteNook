import { requireOrgAdmin, requireOrgId } from '../../../../utils/analytics/connections'
import { syncAnalyticsConnection } from '../../../../utils/analytics/sync'

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event)
  const organizationId = requireOrgId(user)
  requireOrgAdmin(user)

  const id = getRouterParam(event, 'id')?.trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Connection id is required' })
  }

  const pb = await getPbAdmin(event)
  const connection = await pb.collection('analytics_connections').getOne(id)
  if (String(connection.organization) !== organizationId) {
    throw createError({ statusCode: 403, statusMessage: 'Connection not in your organization' })
  }

  const result = await syncAnalyticsConnection(event, id, { actorId: user.id })
  return result
})
