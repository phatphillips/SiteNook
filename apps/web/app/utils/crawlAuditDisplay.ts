import type { SeoCrawlAudit, SeoIssue } from '~/types/accessiq'
import type { TrafficLight } from '~/utils/trafficLightStatus'

export type CrawlFileKey = 'robots' | 'sitemap' | 'llms'

const ROBOTS_RULES = new Set([
  'robots-unreachable',
  'robots-missing-sitemap-directive',
  'ai-bot-blocked'
])

const SITEMAP_RULES = new Set([
  'sitemap-unreachable',
  'sitemap-invalid-xml',
  'sitemap-over-limit',
  'sitemap-relative-url',
  'sitemap-bad-urls',
  'sitemap-noindex-urls',
  'sitemap-missing-lastmod',
  'sitemap-stale-lastmod',
  'sitemap-index-missing',
  'page-not-in-sitemap'
])

const LLMS_RULES = new Set([
  'llms-missing',
  'llms-invalid-format'
])

const FILE_LABELS: Record<CrawlFileKey, string> = {
  robots: 'robots.txt',
  sitemap: 'sitemap.xml',
  llms: 'llms.txt'
}

export interface SiteFileRow {
  key: CrawlFileKey
  label: string
  url: string
  found: boolean
  summary: string
  status: TrafficLight
  linkedIssue: SeoIssue | null
}

function rulesForFile(key: CrawlFileKey): Set<string> {
  if (key === 'robots') return ROBOTS_RULES
  if (key === 'sitemap') return SITEMAP_RULES
  return LLMS_RULES
}

export function issueForCrawlFile(
  issues: SeoIssue[],
  key: CrawlFileKey
): SeoIssue | null {
  const rules = rulesForFile(key)
  const open = issues.filter(i => i.status === 'open' && rules.has(i.rule_id))
  if (!open.length) return null
  const severityOrder: Record<string, number> = { critical: 4, serious: 3, moderate: 2, minor: 1 }
  return open.sort((a, b) =>
    (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0)
  )[0] ?? null
}

function trafficLightForRow(
  found: boolean,
  linkedIssue: SeoIssue | null
): TrafficLight {
  if (!found) return 'red'
  if (linkedIssue) {
    if (linkedIssue.severity === 'critical' || linkedIssue.severity === 'serious') return 'red'
    return 'orange'
  }
  return 'green'
}

export function buildSiteFileRows(
  audit: SeoCrawlAudit | null | undefined,
  issues: SeoIssue[]
): SiteFileRow[] {
  if (!audit) return []

  const rows: SiteFileRow[] = [
    {
      key: 'robots',
      label: FILE_LABELS.robots,
      url: audit.robots.url,
      found: audit.robots.found,
      summary: audit.robots.summary,
      status: trafficLightForRow(audit.robots.found, issueForCrawlFile(issues, 'robots')),
      linkedIssue: issueForCrawlFile(issues, 'robots')
    },
    {
      key: 'sitemap',
      label: FILE_LABELS.sitemap,
      url: audit.sitemap.url,
      found: audit.sitemap.found,
      summary: audit.sitemap.summary,
      status: trafficLightForRow(audit.sitemap.found, issueForCrawlFile(issues, 'sitemap')),
      linkedIssue: issueForCrawlFile(issues, 'sitemap')
    },
    {
      key: 'llms',
      label: FILE_LABELS.llms,
      url: audit.llms.url,
      found: audit.llms.found,
      summary: audit.llms.summary,
      status: trafficLightForRow(audit.llms.found, issueForCrawlFile(issues, 'llms')),
      linkedIssue: issueForCrawlFile(issues, 'llms')
    }
  ]

  return rows
}
