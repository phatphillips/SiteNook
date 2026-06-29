import type { SeoCategory, SeoIssueDraft, SeoSeverity, SeoSubcategory } from './types.js'

const SEVERITY_PENALTY: Record<SeoSeverity, number> = {
  critical: 8,
  serious: 5,
  moderate: 2,
  minor: 1
}

const MAX_PENALTY_PER_PAGE = 40

function penaltyForIssues(issues: SeoIssueDraft[]): number {
  let total = 0
  for (const issue of issues) {
    total += SEVERITY_PENALTY[issue.severity] ?? 2
    if (total >= MAX_PENALTY_PER_PAGE) return MAX_PENALTY_PER_PAGE
  }
  return total
}

export interface SeoScoreResult {
  score_seo: number
  score_seo_technical: number
  score_seo_content: number
  score_seo_crawlability: number
}

export function calculateSeoScores(issues: SeoIssueDraft[], pageCount: number): SeoScoreResult {
  const pages = Math.max(pageCount, 1)
  const technical = issues.filter(i =>
    i.category === 'technical' && i.subcategory !== 'crawlability'
  )
  const crawlability = issues.filter(i => i.subcategory === 'crawlability')
  const content = issues.filter(i => i.category === 'content')

  const techPenalty = penaltyForIssues(technical)
  const crawlPenalty = penaltyForIssues(crawlability)
  const contentPenalty = penaltyForIssues(content)
  const totalPenalty = penaltyForIssues(issues)

  const denom = pages * 10
  const scoreTechnical = Math.max(0, Math.round(100 - (techPenalty / denom) * 100))
  const scoreCrawlability = Math.max(0, Math.round(100 - (crawlPenalty / denom) * 100))
  const scoreContent = Math.max(0, Math.round(100 - (contentPenalty / denom) * 100))
  const scoreOverall = Math.max(0, Math.round(100 - (totalPenalty / denom) * 100))

  return {
    score_seo: scoreOverall,
    score_seo_technical: scoreTechnical,
    score_seo_content: scoreContent,
    score_seo_crawlability: scoreCrawlability
  }
}

export function issuesByCategory(issues: SeoIssueDraft[]): Record<SeoCategory, number> {
  return {
    technical: issues.filter(i => i.category === 'technical').length,
    content: issues.filter(i => i.category === 'content').length
  }
}

export function issuesBySubcategory(issues: SeoIssueDraft[]): Record<SeoSubcategory, number> {
  const counts: Record<SeoSubcategory, number> = {
    on_page: 0,
    crawlability: 0,
    structured_data: 0,
    content_quality: 0,
    duplicates: 0
  }
  for (const issue of issues) {
    counts[issue.subcategory] = (counts[issue.subcategory] ?? 0) + 1
  }
  return counts
}
