export type SeoIssueCategoryId = 'technical' | 'crawlability' | 'content'

export interface SeoIssueBreakdownRow {
  id: SeoIssueCategoryId
  label: string
  count: number
  to: string
  icon: string
  accentColor: string
}

const SEO_CATEGORY_META: Record<SeoIssueCategoryId, { icon: string, accentColor: string }> = {
  technical: { icon: 'i-lucide-settings-2', accentColor: '#1565c0' },
  crawlability: { icon: 'i-lucide-bot', accentColor: '#6a1b9a' },
  content: { icon: 'i-lucide-file-text', accentColor: '#e65100' }
}

export function buildSeoIssueBreakdown(input: {
  technical: number
  crawlability: number
  content: number
  siteId: string
}): SeoIssueBreakdownRow[] {
  const base = `/sites/${input.siteId}/seo`
  return [
    {
      id: 'technical',
      label: 'Technical',
      count: input.technical,
      to: `${base}/technical`,
      ...SEO_CATEGORY_META.technical
    },
    {
      id: 'crawlability',
      label: 'Crawlability',
      count: input.crawlability,
      to: `${base}/technical?subcategory=crawlability`,
      ...SEO_CATEGORY_META.crawlability
    },
    {
      id: 'content',
      label: 'Content',
      count: input.content,
      to: `${base}/content`,
      ...SEO_CATEGORY_META.content
    }
  ]
}

export function totalOpenSeoIssues(input: {
  technical: number
  crawlability: number
  content: number
}): number {
  return input.technical + input.crawlability + input.content
}
