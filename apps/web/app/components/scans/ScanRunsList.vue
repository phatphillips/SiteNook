<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import type { Scan } from '~/types/sitenook'
import { formatScanRunSummary } from '~/utils/scanLog'
import { formatScanTypeLabel } from '~/utils/scanDetail'
import { compareTimestampsDesc } from '~/utils/sortTimestamps'
import { scanActiveStatusLabel, scanTimestamp } from '~/utils/scanDisplay'

const props = defineProps<{
  scans: Scan[]
  siteId: string
  loading?: boolean
  hasLoaded?: boolean
  actionLoadingId?: string | null
  siteBusy?: boolean
}>()

const emit = defineEmits<{
  viewResults: [scan: Scan]
  rerun: [scan: Scan]
  delete: [scan: Scan]
}>()

const selectedScan = ref<Scan | null>(null)
const detailOpen = ref(false)

const sortedScans = computed(() =>
  [...props.scans].sort((a, b) =>
    compareTimestampsDesc(scanTimestamp(a), scanTimestamp(b))
  )
)

const showInitialLoading = computed(
  () => !props.hasLoaded && !props.scans.length
)

const showRefreshingEmpty = computed(
  () => props.hasLoaded && props.loading && !props.scans.length
)

const showEmpty = computed(
  () => props.hasLoaded && !props.loading && !props.scans.length
)

const showList = computed(
  () => props.scans.length > 0
)

const showUpdating = computed(
  () => props.loading && props.scans.length > 0
)

function statusTrailLabel(scan: Scan): string {
  if (scan.status === 'complete' || scan.status === 'complete_with_errors') return 'Completed'
  if (scan.status === 'failed') return 'Failed'
  if (scan.status === 'cancelled') return 'Cancelled'
  if (scan.status === 'running' || scan.status === 'background_scan') return 'Running'
  return scanActiveStatusLabel(scan.status)
}

function statusTrailClass(scan: Scan): string {
  if (scan.status === 'complete' || scan.status === 'complete_with_errors') return 'text-success'
  if (scan.status === 'failed') return 'text-error'
  if (scan.status === 'cancelled') return 'text-muted'
  if (scan.status === 'running' || scan.status === 'background_scan') return 'text-info'
  return 'text-muted'
}

function formatScannedWhen(iso?: string): string {
  if (!iso) return '—'
  try {
    return `Scanned ${formatDistanceToNow(new Date(iso), { addSuffix: true })}`
  } catch {
    return iso
  }
}

function scoreDisplay(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value}%`
}

function scanTypeLabel(scan: Scan): string {
  return formatScanTypeLabel(scan.scan_type)
}

function openScan(scan: Scan) {
  selectedScan.value = scan
  detailOpen.value = true
}

function isRowActive(scan: Scan): boolean {
  return detailOpen.value && selectedScan.value?.id === scan.id
}

function onModalDelete(scan: Scan) {
  emit('delete', scan)
  detailOpen.value = false
  selectedScan.value = null
}
</script>

<template>
  <div class="scan-runs-wrap">
    <p v-if="showInitialLoading" class="text-sm text-muted py-2 px-4">
      Loading scan history…
    </p>
    <p v-else-if="showRefreshingEmpty" class="text-sm text-muted py-2 px-4">
      Updating scan history…
    </p>
    <p v-else-if="showEmpty" class="text-sm text-muted py-2 px-4">
      No scans yet for this site.
    </p>
    <template v-else-if="showList">
      <p
        v-if="showUpdating"
        class="text-xs text-muted px-4 pt-3"
      >
        Updating scan history…
      </p>
      <ul
        class="scan-runs-list"
        role="list"
      >
        <li
          v-for="scan in sortedScans"
          :key="scan.id"
          role="listitem"
        >
          <button
            type="button"
            class="scan-run-row"
            :class="{ 'scan-run-row--active': isRowActive(scan) }"
            :aria-label="`View scan from ${formatScannedWhen(scanTimestamp(scan))}`"
            @click="openScan(scan)"
          >
            <div class="scan-run-row__lead">
              <span class="scan-run-row__type">
                {{ scanTypeLabel(scan) }}
              </span>
              <span
                class="scan-run-row__status text-sm"
                :class="statusTrailClass(scan)"
              >
                {{ statusTrailLabel(scan) }}
              </span>
            </div>
            <span class="scan-run-row__time">
              {{ formatScannedWhen(scanTimestamp(scan)) }}
            </span>
            <span
              class="scan-run-row__summary text-sm text-muted truncate"
              :title="formatScanRunSummary(scan)"
            >
              {{ formatScanRunSummary(scan) }}
            </span>
            <span
              class="scan-run-row__score tabular-nums"
              :class="scan.score_aa != null ? 'font-semibold' : 'text-muted'"
            >
              {{ scoreDisplay(scan.score_aa) }}
            </span>
          </button>
        </li>
      </ul>
    </template>

    <ScanDetailModal
      v-model:open="detailOpen"
      :scan="selectedScan"
      :site-busy="siteBusy"
      :action-loading="selectedScan != null && actionLoadingId === selectedScan.id"
      @view-results="emit('viewResults', $event)"
      @rerun="emit('rerun', $event)"
      @delete="onModalDelete"
    />
  </div>
</template>

<style scoped>
.scan-runs-wrap {
  background: var(--ui-bg-elevated, rgba(0, 0, 0, 0.02));
  border-top: 1px solid var(--ui-border);
}

.scan-runs-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.scan-run-row {
  display: grid;
  grid-template-columns: minmax(7rem, auto) minmax(8rem, 1fr) minmax(6rem, 1.5fr) auto;
  gap: 0.75rem 1rem;
  align-items: center;
  width: 100%;
  padding: 0.75rem 1rem;
  text-align: left;
  border: none;
  border-bottom: 1px solid var(--ui-border);
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.scan-run-row:last-child {
  border-bottom: none;
}

.scan-run-row:hover {
  background: var(--ui-bg, rgba(0, 0, 0, 0.03));
}

.scan-run-row--active {
  background: var(--ui-bg, rgba(0, 0, 0, 0.04));
}

.scan-run-row:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: -2px;
}

.scan-run-row__lead {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.scan-run-row__type {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ui-text-muted);
}

.scan-run-row__time {
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.35;
}

.scan-run-row__summary {
  min-width: 0;
}

.scan-run-row__score {
  flex-shrink: 0;
  font-size: 1.125rem;
  line-height: 1.2;
  text-align: right;
}

@media (max-width: 640px) {
  .scan-run-row {
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
  }

  .scan-run-row__time {
    grid-column: 1;
  }

  .scan-run-row__summary {
    grid-column: 1 / -1;
  }

  .scan-run-row__score {
    grid-column: 2;
    grid-row: 1;
  }
}
</style>
