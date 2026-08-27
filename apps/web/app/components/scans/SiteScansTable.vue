<script setup lang="ts">
import type { Scan, Site } from '~/types/sitenook'
import { formatNextScanLabel } from '~/utils/scheduleNextRun'

const props = defineProps<{
  sites: Site[]
  latestScanBySiteId: Map<string, Scan>
  latestCompleteScanBySiteId: Map<string, Scan>
  actionLoadingId?: string | null
  isSiteBusy: (siteId: string) => boolean
}>()

const emit = defineEmits<{
  viewResults: [scan: Scan]
  startAgain: [scan: Scan]
  configureScan: [site: Site]
  configureFromScan: [scan: Scan]
  delete: [scan: Scan]
  refresh: []
}>()

const {
  scansBySite,
  loadScansForSite,
  isSiteScansLoading,
  isSiteScansLoaded,
  expandedSiteId
} = useScans()

const searchQuery = ref('')

type SiteColumnKey = 'schedule' | 'nextScan' | 'lastScan' | 'qa' | 'actions'

const COLUMN_LABELS: Record<SiteColumnKey, string> = {
  schedule: 'Schedule',
  nextScan: 'Next scan',
  lastScan: 'Last scan',
  qa: 'QA',
  actions: 'Actions'
}

const columnVisibility = ref<Record<SiteColumnKey, boolean>>({
  schedule: true,
  nextScan: true,
  lastScan: true,
  qa: true,
  actions: true
})

const columnMenuItems = computed(() =>
  (Object.keys(COLUMN_LABELS) as SiteColumnKey[]).map(key => ({
    label: COLUMN_LABELS[key],
    type: 'checkbox' as const,
    checked: columnVisibility.value[key],
    onUpdateChecked(checked: boolean) {
      columnVisibility.value = { ...columnVisibility.value, [key]: !!checked }
    },
    onSelect(e: Event) {
      e.preventDefault()
    }
  }))
)

const filteredSites = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return props.sites
  return props.sites.filter(
    site =>
      site.name.toLowerCase().includes(q)
      || site.url.toLowerCase().includes(q)
  )
})

const visibleColumnCount = computed(() => {
  let n = 2
  for (const key of Object.keys(columnVisibility.value) as SiteColumnKey[]) {
    if (columnVisibility.value[key]) n++
  }
  return n
})

function statusColor(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
  if (status === 'complete') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'cancelled') return 'neutral'
  if (status === 'running' || status === 'processing') return 'info'
  if (status === 'pending' || status === 'queued') return 'warning'
  return 'neutral'
}

function latestActivityScan(siteId: string): Scan | undefined {
  return props.latestScanBySiteId.get(siteId)
}

function latestCompleteScan(siteId: string): Scan | undefined {
  return props.latestCompleteScanBySiteId.get(siteId)
}

function transitionLabel(scan: Scan): string {
  if (scan.status === 'running') return `Running · ${scan.pages_crawled ?? 0} pages`
  if (scan.status === 'complete') return 'Completed'
  if (scan.status === 'failed') return 'Failed'
  if (scan.status === 'cancelled') return 'Cancelled'
  return scan.status
}

async function toggleSite(site: Site) {
  if (expandedSiteId.value === site.id) {
    expandedSiteId.value = null
    return
  }
  expandedSiteId.value = site.id
  if (!scansBySite.value.has(site.id)) {
    await loadScansForSite(site.id)
  }
}

function scansForSite(siteId: string): Scan[] {
  return scansBySite.value.get(siteId) ?? []
}

function scheduleLabel(site: Site): string {
  const freq = site.crawl_schedule?.replace('_', ' ') ?? 'manual'
  if (site.crawl_schedule === 'manual') return 'Manual'
  return freq
}
</script>

<template>
  <div class="site-scans-wrap space-y-4">
    <div
      v-if="sites.length"
      class="flex flex-wrap items-center justify-between gap-3"
    >
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        placeholder="Search sites…"
        class="w-full max-w-sm"
        aria-label="Search sites"
      />
      <UDropdownMenu
        :items="columnMenuItems"
        :content="{ align: 'end' }"
      >
        <UButton
          label="Columns"
          color="neutral"
          variant="outline"
          trailing-icon="i-lucide-chevron-down"
          aria-label="Toggle column visibility"
        />
      </UDropdownMenu>
    </div>

    <p v-if="!sites.length" class="text-sm text-muted py-4">
      No sites yet. Add a site to start scanning.
    </p>
    <p
      v-else-if="!filteredSites.length"
      class="text-sm text-muted py-4"
    >
      No sites match your search.
    </p>

    <div
      v-else
      class="table-surface"
    >
      <table class="site-scans-table">
        <thead>
          <tr>
            <th class="w-8" />
            <th>Site</th>
            <th v-if="columnVisibility.schedule">
              Schedule
            </th>
            <th v-if="columnVisibility.nextScan">
              Next scan
            </th>
            <th v-if="columnVisibility.lastScan">
              Last scan
            </th>
            <th
              v-if="columnVisibility.qa"
              class="text-center"
            >
              QA
            </th>
            <th
              v-if="columnVisibility.actions"
              class="text-right"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="site in filteredSites" :key="site.id">
            <tr
              class="site-row"
              :class="{ 'site-row--expanded': expandedSiteId === site.id }"
            >
              <td>
                <UButton
                  icon="i-lucide-chevron-down"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :class="{ 'rotate-180': expandedSiteId === site.id }"
                  :aria-label="`Toggle scans for ${site.name}`"
                  @click="toggleSite(site)"
                />
              </td>
              <td class="site-scans-table__site-cell">
                <NuxtLink
                  :to="`/sites/${site.id}`"
                  class="font-medium text-primary hover:underline block truncate"
                  @click.stop
                >
                  {{ site.name }}
                </NuxtLink>
                <a
                  :href="site.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-muted hover:text-primary hover:underline block truncate mt-0.5 max-w-[14rem] sm:max-w-xs"
                  :title="site.url"
                  @click.stop
                >
                  {{ site.url }}
                </a>
              </td>
              <td
                v-if="columnVisibility.schedule"
                class="text-sm capitalize"
              >
                {{ scheduleLabel(site) }}
              </td>
              <td
                v-if="columnVisibility.nextScan"
                class="text-sm text-muted"
              >
                {{ formatNextScanLabel(site.crawl_schedule, site.schedule_next_run_at) }}
              </td>
              <td v-if="columnVisibility.lastScan">
                <template v-if="latestActivityScan(site.id)">
                  <StatusBadge
                    :status="transitionLabel(latestActivityScan(site.id)!)"
                    :color="statusColor(latestActivityScan(site.id)!.status)"
                  />
                </template>
                <span v-else class="text-sm text-muted">Never</span>
              </td>
              <td
                v-if="columnVisibility.qa"
                class="text-center text-sm"
              >
                <span v-if="latestCompleteScan(site.id)?.score_qa != null">
                  {{ latestCompleteScan(site.id)!.score_qa }}%
                </span>
                <span v-else class="text-muted">—</span>
              </td>
              <td v-if="columnVisibility.actions">
                <div class="flex justify-end gap-1 flex-wrap" @click.stop>
                  <UButton
                    label="Configure"
                    size="xs"
                    variant="ghost"
                    icon="i-lucide-settings"
                    :disabled="isSiteBusy(site.id)"
                    @click="emit('configureScan', site)"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="expandedSiteId === site.id">
              <td :colspan="visibleColumnCount" class="site-scans-expand-cell">
                <ScanRunsList
                  :scans="scansForSite(site.id)"
                  :site-id="site.id"
                  :loading="isSiteScansLoading(site.id)"
                  :has-loaded="isSiteScansLoaded(site.id)"
                  :action-loading-id="actionLoadingId"
                  :site-busy="isSiteBusy(site.id)"
                  @view-results="emit('viewResults', $event)"
                  @rerun="emit('startAgain', $event)"
                  @delete="emit('delete', $event)"
                />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.site-scans-table {
  width: 100%;
  font-size: 0.875rem;
  border-collapse: collapse;
}

.site-scans-table th {
  text-align: left;
  padding: 0.75rem 1rem;
  font-weight: 500;
  color: var(--ui-text-muted);
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated, transparent);
}

.site-scans-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--ui-border);
  vertical-align: middle;
}

.site-scans-table__site-cell {
  min-width: 10rem;
  max-width: 16rem;
}

.site-scans-expand-cell {
  padding: 0 !important;
  border-bottom: none;
}

.rotate-180 :deep(svg) {
  transform: rotate(180deg);
}
</style>
