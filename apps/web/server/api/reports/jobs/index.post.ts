import { createError, readBody } from 'h3'
import type { ReportFormat, ReportSectionSelection } from '~/types/reports'
import { requireOrgAccess } from '../../../utils/requireOrgAccess'
import { canSubmitReportSections, hasSelectedReportSections } from '~/utils/reportSections'

type CreateBody = {
  format?: ReportFormat
  siteId?: string
  includeAllSites?: boolean
  sections?: ReportSectionSelection
}

export default defineEventHandler(async (event) => {
  const { orgId, pb, user } = await requireOrgAccess(event)
  const body = await readBody<CreateBody>(event)

  if (body.format !== 'pdf' && body.format !== 'csv') {
    throw createError({ statusCode: 400, statusMessage: 'format must be pdf or csv' })
  }
  if (!hasSelectedReportSections(body.sections)) {
    throw createError({ statusCode: 400, statusMessage: 'At least one section is required' })
  }
  if (!canSubmitReportSections(body.sections, body.format)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'CSV exports require at least one data section. Overview sections are PDF-only.'
    })
  }

  const includeAllSites = body.includeAllSites !== false
  let siteId: string | undefined
  if (!includeAllSites) {
    siteId = body.siteId?.trim()
    if (!siteId) {
      throw createError({ statusCode: 400, statusMessage: 'siteId is required when includeAllSites is false' })
    }
    const site = await pb.collection('sites').getOne(siteId, { fields: 'id,organization' }) as { organization?: string }
    if (site.organization !== orgId) {
      throw createError({ statusCode: 403, statusMessage: 'Site does not belong to your organization' })
    }
  }

  return await pb.collection('report_jobs').create({
    org: orgId,
    site: siteId,
    requested_by: user.id,
    format: body.format,
    include_all_sites: includeAllSites,
    sections: body.sections,
    status: 'pending',
    progress: 0,
    progress_label: 'Queued'
  })
})
