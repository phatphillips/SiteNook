import { createError } from 'h3'
import type {
  CreateReportSchedulePayload,
  ReportFormat,
  ReportScheduleCadence,
  ReportSectionSelection
} from '~/types/reports'
import { canSubmitReportSections, hasSelectedReportSections } from '~/utils/reportSections'
import { computeReportScheduleNextRunAt } from '~/utils/reportSchedule'

const CADENCES = new Set<ReportScheduleCadence>(['once', 'daily', 'weekly', 'monthly', 'every_5d'])

export function normalizeRecipientIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const ids: string[] = []
  for (const value of raw) {
    const id = String(value || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

export function assertValidScheduleSections(
  sections: ReportSectionSelection | undefined,
  format: ReportFormat
): void {
  if (!hasSelectedReportSections(sections)) {
    throw createError({ statusCode: 400, statusMessage: 'At least one section is required' })
  }
  if (!canSubmitReportSections(sections, format)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'CSV exports require at least one data section. Overview sections are PDF-only.'
    })
  }
}

export function parseScheduleCadence(value: unknown): ReportScheduleCadence {
  const cadence = String(value || '').trim() as ReportScheduleCadence
  if (!CADENCES.has(cadence)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid schedule cadence' })
  }
  return cadence
}

export async function assertRecipientsInOrg(
  pb: { collection: (name: string) => { getOne: (id: string, opts?: object) => Promise<{ organization?: string }> } },
  orgId: string,
  recipientIds: string[]
): Promise<string[]> {
  const ids = normalizeRecipientIds(recipientIds)
  if (!ids.length) {
    throw createError({ statusCode: 400, statusMessage: 'At least one recipient is required' })
  }

  for (const id of ids) {
    let user: { organization?: string }
    try {
      user = await pb.collection('users').getOne(id, { fields: 'id,organization' })
    } catch {
      throw createError({ statusCode: 400, statusMessage: `Recipient not found: ${id}` })
    }
    if (String(user.organization || '') !== orgId) {
      throw createError({ statusCode: 403, statusMessage: 'Recipients must belong to your organization' })
    }
  }
  return ids
}

export async function resolveScheduleSiteId(
  pb: { collection: (name: string) => { getOne: (id: string, opts?: object) => Promise<{ organization?: string }> } },
  orgId: string,
  includeAllSites: boolean,
  siteId?: string
): Promise<string | undefined> {
  if (includeAllSites) return undefined
  const id = siteId?.trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'siteId is required when includeAllSites is false' })
  }
  const site = await pb.collection('sites').getOne(id, { fields: 'id,organization' })
  if (site.organization !== orgId) {
    throw createError({ statusCode: 403, statusMessage: 'Site does not belong to your organization' })
  }
  return id
}

export function buildScheduleRecordFields(
  orgId: string,
  userId: string,
  payload: CreateReportSchedulePayload,
  siteId: string | undefined,
  recipientIds: string[]
): Record<string, unknown> {
  const cadence = parseScheduleCadence(payload.cadence)
  const scheduleTime = (payload.scheduleTime || '09:00').trim() || '09:00'
  const timezone = (payload.timezone || 'UTC').trim() || 'UTC'
  const runAt = payload.runAt?.trim() || undefined
  const nextRunAt = computeReportScheduleNextRunAt(cadence, {
    runAt,
    scheduleTime,
    timeZone: timezone,
    now: new Date()
  })

  return {
    org: orgId,
    site: siteId,
    created_by: userId,
    name: payload.name.trim(),
    format: payload.format,
    include_all_sites: payload.includeAllSites !== false,
    sections: payload.sections,
    cadence,
    run_at: cadence === 'once' ? (runAt || nextRunAt) : null,
    schedule_time: scheduleTime,
    timezone,
    next_run_at: nextRunAt,
    recipient_ids: recipientIds,
    enabled: payload.enabled !== false
  }
}
