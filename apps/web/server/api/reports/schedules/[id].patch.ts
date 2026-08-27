import { createError, getRouterParam, readBody } from 'h3'
import type {
  ReportFormat,
  ReportScheduleRecord,
  UpdateReportSchedulePayload
} from '~/types/reports'
import { requireOrgAccess } from '../../../utils/requireOrgAccess'
import {
  assertRecipientsInOrg,
  assertValidScheduleSections,
  buildScheduleRecordFields,
  normalizeRecipientIds,
  parseScheduleCadence,
  resolveScheduleSiteId
} from '../../../utils/reportSchedulePayload'
import { computeReportScheduleNextRunAt } from '~/utils/reportSchedule'

export default defineEventHandler(async (event) => {
  const { orgId, pb, user } = await requireOrgAccess(event)
  const id = getRouterParam(event, 'id')?.trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing schedule id' })

  const existing = await pb.collection('report_schedules').getOne(id) as unknown as ReportScheduleRecord
  if (String(existing.org || '') !== orgId) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody<UpdateReportSchedulePayload>(event)
  const patch: Record<string, unknown> = {}

  const onlyToggleEnabled = Object.keys(body).length === 1 && typeof body.enabled === 'boolean'
  if (onlyToggleEnabled) {
    patch.enabled = body.enabled
    if (body.enabled && !existing.next_run_at) {
      const cadence = parseScheduleCadence(existing.cadence)
      patch.next_run_at = computeReportScheduleNextRunAt(cadence, {
        runAt: existing.run_at,
        scheduleTime: existing.schedule_time || '09:00',
        timeZone: existing.timezone || 'UTC',
        now: new Date()
      })
    }
    return await pb.collection('report_schedules').update(id, patch)
  }

  const name = body.name !== undefined ? String(body.name || '').trim() : existing.name
  if (!name) throw createError({ statusCode: 400, statusMessage: 'name is required' })

  const format = (body.format ?? existing.format) as ReportFormat
  if (format !== 'pdf' && format !== 'csv') {
    throw createError({ statusCode: 400, statusMessage: 'format must be pdf or csv' })
  }

  const sections = body.sections ?? existing.sections
  assertValidScheduleSections(sections, format)

  const includeAllSites = body.includeAllSites !== undefined
    ? body.includeAllSites !== false
    : existing.include_all_sites !== false
  const siteId = await resolveScheduleSiteId(
    pb,
    orgId,
    includeAllSites,
    body.siteId !== undefined ? body.siteId : existing.site
  )

  const recipientIds = body.recipientIds !== undefined
    ? await assertRecipientsInOrg(pb, orgId, body.recipientIds)
    : normalizeRecipientIds(existing.recipient_ids)

  if (!recipientIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'At least one recipient is required' })
  }

  const cadence = parseScheduleCadence(body.cadence ?? existing.cadence)
  const fields = buildScheduleRecordFields(
    orgId,
    existing.created_by || user.id,
    {
      name,
      format,
      includeAllSites,
      siteId,
      sections,
      cadence,
      runAt: body.runAt !== undefined ? body.runAt : existing.run_at,
      scheduleTime: body.scheduleTime !== undefined ? body.scheduleTime : existing.schedule_time,
      timezone: body.timezone !== undefined ? body.timezone : existing.timezone,
      recipientIds,
      enabled: body.enabled !== undefined ? body.enabled : existing.enabled
    },
    siteId,
    recipientIds
  )

  delete fields.created_by
  return await pb.collection('report_schedules').update(id, fields)
})
