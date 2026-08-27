<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import type { ActiveScanRow, Scan } from '~/types/sitenook'
import {
  canStopActiveScanRow,
  scanActiveStatusLabel,
  scanTimestamp
} from '~/utils/scanDisplay'
import { formatScanTypeLabel } from '~/utils/scanDetail'

const props = defineProps<{
  rows: ActiveScanRow[]
  loading?: boolean
  hasLoaded?: boolean
  stoppingRowId?: string | null
  isSiteBusy?: (siteId: string) => boolean
  actionLoadingId?: string | null
}>()

const emit = defineEmits<{
  stop: [row: ActiveScanRow]
  viewResults: [scan: Scan]
  delete: [scan: Scan]
  rerun: [scan: Scan]
}>()

const selectedRowId = defineModel<string | null>('selectedRowId', { default: null })
const stopConfirmRowId = ref<string | null>(null)

const tableTab = ref<'active' | 'history'>('active')
const tableTabItems = [
  { label: 'Active', value: 'active' },
  { label: 'History', value: 'history' }
]

const { historyScans, historyLoading, fetchRecentScans } = useScans()
const { sites } = useSites()

const crawlErrorsSummary = ref<string | null>(null)

function onCrawlErrorsSummary(summary: string | null) {
  crawlErrorsSummary.value = summary
}

function siteUrlForScan(scan: Scan): string {
  return scan.expand?.site?.url ?? sites.value.find(s => s.id === scan.site)?.url ?? ''
}

function scanSubtitle(siteUrl: string, scanType: string): string {
  const typeLabel = formatScanTypeLabel(scanType)
  if (siteUrl) return `${siteUrl} · ${typeLabel} scan`
  return `${typeLabel} scan`
}

const detailOpen = ref(false)
const selectedHistoryScan = ref<Scan | null>(null)

watch(tableTab, (tab) => {
  if (tab === 'history') {
    void fetchRecentScans()
  }
})

function historySiteName(scan: Scan): string {
  return scan.expand?.site?.name ?? 'Unknown site'
}

function historyStatusColor(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
  if (status === 'complete') return 'success'
  if (status === 'complete_with_errors') return 'warning'
  if (status === 'failed') return 'error'
  if (status === 'cancelled') return 'neutral'
  return 'neutral'
}

function statusColor(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
  if (status === 'complete') return 'success'
  if (status === 'complete_with_errors') return 'warning'
  if (status === 'failed') return 'error'
  if (status === 'cancelled') return 'neutral'
  if (status === 'running' || status === 'background_scan' || status === 'processing') return 'info'
  if (status === 'pending' || status === 'queued') return 'warning'
  return 'neutral'
}

function formatWhen(iso?: string): string {
  if (!iso) return '—'
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return iso
  }
}

function canStop(row: ActiveScanRow): boolean {
  return canStopActiveScanRow(row.status)
}

function isStopping(row: ActiveScanRow): boolean {
  return props.stoppingRowId === row.id
}

const selectedRow = computed(() =>
  props.rows.find(r => r.id === selectedRowId.value) ?? null
)

function selectRow(row: ActiveScanRow) {
  selectedRowId.value = row.id
  if (stopConfirmRowId.value && stopConfirmRowId.value !== row.id) {
    stopConfirmRowId.value = null
  }
}

function openHistoryScan(scan: Scan) {
  selectedHistoryScan.value = scan
  detailOpen.value = true
}

function onHistoryDelete(scan: Scan) {
  emit('delete', scan)
  if (selectedHistoryScan.value?.id === scan.id) {
    detailOpen.value = false
    selectedHistoryScan.value = null
  }
}

function requestStop(row: ActiveScanRow) {
  stopConfirmRowId.value = row.id
}

function cancelStopConfirm() {
  stopConfirmRowId.value = null
}

function confirmStop(row: ActiveScanRow) {
  stopConfirmRowId.value = null
  emit('stop', row)
}

function durationBetween(startIso?: string, endMs: number = Date.now()): string {
  if (!startIso) return '—'
  const start = Date.parse(startIso)
  if (!Number.isFinite(start)) return '—'
  const sec = Math.max(0, Math.floor((endMs - start) / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

function elapsedLabel(iso?: string): string {
  return durationBetween(iso)
}

function historyDurationLabel(scan: Scan): string {
  const endIso = scan.completed_at ?? scanTimestamp(scan)
  const end = Date.parse(endIso)
  if (!Number.isFinite(end)) return '—'
  return durationBetween(scan.started_at, end)
}

const elapsedTick = ref(0)
let elapsedTimer: ReturnType<typeof setInterval> | null = null

interface SummaryPanelView {
  siteName: string
  subtitle: string
  scanTypeLabel: string
  status: string
  statusColor: 'success' | 'error' | 'warning' | 'info' | 'neutral'
  pagesValue: string
  elapsedValue: string
  whenValue: string
  whenLabel: string
  errorsValue: string
  showStop: boolean
  stopRow: ActiveScanRow | null
  hasSelection: boolean
}

const summaryPanel = computed((): SummaryPanelView => {
  if (tableTab.value === 'history') {
    const scan = selectedHistoryScan.value
    if (!scan) {
      return {
        siteName: '',
        subtitle: historyScans.value.length
          ? 'Click a row to view scan details'
          : 'Completed scans will appear here',
        scanTypeLabel: '—',
        status: '—',
        statusColor: 'neutral',
        pagesValue: '—',
        elapsedValue: '—',
        whenValue: '—',
        whenLabel: 'Finished',
        errorsValue: '—',
        showStop: false,
        stopRow: null,
        hasSelection: false
      }
    }
    const typeLabel = formatScanTypeLabel(scan.scan_type)
    return {
      siteName: historySiteName(scan),
      subtitle: scanSubtitle(siteUrlForScan(scan), scan.scan_type || 'full'),
      scanTypeLabel: typeLabel,
      status: scanActiveStatusLabel(scan.status),
      statusColor: historyStatusColor(scan.status),
      pagesValue: String(scan.pages_crawled ?? 0),
      elapsedValue: historyDurationLabel(scan),
      whenValue: formatWhen(scanTimestamp(scan)),
      whenLabel: 'Finished',
      errorsValue: '—',
      showStop: false,
      stopRow: null,
      hasSelection: true
    }
  }

  const row = selectedRow.value
  if (!row) {
    return {
      siteName: '',
      subtitle: props.rows.length ? 'Select a scan in the queue' : '',
      scanTypeLabel: '—',
      status: '—',
      statusColor: 'neutral',
      pagesValue: '—',
      elapsedValue: '—',
      whenValue: '—',
      whenLabel: 'Started',
      errorsValue: '—',
      showStop: false,
      stopRow: null,
      hasSelection: false
    }
  }

  const typeLabel = formatScanTypeLabel(row.scanType)
  return {
    siteName: row.siteName,
    subtitle: scanSubtitle(row.siteUrl ?? '', row.scanType),
    scanTypeLabel: typeLabel,
    status: scanActiveStatusLabel(row.status),
    statusColor: statusColor(row.status),
    pagesValue: row.source === 'scan' ? String(row.pagesCrawled ?? 0) : '—',
    elapsedValue: selectedElapsed.value,
    whenValue: formatWhen(row.timestamp),
    whenLabel: 'Started',
    errorsValue: crawlErrorsSummary.value ?? 'None',
    showStop: canStop(row),
    stopRow: row,
    hasSelection: true
  }
})

watch(
  () => selectedRow.value?.id,
  () => {
    crawlErrorsSummary.value = null
  }
)

const selectedElapsed = computed(() => {
  void elapsedTick.value
  const row = selectedRow.value
  if (!row || tableTab.value !== 'active') return '—'
  return elapsedLabel(row.timestamp)
})

const showActiveInitialLoading = computed(
  () => tableTab.value === 'active' && props.loading && !props.hasLoaded && !props.rows.length
)

const isIdle = computed(() => Boolean(props.hasLoaded) && !props.rows.length)

const showCompactIdle = computed(
  () => isIdle.value && tableTab.value === 'active'
)

const showFullMonitor = computed(() => props.rows.length > 0)

const hasMultipleActiveScans = computed(
  () => tableTab.value === 'active' && props.rows.length > 1
)

const historyModalSiteBusy = computed(() => {
  const scan = selectedHistoryScan.value
  if (!scan || !props.isSiteBusy) return false
  return props.isSiteBusy(scan.site)
})

watch(
  () => props.rows,
  (rows) => {
    if (!rows.length) {
      selectedRowId.value = null
      stopConfirmRowId.value = null
      return
    }
    if (rows.some(r => r.id === selectedRowId.value)) return
    selectedRowId.value =
      rows.find(r => r.source === 'scan' && r.status === 'running')?.id
      ?? rows.find(r => r.source === 'scan' && r.status === 'background_scan')?.id
      ?? rows[0]?.id
      ?? null
  },
  { immediate: true }
)

watch(
  () => (tableTab.value === 'active' ? selectedRow.value?.id : null),
  (id) => {
    if (elapsedTimer) {
      clearInterval(elapsedTimer)
      elapsedTimer = null
    }
    if (!id) return
    elapsedTimer = setInterval(() => {
      elapsedTick.value++
    }, 1000)
  },
  { immediate: true }
)

onUnmounted(() => {
  if (elapsedTimer) clearInterval(elapsedTimer)
})

watch(
  () => props.stoppingRowId,
  (id) => {
    if (id) stopConfirmRowId.value = null
  }
)
</script>

<template>
  <div class="active-scans-wrap">
    <div class="flex items-center justify-between gap-2 mb-4">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="font-semibold">
            Scan monitor
          </h2>
          <UBadge v-if="rows.length" color="info" variant="subtle">
            {{ rows.length }} active
          </UBadge>
        </div>
        <p class="text-sm text-muted mt-1">
          <template v-if="rows.length">
            Live progress and crawl logs for running scans.
          </template>
          <template v-else-if="tableTab === 'history'">
            Recent completed scans across all sites.
          </template>
          <template v-else>
            No scans running right now.
          </template>
        </p>
      </div>
      <UTabs
        v-model="tableTab"
        :content="false"
        :items="tableTabItems"
        variant="pill"
        color="neutral"
        size="xs"
        class="scanner-info__tabs shrink-0"
      />
    </div>

    <div
      v-if="showActiveInitialLoading"
      class="py-6 text-center text-muted text-sm table-surface"
    >
      Loading active scans…
    </div>

    <!-- Compact idle: no running scans -->
    <div
      v-else-if="showCompactIdle"
      class="table-surface px-4 py-5"
    >
      <div class="flex items-start gap-3">
        <div class="rounded-lg bg-elevated/50 p-2.5 shrink-0">
          <UIcon name="i-lucide-radar" class="size-5 text-muted" />
        </div>
        <div class="min-w-0">
          <p class="font-medium">
            No scans in progress
          </p>
          <p class="text-sm text-muted mt-1">
            Start a scan from the Sites list or use
            <span class="font-medium text-default">New scan</span>
            in the header. Switch to History to review past runs.
          </p>
        </div>
      </div>
    </div>

    <!-- History-only when idle -->
    <div
      v-else-if="isIdle && tableTab === 'history'"
      class="history-only-panel table-surface"
    >
      <p
        v-if="historyLoading && !historyScans.length"
        class="text-sm text-muted py-6 px-4 text-center"
      >
        Loading scan history…
      </p>
      <p
        v-else-if="!historyScans.length"
        class="text-sm text-muted py-6 px-4 text-center"
      >
        No completed scans yet.
      </p>
      <div v-else class="history-only-panel__scroll">
        <table class="active-scans-table">
          <thead>
            <tr>
              <th>Site</th>
              <th>Type</th>
              <th>Status</th>
              <th class="text-right">Pages</th>
              <th>Finished</th>
              <th class="w-8" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="scan in historyScans"
              :key="scan.id"
              class="active-row cursor-pointer group"
              @click="openHistoryScan(scan)"
            >
              <td class="font-medium">
                {{ historySiteName(scan) }}
              </td>
              <td class="text-sm text-muted">
                {{ formatScanTypeLabel(scan.scan_type) }}
              </td>
              <td>
                <StatusBadge
                  :status="scanActiveStatusLabel(scan.status)"
                  :color="historyStatusColor(scan.status)"
                />
              </td>
              <td class="text-right text-sm tabular-nums">
                {{ scan.pages_crawled ?? 0 }}
              </td>
              <td class="text-sm text-muted whitespace-nowrap">
                {{ formatWhen(scanTimestamp(scan)) }}
              </td>
              <td class="text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                <UIcon name="i-lucide-chevron-right" class="size-4" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-xs text-muted px-4 py-2 border-t border-default">
        Click a row to view details, rerun, or delete.
      </p>
    </div>

    <!-- Full monitor when scans are running -->
    <div
      v-else-if="showFullMonitor"
      class="active-scan-panel relative"
    >
      <div
        v-if="loading && tableTab === 'active'"
        class="absolute top-2 right-2 z-10 text-xs text-muted bg-default/90 border border-default rounded px-2 py-1"
      >
        Refreshing…
      </div>

      <div class="table-surface overflow-hidden">
        <template v-if="tableTab === 'active' && summaryPanel.hasSelection">
          <div class="p-4 border-b border-default">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <p class="font-semibold truncate">
                  {{ summaryPanel.siteName }}
                </p>
                <p
                  class="text-sm text-muted mt-0.5 truncate"
                  :title="summaryPanel.subtitle"
                >
                  {{ summaryPanel.subtitle }}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2 shrink-0">
                <StatusBadge
                  v-if="summaryPanel.status !== '—'"
                  :status="summaryPanel.status"
                  :color="summaryPanel.statusColor"
                />
                <template v-if="summaryPanel.showStop && summaryPanel.stopRow">
                  <template v-if="isStopping(summaryPanel.stopRow)">
                    <UButton
                      label="Stopping…"
                      size="sm"
                      color="neutral"
                      variant="outline"
                      disabled
                      icon="i-lucide-loader-circle"
                      class="animate-spin-icon"
                    />
                  </template>
                  <template v-else-if="stopConfirmRowId === summaryPanel.stopRow.id">
                    <UButton
                      label="Yes, stop"
                      size="sm"
                      color="neutral"
                      variant="outline"
                      icon="i-lucide-square"
                      @click="confirmStop(summaryPanel.stopRow)"
                    />
                    <UButton
                      label="Cancel"
                      size="sm"
                      color="neutral"
                      variant="ghost"
                      @click="cancelStopConfirm"
                    />
                  </template>
                  <template v-else>
                    <UButton
                      label="Stop scan"
                      size="sm"
                      color="neutral"
                      variant="outline"
                      icon="i-lucide-square"
                      @click="requestStop(summaryPanel.stopRow)"
                    />
                  </template>
                </template>
              </div>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span class="inline-flex items-center gap-1.5">
                <span class="text-muted">Pages</span>
                <span class="font-medium tabular-nums">{{ summaryPanel.pagesValue }}</span>
              </span>
              <span class="text-muted/40 hidden sm:inline">·</span>
              <span class="inline-flex items-center gap-1.5">
                <span class="text-muted">Elapsed</span>
                <span class="font-medium tabular-nums font-mono">{{ summaryPanel.elapsedValue }}</span>
              </span>
              <span class="text-muted/40 hidden sm:inline">·</span>
              <span class="inline-flex items-center gap-1.5">
                <span class="text-muted">{{ summaryPanel.whenLabel }}</span>
                <span class="font-medium">{{ summaryPanel.whenValue }}</span>
              </span>
              <span class="text-muted/40 hidden sm:inline">·</span>
              <span class="inline-flex items-center gap-1.5">
                <span class="text-muted">Type</span>
                <span class="font-medium">{{ summaryPanel.scanTypeLabel }}</span>
              </span>
              <span class="text-muted/40 hidden sm:inline">·</span>
              <span class="inline-flex items-center gap-1.5">
                <span class="text-muted">Errors</span>
                <span
                  class="font-medium"
                  :class="crawlErrorsSummary ? 'text-error' : ''"
                >
                  {{ summaryPanel.errorsValue }}
                </span>
              </span>
            </div>
          </div>

          <div
            v-if="hasMultipleActiveScans"
            class="px-4 py-2.5 border-b border-default flex gap-2 overflow-x-auto"
          >
            <button
              v-for="row in rows"
              :key="row.id"
              type="button"
              class="scan-switcher-chip shrink-0"
              :class="{ 'scan-switcher-chip--selected': selectedRowId === row.id }"
              @click="selectRow(row)"
            >
              <span class="font-medium truncate max-w-[10rem]">{{ row.siteName }}</span>
              <StatusBadge
                :status="scanActiveStatusLabel(row.status)"
                :color="statusColor(row.status)"
              />
              <span
                v-if="row.source === 'scan'"
                class="text-xs text-muted tabular-nums"
              >
                {{ row.pagesCrawled ?? 0 }} pg
              </span>
            </button>
          </div>

          <div class="crawl-activity-section">
            <div class="crawl-activity-section__label">
              <span
                class="crawl-activity-section__dot"
                :class="selectedRow ? 'crawl-activity-section__dot--live' : ''"
              />
              Crawl activity
            </div>
            <LiveCrawlLogPanel
              embedded
              :active-row="selectedRow"
              :stopping-row-id="stoppingRowId"
              class="crawl-activity-section__feed"
              @errors-summary="onCrawlErrorsSummary"
            />
          </div>
        </template>

        <template v-else-if="tableTab === 'history'">
          <div
            v-if="summaryPanel.hasSelection"
            class="p-4 border-b border-default"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <p class="font-semibold truncate">
                  {{ summaryPanel.siteName }}
                </p>
                <p class="text-sm text-muted mt-0.5 truncate">
                  {{ summaryPanel.subtitle }}
                </p>
              </div>
              <StatusBadge
                v-if="summaryPanel.status !== '—'"
                :status="summaryPanel.status"
                :color="summaryPanel.statusColor"
              />
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span class="inline-flex items-center gap-1.5">
                <span class="text-muted">Pages</span>
                <span class="font-medium tabular-nums">{{ summaryPanel.pagesValue }}</span>
              </span>
              <span class="text-muted/40 hidden sm:inline">·</span>
              <span class="inline-flex items-center gap-1.5">
                <span class="text-muted">Duration</span>
                <span class="font-medium tabular-nums font-mono">{{ summaryPanel.elapsedValue }}</span>
              </span>
              <span class="text-muted/40 hidden sm:inline">·</span>
              <span class="inline-flex items-center gap-1.5">
                <span class="text-muted">Finished</span>
                <span class="font-medium">{{ summaryPanel.whenValue }}</span>
              </span>
            </div>
            <UButton
              v-if="selectedHistoryScan"
              label="View details"
              size="sm"
              color="neutral"
              variant="soft"
              class="mt-3"
              icon="i-lucide-panel-right-open"
              @click="detailOpen = true"
            />
          </div>

          <div class="active-scan-queue-card__body scanner-info__table-scroll">
            <p
              v-if="historyLoading && !historyScans.length"
              class="text-sm text-muted py-6 px-4 text-center"
            >
              Loading scan history…
            </p>
            <p
              v-else-if="!historyScans.length"
              class="text-sm text-muted py-6 px-4 text-center"
            >
              No completed scans yet.
            </p>
            <table v-else class="active-scans-table">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th class="text-right">Pages</th>
                  <th>Finished</th>
                  <th class="w-8" />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="scan in historyScans"
                  :key="scan.id"
                  class="active-row cursor-pointer group"
                  :class="{ 'active-row--selected': selectedHistoryScan?.id === scan.id }"
                  @click="openHistoryScan(scan)"
                >
                  <td class="font-medium">
                    {{ historySiteName(scan) }}
                  </td>
                  <td class="text-sm text-muted">
                    {{ formatScanTypeLabel(scan.scan_type) }}
                  </td>
                  <td>
                    <StatusBadge
                      :status="scanActiveStatusLabel(scan.status)"
                      :color="historyStatusColor(scan.status)"
                    />
                  </td>
                  <td class="text-right text-sm tabular-nums">
                    {{ scan.pages_crawled ?? 0 }}
                  </td>
                  <td class="text-sm text-muted whitespace-nowrap">
                    {{ formatWhen(scanTimestamp(scan)) }}
                  </td>
                  <td class="text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                    <UIcon name="i-lucide-chevron-right" class="size-4" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p
            v-if="historyScans.length"
            class="text-xs text-muted px-4 py-2 border-t border-default"
          >
            Click a row to view details, rerun, or delete.
          </p>
        </template>
      </div>
    </div>
  </div>

  <ScanDetailModal
    v-model:open="detailOpen"
    :scan="selectedHistoryScan"
    :site-busy="historyModalSiteBusy"
    :action-loading="selectedHistoryScan != null && actionLoadingId === selectedHistoryScan.id"
    @view-results="emit('viewResults', $event)"
    @rerun="emit('rerun', $event)"
    @delete="onHistoryDelete"
  />
</template>

<style scoped>
.scanner-info__table-scroll {
  flex: 1;
  min-height: 6rem;
  max-height: 18rem;
  overflow-y: auto;
  overflow-x: auto;
}

.scan-switcher-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid var(--ui-border);
  background: var(--ui-bg);
  font-size: 0.8125rem;
  transition: background 0.15s, border-color 0.15s;
}

.scan-switcher-chip:hover {
  background: var(--ui-bg-elevated);
}

.scan-switcher-chip--selected {
  border-color: var(--ui-border-accented, var(--ui-border));
  background: var(--ui-bg-elevated);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-primary) 15%, transparent);
}

.crawl-activity-section__label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ui-text-muted);
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-bg-muted, var(--ui-bg-elevated));
}

.crawl-activity-section__dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 9999px;
  background: var(--ui-text-muted);
  opacity: 0.35;
}

.crawl-activity-section__dot--live {
  background: var(--ui-success);
  opacity: 1;
  animation: crawl-dot-pulse 1.5s ease-in-out infinite;
}

.crawl-activity-section__feed {
  max-height: 16rem;
  min-height: 8rem;
}

@keyframes crawl-dot-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

.scanner-info__tabs {
  flex-shrink: 0;
}

.history-only-panel__scroll {
  max-height: 20rem;
  overflow-y: auto;
  overflow-x: auto;
}

.active-scans-table {
  width: 100%;
  font-size: 0.875rem;
  border-collapse: collapse;
}

.active-scans-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--ui-bg-elevated, var(--ui-color-neutral-100));
}

.active-scans-table th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  font-weight: 500;
  color: var(--ui-text-muted);
  border-bottom: 1px solid var(--ui-border);
}

.active-scans-table td {
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid var(--ui-border);
  vertical-align: middle;
}

.active-row--selected {
  background: var(--ui-bg-elevated, rgba(0, 0, 0, 0.04));
}

.active-row:hover {
  background: var(--ui-bg-elevated, rgba(0, 0, 0, 0.02));
}

.active-scan-queue-card {
  min-width: 0;
}

.active-scan-queue-card__title {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ui-text-muted);
}

:deep(.animate-spin-icon svg) {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
