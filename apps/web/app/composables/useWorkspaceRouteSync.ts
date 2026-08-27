import { pathToAlignWorkspaceWithRoute } from '~/utils/workspaceRouteSync'

/** Keeps workspace mode and feature routes aligned across the app. */
export function useWorkspaceRouteSync() {
  const route = useRoute()
  const { isAllSites, activeSiteId, selectSite } = useSites()

  function syncWorkspaceFromRoute(path: string, id: unknown) {
    if (isAllSites.value) return
    if (typeof id === 'string' && id && path.startsWith('/sites/')) {
      selectSite(id)
    }
  }

  function alignRouteWithWorkspace(path: string) {
    const nextPath = pathToAlignWorkspaceWithRoute(
      path,
      isAllSites.value,
      activeSiteId.value
    )
    if (nextPath && nextPath !== path) {
      navigateTo(nextPath)
    }
  }

  watch(
    () => [route.path, isAllSites.value, activeSiteId.value] as const,
    ([path]) => {
      alignRouteWithWorkspace(path)
    },
    { immediate: true }
  )

  watch(
    () => [route.path, route.params.id] as const,
    ([path, id]) => syncWorkspaceFromRoute(path, id),
    { immediate: true }
  )
}
