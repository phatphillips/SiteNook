import type { Ref, ComputedRef } from 'vue'
import type { InventoryPageRow } from '~/types/sitenook'
import { watchDebounced } from '@vueuse/core'
import { orgApiFetch } from '~/utils/orgApiFetch'

export type OrgInventoryTab = 'pages' | 'files' | 'images' | 'pdfs'

export interface OrgInventoryPageRow extends InventoryPageRow {
  siteId: string
  siteName: string
}

export interface OrgInventoryAssetRow extends Record<string, unknown> {
  siteId: string
  siteName: string
}

interface OrgInventoryResponse<T> {
  items: T[]
  total: number
  page: number
  perPage: number
}

export function useOrgInventory(options?: {
  siteId?: Ref<string | undefined> | ComputedRef<string | undefined>
}) {
  const { resolvedSiteId: workspaceSiteId } = useWorkspaceSiteFilter()
  const resolvedSiteId = computed(() => {
    const override = options?.siteId?.value
    if (override) return override
    return workspaceSiteId.value
  })

  const tab = ref<OrgInventoryTab>('pages')
  const search = ref('')
  const page = ref(1)
  const perPage = ref(50)
  const pages = ref<OrgInventoryPageRow[]>([])
  const assets = ref<OrgInventoryAssetRow[]>([])
  const total = ref(0)
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref('')
  let fetchGeneration = 0

  async function fetchInventory() {
    if (!import.meta.client) return

    const generation = ++fetchGeneration
    const hasExistingData = tab.value === 'pages'
      ? pages.value.length > 0
      : assets.value.length > 0
    if (hasExistingData) {
      refreshing.value = true
    } else {
      loading.value = true
    }
    error.value = ''

    try {
      const result = await orgApiFetch<OrgInventoryResponse<OrgInventoryPageRow | OrgInventoryAssetRow>>(
        '/api/org/qa/inventory',
        {
          page: page.value,
          perPage: perPage.value,
          siteId: resolvedSiteId.value,
          search: search.value.trim() || undefined,
          tab: tab.value
        }
      )
      if (generation !== fetchGeneration) return

      total.value = result.total
      page.value = result.page
      perPage.value = result.perPage
      if (tab.value === 'pages') {
        pages.value = result.items as OrgInventoryPageRow[]
        assets.value = []
      } else {
        assets.value = result.items as OrgInventoryAssetRow[]
        pages.value = []
      }
    } catch (e: unknown) {
      if (generation !== fetchGeneration) return
      error.value = e instanceof Error ? e.message : 'Failed to load inventory'
      pages.value = []
      assets.value = []
      total.value = 0
    } finally {
      if (generation === fetchGeneration) {
        loading.value = false
        refreshing.value = false
      }
    }
  }

  watch([tab, resolvedSiteId, page], () => {
    void fetchInventory()
  }, { immediate: true })

  watch([tab, resolvedSiteId], () => {
    page.value = 1
  })

  watchDebounced(search, () => {
    if (page.value !== 1) {
      page.value = 1
      return
    }
    void fetchInventory()
  }, { debounce: 300 })

  onUnmounted(() => {
    fetchGeneration++
    pages.value = []
    assets.value = []
    total.value = 0
    error.value = ''
  })

  return {
    tab,
    search,
    page,
    perPage,
    total,
    pages,
    assets,
    loading,
    refreshing,
    error,
    fetchInventory
  }
}
