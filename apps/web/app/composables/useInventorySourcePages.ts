import type { InventorySourcePageSummary } from '~/types/sitenook'
import { orgApiFetch } from '~/utils/orgApiFetch'
import { normalizeInventoryUrl } from '~/utils/inventoryUrl'

function cacheKey(siteId: string, url: string): string {
  return `${siteId}:${normalizeInventoryUrl(url).toLowerCase()}`
}

export const useInventorySourcePages = createSharedComposable(function useInventorySourcePages(options?: {
  siteId?: Ref<string | undefined> | ComputedRef<string | undefined>
}) {
  const { resolvedSiteId: workspaceSiteId } = useWorkspaceSiteFilter()
  const resolvedSiteId = computed(() => {
    const override = options?.siteId?.value
    if (override) return override
    return workspaceSiteId.value
  })

  const sourcePagesCache = ref<Map<string, InventorySourcePageSummary[]>>(new Map())
  const sourcePagesLoading = ref<Set<string>>(new Set())
  const sourcePagesTick = ref(0)

  function bumpSourcePagesTick() {
    sourcePagesTick.value += 1
  }

  function getSourcePages(siteId: string, url: string): InventorySourcePageSummary[] {
    void sourcePagesTick.value
    return sourcePagesCache.value.get(cacheKey(siteId, url)) ?? []
  }

  function isSourcePagesLoading(siteId: string, url: string): boolean {
    void sourcePagesTick.value
    return sourcePagesLoading.value.has(cacheKey(siteId, url))
  }

  async function loadSourcePages(
    url: string,
    siteIdOverride?: string
  ): Promise<InventorySourcePageSummary[]> {
    if (!import.meta.client || !url.trim()) return []

    const siteId = siteIdOverride ?? resolvedSiteId.value
    if (!siteId) return []

    const key = cacheKey(siteId, url)
    const cached = sourcePagesCache.value.get(key)
    if (cached) return cached
    if (sourcePagesLoading.value.has(key)) return []

    sourcePagesLoading.value = new Set(sourcePagesLoading.value).add(key)
    bumpSourcePagesTick()
    try {
      const response = await orgApiFetch<{ pages: InventorySourcePageSummary[] }>(
        '/api/org/qa/inventory/references',
        {
          url: normalizeInventoryUrl(url),
          siteId
        }
      )
      const pages = response.pages ?? []
      sourcePagesCache.value = new Map(sourcePagesCache.value).set(key, pages)
      bumpSourcePagesTick()
      return pages
    } catch {
      sourcePagesCache.value = new Map(sourcePagesCache.value).set(key, [])
      bumpSourcePagesTick()
      return []
    } finally {
      const next = new Set(sourcePagesLoading.value)
      next.delete(key)
      sourcePagesLoading.value = next
      bumpSourcePagesTick()
    }
  }

  return {
    getSourcePages,
    loadSourcePages,
    isSourcePagesLoading
  }
})
