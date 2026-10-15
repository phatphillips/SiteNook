<script setup lang="ts">
import type { Scan } from '~/types/sitenook'
import { buildContentExplorerSiteRows, type ContentExplorerSiteRow } from '~/utils/contentExplorerSites'
import { pbRelation } from '~/utils/pbFilter'
import { pathAfterSelectSite } from '~/utils/workspaceSwitchPath'
import type { SimulatorVisionId } from '~/utils/simulatorChecks'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const { pb } = usePocketBase()
const { sites, fetchSites, activeSiteId, selectSite, isAllSites } = useSites()
const resolvedSiteId = computed(() => (isAllSites.value ? undefined : activeSiteId.value) || undefined)

const siteRows = ref<ContentExplorerSiteRow[]>([])
const sitesLoading = ref(false)
const visionId = ref<SimulatorVisionId>('none')
const tabOrder = ref(false)

async function loadSiteRows() {
  if (!pb) {
    siteRows.value = []
    return
  }
  sitesLoading.value = true
  try {
    const scansBySiteId: Record<string, Scan[]> = {}
    await Promise.all(sites.value.map(async (site) => {
      const scans = await pb!.collection('scans').getList(1, 5, {
        filter: pbRelation('site', site.id),
        sort: '-completed_at,-started_at',
        fields: 'id,status,completed_at,created,pages_crawled'
      })
      scansBySiteId[site.id] = scans.items as unknown as Scan[]
    }))
    siteRows.value = buildContentExplorerSiteRows(sites.value, scansBySiteId)
  } catch {
    siteRows.value = buildContentExplorerSiteRows(sites.value, {})
  } finally {
    sitesLoading.value = false
  }
}

async function openSite(siteId: string) {
  selectSite(siteId)
  const next = pathAfterSelectSite(route.path, siteId)
    || `/sites/${siteId}/accessibility/simulator`
  await navigateTo(next)
}

onMounted(async () => {
  await fetchSites()
})

watch([sites, resolvedSiteId], async ([, siteId]) => {
  if (!siteId) {
    await loadSiteRows()
  }
}, { immediate: true })

watch(resolvedSiteId, () => {
  visionId.value = 'none'
})
</script>

<template>
  <OrgFeaturePageShell
    title="Simulator"
    :fluid="Boolean(resolvedSiteId)"
  >
    <template #right>
      <ScanTriggerButton
        v-if="resolvedSiteId"
        :site-id="resolvedSiteId"
      />
    </template>

    <ContentExplorerSitesTable
      v-if="!resolvedSiteId"
      :rows="siteRows"
      :loading="sitesLoading"
      heading="All sites"
      description="Choose a site to simulate vision impairments on crawl page snapshots."
      @select="openSite"
    />

    <AccessibilitySimulatorWorkspace
      v-else
      v-model:vision-id="visionId"
      v-model:tab-order="tabOrder"
      :site-id="resolvedSiteId"
    />
  </OrgFeaturePageShell>
</template>
