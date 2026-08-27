import { createError, getQuery } from 'h3'
import { requireOrgAccess } from '../../../utils/requireOrgAccess'
import { parseOrgListQuery } from '../../../utils/orgSites'
import { queryOrgSeoIssues } from '../../../utils/orgSeoQueries'

export default defineEventHandler(async (event) => {
  const { orgId, pb } = await requireOrgAccess(event)
  const query = getQuery(event)
  const { page, perPage, siteId, category } = parseOrgListQuery(query as Record<string, unknown>)
  const resolvedCategory = category === 'content' ? 'content' : category === 'technical' ? 'technical' : undefined

  try {
    return await queryOrgSeoIssues(pb, orgId, {
      page,
      perPage,
      siteId,
      category: resolvedCategory
    })
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load org SEO issues'
    })
  }
})
