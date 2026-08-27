import { createError, getRouterParam, readBody } from 'h3'
import { requireSiteAccess } from '../../../../../utils/requireSiteAccess'
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
  const siteId = getRouterParam(event, 'siteId') ?? ''
  const { pb } = await requireSiteAccess(event, siteId)
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

  const collection = collectionForType(issueType)
  const patch = mapQaPatch(issueType, action)
  await Promise.all(issueIds.map(id => pb.collection(collection).update(id, patch)))
  await recomputeDashboardRollupsForSite(pb, siteId)
  return { ok: true, updated: issueIds.length }
})
