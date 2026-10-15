<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import type { ContentExplorerSiteRow } from '~/utils/contentExplorerSites'
import {
  DATA_TABLE_THEAD_CLASS,
  dataTableTdClass,
  dataTableThClass
} from '~/utils/dataTableUi'
import { compareTimestampsDesc } from '~/utils/sortTimestamps'

const props = withDefaults(defineProps<{
  rows: ContentExplorerSiteRow[]
  loading?: boolean
  heading?: string
  description?: string
}>(), {
  heading: 'All sites',
  description: 'Choose a site to browse extracted page content from its latest completed scan.'
})

const emit = defineEmits<{
  select: [siteId: string]
}>()

type SortKey = 'site' | 'pages' | 'lastScan'
type SortDir = 'asc' | 'desc'

const sortKey = ref<SortKey>('lastScan')
const sortDir = ref<SortDir>('desc')

const sortedRows = computed(() => {
  const sorted = [...props.rows]
  const dir = sortDir.value === 'asc' ? 1 : -1

  sorted.sort((left, right) => {
    switch (sortKey.value) {
      case 'site':
        return left.siteName.localeCompare(right.siteName) * dir
      case 'pages':
        return (left.pageCount - right.pageCount) * dir
      case 'lastScan':
      default:
        return compareTimestampsDesc(left.lastScanAt ?? '', right.lastScanAt ?? '')
          * (sortDir.value === 'desc' ? 1 : -1)
    }
  })

  return sorted
})

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
</script>

<template>
  <section class="space-y-4">
    <div>
      <h2 class="text-lg font-semibold text-highlighted">
        {{ heading }}
      </h2>
      <p class="text-sm text-muted">
        {{ description }}
      </p>
    </div>

    <div
      v-if="loading"
      class="rounded-lg border border-default bg-elevated p-6 text-sm text-muted"
    >
      Loading sites…
    </div>
    <div
      v-else-if="!sortedRows.length"
      class="rounded-lg border border-default bg-elevated p-6 text-sm text-muted"
    >
      No sites yet.
      <NuxtLink
        to="/sites"
        class="text-primary hover:underline"
      >
        Add your first site
      </NuxtLink>.
    </div>
    <div
      v-else
      class="table-surface overflow-x-auto"
    >
      <table class="min-w-full table-fixed border-collapse">
        <thead :class="DATA_TABLE_THEAD_CLASS">
          <tr>
            <th :class="dataTableThClass()">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                label="Site"
                :trailing-icon="sortIcon('site')"
                class="-mx-2.5 hover:bg-elevated"
                @click="toggleSort('site')"
              />
            </th>
            <th :class="dataTableThClass()">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                label="Pages"
                :trailing-icon="sortIcon('pages')"
                class="-mx-2.5 hover:bg-elevated"
                @click="toggleSort('pages')"
              />
            </th>
            <th :class="dataTableThClass()">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                label="Last scanned"
                :trailing-icon="sortIcon('lastScan')"
                class="-mx-2.5 hover:bg-elevated"
                @click="toggleSort('lastScan')"
              />
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="site in sortedRows"
            :key="site.siteId"
            class="cursor-pointer hover:bg-elevated/40"
            @click="emit('select', site.siteId)"
          >
            <td :class="dataTableTdClass()">
              <button
                type="button"
                class="w-full text-left font-medium text-highlighted hover:text-primary"
                @click.stop="emit('select', site.siteId)"
              >
                {{ site.siteName }}
              </button>
              <p class="truncate text-xs text-muted">
                {{ site.siteUrl }}
              </p>
            </td>
            <td :class="dataTableTdClass()">
              <span class="tabular-nums text-sm text-highlighted">
                {{ site.pageCount.toLocaleString() }}
              </span>
            </td>
            <td :class="dataTableTdClass()">
              <span class="text-sm text-muted">
                {{ formatLastScan(site.lastScanAt) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
