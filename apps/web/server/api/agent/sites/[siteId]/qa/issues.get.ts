import { createError, getQuery, getRouterParam } from 'h3'
import { requireAgentAuth, requireAgentSiteAccess } from '../../../../../utils/requireAgentAuth'

type QaIssueType = 'broken_links' | 'spelling' | 'policy_matches'

function collectionForType(type: QaIssueType) {
  if (type === 'broken_links') return 'qa_broken_links'
  if (type === 'policy_matches') return 'policy_matches'
  return 'qa_spelling'
}

/** List recent QA issues for a site (paginated). */
export default defineEventHandler(async (event) => {
  const ctx = await requireAgentAuth(event)
  const siteId = getRouterParam(event, 'siteId') ?? ''
  await requireAgentSiteAccess(ctx, siteId)

  const query = getQuery(event)
  const issueType = String(query.type || 'broken_links') as QaIssueType
  if (issueType !== 'broken_links' && issueType !== 'spelling' && issueType !== 'policy_matches') {
    throw createError({ statusCode: 400, statusMessage: 'type must be broken_links, spelling, or policy_matches' })
  }

  const page = Math.max(1, Number(query.page) || 1)
  const perPage = Math.min(100, Math.max(1, Number(query.perPage) || 25))
  const collection = collectionForType(issueType)

  const result = await ctx.pb.collection(collection).getList(page, perPage, {
    filter: `site = "${siteId}"`,
    sort: '-created',
    requestKey: null
  })

  return {
    type: issueType,
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
    items: result.items
  }
})
