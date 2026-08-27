import { createError, getRouterParam, readBody } from 'h3'
import { requireAgentAuth, requireAgentSiteAccess, requireAgentWrite } from '../../../../../utils/requireAgentAuth'
import { recomputeDashboardRollupsForSite } from '../../../../../utils/dashboardRollups'

type QaIssueType = 'broken_links' | 'spelling' | 'policy_matches'
type QaAction = 'dismiss' | 'reopen' | 'fixed'

function mapQaPatch(type: QaIssueType, action: QaAction) {
  const now = new Date().toISOString()
  if (type === 'broken_links') {
    if (action === 'dismiss') return { status: 'dismissed', dismissed_at: now }
    if (action === 'reopen') return { status: 'broken', dismissed_at: null, dismiss_reason: '' }
    return { status: 'redirected' }
  }
  if (type === 'policy_matches') {
    if (action === 'dismiss') return { status: 'dismissed' }
    if (action === 'reopen') return { status: 'open' }
    return { status: 'fixed' }
  }
  if (action === 'dismiss') return { status: 'dismissed', dismissed_at: now }
  if (action === 'reopen') return { status: 'open', dismissed_at: null, dismiss_reason: '' }
  return { status: 'false_positive' }
}

function collectionForType(type: QaIssueType) {
  if (type === 'broken_links') return 'qa_broken_links'
  if (type === 'policy_matches') return 'policy_matches'
  return 'qa_spelling'
}

export default defineEventHandler(async (event) => {
  const ctx = await requireAgentAuth(event)
  requireAgentWrite(ctx)
  const siteId = getRouterParam(event, 'siteId') ?? ''
  await requireAgentSiteAccess(ctx, siteId)

  const body = await readBody<{
    issueIds?: string[]
    issueType?: QaIssueType
    action?: QaAction
  }>(event)

  const issueIds = Array.isArray(body?.issueIds) ? body.issueIds.filter(Boolean) : []
  const issueType = body?.issueType
  const action = body?.action
  if (!issueIds.length || !issueType || !action) {
    throw createError({ statusCode: 400, statusMessage: 'issueIds, issueType and action are required' })
  }
  if (issueType !== 'broken_links' && issueType !== 'spelling' && issueType !== 'policy_matches') {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported issueType' })
  }
  if (action !== 'dismiss' && action !== 'reopen' && action !== 'fixed') {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported action' })
  }

  const collection = collectionForType(issueType)
  const patch = mapQaPatch(issueType, action)

  await Promise.all(
    issueIds.map(async (id) => {
      const row = await ctx.pb.collection(collection).getOne(id, { fields: 'id,site' })
      if (String(row.site) !== siteId) {
        throw createError({ statusCode: 403, statusMessage: 'Issue does not belong to this site' })
      }
      await ctx.pb.collection(collection).update(id, patch)
    })
  )

  try {
    await recomputeDashboardRollupsForSite(ctx.pb, siteId)
  } catch {
    // Non-fatal
  }

  return { updated: issueIds.length, issueType, action }
})
