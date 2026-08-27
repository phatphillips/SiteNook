import type PocketBase from 'pocketbase'
import { getPocketBase, isPocketBaseConnectionError, resetPocketBaseClient } from '../db/pocketbaseClient.js'
import {
  computeShareExpiresAt,
  generateReportShareToken,
  notifyReportReadyEmail
} from '../scheduler/reportScheduleScheduler.js'
import { READABILITY_METHOD_IDS, type ReadabilityMethodId } from '../qa/readabilityMethods.js'
import { renderCsvArchive } from './csvRenderer.js'
import { renderPdfReport } from './pdfRenderer.js'
import { buildReportExecutiveSummary } from './reportSummary.js'
import { buildReportOverviewData } from './buildReportOverviewData.js'
import { normalizeReportSectionSelection } from './normalizeReportSections.js'
import { readabilityMethodLabel } from './preparePdfSections.js'
import {
  hasAnySelectedSections,
  REPORT_DATA_SECTION_LABELS,
  REPORT_OVERVIEW_SECTION_LABELS,
  selectedDataSections,
  selectedOverviewSections,
  type ReportDataSectionKey,
  type ReportJobRecord,
  type ReportSectionData
} from './types.js'

type RecordData = Record<string, unknown>

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { message?: string, data?: Record<string, unknown> } }).response
    const fieldErrors = response?.data
      ? Object.entries(response.data)
        .map(([field, detail]) => `${field}: ${JSON.stringify(detail)}`)
        .join('; ')
      : ''
    if (fieldErrors) return `${response?.message || 'Request failed'} (${fieldErrors})`
    if (response?.message) return response.message
  }
  return error instanceof Error ? error.message : String(error)
}

async function listPendingJobs(pb: PocketBase): Promise<ReportJobRecord[]> {
  const rows = await pb.collection('report_jobs').getFullList({
    fields: 'id,org,site,format,sections,include_all_sites,schedule,share_token,share_expires_at',
    filter: 'status = "pending"',
    sort: 'created'
  })
  return rows as unknown as ReportJobRecord[]
}

async function latestCompleteScanId(pb: PocketBase, siteId: string): Promise<string | null> {
  const list = await pb.collection('scans').getList(1, 1, {
    filter: `site = "${siteId}" && status = "complete"`,
    sort: '-completed_at,-started_at',
    fields: 'id'
  })
  return list.items[0]?.id ?? null
}

async function resolveScanIds(pb: PocketBase, job: ReportJobRecord): Promise<string[]> {
  if (job.include_all_sites) {
    const sites = await pb.collection('sites').getFullList({
      filter: `organization = "${job.org}"`,
      fields: 'id'
    })
    const scanIds: string[] = []
    for (const site of sites) {
      const scanId = await latestCompleteScanId(pb, site.id)
      if (scanId) scanIds.push(scanId)
    }
    return scanIds
  }

  if (!job.site) return []
  const scanId = await latestCompleteScanId(pb, job.site)
  return scanId ? [scanId] : []
}

function toCell(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function normalizeRows(records: RecordData[], headers: string[]): string[][] {
  return records.map((record) => headers.map(header => toCell(record[header])))
}

async function fetchSectionData(
  pb: PocketBase,
  scanIds: string[],
  section: ReportDataSectionKey,
  siteIds: string[] = []
): Promise<ReportSectionData> {
  const label = REPORT_DATA_SECTION_LABELS[section]
  if (!scanIds.length && section !== 'accessibility.pdfs') {
    return { key: section, label, headers: ['message'], rows: [['No completed scan data']] }
  }
  const scanFilter = scanIds.map(id => `scan = "${id}"`).join(' || ')

  if (section === 'accessibility.issues') {
    const rows = await pb.collection('accessibility_issues').getFullList({
      filter: scanFilter,
      expand: 'page',
      fields: 'scan,rule_id,wcag_level,impact,type,status,description,expand.page.url'
    }) as unknown as RecordData[]
    const normalized = rows.map((row) => ({
      scan: row.scan,
      rule_id: row.rule_id,
      wcag_level: row.wcag_level,
      impact: row.impact,
      type: row.type,
      status: row.status,
      page_url: ((row.expand as RecordData | undefined)?.page as RecordData | undefined)?.url ?? '',
      description: row.description
    }))
    const headers = ['scan', 'rule_id', 'wcag_level', 'impact', 'type', 'status', 'page_url', 'description']
    return { key: section, label, headers, rows: normalizeRows(normalized, headers) }
  }

  if (section === 'qa.links') {
    const rows = await pb.collection('qa_broken_links').getFullList({
      filter: scanFilter,
      expand: 'page',
      fields: 'scan,href,status_code,link_type,status,expand.page.url'
    }) as unknown as RecordData[]
    const normalized = rows.map(row => ({
      scan: row.scan,
      href: row.href,
      status_code: row.status_code,
      link_type: row.link_type,
      status: row.status,
      page_url: ((row.expand as RecordData | undefined)?.page as RecordData | undefined)?.url ?? ''
    }))
    const headers = ['scan', 'href', 'status_code', 'link_type', 'status', 'page_url']
    return { key: section, label, headers, rows: normalizeRows(normalized, headers) }
  }

  if (section === 'qa.spelling') {
    const rows = await pb.collection('qa_spelling').getFullList({
      filter: scanFilter,
      expand: 'page',
      fields: 'word,context,status,expand.page.url'
    }) as unknown as RecordData[]
    const normalized = rows.map(row => ({
      word: row.word,
      context: row.context,
      status: row.status,
      page: ((row.expand as RecordData | undefined)?.page as RecordData | undefined)?.url ?? ''
    }))
    const headers = ['word', 'context', 'status', 'page']
    return { key: section, label, headers, rows: normalizeRows(normalized, headers) }
  }

  if (section === 'seo.technical' || section === 'seo.content') {
    const rows = await pb.collection('seo_issues').getFullList({
      filter: `${scanFilter} && category = "${section === 'seo.technical' ? 'technical' : 'content'}"`,
      expand: 'page',
      fields: 'title,severity,status,description,expand.page.url'
    }) as unknown as RecordData[]
    const normalized = rows.map(row => ({
      title: row.title,
      severity: row.severity,
      status: row.status,
      description: row.description,
      page: ((row.expand as RecordData | undefined)?.page as RecordData | undefined)?.url ?? ''
    }))
    const headers = ['title', 'severity', 'status', 'description', 'page']
    return { key: section, label, headers, rows: normalizeRows(normalized, headers) }
  }

  if (section === 'accessibility.pdfs') {
    if (!siteIds.length) {
      return { key: section, label, headers: ['message'], rows: [['No sites in scope']] }
    }
    const siteFilter = siteIds.map(id => `site = "${id}"`).join(' || ')
    const rows = await pb.collection('pdf_documents').getFullList({
      filter: siteFilter,
      fields: 'document_title,filename,url,status,machine_readable,has_pdf_tags,issue_count,accessibility_score,source,validated_at'
    }) as unknown as RecordData[]
    if (!rows.length) {
      return { key: section, label, headers: ['message'], rows: [['No validated PDF documents found']] }
    }
    const headers = [
      'document_title',
      'filename',
      'url',
      'status',
      'machine_readable',
      'has_pdf_tags',
      'issue_count',
      'accessibility_score',
      'source',
      'validated_at'
    ]
    return { key: section, label, headers, rows: normalizeRows(rows, headers) }
  }

  if (section === 'accessibility.readability' || section === 'accessibility.pages') {
    const rows = await pb.collection('pages').getFullList({
      filter: scanFilter,
      fields: 'url,title,status_code,word_count,readability_score,readability_scores'
    }) as unknown as RecordData[]
    const headers = [
      'url',
      'title',
      'status_code',
      'word_count',
      'readability_score',
      'readability_scores'
    ]
    return { key: section, label, headers, rows: normalizeRows(rows, headers) }
  }

  const collection = section === 'qa.inventory'
    ? 'qa_inventory'
    : 'pages'
  const rows = await pb.collection(collection).getFullList({
    filter: scanFilter
  }) as unknown as RecordData[]
  const headers = Object.keys(rows[0] || {}).filter(key => key !== 'expand')
  return { key: section, label, headers, rows: normalizeRows(rows, headers) }
}

async function resolveSiteIdsForJob(pb: PocketBase, job: ReportJobRecord): Promise<string[]> {
  if (job.include_all_sites) {
    const sites = await pb.collection('sites').getFullList({
      filter: `organization = "${job.org}"`,
      fields: 'id'
    })
    return sites.map(site => site.id)
  }
  return job.site ? [job.site] : []
}

async function resolveReadabilityMethodForSites(
  pb: PocketBase,
  siteIds: string[]
): Promise<{ id: ReadabilityMethodId, label: string }> {
  const fallback: ReadabilityMethodId = 'flesch_kincaid_grade'

  if (!siteIds.length) {
    return { id: fallback, label: readabilityMethodLabel(fallback) }
  }

  const counts = new Map<string, number>()
  for (const siteId of siteIds) {
    try {
      const site = await pb.collection('sites').getOne(siteId, { fields: 'site_settings' }) as {
        site_settings?: Record<string, unknown>
      }
      const methods = site.site_settings?.readabilityMethods
      const primary = Array.isArray(methods) ? methods[0] : null
      const id = typeof primary === 'string' && (READABILITY_METHOD_IDS as readonly string[]).includes(primary)
        ? primary
        : fallback
      counts.set(id, (counts.get(id) || 0) + 1)
    } catch {
      counts.set(fallback, (counts.get(fallback) || 0) + 1)
    }
  }

  let best = fallback as string
  let bestCount = -1
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id
      bestCount = count
    }
  }
  const methodId = (READABILITY_METHOD_IDS as readonly string[]).includes(best)
    ? best as ReadabilityMethodId
    : fallback
  return { id: methodId, label: readabilityMethodLabel(methodId) }
}

async function setJobFailed(pb: PocketBase, jobId: string, message: string) {
  await pb.collection('report_jobs').update(jobId, {
    status: 'failed',
    error_message: message,
    progress: 100,
    progress_label: 'Failed',
    completed_at: new Date().toISOString()
  })
}

async function resolveScopeLabel(pb: PocketBase, job: ReportJobRecord): Promise<string> {
  if (job.include_all_sites) return 'All sites'
  if (!job.site) return 'Single site'
  try {
    const site = await pb.collection('sites').getOne(job.site, { fields: 'name' }) as { name?: string }
    return site.name?.trim() || 'Single site'
  } catch {
    return 'Single site'
  }
}

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Report'
}

export function buildFriendlyArtifactName(
  scopeLabel: string,
  format: 'pdf' | 'csv',
  generatedAt: Date = new Date()
): string {
  const dateLabel = generatedAt.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
  const formatLabel = format === 'pdf' ? 'PDF' : 'CSV'
  const base = `${sanitizeFilenamePart(scopeLabel)} - ${formatLabel} report - ${dateLabel}`
  const ext = format === 'pdf' ? 'pdf' : 'zip'
  return `${base}.${ext}`
}

async function countPdfPages(buffer: Buffer): Promise<number> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.load(buffer)
  return doc.getPageCount()
}

async function setJobProgress(
  pb: PocketBase,
  jobId: string,
  progress: number,
  progressLabel: string
): Promise<void> {
  await pb.collection('report_jobs').update(jobId, {
    progress: Math.max(0, Math.min(100, Math.round(progress))),
    progress_label: progressLabel
  })
}

export async function processNextReportJob(pb: PocketBase): Promise<boolean> {
  const pending = await listPendingJobs(pb)
  const job = pending[0]
  if (!job) return false

  const normalizedSections = normalizeReportSectionSelection(job.sections)
  const dataSections = selectedDataSections(normalizedSections)
  const overviewSections = selectedOverviewSections(normalizedSections)

  if (!hasAnySelectedSections(normalizedSections)) {
    await setJobFailed(pb, job.id, 'At least one report section is required')
    return true
  }

  if (job.format === 'csv' && !dataSections.length) {
    await setJobFailed(pb, job.id, 'CSV exports require at least one data section')
    return true
  }

  try {
    await pb.collection('report_jobs').update(job.id, {
      status: 'processing',
      started_at: new Date().toISOString(),
      progress: 5,
      progress_label: 'Resolving latest scans'
    })

    const scanIds = await resolveScanIds(pb, job)
    if (!scanIds.length) {
      await setJobFailed(
        pb,
        job.id,
        job.include_all_sites
          ? 'No completed scans found for any site in this organization'
          : 'No completed scan found for this site. Run a scan first, then export the report.'
      )
      return true
    }

    const siteIds = await resolveSiteIdsForJob(pb, job)
    const readabilityMethod = await resolveReadabilityMethodForSites(pb, siteIds)

    const sectionData: ReportSectionData[] = []
    const totalSteps = Math.max(1, overviewSections.length + dataSections.length)
    let stepIndex = 0

    let overviewData
    if (overviewSections.length && job.format === 'pdf') {
      await setJobProgress(pb, job.id, 10, 'Loading overview data')
      overviewData = await buildReportOverviewData(pb, job, scanIds, overviewSections)
      console.log(
        `Report job ${job.id}: rendering overview sections ${overviewSections.join(', ')} ` +
        `(data loaded: ${overviewData ? 'yes' : 'no'})`
      )
      for (const overviewKey of overviewSections) {
        stepIndex += 1
        await setJobProgress(
          pb,
          job.id,
          Math.min(85, 15 + Math.round((stepIndex / totalSteps) * 70)),
          `Preparing ${REPORT_OVERVIEW_SECTION_LABELS[overviewKey]}`
        )
      }
    }

    for (const section of dataSections) {
      const label = REPORT_DATA_SECTION_LABELS[section]
      const loadProgress = Math.min(85, 15 + Math.round(((stepIndex + 0.4) / totalSteps) * 70))
      await setJobProgress(pb, job.id, loadProgress, `Loading ${label}`)
      const data = await fetchSectionData(pb, scanIds, section, siteIds)
      sectionData.push(data)
      stepIndex += 1
      await setJobProgress(
        pb,
        job.id,
        Math.min(85, 15 + Math.round((stepIndex / totalSteps) * 70)),
        `Preparing ${data.label}`
      )
    }

    await setJobProgress(
      pb,
      job.id,
      88,
      job.format === 'pdf' ? 'Building PDF' : 'Building CSV archive'
    )

    const scopeLabel = await resolveScopeLabel(pb, job)
    const summary = await buildReportExecutiveSummary(pb, job.org, scanIds, sectionData)
    const generatedAt = new Date()
    const artifactBuffer = job.format === 'pdf'
      ? await renderPdfReport(sectionData, {
        title: `${scopeLabel} report`,
        scopeLabel,
        orgName: summary.orgName,
        generatedAt: generatedAt.toISOString(),
        summary,
        overviewSections: overviewSections.length ? overviewSections : undefined,
        overviewData,
        includeTableOfContents: normalizedSections.options?.tableOfContents === true,
        readabilityMethodId: readabilityMethod.id,
        readabilityMethodLabel: readabilityMethod.label
      })
      : await renderCsvArchive(sectionData)
    const artifactName = buildFriendlyArtifactName(scopeLabel, job.format, generatedAt)
    const artifactSizeBytes = artifactBuffer.byteLength
    const artifactPageCount = job.format === 'pdf'
      ? await countPdfPages(artifactBuffer)
      : 0
    const shareToken = job.share_token || (job.schedule ? generateReportShareToken() : '')
    const form = new FormData()
    form.append('artifact', new Blob([new Uint8Array(artifactBuffer)]), artifactName)
    form.append('artifact_name', artifactName)
    form.append('artifact_size_bytes', String(artifactSizeBytes))
    form.append('artifact_page_count', String(artifactPageCount))
    form.append('status', 'complete')
    form.append('progress', '100')
    form.append('progress_label', 'Completed')
    form.append('completed_at', generatedAt.toISOString())
    if (shareToken) {
      form.append('share_token', shareToken)
      form.append('share_expires_at', job.share_expires_at || computeShareExpiresAt())
    }
    await pb.collection('report_jobs').update(job.id, form)

    if (job.schedule) {
      const sent = await notifyReportReadyEmail(pb, job.id)
      if (sent > 0) {
        console.log(`Report job ${job.id}: emailed ${sent} recipient(s)`)
      }
    }
  } catch (error) {
    const message = errorMessage(error)
    console.error(`Report job ${job.id} failed:`, message)
    await setJobFailed(pb, job.id, message)
  }
  return true
}

export function startReportJobLoop(_pb?: PocketBase): void {
  const tickMs = Number(process.env.REPORT_JOB_TICK_MS || process.env.SCANNER_POLL_INTERVAL_MS || 5000)
  let busy = false

  async function loop() {
    if (!busy) {
      busy = true
      try {
        let processed = true
        while (processed) {
          processed = await processNextReportJob(getPocketBase())
        }
      } catch (err) {
        if (isPocketBaseConnectionError(err)) {
          resetPocketBaseClient()
          console.warn('Report job loop: PocketBase connection lost')
        } else {
          console.error('Report job loop error:', err)
        }
      } finally {
        busy = false
      }
    }
    setTimeout(loop, tickMs)
  }

  console.log(`Report job loop started (tick every ${tickMs}ms)`)
  setTimeout(loop, Math.min(tickMs, 2000))
}
