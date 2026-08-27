<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import type { Scan } from '~/types/sitenook'
import { scanFreshness, scanFreshnessBadgeColor } from '~/utils/scanFreshness'
import { scanTimestamp } from '~/utils/scanDisplay'

const props = defineProps<{
  scan: Scan | null
  title?: string
  /** Render as a section inside a parent card (no nested UCard). */
  embedded?: boolean
}>()

const statusColor = computed<'success' | 'error' | 'warning' | 'info' | 'neutral'>(() => {
  const status = props.scan?.status
  if (!status) return 'neutral'
  if (status === 'complete') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'cancelled') return 'neutral'
  if (status === 'running') return 'info'
  return 'warning'
})

const transitionLabel = computed(() => {
  const status = props.scan?.status
  if (!status) return 'No scans yet'
  if (status === 'running') return 'Running now'
  if (status === 'complete') return 'Completed'
  if (status === 'failed') return 'Failed'
  if (status === 'cancelled') return 'Cancelled'
  return status
})

const whenLabel = computed(() => {
  const scan = props.scan
  if (!scan) return 'Run a scan to populate results.'
  const ts = scanTimestamp(scan)
  if (!ts) return 'Timestamp unavailable'
  try {
    return `Updated ${formatDistanceToNow(new Date(ts), { addSuffix: true })}`
  } catch {
    return ts
  }
})

const freshnessLabel = computed(() => {
  const scan = props.scan
  if (!scan || scan.status === 'running') return 'fresh'
  return scanFreshness(scan.completed_at ?? scan.started_at)
})

const freshnessColor = computed<'success' | 'warning' | 'error'>(() =>
  scanFreshnessBadgeColor(freshnessLabel.value)
)
</script>

<template>
  <UCard v-if="!embedded" :ui="{ root: 'overflow-visible bg-elevated/25 border border-default' }">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-wide text-muted">{{ title ?? 'Latest Scan' }}</p>
        <p class="text-sm mt-1">{{ whenLabel }}</p>
      </div>
      <div class="flex items-center gap-2">
        <StatusBadge :status="transitionLabel" :color="statusColor" />
        <UBadge
          v-if="scan && scan.status !== 'running'"
          :color="freshnessColor"
          variant="subtle"
          size="sm"
        >
          {{ freshnessLabel }}
        </UBadge>
      </div>
    </div>
  </UCard>
  <div v-else class="p-4 sm:px-6">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-wide text-muted">{{ title ?? 'Latest Scan' }}</p>
        <p class="text-sm mt-1">{{ whenLabel }}</p>
      </div>
      <div class="flex items-center gap-2">
        <StatusBadge :status="transitionLabel" :color="statusColor" />
        <UBadge
          v-if="scan && scan.status !== 'running'"
          :color="freshnessColor"
          variant="subtle"
          size="sm"
        >
          {{ freshnessLabel }}
        </UBadge>
      </div>
    </div>
  </div>
</template>
