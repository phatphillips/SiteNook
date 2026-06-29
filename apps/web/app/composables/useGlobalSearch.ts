import type { GlobalSearchParams, GlobalSearchResponse } from '~/types/globalSearch'

function pocketBaseErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const fetchError = error as {
      data?: { message?: string, statusMessage?: string }
      statusMessage?: string
      message?: string
    }
    if (fetchError.data?.statusMessage) return fetchError.data.statusMessage
    if (fetchError.data?.message) return fetchError.data.message
    if (fetchError.statusMessage) return fetchError.statusMessage
    if (fetchError.message) return fetchError.message
  }
  return 'Search failed'
}

export function useGlobalSearch() {
  const { pb } = usePocketBase()

  const loading = ref(false)
  const error = ref('')
  const results = ref<GlobalSearchResponse | null>(null)

  async function search(params: GlobalSearchParams): Promise<GlobalSearchResponse | null> {
    loading.value = true
    error.value = ''

    const token = pb?.authStore.token
    if (!token) {
      error.value = 'You must be signed in to search.'
      loading.value = false
      return null
    }

    try {
      const response = await $fetch<GlobalSearchResponse>('/api/global-search', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        query: {
          q: params.q,
          mode: params.mode,
          type: params.type,
          siteId: params.siteId || undefined,
          page: params.page || 1,
          perPage: params.perPage || undefined
        }
      })
      results.value = response
      return response
    } catch (e) {
      error.value = pocketBaseErrorMessage(e)
      return null
    } finally {
      loading.value = false
    }
  }

  function clearResults() {
    results.value = null
    error.value = ''
  }

  return {
    loading,
    error,
    results,
    search,
    clearResults
  }
}
