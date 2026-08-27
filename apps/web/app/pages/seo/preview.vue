<script setup lang="ts">
import type { SerpDevice } from '~/utils/serpPreview'

definePageMeta({ middleware: ['auth', 'plan-feature'], planFeature: 'seoModule' })

const { resolvedSiteId } = useWorkspaceSiteFilter()
const { pages, loading, fetchPages } = useOrgReadability(resolvedSiteId)
const { sites } = useSites()

const selectedKey = ref('')
const title = ref('')
const metaDescription = ref('')
const device = ref<SerpDevice>('mobile')
const fetching = ref(false)

const pageOptions = computed(() =>
  pages.value.map(page => ({
    label: `${page.siteName} — ${page.url}`,
    value: `${page.siteId}::${page.url}`,
    siteId: page.siteId,
    url: page.url
  }))
)

const selectedPage = computed(() => {
  const [siteId, url] = selectedKey.value.split('::')
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
  selectedKey.value = ''
  void fetchPages()
})

watch(selectedPage, async (page) => {
  if (!page) return
  title.value = page.title || ''
  metaDescription.value = ''
  fetching.value = true
  try {
    const result = await $fetch<{ title?: string, description?: string }>('/api/seo-meta-preview', {
      query: {
        url: page.url,
        siteUrl: selectedSite.value?.url ?? page.url
      }
    })
    title.value = result.title || page.title || ''
    metaDescription.value = result.description || ''
  } catch {
    // keep page title fallback
  } finally {
    fetching.value = false
  }
})
</script>

<template>
  <OrgFeaturePageShell title="Search Result Preview">
    <div v-if="loading" class="flex justify-center py-10">
      <UIcon name="i-lucide-loader-circle" class="size-7 animate-spin text-muted" />
    </div>
    <div v-else class="grid gap-6 lg:grid-cols-2">
      <div class="space-y-4">
        <UFormField label="Page">
          <USelectMenu
            v-model="selectedKey"
            :items="pageOptions"
            value-key="value"
            placeholder="Select a page"
            class="w-full"
          />
        </UFormField>
        <SeoSerpPreviewEditor
          v-model:title="title"
          v-model:meta-description="metaDescription"
          :loading="fetching"
        />
      </div>
      <SeoSerpPreviewCard
        v-if="selectedPage"
        :url="selectedPage.url"
        :title="title"
        :description="metaDescription"
        :device="device"
        @update:device="device = $event"
      />
      <p v-else class="text-sm text-muted">
        Select a page to preview search results.
      </p>
    </div>
  </OrgFeaturePageShell>
</template>
