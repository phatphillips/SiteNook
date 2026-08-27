import type { AccessibilityIssue, Scan } from '~/types/sitenook'

export interface A11yPageRow {
  id: string
  url: string
  title?: string
  scan: string
  site?: string
  created?: string
  expand?: { scan?: Scan }
}

/** Attach page url/title from a lightweight page map (avoids expand: 'page' on issues). */
export function attachPageMetaToIssues(
  issues: AccessibilityIssue[],
  pageById: Map<string, { url: string, title?: string }>
): AccessibilityIssue[] {
  for (const issue of issues) {
    const page = pageById.get(issue.page)
    if (page) {
      issue.expand = { page: { url: page.url, title: page.title } }
    }
  }
  return issues
}

export function pageUrlMapFromRows(
  pages: A11yPageRow[]
): Map<string, { url: string, title?: string }> {
  const map = new Map<string, { url: string, title?: string }>()
  for (const page of pages) {
    map.set(page.id, { url: page.url, title: page.title })
  }
  return map
}
