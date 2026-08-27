import { requireAgentAuth } from '../../../utils/requireAgentAuth'

/** List sites in the authenticated organization. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAgentAuth(event)

  const items = await ctx.pb.collection('sites').getFullList({
    filter: `organization = "${ctx.orgId}"`,
    fields: 'id,name,url,schedule,schedule_next_run_at,created,updated',
    sort: 'name',
    requestKey: null
  })

  return {
    items: items.map((site) => ({
      id: site.id,
      name: site.name,
      url: site.url,
      schedule: site.schedule ?? null,
      schedule_next_run_at: site.schedule_next_run_at ?? null,
      created: site.created,
      updated: site.updated
    }))
  }
})
