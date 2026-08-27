import type PocketBase from 'pocketbase'
import type { ReportSectionData } from './types.js'
import { preparePdfSections } from './preparePdfSections.js'

export interface ReportExecutiveSummary {
  orgName: string
  siteCount: number
  averageAccessibilityScore: number | null
  totalOpenIssues: number
  criticalIssueRules: number
  sectionTotals: Array<{ label: string, count: number }>
  topIssues: Array<{ title: string, impact: string, pages: number, occurrences: number }>
}

function impactRank(impact: string): number {
  const order: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 }
  return order[impact.toLowerCase()] ?? 99
}

export async function buildReportExecutiveSummary(
  pb: PocketBase,
  orgId: string,
  scanIds: string[],
  sections: ReportSectionData[]
): Promise<ReportExecutiveSummary> {
  let orgName = 'Your organization'
  try {
    const org = await pb.collection('organizations').getOne(orgId, { fields: 'name' }) as { name?: string }
    if (org.name?.trim()) orgName = org.name.trim()
  } catch {
    // keep default
  }

  const scores: number[] = []
  let totalOpenIssues = 0
  for (const scanId of scanIds) {
    try {
      const scan = await pb.collection('scans').getOne(scanId, {
        fields: 'score_overall,open_issue_count'
      }) as { score_overall?: number, open_issue_count?: number }
      if (typeof scan.score_overall === 'number' && Number.isFinite(scan.score_overall)) {
        scores.push(scan.score_overall)
      }
      if (typeof scan.open_issue_count === 'number' && Number.isFinite(scan.open_issue_count)) {
        totalOpenIssues += scan.open_issue_count
      }
    } catch {
      // skip missing scan
    }
  }

  const prepared = preparePdfSections(sections)
  const issuesSection = sections.find(section => section.key === 'accessibility.issues')
  let criticalIssueRules = 0
  const topIssues: ReportExecutiveSummary['topIssues'] = []

  if (issuesSection) {
    const index = Object.fromEntries(issuesSection.headers.map((header, i) => [header, i]))
    const grouped = new Map<string, { title: string, impact: string, pages: Set<string>, occurrences: number }>()
    for (const row of issuesSection.rows) {
      const ruleId = row[index.rule_id ?? -1] || 'unknown'
      const impact = row[index.impact ?? -1] || ''
      const pageUrl = row[index.page_url ?? -1] || ''
      const title = row[index.description ?? -1] || ruleId
      const existing = grouped.get(ruleId)
      if (existing) {
        if (pageUrl) existing.pages.add(pageUrl)
        existing.occurrences += 1
        continue
      }
      grouped.set(ruleId, {
        title,
        impact,
        pages: new Set(pageUrl ? [pageUrl] : []),
        occurrences: 1
      })
    }

    const sorted = [...grouped.values()].sort((a, b) => {
      const impactDiff = impactRank(a.impact) - impactRank(b.impact)
      if (impactDiff !== 0) return impactDiff
      return b.occurrences - a.occurrences
    })

    criticalIssueRules = sorted.filter(item =>
      item.impact === 'critical' || item.impact === 'serious'
    ).length

    for (const item of sorted.slice(0, 5)) {
      topIssues.push({
        title: item.title,
        impact: item.impact,
        pages: item.pages.size,
        occurrences: item.occurrences
      })
    }
  }

  return {
    orgName,
    siteCount: scanIds.length,
    averageAccessibilityScore: scores.length
      ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
      : null,
    totalOpenIssues,
    criticalIssueRules,
    sectionTotals: prepared.map(section => ({ label: section.label, count: section.totalRows })),
    topIssues
  }
}
