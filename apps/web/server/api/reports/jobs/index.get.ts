import { createError, getQuery } from 'h3'
import type { ReportJobRecord } from '~/types/reports'
import { requireOrgAccess } from '../../../utils/requireOrgAccess'

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export default defineEventHandler(async (event) => {
  try {
    const { orgId, pb } = await requireOrgAccess(event)
    const query = getQuery(event)
    const page = Math.max(1, Number(query.page || 1))
    const perPage = Math.min(100, Math.max(1, Number(query.perPage || 20)))
    const q = String(query.q || '').trim()

    const filters = [`org = "${orgId}"`]
    if (q) {
      const escaped = escapeFilterValue(q)
      filters.push(`(artifact_name ~ '${escaped}' || status ~ '${escaped}' || format ~ '${escaped}')`)
    }

    const result = await pb.collection('report_jobs').getList(page, perPage, {
      filter: filters.join(' && '),
      sort: '-started_at,-created',
      expand: 'site,requested_by'
    })

    return {
      items: result.items as unknown as ReportJobRecord[],
      total: result.totalItems,
      page,
      perPage
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load report jobs'
    })
  }
})
