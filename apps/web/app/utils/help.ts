export type HelpCategoryId =
  | 'getting-started'
  | 'scanning'
  | 'accessibility'
  | 'account-billing'
  | 'troubleshooting'

export interface HelpCategoryMeta {
  id: HelpCategoryId
  label: string
  description: string
  icon: string
}

export interface HelpArticleSummary {
  title: string
  description: string
  category: HelpCategoryId
  categoryLabel: string
  path: string
  slug: string
  order: number
}

export interface HelpSearchHit {
  title: string
  description: string
  category: HelpCategoryId | string
  categoryLabel: string
  path: string
  snippet?: string
}

export interface HelpCatalogCategory extends HelpCategoryMeta {
  articleCount: number
  articles: HelpArticleSummary[]
}

export const HELP_CATEGORIES: HelpCategoryMeta[] = [
  {
    id: 'getting-started',
    label: 'Getting started',
    description: 'Add a site, run your first scan, and invite teammates.',
    icon: 'i-lucide-rocket'
  },
  {
    id: 'scanning',
    label: 'Scanning',
    description: 'Crawl settings, live progress, schedules, and cancellation.',
    icon: 'i-lucide-radar'
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    description: 'Scores, issues, readability, and WCAG findings.',
    icon: 'i-lucide-accessibility'
  },
  {
    id: 'account-billing',
    label: 'Account & billing',
    description: 'Plans, trials, teammates, and invoices.',
    icon: 'i-lucide-credit-card'
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting',
    description: 'Stuck scans, auth problems, and common fixes.',
    icon: 'i-lucide-wrench'
  }
]

const CATEGORY_IDS = new Set(HELP_CATEGORIES.map(c => c.id))

export function isHelpCategoryId(value: string): value is HelpCategoryId {
  return CATEGORY_IDS.has(value as HelpCategoryId)
}

export function helpCategoryLabel(category: string): string {
  return HELP_CATEGORIES.find(c => c.id === category)?.label ?? category
}

export function helpCategoryMeta(category: string): HelpCategoryMeta | undefined {
  return HELP_CATEGORIES.find(c => c.id === category)
}

/** `getting-started/first-scan` → path `/help/getting-started/first-scan` */
export function helpPathFromParts(category: string, slug: string): string {
  return `/help/${category}/${slug}`
}

export function parseHelpSlugParam(slugParam: string | string[]): {
  category: string
  slug: string
  pathKey: string
} | null {
  const parts = (Array.isArray(slugParam) ? slugParam : slugParam.split('/'))
    .map(p => p.trim())
    .filter(Boolean)
  if (parts.length === 1 && isHelpCategoryId(parts[0]!)) {
    return { category: parts[0]!, slug: '', pathKey: parts[0]! }
  }
  if (parts.length < 2) return null
  const category = parts[0]!
  const slug = parts.slice(1).join('/')
  if (!category || !slug) return null
  return { category, slug, pathKey: `${category}/${slug}` }
}
