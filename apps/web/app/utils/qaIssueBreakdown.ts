export type QaIssueCategoryId =
  | 'broken_links'
  | 'misspellings'
  | 'words_to_review'
  | 'policies'
  | 'inventory'

export interface QaIssueBreakdownRow {
  id: QaIssueCategoryId
  label: string
  count: number
  to: string
  icon: string
  accentColor: string
}

const QA_CATEGORY_META: Record<QaIssueCategoryId, { icon: string, accentColor: string }> = {
  broken_links: { icon: 'i-lucide-unlink', accentColor: '#c62828' },
  misspellings: { icon: 'i-lucide-spell-check', accentColor: '#e65100' },
  words_to_review: { icon: 'i-lucide-text-search', accentColor: '#f9a825' },
  policies: { icon: 'i-lucide-shield-alert', accentColor: '#6a1b9a' },
  inventory: { icon: 'i-lucide-package', accentColor: '#1565c0' }
}

export function buildQaIssueBreakdown(input: {
  brokenLinks: number
  misspellings: number
  wordsToReview: number
  policies: number
  inventory: number
  siteId: string
}): QaIssueBreakdownRow[] {
  const base = `/sites/${input.siteId}/qa`
  return [
    {
      id: 'broken_links',
      label: 'Broken links',
      count: input.brokenLinks,
      to: `${base}/links`,
      ...QA_CATEGORY_META.broken_links
    },
    {
      id: 'misspellings',
      label: 'Misspellings',
      count: input.misspellings,
      to: `${base}/spelling`,
      ...QA_CATEGORY_META.misspellings
    },
    {
      id: 'words_to_review',
      label: 'Words to review',
      count: input.wordsToReview,
      to: `${base}/spelling`,
      ...QA_CATEGORY_META.words_to_review
    },
    {
      id: 'policies',
      label: 'Policy matches',
      count: input.policies,
      to: `${base}/policies`,
      ...QA_CATEGORY_META.policies
    },
    {
      id: 'inventory',
      label: 'Inventory assets',
      count: input.inventory,
      to: `${base}/inventory`,
      ...QA_CATEGORY_META.inventory
    }
  ]
}

export function totalOpenQaIssues(input: {
  brokenLinks: number
  misspellings: number
  policies: number
}): number {
  return input.brokenLinks + input.misspellings + input.policies
}
