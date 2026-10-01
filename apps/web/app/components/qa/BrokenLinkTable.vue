<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { getSortedRowModel } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { Column, SortingState } from '@tanstack/vue-table'
import type { BrokenLink } from '~/types/sitenook'
import { BROKEN_LINKS_TABLE_SKELETON_COLUMNS } from '~/utils/dataTableSkeletonColumns'
import { DATA_TABLE_UI } from '~/utils/dataTableUi'
import { scrollDataTableIntoView } from '~/utils/dataTableScroll'
import { parsePageUrl } from '~/utils/issueExplanation'

const props = withDefaults(defineProps<{
  links: BrokenLink[]
  view: 'pages' | 'links'
  urlSearchActive?: boolean
  loading?: boolean
  showSiteColumn?: boolean
  serverPaginated?: boolean
  total?: number
  page?: number
  pageSize?: number
}>(), {
  urlSearchActive: false,
  loading: false,
  showSiteColumn: false,
  serverPaginated: false,
  total: 0,
  page: 1,
  pageSize: 20
})

const emit = defineEmits<{
  'update:page': [page: number]
}>()

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const stableLoading = useStableLoading(toRef(() => props.loading))
const sorting = ref<SortingState>([])

function sortableHeader<T>(
  column: Column<T, unknown>,
  label: string,
  align: 'left' | 'right' | 'center' = 'left'
) {
  const isSorted = column.getIsSorted()
  const button = h(UButton, {
    color: 'neutral',
    variant: 'ghost',
    size: 'xs',
    label,
    icon: isSorted
      ? (isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow')
      : 'i-lucide-arrow-up-down',
    class: align === 'left' ? '-ms-2' : '',
    ui: {
      base: 'font-medium',
      leadingIcon: 'size-3.5'
    },
    onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
  })
  if (align === 'left') return button
  return h('div', {
    class: align === 'right' ? 'flex justify-end' : 'flex justify-center'
  }, [button])
}

const visibleLinks = computed(() => {
  if (props.serverPaginated) return props.links
  if (props.urlSearchActive) return props.links
  return props.links.filter(link => link.status === 'broken')
})

type BrokenLinkRow = BrokenLink & { siteName?: string }

type FlatLinkRow = {
  href: string
  status_code: number
  link_type: string
  status: string
  pageUrl: string
  siteName: string
}

const flatLinksView = computed<FlatLinkRow[]>(() =>
  visibleLinks.value.map(link => ({
    href: link.href,
    status_code: link.status_code,
    link_type: link.link_type,
    status: link.status,
    pageUrl: link.expand?.page?.url || link.page,
    siteName: (link as BrokenLinkRow).siteName ?? '—'
  }))
)

const pagesView = computed(() => {
  const map = new Map<string, { url: string, count: number }>()
  for (const link of visibleLinks.value) {
    const pageUrl = link.expand?.page?.url || link.page
    const existing = map.get(pageUrl) || { url: pageUrl, count: 0 }
    existing.count++
    map.set(pageUrl, existing)
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
})

const linksView = computed(() => {
  const map = new Map<string, {
    href: string
    status_code: number
    link_type: string
    status: string
    pages: string[]
  }>()
  for (const link of visibleLinks.value) {
    const existing = map.get(link.href) || {
      href: link.href,
      status_code: link.status_code,
      link_type: link.link_type,
      status: link.status,
      pages: []
    }
    const pageUrl = link.expand?.page?.url || link.page
    if (!existing.pages.includes(pageUrl)) existing.pages.push(pageUrl)
    map.set(link.href, existing)
  }
  return [...map.values()].sort((a, b) => b.pages.length - a.pages.length)
})

function statusColor(code: number) {
  if (code === 404) return 'error'
  if (code >= 500) return 'warning'
  if (code >= 300) return 'info'
  return 'neutral'
}

function linkStatusColor(status: string) {
  if (status === 'broken') return 'error'
  if (status === 'redirected') return 'info'
  return 'neutral'
}

function pageUrlCell(url: string) {
  if (!url) return '—'
  const parsed = parsePageUrl(url)
  return h('div', { class: 'min-w-0 max-w-md' }, [
    h('a', {
      href: url,
      target: '_blank',
      rel: 'noopener',
      class: 'text-sm text-primary hover:underline block truncate',
      title: url
    }, parsed.path),
    h('span', { class: 'text-xs text-muted block truncate' }, parsed.domain)
  ])
}

type LinkAggRow = {
  href: string
  status_code: number
  link_type: string
  status: string
  pages: string[]
}

const flatLinksColumns = computed<TableColumn<FlatLinkRow>[]>(() => {
  const cols: TableColumn<FlatLinkRow>[] = []

  if (props.showSiteColumn) {
    cols.push({
      accessorKey: 'siteName',
      header: ({ column }) => sortableHeader(column, 'Site'),
      cell: ({ row }) => h('span', { class: 'text-sm' }, row.original.siteName)
    })
  }

  cols.push(
    {
      accessorKey: 'href',
      header: ({ column }) => sortableHeader(column, 'URL'),
      cell: ({ row }) => pageUrlCell(row.original.href)
    },
    {
      accessorKey: 'pageUrl',
      header: ({ column }) => sortableHeader(column, 'Page'),
      cell: ({ row }) => pageUrlCell(row.original.pageUrl)
    }
  )

  if (props.urlSearchActive) {
    cols.push({
      accessorKey: 'status',
      header: ({ column }) => sortableHeader(column, 'Status'),
      cell: ({ row }) => h(UBadge, {
        color: linkStatusColor(row.original.status),
        variant: 'subtle'
      }, () => row.original.status)
    })
  }

  cols.push(
    {
      accessorKey: 'status_code',
      header: ({ column }) => sortableHeader(column, 'HTTP status', 'right'),
      meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } },
      cell: ({ row }) => h(UBadge, {
        color: statusColor(row.original.status_code),
        variant: 'subtle',
        class: 'tabular-nums'
      }, () => String(row.original.status_code || 'ERR'))
    },
    {
      accessorKey: 'link_type',
      header: ({ column }) => sortableHeader(column, 'Type'),
      cell: ({ row }) => h('span', { class: 'text-sm capitalize' }, row.original.link_type)
    }
  )

  return cols
})

const pagesColumns = computed<TableColumn<{ url: string, count: number }>[]>(() => [
  {
    accessorKey: 'url',
    header: ({ column }) => sortableHeader(column, 'Page URL'),
    cell: ({ row }) => pageUrlCell(row.original.url)
  },
  {
    accessorKey: 'count',
    header: ({ column }) => sortableHeader(
      column,
      props.urlSearchActive ? 'Matching links' : 'Broken links',
      'right'
    ),
    meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } },
    cell: ({ row }) => h('span', { class: 'text-sm tabular-nums' }, String(row.original.count))
  }
])

const linksColumns = computed<TableColumn<LinkAggRow>[]>(() => {
  const cols: TableColumn<LinkAggRow>[] = [
    {
      accessorKey: 'href',
      header: ({ column }) => sortableHeader(column, 'URL'),
      cell: ({ row }) => pageUrlCell(row.original.href)
    }
  ]

  if (props.urlSearchActive) {
    cols.push({
      accessorKey: 'status',
      header: ({ column }) => sortableHeader(column, 'Status'),
      cell: ({ row }) => h(UBadge, {
        color: linkStatusColor(row.original.status),
        variant: 'subtle'
      }, () => row.original.status)
    })
  }

  cols.push(
    {
      accessorKey: 'status_code',
      header: ({ column }) => sortableHeader(column, 'HTTP status', 'right'),
      meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } },
      cell: ({ row }) => h(UBadge, {
        color: statusColor(row.original.status_code),
        variant: 'subtle',
        class: 'tabular-nums'
      }, () => String(row.original.status_code || 'ERR'))
    },
    {
      accessorKey: 'link_type',
      header: ({ column }) => sortableHeader(column, 'Type'),
      cell: ({ row }) => h('span', { class: 'text-sm capitalize' }, row.original.link_type)
    },
    {
      id: 'pages',
      accessorFn: row => row.pages.length,
      header: ({ column }) => sortableHeader(column, 'Pages affected', 'right'),
      meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } },
      cell: ({ row }) => h('span', { class: 'text-sm tabular-nums' }, String(row.original.pages.length))
    }
  )

  return cols
})

const useFlatView = computed(
  () => props.showSiteColumn || props.serverPaginated
)

const showInitialSkeleton = computed(
  () => stableLoading.value && !props.links.length
)

const showPagination = computed(
  () => props.serverPaginated && props.total > props.pageSize
)

const footerSummary = computed(() => {
  if (props.serverPaginated) {
    if (stableLoading.value && !props.links.length) return ''
    const start = props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1
    const end = Math.min(props.page * props.pageSize, props.total)
    return `Showing ${start}-${end} of ${props.total.toLocaleString()}`
  }

  if (props.loading || !visibleLinks.value.length) return ''

  if (useFlatView.value) {
    const noun = flatLinksView.value.length === 1 ? 'link' : 'links'
    return `Showing ${flatLinksView.value.length} ${noun}`
  }

  if (props.view === 'pages') {
    const noun = pagesView.value.length === 1 ? 'page' : 'pages'
    return `Showing ${pagesView.value.length} ${noun}`
  }

  const noun = linksView.value.length === 1 ? 'link' : 'links'
  return `Showing ${linksView.value.length} ${noun}`
})

const emptyDescription = computed(() =>
  props.urlSearchActive
    ? 'No links match that URL filter.'
    : 'No broken links found on the latest scan.'
)

const tablePanelRef = useTemplateRef<HTMLElement>('tablePanelRef')

function onPaginationChange(nextPage: number) {
  scrollDataTableIntoView(tablePanelRef.value)
  emit('update:page', nextPage)
}

watch(
  () => props.page,
  (nextPage, previousPage) => {
    if (!props.serverPaginated || nextPage === previousPage) return
    scrollDataTableIntoView(tablePanelRef.value)
  }
)
</script>

<template>
  <div ref="tablePanelRef" class="broken-links-table-panel space-y-4">
    <div
      v-if="!serverPaginated && loading && !links.length"
      class="flex justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-6 animate-spin text-muted"
      />
    </div>

    <div
      v-else
      class="table-surface"
    >
      <DataTableSkeleton
        v-if="showInitialSkeleton"
        :rows="pageSize"
        :layout="BROKEN_LINKS_TABLE_SKELETON_COLUMNS"
      />

      <template v-else>
        <UTable
          v-if="useFlatView"
          v-model:sorting="sorting"
          :data="flatLinksView"
          :columns="flatLinksColumns"
          :loading="stableLoading && !!links.length"
          :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
          :ui="DATA_TABLE_UI"
          :empty-state="{
            icon: 'i-lucide-unlink',
            label: 'No links',
            description: emptyDescription
          }"
        >
          <template #loading>
            <DataTableSkeleton
              :rows="Math.min(pageSize, 8)"
              :layout="BROKEN_LINKS_TABLE_SKELETON_COLUMNS"
              :show-header="false"
            />
          </template>
        </UTable>

        <UTable
          v-else-if="view === 'pages'"
          v-model:sorting="sorting"
          :data="pagesView"
          :columns="pagesColumns"
          :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
          :ui="DATA_TABLE_UI"
          :empty-state="{
            icon: 'i-lucide-unlink',
            label: 'No links',
            description: emptyDescription
          }"
        />
        <UTable
          v-else
          v-model:sorting="sorting"
          :data="linksView"
          :columns="linksColumns"
          :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
          :ui="DATA_TABLE_UI"
          :empty-state="{
            icon: 'i-lucide-unlink',
            label: 'No links',
            description: emptyDescription
          }"
        />
      </template>

      <div
        v-if="footerSummary || showPagination"
        class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-4 py-2"
      >
        <p
          v-if="footerSummary"
          class="text-xs text-muted"
        >
          {{ footerSummary }}
          <span v-if="urlSearchActive && !serverPaginated"> — includes broken and redirected links</span>
        </p>
        <div
          v-else
          class="flex-1"
        />
        <UPagination
          v-if="showPagination"
          :page="page"
          :items-per-page="pageSize"
          :total="total"
          class="ms-auto"
          @update:page="onPaginationChange"
        />
      </div>
    </div>
  </div>
</template>
