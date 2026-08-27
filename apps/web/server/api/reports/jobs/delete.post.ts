import { createError, readBody } from 'h3'
import type { ReportJobRecord } from '~/types/reports'
import { requireOrgAccess } from '../../../utils/requireOrgAccess'

export default defineEventHandler(async (event) => {
  const { orgId, pb } = await requireOrgAccess(event)
  const body = await readBody<{ ids?: string[] }>(event)
  const ids = Array.isArray(body?.ids)
    ? [...new Set(body.ids.map(id => String(id || '').trim()).filter(Boolean))]
    : []

  if (!ids.length) {
    throw createError({ statusCode: 400, statusMessage: 'At least one report job id is required' })
  }
  if (ids.length > 50) {
    throw createError({ statusCode: 400, statusMessage: 'You can delete at most 50 reports at once' })
  }

  let deleted = 0
  for (const id of ids) {
    let job: ReportJobRecord
    try {
      job = await pb.collection('report_jobs').getOne(id) as unknown as ReportJobRecord
    } catch {
      throw createError({ statusCode: 404, statusMessage: `Report job not found: ${id}` })
    }
    if (String(job.org || '') !== orgId) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }
    await pb.collection('report_jobs').delete(id)
    deleted += 1
  }

  return { ok: true, deleted }
})
