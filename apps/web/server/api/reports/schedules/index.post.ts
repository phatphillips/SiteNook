import { createError, readBody } from 'h3'
import type { CreateReportSchedulePayload, ReportFormat } from '~/types/reports'
import { requireOrgAccess } from '../../../utils/requireOrgAccess'
import {
  assertRecipientsInOrg,
  assertValidScheduleSections,
  buildScheduleRecordFields,
  resolveScheduleSiteId
} from '../../../utils/reportSchedulePayload'

export default defineEventHandler(async (event) => {
  const { orgId, pb, user } = await requireOrgAccess(event)
  const body = await readBody<CreateReportSchedulePayload>(event)

  const name = String(body.name || '').trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }
  if (body.format !== 'pdf' && body.format !== 'csv') {
    throw createError({ statusCode: 400, statusMessage: 'format must be pdf or csv' })
  }

  assertValidScheduleSections(body.sections, body.format as ReportFormat)

  const includeAllSites = body.includeAllSites !== false
  const siteId = await resolveScheduleSiteId(pb, orgId, includeAllSites, body.siteId)
  const recipientIds = await assertRecipientsInOrg(pb, orgId, body.recipientIds)

  const fields = buildScheduleRecordFields(
    orgId,
    user.id,
    { ...body, name, includeAllSites },
    siteId,
    recipientIds
  )

  return await pb.collection('report_schedules').create(fields)
})
