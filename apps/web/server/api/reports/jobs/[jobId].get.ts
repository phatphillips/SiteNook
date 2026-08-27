import { createError, getRouterParam } from 'h3'
import type { ReportJobRecord } from '~/types/reports'
import { requireOrgAccess } from '../../../utils/requireOrgAccess'

export default defineEventHandler(async (event) => {
  const { orgId, pb } = await requireOrgAccess(event)
  const jobId = getRouterParam(event, 'jobId')?.trim()
  if (!jobId) throw createError({ statusCode: 400, statusMessage: 'Missing report job id' })

  let job: ReportJobRecord
  try {
    job = await pb.collection('report_jobs').getOne(jobId, { expand: 'site,requested_by' }) as unknown as ReportJobRecord
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Report job not found' })
  }
  if (job.org !== orgId) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  return job
})
