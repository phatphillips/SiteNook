import { createError, getQuery } from 'h3'
import type { ReportScheduleRecord } from '~/types/reports'
import { requireOrgAccess } from '../../../utils/requireOrgAccess'

function pocketBaseStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  if ('status' in error && typeof (error as { status: unknown }).status === 'number') {
    return (error as { status: number }).status
  }
  if ('statusCode' in error && typeof (error as { statusCode: unknown }).statusCode === 'number') {
    return (error as { statusCode: number }).statusCode
  }
  return undefined
}

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
      filters.push(`(name ~ '${escaped}' || format ~ '${escaped}' || cadence ~ '${escaped}')`)
    }

    const result = await pb.collection('report_schedules').getList(page, perPage, {
      filter: filters.join(' && '),
      sort: '-updated,-next_run_at',
      expand: 'site,created_by,last_job'
    })

    return {
      items: result.items as unknown as ReportScheduleRecord[],
      total: result.totalItems,
      page,
      perPage
    }
  } catch (error) {
    const status = pocketBaseStatus(error)
    if (status === 404) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Report schedules are not available yet. Restart PocketBase to apply migrations.'
      })
    }
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({
      statusCode: status && status >= 400 ? status : 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load report schedules'
    })
  }
})
