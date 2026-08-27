/** Site target baked into current_a11y — reconcile when these change. */

export interface A11ySiteTargetSnapshot {

  wcagVersion: string

  wcagConformance: string

  ariaConformance: boolean

  bestPractices: boolean

  includeIssues: boolean

  includePotentialIssues: boolean

}



/** Pre-computed accessibility rollup (stored on scans.a11y_summary and sites.current_a11y). */

export interface A11ySummaryRuleRow {

  rule_id: string

  wcag_level: string

  impact: string

  open_count: number

  dismissed_count: number

  page_count: number

  points_to_gain: number

  sample_page_urls: string[]

  description?: string

  type?: string

  element_type?: string

  responsible_role?: string

  wcag_version?: string

  representative_issue_id?: string

}



export interface A11ySummary {

  generated_at: string

  page_count: number

  open_issue_count: number

  by_rule: A11ySummaryRuleRow[]

  by_severity: { critical: number, serious: number, moderate: number, minor: number }

  by_level: { A: number, AA: number, AAA: number }

  pages_breakdown?: Array<{ url: string, a_count: number, aa_count: number, aaa_count: number }>

  site_target?: A11ySiteTargetSnapshot

}



/** Prefer live issues when the stored summary predates the latest completed scan. */
export function isA11ySummaryFresh(
  summary: Pick<A11ySummary, 'generated_at' | 'by_rule'> | null | undefined,
  latestScanCompletedAt?: string | null
): boolean {
  if (!summary?.by_rule?.length) return false
  if (!latestScanCompletedAt) return true
  const summaryMs = Date.parse(summary.generated_at)
  const scanMs = Date.parse(latestScanCompletedAt)
  if (!Number.isFinite(summaryMs) || !Number.isFinite(scanMs)) return true
  return summaryMs + 2000 >= scanMs
}

export function emptyA11ySummary(): A11ySummary {

  return {

    generated_at: new Date().toISOString(),

    page_count: 0,

    open_issue_count: 0,

    by_rule: [],

    by_severity: { critical: 0, serious: 0, moderate: 0, minor: 0 },

    by_level: { A: 0, AA: 0, AAA: 0 }

  }

}


