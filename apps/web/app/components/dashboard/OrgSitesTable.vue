<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import type { SiteDashboardSnapshot } from '~/utils/dashboardAggregates'
import {
  DATA_TABLE_THEAD_CLASS,
  dataTableTdClass,
  dataTableThClass
} from '~/utils/dataTableUi'
import { formatAccessibilityScore, scoreRingColor } from '~/utils/siteimproveScore'
import { compareTimestampsDesc } from '~/utils/sortTimestamps'
import {
  A11Y_BAR_FILL,
  A11Y_BAR_FILL_HOVER,
  A11Y_BAR_TEXT,
  A11Y_BAR_TEXT_ON_HOVER,
  A11Y_BAR_TRACK
} from '~/utils/chartTheme'

const props = withDefaults(defineProps<{
  snapshots: SiteDashboardSnapshot[]
  seoEnabled?: boolean
  /** When false, hide the QA score column (e.g. accessibility overview). */
  showQa?: boolean
  /** When false, hide the SEO score column even if the plan includes SEO. */
  showSeo?: boolean
}>(), {
  seoEnabled: false,
  showQa: true,
  showSeo: undefined
})

const showSeoColumn = computed(() =>
  props.showSeo ?? props.seoEnabled
)

type SortKey = 'site' | 'accessibility' | 'qa' | 'seo' | 'lastScan'
type SortDir = 'asc' | 'desc'

const sortKey = ref<SortKey>('lastScan')
const sortDir = ref<SortDir>('desc')

const rows = computed(() => {
  const sorted = [...props.snapshots]
  const dir = sortDir.value === 'asc' ? 1 : -1

  sorted.sort((left, right) => {
    switch (sortKey.value) {
      case 'site':
        return left.siteName.localeCompare(right.siteName) * dir
      case 'accessibility':
        return compareNullableScores(left.accessibilityScore, right.accessibilityScore) * dir
      case 'qa':
        return compareNullableScores(left.qaScore, right.qaScore) * dir
      case 'seo':
        return compareNullableScores(left.seoScore, right.seoScore) * dir
      case 'lastScan':
      default:
        return compareTimestampsDesc(left.lastScanAt ?? '', right.lastScanAt ?? '') * (sortDir.value === 'desc' ? 1 : -1)
    }
  })

  return sorted
})

function compareNullableScores(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return a - b
}

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortKey.value = key
  sortDir.value = key === 'site' ? 'asc' : 'desc'
}

function sortIcon(key: SortKey) {
  if (sortKey.value !== key) return 'i-lucide-arrow-up-down'
  return sortDir.value === 'asc'
    ? 'i-lucide-arrow-up-narrow-wide'
    : 'i-lucide-arrow-down-wide-narrow'
}

function formatLastScan(iso: string | null) {
  if (!iso) return 'Never scanned'
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return '—'
  }
}

function scoreBarWidth(score: number): string {
  return `${Math.max(0, Math.min(100, score))}%`
}
</script>

<template>
  <section id="org-sites-table" class="scroll-mt-6">
    <div class="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-highlighted">
          All sites
        </h2>
        <p class="text-sm text-muted">
          Latest scores and scan activity across your workspace.
        </p>
      </div>
      <UButton to="/sites" size="sm" variant="outline">
        Manage sites
      </UButton>
    </div>

    <div v-if="!rows.length" class="rounded-lg border border-default bg-elevated/25 p-6 text-sm text-muted">
      No sites yet.
      <NuxtLink to="/sites" class="text-primary hover:underline">
        Add your first site
      </NuxtLink>.
    </div>

    <div v-else class="table-surface overflow-x-auto">
      <table class="min-w-full table-fixed border-collapse">
        <thead :class="DATA_TABLE_THEAD_CLASS">
          <tr>
            <th :class="dataTableThClass()">
              <UButton
                color="neutral"
                variant="ghost"
                label="Site"
                :icon="sortIcon('site')"
                class="-mx-2.5"
                @click="toggleSort('site')"
              />
            </th>
            <th :class="dataTableThClass()">
              <UButton
                color="neutral"
                variant="ghost"
                label="Accessibility"
                :icon="sortIcon('accessibility')"
                class="-mx-2.5"
                @click="toggleSort('accessibility')"
              />
            </th>
            <th v-if="showQa" :class="dataTableThClass()">
              <UButton
                color="neutral"
                variant="ghost"
                label="QA"
                :icon="sortIcon('qa')"
                class="-mx-2.5"
                @click="toggleSort('qa')"
              />
            </th>
            <th v-if="showSeoColumn" :class="dataTableThClass()">
              <UButton
                color="neutral"
                variant="ghost"
                label="SEO"
                :icon="sortIcon('seo')"
                class="-mx-2.5"
                @click="toggleSort('seo')"
              />
            </th>
            <th :class="dataTableThClass()">
              <UButton
                color="neutral"
                variant="ghost"
                label="Last scan"
                :icon="sortIcon('lastScan')"
                class="-mx-2.5"
                @click="toggleSort('lastScan')"
              />
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="site in rows"
            :key="site.siteId"
            class="org-sites-row hover:bg-elevated/40"
          >
            <td :class="dataTableTdClass()">
              <NuxtLink
                :to="`/sites/${site.siteId}`"
                class="font-medium text-highlighted hover:text-primary"
              >
                {{ site.siteName }}
              </NuxtLink>
              <p class="truncate text-xs text-muted">
                {{ site.siteUrl }}
              </p>
            </td>
            <td :class="dataTableTdClass()">
              <NuxtLink
                v-if="site.accessibilityScore != null"
                :to="`/sites/${site.siteId}/accessibility`"
                class="a11y-score-chip group relative flex h-8 w-full max-w-[8.5rem] items-center justify-center overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary"
                :style="{
                  '--bar-fill': A11Y_BAR_FILL,
                  '--bar-fill-hover': A11Y_BAR_FILL_HOVER,
                  '--bar-track': A11Y_BAR_TRACK,
                  '--bar-text': A11Y_BAR_TEXT,
                  '--bar-text-hover': A11Y_BAR_TEXT_ON_HOVER,
                  '--score-pct': scoreBarWidth(site.accessibilityScore)
                }"
              >
                <span
                  class="a11y-score-chip__track absolute inset-0 rounded-md"
                  aria-hidden="true"
                />
                <span
                  class="a11y-score-chip__bar absolute inset-y-0 left-0 rounded-md"
                  :style="{ width: 'var(--score-pct)' }"
                  aria-hidden="true"
                />
                <span class="a11y-score-chip__text a11y-score-chip__text--base absolute inset-0 z-10 flex items-center justify-center text-sm font-semibold tabular-nums">
                  {{ formatAccessibilityScore(site.accessibilityScore) }}%
                </span>
                <span
                  class="a11y-score-chip__text a11y-score-chip__text--on-fill absolute inset-0 z-20 flex items-center justify-center text-sm font-semibold tabular-nums"
                  aria-hidden="true"
                >
                  {{ formatAccessibilityScore(site.accessibilityScore) }}%
                </span>
              </NuxtLink>
              <span v-else class="text-muted">—</span>
            </td>
            <td v-if="showQa" :class="dataTableTdClass()">
              <NuxtLink
                v-if="site.qaScore != null"
                :to="`/sites/${site.siteId}/qa`"
                class="inline-flex items-center rounded-md bg-elevated px-2.5 py-1 text-sm font-semibold tabular-nums ring-1 ring-inset ring-default transition-colors hover:bg-elevated/80"
                :style="{ color: scoreRingColor(site.qaScore) }"
              >
                {{ formatAccessibilityScore(site.qaScore) }} / 100
              </NuxtLink>
              <span v-else class="text-muted">—</span>
            </td>
            <td v-if="showSeoColumn" :class="dataTableTdClass()">
              <NuxtLink
                v-if="site.seoScore != null"
                :to="`/sites/${site.siteId}/seo`"
                class="inline-flex items-center rounded-md bg-elevated px-2.5 py-1 text-sm font-semibold tabular-nums ring-1 ring-inset ring-default transition-colors hover:bg-elevated/80"
                :style="{ color: scoreRingColor(site.seoScore) }"
              >
                {{ formatAccessibilityScore(site.seoScore) }} / 100
              </NuxtLink>
              <span v-else class="text-muted">—</span>
            </td>
            <td :class="[dataTableTdClass(), 'text-muted']">
              {{ formatLastScan(site.lastScanAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.a11y-score-chip__track {
  background-color: var(--bar-track);
}

.a11y-score-chip__bar {
  background-color: var(--bar-fill);
  transition: background-color 180ms ease;
}

.a11y-score-chip:hover .a11y-score-chip__bar,
.a11y-score-chip:focus-visible .a11y-score-chip__bar,
.org-sites-row:hover .a11y-score-chip__bar {
  background-color: var(--bar-fill-hover);
}

.a11y-score-chip__text--base {
  color: var(--bar-text);
  clip-path: none;
  transition: clip-path 0ms;
}

/* On hover: white only over the dark track; black only over purple fill (no overlap/bleed). */
.a11y-score-chip:hover .a11y-score-chip__text--base,
.a11y-score-chip:focus-visible .a11y-score-chip__text--base,
.org-sites-row:hover .a11y-score-chip__text--base {
  clip-path: inset(0 0 0 var(--score-pct));
}

.a11y-score-chip__text--on-fill {
  color: var(--bar-text-hover);
  clip-path: inset(0 calc(100% - var(--score-pct)) 0 0);
  opacity: 0;
  pointer-events: none;
}

.a11y-score-chip:hover .a11y-score-chip__text--on-fill,
.a11y-score-chip:focus-visible .a11y-score-chip__text--on-fill,
.org-sites-row:hover .a11y-score-chip__text--on-fill {
  opacity: 1;
}
</style>
