import { isOrgFeaturePath, orgFeaturePathFromSite, siteFeaturePathFromOrg } from '~/utils/orgFeaturePaths'

/**
 * When workspace and route disagree (e.g. all-sites mode on a /sites/:id/... URL),
 * return the path to navigate to, or null if already aligned.
 */
export function pathToAlignWorkspaceWithRoute(
  path: string,
  allSites: boolean,
  siteId: string | null
): string | null {
  if (allSites) {
    return orgFeaturePathFromSite(path)
  }

  if (siteId && isOrgFeaturePath(path)) {
    return siteFeaturePathFromOrg(path, siteId)
  }

  return null
}
