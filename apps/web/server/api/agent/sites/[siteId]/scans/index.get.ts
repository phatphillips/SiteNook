import { getRouterParam } from 'h3'
import { requireAgentAuth, requireAgentSiteAccess } from '../../../../../utils/requireAgentAuth'

/** Active / recent queue items for a site. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAgentAuth(event)
  const siteId = getRouterParam(event, 'siteId') ?? ''
  await requireAgentSiteAccess(ctx, siteId)

  let queueItems: Array<Record<string, unknown>> = []
  let scanItems: Array<Record<string, unknown>> = []

  try {
    const queue = await ctx.pb.collection('scan_queue').getList(1, 20, {
      filter: `site = "${siteId}"`,
      sort: '-priority,id',
      fields: 'id,site,scan_type,status,priority'
    })
    queueItems = queue.items as Array<Record<string, unknown>>
  } catch {
    queueItems = []
  }

  try {
    const scans = await ctx.pb.collection('scans').getList(1, 10, {
      filter: `site = "${siteId}"`,
      sort: '-id',
      fields: 'id,site,status,scan_type,pages_crawled,completed_at'
    })
    scanItems = scans.items as Array<Record<string, unknown>>
  } catch {
    scanItems = []
  }

  return {
    queue: queueItems.map((row) => ({
      id: row.id,
      site: row.site,
      scan_type: row.scan_type,
      status: row.status,
      priority: row.priority,
      created: row.created,
      updated: row.updated
    })),
    recent_scans: scanItems.map((row) => ({
      id: row.id,
      site: row.site,
      status: row.status,
      scan_type: row.scan_type,
      pages_crawled: row.pages_crawled,
      created: row.created,
      updated: row.updated,
      completed_at: row.completed_at ?? null
    }))
  }
})
