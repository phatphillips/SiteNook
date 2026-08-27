import { createError, getRouterParam, readBody } from 'h3'
import { requireAgentAuth, requireAgentSiteAccess, requireAgentWrite } from '../../../../../utils/requireAgentAuth'
import { queuePriorityForPlan } from '~/utils/planQueuePriority'

type ScanType = 'full' | 'accessibility_only' | 'qa_only'

/** Enqueue a scan for a site. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAgentAuth(event)
  requireAgentWrite(ctx)
  const siteId = getRouterParam(event, 'siteId') ?? ''
  await requireAgentSiteAccess(ctx, siteId)

  const body = await readBody<{
    scan_type?: ScanType
    raw_config?: Record<string, unknown>
  }>(event)

  const scanType = body?.scan_type || 'full'
  if (scanType !== 'full' && scanType !== 'accessibility_only' && scanType !== 'qa_only') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid scan_type' })
  }

  let plan: unknown = 'free'
  try {
    const org = await ctx.pb.collection('organizations').getOne(ctx.orgId, { fields: 'id,plan' })
    plan = org.plan
  } catch {
    // default priority
  }

  const requestedBy = ctx.user?.id || ctx.apiKey?.created_by || undefined

  const item = await ctx.pb.collection('scan_queue').create({
    site: siteId,
    scan_type: scanType,
    priority: queuePriorityForPlan(plan),
    requested_by: requestedBy || null,
    status: 'pending',
    raw_config: body?.raw_config ?? {}
  })

  return {
    id: item.id,
    site: siteId,
    scan_type: item.scan_type,
    status: item.status,
    priority: item.priority,
    created: item.created
  }
})
