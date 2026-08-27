import { getRouterParam } from 'h3'
import { requireAgentAuth, requireAgentSiteAccess } from '../../../../utils/requireAgentAuth'

export default defineEventHandler(async (event) => {
  const ctx = await requireAgentAuth(event)
  const siteId = getRouterParam(event, 'siteId') ?? ''
  const site = await requireAgentSiteAccess(ctx, siteId)

  const full = await ctx.pb.collection('sites').getOne(site.id, {
    fields: 'id,name,url,schedule,schedule_next_run_at,default_scan_config,created,updated'
  })

  return {
    id: full.id,
    name: full.name,
    url: full.url,
    schedule: full.schedule ?? null,
    schedule_next_run_at: full.schedule_next_run_at ?? null,
    default_scan_config: full.default_scan_config ?? null,
    created: full.created,
    updated: full.updated
  }
})
