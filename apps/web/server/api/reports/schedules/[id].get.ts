import { createError, getRouterParam } from 'h3'
import type { ReportScheduleRecord } from '~/types/reports'
import { requireOrgAccess } from '../../../utils/requireOrgAccess'

export default defineEventHandler(async (event) => {
  const { orgId, pb } = await requireOrgAccess(event)
  const id = getRouterParam(event, 'id')?.trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing schedule id' })

  const schedule = await pb.collection('report_schedules').getOne(id, {
    expand: 'site,created_by,last_job'
  }) as unknown as ReportScheduleRecord

  if (String(schedule.org || '') !== orgId) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return schedule
})
