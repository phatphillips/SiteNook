import { createError, getRouterParam } from 'h3'
import type { ReportScheduleRecord } from '~/types/reports'
import {
  computeShareExpiresAt,
  generateReportShareToken
} from '~/utils/reportSchedule'
import { requireOrgAccess } from '../../../../utils/requireOrgAccess'

/** Manually enqueue a report job from a schedule (run now). */
export default defineEventHandler(async (event) => {
  const { orgId, pb, user } = await requireOrgAccess(event)
  const id = getRouterParam(event, 'id')?.trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing schedule id' })

  const schedule = await pb.collection('report_schedules').getOne(id) as unknown as ReportScheduleRecord
  if (String(schedule.org || '') !== orgId) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const shareToken = generateReportShareToken()
  const job = await pb.collection('report_jobs').create({
    org: schedule.org,
    site: schedule.site || undefined,
    requested_by: user.id,
    schedule: schedule.id,
    format: schedule.format,
    include_all_sites: schedule.include_all_sites !== false,
    sections: schedule.sections,
    status: 'pending',
    progress: 0,
    progress_label: 'Queued',
    share_token: shareToken,
    share_expires_at: computeShareExpiresAt()
  })

  await pb.collection('report_schedules').update(schedule.id, {
    last_job: job.id,
    last_run_at: new Date().toISOString()
  })

  return job
})
