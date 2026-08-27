import type { AccessibilityIssue } from '~/types/sitenook'
import { normalizePageUrl } from '~/utils/pageUrl'

export interface AffectedPageDetail {
  url: string
  issueId: string
  htmlSnippet?: string
  cssSelector?: string
}

export interface AffectedPageSummary {
  url: string
  title?: string
  occurrences: number
  /** Open issue record ids for this page (when loaded for dismiss actions). */
  issueIds?: string[]
}

export function pageDisplayTitle(page: Pick<AffectedPageSummary, 'url' | 'title'>): string {
  const title = page.title?.trim()
  if (title) return title
  try {
    const parsed = new URL(page.url)
    const path = parsed.pathname === '/' ? parsed.hostname : parsed.pathname
    return path || page.url
  } catch {
    return page.url
  }
}

export function affectedPagesSummaryForRule(
  issues: AccessibilityIssue[],
  ruleId: string,
  options?: { statuses?: Array<AccessibilityIssue['status']> }
): AffectedPageSummary[] {
  const allowed = options?.statuses ? new Set(options.statuses) : null
  const map = new Map<string, { url: string, title?: string, occurrences: number, issueIds: string[] }>()

  for (const issue of issues) {
    if (issue.rule_id !== ruleId) continue
    if (allowed && !allowed.has(issue.status)) continue
    const url = issue.expand?.page?.url
    if (!url) continue
    const key = normalizePageUrl(url)
    const existing = map.get(key)
    if (existing) {
      existing.occurrences += 1
      if (issue.status === 'open') existing.issueIds.push(issue.id)
      if (!existing.title && issue.expand?.page?.title) {
        existing.title = issue.expand.page.title
      }
    } else {
      map.set(key, {
        url,
        title: issue.expand?.page?.title,
        occurrences: 1,
        issueIds: issue.status === 'open' ? [issue.id] : []
      })
    }
  }

  return [...map.values()]
    .map(({ issueIds, ...page }) => ({
      ...page,
      issueIds: issueIds.length ? issueIds : undefined
    }))
    .sort((a, b) => a.url.localeCompare(b.url))
}

export function buildAffectedPagesByRule(
  issues: AccessibilityIssue[],
  statuses?: Array<AccessibilityIssue['status']>
): Map<string, AffectedPageSummary[]> {
  const ruleIds = new Set(
    issues
      .filter((i) => !statuses || statuses.includes(i.status))
      .map(i => i.rule_id)
  )
  const result = new Map<string, AffectedPageSummary[]>()
  for (const ruleId of ruleIds) {
    result.set(ruleId, affectedPagesSummaryForRule(issues, ruleId, { statuses }))
  }
  return result
}

export function affectedPagesForRule(
  issues: AccessibilityIssue[],
  ruleId: string
): AffectedPageDetail[] {
  const map = new Map<string, AffectedPageDetail>()
  for (const issue of issues.filter(i => i.rule_id === ruleId && i.status !== 'dismissed')) {
    const url = issue.expand?.page?.url
    if (!url) continue
    const key = normalizePageUrl(url)
    if (!map.has(key)) {
      map.set(key, {
        url,
        issueId: issue.id,
        htmlSnippet: issue.html_snippet,
        cssSelector: issue.css_selector
      })
    }
  }
  return [...map.values()].sort((a, b) => a.url.localeCompare(b.url))
}

export function openIssueIdsForRule(issues: AccessibilityIssue[], ruleId: string): string[] {
  return issues
    .filter(i => i.rule_id === ruleId && i.status === 'open')
    .map(i => i.id)
}

export function openIssueIdsForRuleAndPage(
  issues: AccessibilityIssue[],
  ruleId: string,
  pageUrl: string
): string[] {
  const key = normalizePageUrl(pageUrl)
  return issues
    .filter((issue) => {
      const url = issue.expand?.page?.url
      return issue.rule_id === ruleId
        && issue.status === 'open'
        && url
        && normalizePageUrl(url) === key
    })
    .map(issue => issue.id)
}

export function openIssueIdsForPage(issues: AccessibilityIssue[], pageUrl: string): string[] {
  const key = normalizePageUrl(pageUrl)
  return issues
    .filter((i) => {
      const url = i.expand?.page?.url
      return url && normalizePageUrl(url) === key && i.status === 'open'
    })
    .map(i => i.id)
}
