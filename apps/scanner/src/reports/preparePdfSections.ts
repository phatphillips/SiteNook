import type { ReportSectionData, ReportDataSectionKey, ReportOverviewSectionKey } from './types.js'
import type { ReportOverviewData } from './buildReportOverviewData.js'
import type { ReportExecutiveSummary } from './reportSummary.js'
import {
  READABILITY_METHOD_IDS,
  type ReadabilityMethodId,
  type ReadabilityScores,
  parseStoredReadabilityScores
} from '../qa/readabilityMethods.js'

export interface ReportPdfColumn {
  key: string
  label: string
  width: number
  align?: 'left' | 'center' | 'right'
}

export interface ReportPdfOptions {
  title: string
  scopeLabel: string
  orgName?: string
  generatedAt: string
  sections: ReportSectionData[]
  summary?: ReportExecutiveSummary
  overviewSections?: ReportOverviewSectionKey[]
  overviewData?: ReportOverviewData
  includeTableOfContents?: boolean
  /** Populated on the second HTML pass so the TOC can show real page numbers. */
  sectionPageNumbers?: Record<string, number>
  /** Active readability method for the report (from site settings). */
  readabilityMethodId?: ReadabilityMethodId
  readabilityMethodLabel?: string
}

export interface PreparedPdfSection {
  key: ReportDataSectionKey
  label: string
  columns: ReportPdfColumn[]
  rows: string[][]
  totalRows: number
  truncated: boolean
  metaNote?: string
  issueDrillDown?: Array<{
    title: string
    impact: string
    pages: string[]
  }>
}

type IssueRow = {
  rule_id: string
  description: string
  wcag_level: string
  impact: string
  page_url: string
}

const IMPACT_ORDER: Record<string, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3
}

const METHOD_LABELS: Record<ReadabilityMethodId, string> = {
  ari: 'Automated Readability Index',
  coleman_liau: 'Coleman-Liau',
  flesch_kincaid_grade: 'Flesch-Kincaid Grade Level',
  flesch_reading_ease: 'Flesch Reading Ease',
  gunning_fog: 'Gunning Fog',
  lix: 'LIX',
  smog: 'SMOG'
}

const SCORE_THRESHOLDS: Record<ReadabilityMethodId, { goodMax?: number, goodMin?: number, warningMax?: number, warningMin?: number }> = {
  ari: { goodMax: 9, warningMax: 10 },
  coleman_liau: { goodMax: 8, warningMax: 9 },
  flesch_kincaid_grade: { goodMax: 8, warningMax: 9 },
  flesch_reading_ease: { goodMin: 60, warningMin: 50 },
  gunning_fog: { goodMax: 8, warningMax: 9 },
  lix: { goodMax: 34, warningMax: 44 },
  smog: { goodMax: 8, warningMax: 9 }
}

function impactRank(impact: string): number {
  return IMPACT_ORDER[impact.toLowerCase()] ?? 99
}

function truncateText(value: string, max = 120): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function titleCase(value: string): string {
  if (!value || value === '—') return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function yesNo(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized === 'false' || normalized === '0' || normalized === 'no') return 'No'
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return 'Yes'
  return titleCase(value)
}

function formatPdfScore(value: string): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return value || '—'
  return `${Math.round(num)} / 100`
}

function readabilityDifficulty(
  methodId: ReadabilityMethodId,
  score: number
): 'Easy' | 'Moderate' | 'Hard' {
  const thresholds = SCORE_THRESHOLDS[methodId]
  if (methodId === 'flesch_reading_ease') {
    if (score >= (thresholds.goodMin ?? 60)) return 'Easy'
    if (score >= (thresholds.warningMin ?? 50)) return 'Moderate'
    return 'Hard'
  }
  if (score <= (thresholds.goodMax ?? 8)) return 'Easy'
  if (score <= (thresholds.warningMax ?? 9)) return 'Moderate'
  return 'Hard'
}

export function formatReadabilityScoreForReport(
  methodId: ReadabilityMethodId,
  score: number | null | undefined
): string {
  if (score == null || !Number.isFinite(score) || score === 0) return '—'
  const raw = Number.isInteger(score) ? String(score) : score.toFixed(1)
  const difficulty = readabilityDifficulty(methodId, score)
  if (methodId === 'flesch_reading_ease') {
    return `${raw} · ${difficulty}`
  }
  return `Grade ${raw} · ${difficulty}`
}

function parseScoresCell(raw: string, legacyScore: string): ReadabilityScores {
  let parsed: unknown = raw
  if (raw.trim().startsWith('{')) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
  }
  const legacy = Number(legacyScore)
  return parseStoredReadabilityScores(
    parsed,
    Number.isFinite(legacy) ? legacy : undefined
  )
}

function coerceMethodId(value: string | undefined): ReadabilityMethodId {
  if (value && (READABILITY_METHOD_IDS as readonly string[]).includes(value)) {
    return value as ReadabilityMethodId
  }
  return 'flesch_kincaid_grade'
}

function aggregateAccessibilityIssues(rows: string[][], headers: string[]): PreparedPdfSection {
  const index = Object.fromEntries(headers.map((header, i) => [header, i]))
  const grouped = new Map<string, IssueRow & { pages: Set<string>, occurrences: number }>()

  for (const row of rows) {
    const ruleId = row[index.rule_id ?? -1] || 'unknown'
    const pageUrl = row[index.page_url ?? -1] || ''
    const existing = grouped.get(ruleId)
    if (existing) {
      if (pageUrl) existing.pages.add(pageUrl)
      existing.occurrences += 1
      continue
    }
    grouped.set(ruleId, {
      rule_id: ruleId,
      description: row[index.description ?? -1] || ruleId,
      wcag_level: row[index.wcag_level ?? -1] || '',
      impact: row[index.impact ?? -1] || '',
      page_url: pageUrl,
      pages: new Set(pageUrl ? [pageUrl] : []),
      occurrences: 1
    })
  }

  const sorted = [...grouped.values()].sort((a, b) => {
    const impactDiff = impactRank(a.impact) - impactRank(b.impact)
    if (impactDiff !== 0) return impactDiff
    return b.occurrences - a.occurrences
  })

  const maxRows = 200
  const visible = sorted.slice(0, maxRows)
  const drillDown = sorted.slice(0, 8).map(item => ({
    title: item.description || item.rule_id,
    impact: item.impact,
    pages: [...item.pages].slice(0, 12)
  }))

  return {
    key: 'accessibility.issues',
    label: 'Accessibility Issues',
    columns: [
      { key: 'issue', label: 'Issue', width: 0.34 },
      { key: 'level', label: 'Level', width: 0.08, align: 'center' },
      { key: 'severity', label: 'Severity', width: 0.12, align: 'center' },
      { key: 'pages', label: 'Pages', width: 0.1, align: 'center' },
      { key: 'occurrences', label: 'Occurrences', width: 0.12, align: 'center' }
    ],
    rows: visible.map(item => [
      truncateText(item.description || item.rule_id, 90),
      item.wcag_level || '—',
      titleCase(item.impact || '—'),
      String(item.pages.size),
      String(item.occurrences)
    ]),
    totalRows: sorted.length,
    truncated: sorted.length > maxRows,
    issueDrillDown: drillDown
  }
}

function prepareReadabilitySection(
  label: string,
  headers: string[],
  rows: string[][],
  methodId: ReadabilityMethodId,
  methodLabel: string
): PreparedPdfSection {
  const index = Object.fromEntries(headers.map((header, i) => [header, i]))
  const mapped = rows.slice(0, 200).map((row) => {
    const title = row[index.title ?? -1] || ''
    const url = row[index.url ?? -1] || ''
    const words = row[index.word_count ?? -1] || ''
    const scores = parseScoresCell(
      row[index.readability_scores ?? -1] || '',
      row[index.readability_score ?? -1] || ''
    )
    const score = scores[methodId]
    return [
      truncateText(title || 'Untitled page', 70),
      formatReadabilityScoreForReport(methodId, score),
      words || '—',
      truncateText(url, 70)
    ]
  })

  return {
    key: 'accessibility.readability',
    label,
    columns: [
      { key: 'title', label: 'Title', width: 0.34 },
      { key: 'score', label: 'Score', width: 0.22, align: 'left' },
      { key: 'word_count', label: 'Words', width: 0.12, align: 'right' },
      { key: 'url', label: 'Page URL', width: 0.32 }
    ],
    rows: mapped,
    totalRows: rows.length,
    truncated: rows.length > 200,
    metaNote: `Scores use ${methodLabel}.`
  }
}

function preparePdfDocumentsSection(
  label: string,
  headers: string[],
  rows: string[][]
): PreparedPdfSection {
  const index = Object.fromEntries(headers.map((header, i) => [header, i]))
  const mapped = rows.slice(0, 200).map((row) => {
    const title = row[index.document_title ?? -1]
      || row[index.filename ?? -1]
      || 'Untitled PDF'
    const score = formatPdfScore(row[index.accessibility_score ?? -1] || '')
    const issues = row[index.issue_count ?? -1] || '0'
    const tags = yesNo(row[index.has_pdf_tags ?? -1] || '')
    const machine = yesNo(row[index.machine_readable ?? -1] || '')
    const status = titleCase(row[index.status ?? -1] || '—')
    return [
      truncateText(title, 70),
      score,
      issues,
      tags,
      machine,
      status
    ]
  })

  return {
    key: 'accessibility.pdfs',
    label,
    columns: [
      { key: 'title', label: 'Title', width: 0.3 },
      { key: 'score', label: 'Score', width: 0.14, align: 'center' },
      { key: 'issues', label: 'Issues', width: 0.1, align: 'center' },
      { key: 'tags', label: 'Tagged', width: 0.12, align: 'center' },
      { key: 'machine', label: 'Machine-readable', width: 0.18, align: 'center' },
      { key: 'status', label: 'Status', width: 0.16, align: 'center' }
    ],
    rows: mapped,
    totalRows: rows.length,
    truncated: rows.length > 200,
    metaNote: 'Score is the PDF accessibility score from validation (0–100).'
  }
}

function pickColumns(
  key: ReportDataSectionKey,
  label: string,
  headers: string[],
  rows: string[][],
  options?: { readabilityMethodId?: ReadabilityMethodId, readabilityMethodLabel?: string }
): PreparedPdfSection {
  if (key === 'accessibility.readability') {
    const methodId = coerceMethodId(options?.readabilityMethodId)
    const methodLabel = options?.readabilityMethodLabel || METHOD_LABELS[methodId]
    return prepareReadabilitySection(label, headers, rows, methodId, methodLabel)
  }

  if (key === 'accessibility.pdfs') {
    return preparePdfDocumentsSection(label, headers, rows)
  }

  const configs: Partial<Record<ReportDataSectionKey, { columns: ReportPdfColumn[], pick: string[] }>> = {
    'qa.links': {
      columns: [
        { key: 'page_url', label: 'Page', width: 0.32 },
        { key: 'href', label: 'Broken URL', width: 0.34 },
        { key: 'status_code', label: 'HTTP', width: 0.1, align: 'center' },
        { key: 'link_type', label: 'Type', width: 0.12, align: 'center' },
        { key: 'status', label: 'Status', width: 0.12, align: 'center' }
      ],
      pick: ['page_url', 'href', 'status_code', 'link_type', 'status']
    },
    'qa.spelling': {
      columns: [
        { key: 'word', label: 'Word', width: 0.16 },
        { key: 'context', label: 'Context', width: 0.44 },
        { key: 'page', label: 'Page URL', width: 0.4 }
      ],
      pick: ['word', 'context', 'page']
    },
    'qa.inventory': {
      columns: [
        { key: 'url', label: 'Asset URL', width: 0.42 },
        { key: 'asset_category', label: 'Category', width: 0.16, align: 'center' },
        { key: 'content_type', label: 'Type', width: 0.18, align: 'center' },
        { key: 'size_bytes', label: 'Size', width: 0.12, align: 'right' },
        { key: 'found_on_page_count', label: 'Pages', width: 0.12, align: 'center' }
      ],
      pick: ['url', 'asset_category', 'content_type', 'size_bytes', 'found_on_page_count']
    },
    'accessibility.pages': {
      columns: [
        { key: 'title', label: 'Title', width: 0.34 },
        { key: 'url', label: 'Page URL', width: 0.4 },
        { key: 'status_code', label: 'Status', width: 0.1, align: 'center' },
        { key: 'word_count', label: 'Words', width: 0.16, align: 'right' }
      ],
      pick: ['title', 'url', 'status_code', 'word_count']
    },
    'seo.technical': {
      columns: [
        { key: 'title', label: 'Issue', width: 0.28 },
        { key: 'severity', label: 'Severity', width: 0.12, align: 'center' },
        { key: 'page', label: 'Page', width: 0.32 },
        { key: 'description', label: 'Description', width: 0.28 }
      ],
      pick: ['title', 'severity', 'page', 'description']
    },
    'seo.content': {
      columns: [
        { key: 'title', label: 'Issue', width: 0.28 },
        { key: 'severity', label: 'Severity', width: 0.12, align: 'center' },
        { key: 'page', label: 'Page', width: 0.32 },
        { key: 'description', label: 'Description', width: 0.28 }
      ],
      pick: ['title', 'severity', 'page', 'description']
    }
  }

  const config = configs[key]
  if (!config) {
    const maxCols = Math.min(headers.length, 5)
    const visibleHeaders = headers.slice(0, maxCols)
    return {
      key,
      label,
      columns: visibleHeaders.map(header => ({
        key: header,
        label: header.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        width: 1 / maxCols,
        align: 'left' as const
      })),
      rows: rows.slice(0, 200).map(row => row.slice(0, maxCols).map(cell => truncateText(cell, 100))),
      totalRows: rows.length,
      truncated: rows.length > 200
    }
  }

  const index = Object.fromEntries(headers.map((header, i) => [header, i]))
  const mappedRows = rows.slice(0, 200).map((row) => {
    return config.pick.map((field) => {
      if (field === 'page' && index.page == null && index.page_url != null) {
        return truncateText(row[index.page_url] || '', 80)
      }
      const value = row[index[field] ?? -1] || ''
      if (field === 'size_bytes' && value) {
        const bytes = Number(value)
        if (Number.isFinite(bytes) && bytes > 0) {
          if (bytes < 1024) return `${bytes} B`
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
          return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
        }
      }
      if (field === 'title' && !value) return 'Untitled page'
      return truncateText(String(value), field === 'context' ? 120 : 80)
    })
  })

  return {
    key,
    label,
    columns: config.columns,
    rows: mappedRows,
    totalRows: rows.length,
    truncated: rows.length > 200
  }
}

export function preparePdfSections(
  sections: ReportSectionData[],
  options?: { readabilityMethodId?: ReadabilityMethodId, readabilityMethodLabel?: string }
): PreparedPdfSection[] {
  return sections.map((section) => {
    if (section.key === 'accessibility.issues') {
      return aggregateAccessibilityIssues(section.rows, section.headers)
    }
    return pickColumns(section.key, section.label, section.headers, section.rows, options)
  })
}

export function formatReportDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export function readabilityMethodLabel(methodId: ReadabilityMethodId): string {
  return METHOD_LABELS[methodId]
}
