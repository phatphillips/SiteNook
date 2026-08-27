import { createError, getQuery } from 'h3'
import { requireOrgAccess } from '../../../utils/requireOrgAccess'
import { parseOrgListQuery } from '../../../utils/orgSites'
import { queryOrgReadabilityPages } from '../../../utils/orgReadabilityQueries'
import type { ReadabilityMethodId } from '~/utils/readabilityMethods'

export default defineEventHandler(async (event) => {
  const { orgId, pb } = await requireOrgAccess(event)
  const query = getQuery(event)
  const { page, perPage, siteId } = parseOrgListQuery(query as Record<string, unknown>)
  const methodId = typeof query.methodId === 'string' && query.methodId.trim()
    ? query.methodId.trim() as ReadabilityMethodId
    : undefined
  const bucketId = typeof query.bucketId === 'string' && query.bucketId.trim()
    ? query.bucketId.trim()
    : undefined

  try {
    return await queryOrgReadabilityPages(pb, orgId, {
      page,
      perPage,
      siteId,
      methodId,
      bucketId
    })
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load org readability pages'
    })
  }
})
