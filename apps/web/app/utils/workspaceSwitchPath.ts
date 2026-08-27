import { isOrgFeaturePath, orgFeaturePathFromSite, siteFeaturePathFromOrg } from '~/utils/orgFeaturePaths'

const WORKSPACE_NEUTRAL_PREFIXES = [
  '/search',
  '/scans',
  '/reports',
  '/policies',
  '/settings'
] as const

/** Routes that are not tied to a single site — switching workspace should not navigate away. */
export function isWorkspaceNeutralPath(path: string): boolean {
  if (path === '/' || path === '/sites') return true
  return WORKSPACE_NEUTRAL_PREFIXES.some(
    prefix => path === prefix || path.startsWith(`${prefix}/`)
  )
}

/** Path after selecting a site, or null to remain on the current page. */
export function pathAfterSelectSite(currentPath: string, siteId: string): string | null {
  if (isWorkspaceNeutralPath(currentPath)) return null

  if (isOrgFeaturePath(currentPath)) {
    return siteFeaturePathFromOrg(currentPath, siteId)
  }

  const siteRoute = currentPath.match(/^\/sites\/[^/]+(\/.*)?$/)
  if (siteRoute) {
    return `/sites/${siteId}${siteRoute[1] || ''}`
  }

  return null
}

/** Path after selecting all sites, or null to remain on the current page. */
export function pathAfterSelectAllSites(currentPath: string): string | null {
  if (isWorkspaceNeutralPath(currentPath)) return null

  const orgPath = orgFeaturePathFromSite(currentPath)
  if (orgPath) return orgPath

  if (/^\/sites\/[^/]+$/.test(currentPath)) return '/'

  return null
}
