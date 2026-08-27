import type { DashboardSectionId } from '~/utils/dashboardSectionOrder'

export const ORG_FEATURE_ROOTS = ['/content', '/accessibility', '/qa', '/seo'] as const

export function isOrgFeaturePath(path: string): boolean {
  return ORG_FEATURE_ROOTS.some(
    root => path === root || path.startsWith(`${root}/`)
  )
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

export function siteFeaturePathFromOrg(path: string, siteId: string): string {
  for (const root of ORG_FEATURE_ROOTS) {
    if (path === root) return `/sites/${siteId}${root}`
    if (path.startsWith(`${root}/`)) return `/sites/${siteId}${path}`
  }
  return `/sites/${siteId}`
}

export function orgFeaturePathFromSite(path: string): string | null {
  // PDF document studio is site-scoped only (no org detail route). Keep the site URL.
  if (/^\/sites\/[^/]+\/accessibility\/pdfs\/[^/]+/.test(path)) {
    return null
  }
  const match = path.match(/^\/sites\/[^/]+(\/(?:content|accessibility|qa|seo)(?:\/.*)?)$/)
  return match?.[1] ?? null
}

export function orgFeatureSuffix(path: string): string | null {
  if (!isOrgFeaturePath(path)) return null
  for (const root of ORG_FEATURE_ROOTS) {
    if (path === root) return root
    if (path.startsWith(`${root}/`)) return path
  }
  return null
}
