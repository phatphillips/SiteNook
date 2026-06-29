<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { brokenLinks, loading, latestScan, fetchBrokenLinks } = useQA(siteId)

const view = ref<'pages' | 'links'>('pages')
const hrefSearch = ref('')

let hrefSearchTimer: ReturnType<typeof setTimeout> | null = null

watch(hrefSearch, (value) => {
  if (hrefSearchTimer) clearTimeout(hrefSearchTimer)
  hrefSearchTimer = setTimeout(() => {
    fetchBrokenLinks({ hrefQuery: value.trim() || undefined }).catch(() => {})
  }, 300)
})

const urlSearchActive = computed(() => hrefSearch.value.trim().length > 0)
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Broken Links" />
    </template>
    <template #body>
      <SitePageToolbar class="mb-2" />
      <div class="space-y-4">
        <p
          v-if="!latestScan && !loading"
          class="text-sm text-muted py-8 text-center"
        >
          No scan data yet. Run a scan to populate broken links.
        </p>

        <template v-else>
          <DataTableToolbar>
            <template #leading>
              <QaBrokenLinkViewTabs v-model="view" />
            </template>
            <template #actions>
              <TableSearchInput
                v-model="hrefSearch"
                placeholder="Filter by URL…"
                aria-label="Filter links by URL"
              />
            </template>
          </DataTableToolbar>

          <QaBrokenLinkTable
            :links="brokenLinks"
            :view="view"
            :url-search-active="urlSearchActive"
            :loading="loading"
          />
        </template>
      </div>
    </template>
  </AppDashboardPanel>
</template>
