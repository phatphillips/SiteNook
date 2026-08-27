import { ALL_SITES } from '~/composables/useSites'

/** Org list pages: undefined = all sites in workspace, string = single site (should use site route). */
export function useWorkspaceSiteFilter() {
  const { isAllSites, activeSiteId } = useSites()

  const resolvedSiteId = computed(() =>
    isAllSites.value ? undefined : (activeSiteId.value ?? undefined)
  )

  /** For composables that use the ALL_SITES sentinel. */
  const siteFilter = computed(() =>
    isAllSites.value ? ALL_SITES : (activeSiteId.value ?? ALL_SITES)
  )

  return { isAllSites, activeSiteId, resolvedSiteId, siteFilter }
}
