import { createError, getRouterParam, readBody } from 'h3'
import { requireSiteAccess } from '../../../../../utils/requireSiteAccess'
import { recomputeDashboardRollupsForSite } from '../../../../../utils/dashboardRollups'

type SeoAction = 'dismiss' | 'reopen' | 'fixed'

function mapSeoPatch(action: SeoAction) {
  const now = new Date().toISOString()
  if (action === 'dismiss') return { status: 'dismissed', dismissed_at: now }
  if (action === 'reopen') return { status: 'open', dismissed_at: null, dismiss_reason: '' }
  return { status: 'fixed' }
}

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId') ?? ''
  const { pb } = await requireSiteAccess(event, siteId)
  const body = await readBody<{ issueIds?: string[], action?: SeoAction }>(event)
  const issueIds = Array.isArray(body?.issueIds) ? body.issueIds.filter(Boolean) : []
  const action = body?.action
  if (!issueIds.length || !action) {
    throw createError({ statusCode: 400, statusMessage: 'issueIds and action are required' })
  }
  const patch = mapSeoPatch(action)
  await Promise.all(issueIds.map(id => pb.collection('seo_issues').update(id, patch)))
  await recomputeDashboardRollupsForSite(pb, siteId)
  return { ok: true, updated: issueIds.length }
})
