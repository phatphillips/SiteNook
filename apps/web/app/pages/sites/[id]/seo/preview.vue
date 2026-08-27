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



const selectedUrl = ref('')

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

  if (ogImage) faviconUrl.value = ogImage

}



watch(pages, (list) => {

  const first = list[0]

  if (!first || selectedUrl.value) return

  loadFromPage(first)

}, { immediate: true })



watch(selectedUrl, (url) => {

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

      description: e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Could not fetch page',

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

      <div class="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-4 lg:gap-5 items-start">

        <SeoSerpPreviewCard

          class="w-full min-w-0"

          :url="selectedUrl"

          :title="title"

          :meta-description="metaDescription"

          :device="device"

          :description-max="descriptionMax"

          :show-date="showDate"

          :show-favicon="showFavicon"

          :favicon-url="faviconUrl"

          :last-modified="(selectedPage as { last_modified?: string } | null)?.last_modified"

        />



        <div class="flex flex-col gap-3 min-w-0">

          <SeoSerpPagePicker

            v-model="selectedUrl"

            :pages="pages"

          />



          <SeoSerpPreviewEditor

            v-model:url="selectedUrl"

            v-model:title="title"

            v-model:meta-description="metaDescription"

            v-model:device="device"

            v-model:description-max="descriptionMax"

            v-model:show-date="showDate"

            v-model:show-favicon="showFavicon"

            :fetching="fetching"

            :content-issues="pageContentIssues"

            @fetch="fetchLiveMeta"

            @issue-click="openIssue"

          />

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

