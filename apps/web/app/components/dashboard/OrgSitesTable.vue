<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import type { SiteDashboardSnapshot } from '~/utils/dashboardAggregates'
import {
  DATA_TABLE_THEAD_CLASS,
  dataTableTdClass,
  dataTableThClass
} from '~/utils/dataTableUi'
import { compareTimestampsDesc } from '~/utils/sortTimestamps'
import ScoreProgressChip from '~/components/shared/ScoreProgressChip.vue'

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

const scoreColThClass = computed(() => dataTableThClass())
const scoreColTdClass = computed(() => dataTableTdClass())

const sortBtnClass = 'data-table-sort-btn -mx-2.5'
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

    <div v-if="!rows.length" class="rounded-lg border border-default bg-elevated p-6 text-sm text-muted">
      No sites yet.
      <NuxtLink to="/sites" class="text-link text-primary">
        Add your first site
      </NuxtLink>.
    </div>

    <div v-else class="table-surface overflow-x-auto">
      <table class="min-w-full table-fixed border-collapse">
        <colgroup>
          <col class="w-[36%]">
          <col class="w-[16%]">
          <col v-if="showQa" class="w-[16%]">
          <col v-if="showSeoColumn" class="w-[16%]">
          <col>
        </colgroup>
        <thead :class="DATA_TABLE_THEAD_CLASS">
          <tr>
            <th :class="dataTableThClass()">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                label="Site"
                :trailing-icon="sortIcon('site')"
                :class="sortBtnClass"
                @click="toggleSort('site')"
              />
            </th>
            <th :class="scoreColThClass">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                label="Accessibility"
                :trailing-icon="sortIcon('accessibility')"
                :class="sortBtnClass"
                @click="toggleSort('accessibility')"
              />
            </th>
            <th v-if="showQa" :class="scoreColThClass">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                label="QA"
                :trailing-icon="sortIcon('qa')"
                :class="sortBtnClass"
                @click="toggleSort('qa')"
              />
            </th>
            <th v-if="showSeoColumn" :class="scoreColThClass">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                label="SEO"
                :trailing-icon="sortIcon('seo')"
                :class="sortBtnClass"
                @click="toggleSort('seo')"
              />
            </th>
            <th :class="dataTableThClass()">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                label="Last scan"
                :trailing-icon="sortIcon('lastScan')"
                :class="sortBtnClass"
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
                class="dashboard-inline-link block truncate text-sm font-medium text-highlighted hover:text-primary"
              >
                {{ site.siteName }}
              </NuxtLink>
              <p class="truncate text-xs text-muted">
                {{ site.siteUrl }}
              </p>
            </td>
            <td :class="scoreColTdClass">
              <ScoreProgressChip
                v-if="site.accessibilityScore != null"
                :score="site.accessibilityScore"
                :to="`/sites/${site.siteId}/accessibility`"
              />
              <span v-else class="text-sm text-muted">—</span>
            </td>
            <td v-if="showQa" :class="scoreColTdClass">
              <ScoreProgressChip
                v-if="site.qaScore != null"
                :score="site.qaScore"
                :to="`/sites/${site.siteId}/qa`"
              />
              <span v-else class="text-sm text-muted">—</span>
            </td>
            <td v-if="showSeoColumn" :class="scoreColTdClass">
              <ScoreProgressChip
                v-if="site.seoScore != null"
                :score="site.seoScore"
                :to="`/sites/${site.siteId}/seo`"
              />
              <span v-else class="text-sm text-muted">—</span>
            </td>
            <td :class="[dataTableTdClass(), 'text-sm text-muted']">
              {{ formatLastScan(site.lastScanAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
