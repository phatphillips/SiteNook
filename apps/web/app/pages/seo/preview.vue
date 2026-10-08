<script setup lang="ts">
import type { SerpDevice, SerpPagePickerItem } from '~/utils/serpPreview'

definePageMeta({ middleware: ['auth', 'plan-feature'], planFeature: 'seoModule' })

const toast = useToast()
const { pb } = usePocketBase()
const { resolvedSiteId } = useWorkspaceSiteFilter()
const { pages, loading, fetchPages } = useOrgReadability(resolvedSiteId)
const { sites } = useSites()

const selectedKey = ref<string | null>(null)
const title = ref('')
const metaDescription = ref('')
const device = ref<SerpDevice>('mobile')
const descriptionMax = ref(157)
const showDate = ref(true)
const showFavicon = ref(true)
const fetching = ref(false)
const faviconUrl = ref('')

const pageItems = computed<SerpPagePickerItem[]>(() =>
  pages.value.map((page) => {
    const titleLabel = page.title?.trim()
    return {
      label: titleLabel || page.url,
      description: `${page.siteName} · ${page.url}`,
      value: `${page.siteId}::${page.url}`
    }
  })
)

const selectedPage = computed(() => {
  if (!selectedKey.value) return null
  const [siteId, ...urlParts] = selectedKey.value.split('::')
  const url = urlParts.join('::')
  if (!siteId || !url) return null
  return pages.value.find(p => p.siteId === siteId && p.url === url) ?? null
})

const selectedSite = computed(() =>
  sites.value.find(s => s.id === selectedPage.value?.siteId) ?? null
)

onMounted(() => {
  void fetchPages()
})

watch(resolvedSiteId, () => {
  selectedKey.value = null
  void fetchPages()
})

watch(pages, (list) => {
  const first = list[0]
  if (!first) return
  const key = `${first.siteId}::${first.url}`
  if (!selectedKey.value || !list.some(p => `${p.siteId}::${p.url}` === selectedKey.value)) {
    selectedKey.value = key
  }
}, { immediate: true })

watch(selectedPage, (page) => {
  if (!page) return
  title.value = page.title?.trim() || ''
  metaDescription.value = ''
  faviconUrl.value = ''
  void fetchLiveMeta()
})

async function fetchLiveMeta() {
  const page = selectedPage.value
  if (!page || !pb) return

  fetching.value = true
  try {
    const data = await $fetch<{
      title?: string
      metaDescription?: string
      description?: string
      favicon?: string
    }>('/api/seo-meta-preview', {
      query: {
        url: page.url,
        siteUrl: selectedSite.value?.url ?? page.url
      },
      headers: { Authorization: `Bearer ${pb.authStore.token}` }
    })

    title.value = data.title?.trim() || page.title || ''
    metaDescription.value = (data.metaDescription ?? data.description)?.trim() || ''
    if (data.favicon) faviconUrl.value = data.favicon
  } catch (e: unknown) {
    toast.add({
      title: 'Fetch failed',
      description: e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Could not fetch page',
      color: 'error'
    })
  } finally {
    fetching.value = false
  }
}
</script>

<template>
  <OrgFeaturePageShell title="Search Result Preview">
    <div
      v-if="loading && !pages.length"
      class="flex justify-center py-10"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-7 animate-spin text-muted"
      />
    </div>

    <div
      v-else
      class="overflow-hidden rounded-xl border border-default bg-default"
    >
      <div class="grid grid-cols-1 lg:grid-cols-[minmax(20rem,42%)_1fr]">
        <div class="min-w-0 space-y-5 border-b border-default p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <div class="space-y-3">
            <SeoSerpPagePicker
              v-model="selectedKey"
              :items="pageItems"
            />

            <div
              v-if="selectedPage"
              class="flex flex-col gap-2 sm:flex-row sm:items-start"
            >
              <p class="min-w-0 flex-1 break-all text-xs text-muted">
                {{ selectedPage.url }}
              </p>
              <UButton
                size="sm"
                color="neutral"
                variant="outline"
                icon="i-lucide-refresh-cw"
                label="Fetch live meta"
                class="shrink-0"
                :loading="fetching"
                @click="fetchLiveMeta"
              />
            </div>
          </div>

          <SeoSerpPreviewEditor
            v-model:title="title"
            v-model:meta-description="metaDescription"
            v-model:device="device"
            v-model:description-max="descriptionMax"
            v-model:show-date="showDate"
            v-model:show-favicon="showFavicon"
          />
        </div>

        <div class="min-w-0 bg-elevated/20 p-4 sm:p-5 lg:sticky lg:top-0 lg:self-start">
          <div class="mb-3 space-y-1">
            <p class="text-sm font-medium text-highlighted">
              Search result preview
            </p>
            <p class="text-xs text-muted">
              Approximate Google {{ device }} snippet. Truncation and layout can differ in real results.
            </p>
          </div>

          <SeoSerpPreviewCard
            v-if="selectedPage"
            class="w-full min-w-0"
            :url="selectedPage.url"
            :title="title"
            :meta-description="metaDescription"
            :device="device"
            :description-max="descriptionMax"
            :show-date="showDate"
            :show-favicon="showFavicon"
            :favicon-url="faviconUrl"
          />
          <p
            v-else
            class="text-sm text-muted"
          >
            Select a page to preview search results.
          </p>
        </div>
      </div>
    </div>
  </OrgFeaturePageShell>
</template>
