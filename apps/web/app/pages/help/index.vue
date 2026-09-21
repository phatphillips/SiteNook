<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import type { HelpCatalogCategory, HelpSearchHit } from '~/utils/help'

definePageMeta({
  middleware: 'marketing-public'
})

interface HelpCatalogResponse {
  categories: HelpCatalogCategory[]
}

interface HelpSearchResponse {
  hits: HelpSearchHit[]
  found: number
  unavailable?: boolean
}

const route = useRoute()
const router = useRouter()

const { data: catalog } = await useAsyncData('help-catalog', () =>
  $fetch<HelpCatalogResponse>('/api/help/catalog')
)

const categories = computed(() => catalog.value?.categories ?? [])

const query = ref(String(route.query.q || ''))
const searchHits = ref<HelpSearchHit[]>([])
const searchLoading = ref(false)
const searchUnavailable = ref(false)
const hasActiveQuery = computed(() => query.value.trim().length > 0)

async function runSearch(q: string) {
  const trimmed = q.trim()
  if (!trimmed) {
    searchHits.value = []
    searchUnavailable.value = false
    searchLoading.value = false
    return
  }

  searchLoading.value = true
  try {
    const result = await $fetch<HelpSearchResponse>('/api/help/search', {
      query: { q: trimmed }
    })
    searchHits.value = result.hits ?? []
    searchUnavailable.value = Boolean(result.unavailable)
  } catch (error: unknown) {
    const status = error && typeof error === 'object' && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode)
      : 0
    if (status === 503) {
      searchUnavailable.value = true
      searchHits.value = []
    } else {
      searchUnavailable.value = true
      searchHits.value = []
    }
  } finally {
    searchLoading.value = false
  }
}

watchDebounced(
  query,
  async (value) => {
    const trimmed = value.trim()
    const nextQuery = trimmed ? { q: trimmed } : {}
    await router.replace({ query: nextQuery })
    await runSearch(trimmed)
  },
  { debounce: 200 }
)

onMounted(() => {
  if (query.value.trim()) void runSearch(query.value)
})

useSeoMeta({
  title: 'Help Center',
  description: 'Guides and answers for scanning, accessibility, and troubleshooting SiteNook.'
})
</script>

<template>
  <div>
    <section class="border-b border-default/60">
      <div class="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p class="mb-3 text-sm font-medium text-primary">
          Help
        </p>
        <h1 class="text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl">
          Help Center
        </h1>
        <p class="mt-3 text-base text-muted sm:text-lg">
          Search guides or browse by topic.
        </p>
        <div class="mt-8">
          <HelpSearchInput
            v-model="query"
            :loading="searchLoading"
          />
        </div>
      </div>
    </section>

    <section>
      <div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <HelpSearchResults
          v-if="hasActiveQuery"
          :hits="searchHits"
          :query="query.trim()"
          :loading="searchLoading"
          :unavailable="searchUnavailable"
        />
        <HelpCategoryGrid
          v-else
          :categories="categories"
        />
      </div>
    </section>
  </div>
</template>
