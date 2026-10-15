export type DashboardSectionId = 'accessibility' | 'qa' | 'seo'

export const DASHBOARD_SECTION_IDS: DashboardSectionId[] = [
  'accessibility',
  'qa',
  'seo'
]

export const DEFAULT_DASHBOARD_SECTION_ORDER: DashboardSectionId[] = [
  ...DASHBOARD_SECTION_IDS
]

export const DASHBOARD_SECTION_LABELS: Record<DashboardSectionId, string> = {
  accessibility: 'Accessibility',
  qa: 'Quality Assurance',
  seo: 'SEO'
}

/** H2 titles on the site Overview dashboard (longer SEO label). */
export const DASHBOARD_SECTION_HEADINGS: Record<DashboardSectionId, string> = {
  accessibility: 'Accessibility',
  qa: 'Quality Assurance',
  seo: 'Search Engine Optimisation'
}

/** Contextual “view full” link labels on Overview section headers. */
export const DASHBOARD_SECTION_VIEW_LABELS: Record<DashboardSectionId, string> = {
  accessibility: 'View accessibility',
  qa: 'View quality assurance',
  seo: 'View SEO'
}

export const DASHBOARD_SECTION_STORAGE_KEY = 'sitenook:dashboard-section-order'

export function normalizeDashboardSectionOrder(stored: unknown): DashboardSectionId[] {
  if (!Array.isArray(stored)) {
    return [...DEFAULT_DASHBOARD_SECTION_ORDER]
  }

  const valid = stored.filter(
    (id): id is DashboardSectionId =>
      typeof id === 'string' && DASHBOARD_SECTION_IDS.includes(id as DashboardSectionId)
  )
  const deduped = [...new Set(valid)]
  const missing = DASHBOARD_SECTION_IDS.filter(id => !deduped.includes(id))

  if (!deduped.length) {
    return [...DEFAULT_DASHBOARD_SECTION_ORDER]
  }

  return [...deduped, ...missing]
}

export function readDashboardSectionOrderForOrg(
  storedByOrg: Record<string, unknown> | null | undefined,
  orgId: string | null | undefined
): DashboardSectionId[] {
  const key = orgId || 'default'
  return normalizeDashboardSectionOrder(storedByOrg?.[key])
}

export function writeDashboardSectionOrderForOrg(
  storedByOrg: Record<string, DashboardSectionId[]>,
  orgId: string | null | undefined,
  order: DashboardSectionId[]
): Record<string, DashboardSectionId[]> {
  const key = orgId || 'default'
  return {
    ...storedByOrg,
    [key]: normalizeDashboardSectionOrder(order)
  }
}

export function dashboardSectionViewPath(
  sectionId: DashboardSectionId,
  siteId: string
): string {
  switch (sectionId) {
    case 'accessibility':
      return `/sites/${siteId}/accessibility`
    case 'qa':
      return `/sites/${siteId}/qa`
    case 'seo':
      return `/sites/${siteId}/seo`
  }
}

export function dashboardOrgSectionViewPath(sectionId: DashboardSectionId): string {
  switch (sectionId) {
    case 'accessibility':
      return '/accessibility'
    case 'qa':
      return '/qa'
    case 'seo':
      return '/seo'
  }
}
