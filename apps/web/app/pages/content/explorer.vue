<script setup lang="ts">
import type { ContentExplorerEntry } from '~/types/sitenook'
import type { Scan } from '~/types/sitenook'
import { downloadAuthed } from '~/utils/downloadAuthed'
import { buildContentExplorerSiteRows, type ContentExplorerSiteRow } from '~/utils/contentExplorerSites'
import { pickDefaultContentExplorerEntry } from '~/utils/pickDefaultContentExplorerEntry'
import { pbRelation } from '~/utils/pbFilter'
import { pathAfterSelectSite } from '~/utils/workspaceSwitchPath'
import type { ExplorerViewMode, PreviewViewportId } from '~/utils/previewViewport'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const { pb } = usePocketBase()
const { sites, fetchSites, activeSiteId, selectSite, isAllSites } = useSites()
const resolvedSiteId = computed(() => (isAllSites.value ? undefined : activeSiteId.value) || undefined)

const {
  entries,
  latestScan,
  loading,
  error,
  fetchExplorerData
} = useContentExplorer(resolvedSiteId)

const selectedIds = ref<Set<string>>(new Set())
const activeEntry = ref<ContentExplorerEntry | null>(null)
const exporting = ref(false)
const treeSearch = ref('')
const previewViewport = ref<PreviewViewportId>('desktop')
const viewMode = ref<ExplorerViewMode>('preview')
const siteRows = ref<ContentExplorerSiteRow[]>([])
const sitesLoading = ref(false)
const workspaceRef = useTemplateRef<HTMLElement>('workspaceRef')
const { height: workspaceHeight, update: updateWorkspaceHeight } = useViewportRemainderHeight(workspaceRef)

const { isRunning } = useActiveWorkspaceScanState()

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
    || `/sites/${siteId}/content/explorer`
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

watch(isRunning, (running, wasRunning) => {
  if (wasRunning && !running && resolvedSiteId.value) {
    void fetchExplorerData()
  }
})

watch(entries, (list) => {
  if (!list.length) {
    activeEntry.value = null
    return
  }
  const currentId = activeEntry.value?.id
  if (currentId) {
    const stillPresent = list.find(entry => entry.id === currentId)
    if (stillPresent) {
      activeEntry.value = stillPresent
      return
    }
  }
  activeEntry.value = pickDefaultContentExplorerEntry(list)
}, { immediate: true })

watch([loading, error, latestScan], async () => {
  await nextTick()
  updateWorkspaceHeight()
})

function onSelect(entry: ContentExplorerEntry) {
  activeEntry.value = entry
}

function onToggle(entry: ContentExplorerEntry, checked: boolean) {
  const next = new Set(selectedIds.value)
  if (checked) next.add(entry.id)
  else next.delete(entry.id)
  selectedIds.value = next
}

function onToggleAll(checked: boolean) {
  if (!checked) {
    selectedIds.value = new Set()
    return
  }
  selectedIds.value = new Set(
    entries.value.filter(e => e.hasContent && e.blobId).map(e => e.id)
  )
}

async function downloadZip() {
  const siteId = resolvedSiteId.value
  if (!siteId) return
  const blobIds = entries.value
    .filter(e => selectedIds.value.has(e.id) && e.blobId)
    .map(e => e.blobId!)
  if (!blobIds.length) return
  exporting.value = true
  try {
    const params = new URLSearchParams({ blobIds: blobIds.join(',') })
    await downloadAuthed(`/api/sites/${siteId}/content/export?${params.toString()}`, 'content-export.zip')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <OrgFeaturePageShell
    title="Content Explorer"
    :fluid="Boolean(resolvedSiteId)"
  >
    <template #right>
      <ScanTriggerButton
        v-if="resolvedSiteId"
        :site-id="resolvedSiteId"
      />
    </template>
    <UAlert
      v-if="error"
      class="mb-4"
      color="error"
      variant="subtle"
      :title="error"
    />

    <ContentExplorerSitesTable
      v-if="!resolvedSiteId"
      :rows="siteRows"
      :loading="sitesLoading"
      @select="openSite"
    />

    <div
      v-else
      class="space-y-4"
    >
      <div
        ref="workspaceRef"
        class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-default bg-elevated"
        :style="{ height: workspaceHeight }"
      >
        <ContentExplorerToolbar
          v-model:viewport="previewViewport"
          v-model:view-mode="viewMode"
          :entry="activeEntry"
          show-download
          :can-download="selectedIds.size > 0"
          download-tooltip="Download ZIP"
          :exporting="exporting"
          show-viewport
          :scan-completed-at="latestScan?.completed_at || latestScan?.created || null"
          @download="downloadZip"
        />
        <div class="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 overflow-hidden lg:grid-cols-[minmax(20rem,28%)_1fr] lg:grid-rows-1">
          <ContentExplorerTree
            v-model:search="treeSearch"
            class="min-h-0 lg:border-r lg:border-default"
            :entries="entries"
            :loading="loading"
            :selected-ids="selectedIds"
            :active-entry-id="activeEntry?.id"
            @select="onSelect"
            @toggle="onToggle"
            @toggle-all="onToggleAll"
          />
          <ContentExplorerPreview
            v-model:viewport="previewViewport"
            v-model:view-mode="viewMode"
            :site-id="resolvedSiteId"
            :entry="activeEntry"
          />
        </div>
      </div>
    </div>
  </OrgFeaturePageShell>
</template>
