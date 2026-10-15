<script setup lang="ts">
import type { SeoIssue } from '~/types/sitenook'
import type { SerpDevice } from '~/utils/serpPreview'
import { filterSeoIssues } from '~/utils/seoIssues'

definePageMeta({ middleware: ['auth', 'plan-feature'], planFeature: 'seoModule' })

const route = useRoute()
const toast = useToast()
const { pb } = usePocketBase()
const siteId = computed(() => route.params.id as string)
const { sites, activeSiteId } = useSites()
const { pages, openIssues } = useSEO(siteId, { summary: false, parts: ['issues', 'pages'] })

const selectedUrl = ref<string | null>(null)
const title = ref('')
const metaDescription = ref('')
const device = ref<SerpDevice>('mobile')
const descriptionMax = ref(157)
const showDate = ref(true)
const showFavicon = ref(true)
const fetching = ref(false)
const faviconUrl = ref('')

const selectedIssue = ref<SeoIssue | null>(null)
const drawerOpen = ref(false)

const site = computed(() => sites.value.find(s => s.id === siteId.value))

const selectedPage = computed(() =>
  pages.value.find(p => p.url === selectedUrl.value) ?? null
)

const pageContentIssues = computed(() => {
  if (!selectedPage.value) return []
  return filterSeoIssues(openIssues.value, {
    category: 'content',
    statuses: ['open']
  }).filter(i => i.page === selectedPage.value?.id)
})

function metaDescriptionFromSnapshot(page: NonNullable<typeof selectedPage.value>): string {
  const snap = page.seo_snapshot as { metaDescription?: string } | undefined
  const raw = typeof snap?.metaDescription === 'string' ? snap.metaDescription.trim() : ''
  return raw
}

function loadFromPage(page: typeof selectedPage.value) {
  if (!page) return
  selectedUrl.value = page.url
  title.value = page.title?.trim() ?? ''
  metaDescription.value = metaDescriptionFromSnapshot(page)
  const snap = page.seo_snapshot as { og?: { image?: string } } | undefined
  const ogImage = snap?.og?.image
  faviconUrl.value = typeof ogImage === 'string' ? ogImage : ''
}

watch(pages, (list) => {
  const first = list[0]
  if (!first) return
  if (!selectedUrl.value || !list.some(p => p.url === selectedUrl.value)) {
    loadFromPage(first)
  }
}, { immediate: true })

watch(selectedUrl, (url) => {
  if (!url) return
  const page = pages.value.find(p => p.url === url)
  if (page) loadFromPage(page)
})

onMounted(() => {
  activeSiteId.value = siteId.value
})

async function fetchLiveMeta() {
  if (!selectedUrl.value || !site.value?.url || !pb) return

  fetching.value = true
  try {
    const data = await $fetch<{
      title: string
      metaDescription: string
      favicon: string
    }>('/api/seo-meta-preview', {
      query: { url: selectedUrl.value, siteUrl: site.value.url },
      headers: { Authorization: `Bearer ${pb.authStore.token}` }
    })

    if (data.title?.trim()) title.value = data.title.trim()
    metaDescription.value = data.metaDescription?.trim() ?? ''
    if (data.favicon) faviconUrl.value = data.favicon

    toast.add({ title: 'Page meta fetched' })
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

function openIssue(issue: SeoIssue) {
  selectedIssue.value = issue
  drawerOpen.value = true
}
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Search Result Preview" />
    </template>

    <template #body>
      <div class="overflow-hidden rounded-xl border border-default bg-elevated">
        <div class="grid grid-cols-1 lg:grid-cols-[minmax(20rem,42%)_1fr]">
          <div class="min-w-0 space-y-5 border-b border-default bg-elevated p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <div class="space-y-3">
              <SeoSerpPagePicker
                v-model="selectedUrl"
                :pages="pages"
              />

              <div
                v-if="selectedUrl"
                class="flex flex-col gap-2 sm:flex-row sm:items-start"
              >
                <p class="min-w-0 flex-1 break-all text-xs text-muted">
                  {{ selectedUrl }}
                </p>
                <UButton
                  size="sm"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-refresh-cw"
                  label="Fetch live meta"
                  class="shrink-0"
                  :loading="fetching"
                  :disabled="!selectedUrl"
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
              :content-issues="pageContentIssues"
              @issue-click="openIssue"
            />
          </div>

          <div class="min-w-0 bg-elevated p-4 sm:p-5 lg:sticky lg:top-0 lg:self-start">
            <div class="mb-3 space-y-1">
              <p class="text-sm font-medium text-highlighted">
                Search result preview
              </p>
              <p class="text-xs text-muted">
                Approximate Google {{ device }} snippet. Truncation and layout can differ in real results.
              </p>
            </div>
            <SeoSerpPreviewCard
              class="w-full min-w-0"
              :url="selectedUrl || ''"
              :title="title"
              :meta-description="metaDescription"
              :device="device"
              :description-max="descriptionMax"
              :show-date="showDate"
              :show-favicon="showFavicon"
              :favicon-url="faviconUrl"
              :last-modified="(selectedPage as { last_modified?: string } | null)?.last_modified"
            />
          </div>
        </div>
      </div>

      <SeoIssueDetailDrawer
        :issue="selectedIssue"
        :open="drawerOpen"
        :site-id="siteId"
        @update:open="drawerOpen = $event"
      />
    </template>
  </AppDashboardPanel>
</template>
