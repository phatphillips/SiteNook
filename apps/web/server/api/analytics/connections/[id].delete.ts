import {
  requireOrgAdmin,
  requireOrgId,
  sanitizeConnection,
  logAnalyticsActivity
} from '../../../utils/analytics/connections'

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event)
  const organizationId = requireOrgId(user)
  requireOrgAdmin(user)

  const id = getRouterParam(event, 'id')?.trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Connection id is required' })
  }

  const pb = await getPbAdmin(event)
  const connection = await pb.collection('analytics_connections').getOne(id, { expand: 'site' })
  if (String(connection.organization) !== organizationId) {
    throw createError({ statusCode: 403, statusMessage: 'Connection not in your organization' })
  }

  const siteName = (connection.expand as any)?.site?.name || ''

  await pb.collection('analytics_connections').delete(id)

  // Best-effort snapshot cleanup
  try {
    const snaps = await pb.collection('analytics_snapshots').getList(1, 100, {
      filter: `connection = "${id}"`
    })
    for (const snap of snaps.items) {
      await pb.collection('analytics_snapshots').delete(snap.id)
    }
  } catch {
    // connection cascade may already remove snapshots
  }

  await logAnalyticsActivity(event, {
    organizationId,
    actorId: user.id,
    action: 'analytics_disconnected',
    details: {
      provider: connection.provider,
      siteId: connection.site,
      siteName,
      connectionId: id
    }
  })

  return { ok: true, connection: sanitizeConnection(connection as any) }
})
