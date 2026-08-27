<script setup lang="ts">
import type { SiteMetricBarPoint } from '~/utils/orgSiteMetrics'
import {
  A11Y_BAR_FILL,
  A11Y_BAR_FILL_HOVER
} from '~/utils/chartTheme'

const props = withDefaults(defineProps<{
  title: string
  value: string
  subtitle: string
  points: SiteMetricBarPoint[]
  seriesLabel?: string
  emptyLabel?: string
}>(), {
  seriesLabel: 'Issues',
  emptyLabel: 'No data yet'
})

const router = useRouter()

const hasData = computed(() => props.points.length > 0)

const maxValue = computed(() => {
  if (!props.points.length) return 0
  return Math.max(...props.points.map(p => p.value), 0)
})

/** Width as % of the bar track; 0 issues → no fill. */
function barWidthPercent(value: number): number {
  if (value <= 0 || maxValue.value <= 0) return 0
  return (value / maxValue.value) * 100
}

function onRowActivate(point: SiteMetricBarPoint) {
  if (point.href) void router.push(point.href)
}

function onRowKeydown(event: KeyboardEvent, point: SiteMetricBarPoint) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  onRowActivate(point)
}
</script>

<template>
  <div class="flex flex-col gap-3 overflow-hidden rounded-lg border border-default bg-elevated/25 p-4 shadow-none ring-0 sm:p-5">
    <div class="flex items-start gap-3">
      <p class="shrink-0 text-2xl sm:text-3xl font-semibold tabular-nums tracking-tight leading-none pt-0.5">
        {{ value }}
      </p>
      <div class="min-w-0">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-muted">
          {{ title }}
        </p>
        <p class="mt-1 text-sm text-muted">
          {{ subtitle }}
        </p>
      </div>
    </div>

    <div v-if="!hasData" class="flex min-h-[88px] items-center justify-center">
      <p class="text-xs text-muted">
        {{ emptyLabel }}
      </p>
    </div>

    <div v-else class="space-y-1.5">
      <div class="grid grid-cols-[minmax(7rem,10rem)_1fr_2.5rem] items-center gap-3 px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
        <span class="pl-1">Site</span>
        <span class="sr-only">{{ seriesLabel }}</span>
        <span class="text-right">{{ seriesLabel }}</span>
      </div>

      <ul class="space-y-2" role="list">
        <li
          v-for="point in points"
          :key="point.siteId"
        >
          <button
            type="button"
            class="site-issues-row group grid w-full grid-cols-[minmax(7rem,10rem)_1fr_2.5rem] items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :style="{
              '--bar-fill': A11Y_BAR_FILL,
              '--bar-fill-hover': A11Y_BAR_FILL_HOVER
            }"
            :title="point.tooltipLines?.join(' · ')"
            @click="onRowActivate(point)"
            @keydown="onRowKeydown($event, point)"
          >
            <span class="truncate pl-1 text-sm font-medium text-highlighted">
              {{ point.label }}
            </span>
            <span
              class="site-issues-row__track relative h-7 overflow-hidden rounded bg-default/60"
              aria-hidden="true"
            >
              <span
                v-if="point.value > 0"
                class="site-issues-row__bar absolute inset-y-0 left-0 rounded"
                :style="{ width: `${barWidthPercent(point.value)}%` }"
              />
            </span>
            <span class="text-right text-sm font-semibold tabular-nums text-highlighted">
              {{ point.value }}
            </span>
          </button>
        </li>
      </ul>
    </div>

    <p v-if="hasData" class="text-xs text-muted">
      Ordered fewest → most open issues. Click a row to open that site’s issues.
    </p>
  </div>
</template>

<style scoped>
.site-issues-row__track {
  overflow: hidden;
  transform-origin: left center;
  transition: transform 380ms cubic-bezier(0.34, 1.45, 0.64, 1);
}

.site-issues-row:hover .site-issues-row__track,
.site-issues-row:focus-visible .site-issues-row__track {
  transform: scale(1.012);
}

.site-issues-row__bar {
  background-color: var(--bar-fill);
  transition:
    background-color 180ms ease,
    width 200ms ease;
}

.site-issues-row:hover .site-issues-row__bar,
.site-issues-row:focus-visible .site-issues-row__bar {
  background-color: var(--bar-fill-hover);
}
</style>
