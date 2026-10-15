<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { getExpandedRowModel, getSortedRowModel } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { Column, Row, SortingState } from '@tanstack/vue-table'
import type { BrokenLink } from '~/types/sitenook'
import { BROKEN_LINKS_TABLE_SKELETON_COLUMNS } from '~/utils/dataTableSkeletonColumns'
import { DATA_TABLE_UI, dataTableSortableHeader } from '~/utils/dataTableUi'
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
  /** Href currently being live-rechecked (disables Recheck on that row). */
  recheckingHref?: string | null
}>(), {
  urlSearchActive: false,
  loading: false,
  showSiteColumn: false,
  serverPaginated: false,
  total: 0,
  page: 1,
  pageSize: 20,
  recheckingHref: null
})

const emit = defineEmits<{
  'update:page': [page: number]
  action: [payload: { issueIds: string[], action: 'dismiss' | 'reopen' | 'fixed' }]
  recheck: [payload: { issueIds: string[], href: string }]
}>()

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const stableLoading = useStableLoading(toRef(() => props.loading))
const sorting = ref<SortingState>([])
const expanded = ref<Record<string, boolean>>({})

function sortableHeader<T>(
  column: Column<T, unknown>,
  label: string,
  align: 'left' | 'right' | 'center' = 'left'
) {
  return dataTableSortableHeader(column, label, align)
}

const visibleLinks = computed(() => {
  if (props.serverPaginated) return props.links
  if (props.urlSearchActive) return props.links
  return props.links.filter(link => link.status === 'broken')
})

type BrokenLinkRow = BrokenLink & { siteId?: string, siteName?: string }

type FlatLinkRow = {
  id: string
  href: string
  status_code: number
  link_type: string
  status: string
  pageUrl: string
  siteId: string
  siteName: string
}

type LinkAggRow = {
  href: string
  status_code: number
  link_type: string
  status: string
  pages: string[]
  issueIds: string[]
}

type PageAggRow = {
  url: string
  count: number
  links: Array<{
    id: string
    href: string
    status_code: number
    link_type: string
    status: string
  }>
}

const flatLinksView = computed<FlatLinkRow[]>(() =>
  visibleLinks.value.map(link => ({
    id: link.id,
    href: link.href,
    status_code: link.status_code,
    link_type: link.link_type,
    status: link.status,
    pageUrl: link.expand?.page?.url || link.page,
    siteId: (link as BrokenLinkRow).siteId ?? '',
    siteName: (link as BrokenLinkRow).siteName ?? '—'
  }))
)

const pagesView = computed<PageAggRow[]>(() => {
  const map = new Map<string, PageAggRow>()
  for (const link of visibleLinks.value) {
    const pageUrl = link.expand?.page?.url || link.page
    const existing = map.get(pageUrl) || { url: pageUrl, count: 0, links: [] }
    existing.count++
    existing.links.push({
      id: link.id,
      href: link.href,
      status_code: link.status_code,
      link_type: link.link_type,
      status: link.status
    })
    map.set(pageUrl, existing)
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
})

const linksView = computed<LinkAggRow[]>(() => {
  const map = new Map<string, LinkAggRow>()
  for (const link of visibleLinks.value) {
    const existing = map.get(link.href) || {
      href: link.href,
      status_code: link.status_code,
      link_type: link.link_type,
      status: link.status,
      pages: [],
      issueIds: []
    }
    const pageUrl = link.expand?.page?.url || link.page
    if (!existing.pages.includes(pageUrl)) existing.pages.push(pageUrl)
    if (!existing.issueIds.includes(link.id)) existing.issueIds.push(link.id)
    map.set(link.href, existing)
  }
  return [...map.values()].sort((a, b) => b.pages.length - a.pages.length)
})

function statusColor(code: number) {
  if (code === 404) return 'error'
  if (code >= 500) return 'warning'
  if (code >= 400) return 'error'
  if (code >= 300) return 'info'
  if (!code) return 'neutral'
  return 'neutral'
}

function linkStatusColor(status: string) {
  if (status === 'broken') return 'error'
  if (status === 'redirected') return 'info'
  if (status === 'dismissed') return 'neutral'
  return 'neutral'
}

function httpStatusLabel(code: number) {
  return code > 0 ? String(code) : 'ERR'
}

/** Destination URL: show the full broken link, not a path-first page cell. */
function brokenUrlCell(url: string) {
  if (!url) return '—'
  return h('div', { class: 'min-w-0 max-w-xl' }, [
    h('a', {
      href: url,
      target: '_blank',
      rel: 'noopener noreferrer',
      class: 'text-sm font-medium text-primary hover:underline break-all',
      title: url
    }, url)
  ])
}

/** Source page: compact path + domain, matching Spelling / Policy tables. */
function pageUrlCell(url: string) {
  if (!url) return '—'
  const parsed = parsePageUrl(url)
  return h('div', { class: 'min-w-0 max-w-md' }, [
    h('a', {
      href: url,
      target: '_blank',
      rel: 'noopener noreferrer',
      class: 'text-sm text-primary hover:underline block truncate',
      title: url
    }, parsed.path || '/'),
    h('span', { class: 'text-xs text-muted block truncate' }, parsed.domain)
  ])
}

function httpBadge(code: number) {
  return h(UBadge, {
    color: statusColor(code),
    variant: 'subtle',
    class: 'tabular-nums'
  }, () => httpStatusLabel(code))
}

function typeBadge(linkType: string) {
  return h(UBadge, {
    color: 'neutral',
    variant: 'subtle',
    class: 'capitalize'
  }, () => linkType || '—')
}

function statusBadge(status: string) {
  return h(UBadge, {
    color: linkStatusColor(status),
    variant: 'subtle',
    class: 'capitalize'
  }, () => status)
}

function expandToggle(row: Row<LinkAggRow | PageAggRow>, label: string) {
  return h(UButton, {
    color: 'neutral',
    variant: 'ghost',
    icon: 'i-lucide-chevron-down',
    square: true,
    size: 'xs',
    'aria-label': label,
    ui: {
      leadingIcon: ['transition-transform', row.getIsExpanded() ? 'duration-200 rotate-180' : '']
    },
    onClick: (e: Event) => {
      e.stopPropagation()
      row.toggleExpanded()
    }
  })
}

function runAction(issueIds: string[], action: 'dismiss' | 'reopen' | 'fixed') {
  if (!issueIds.length) return
  emit('action', { issueIds, action })
}

function runRecheck(issueIds: string[], href: string) {
  if (!issueIds.length || !href) return
  if (props.recheckingHref) return
  emit('recheck', { issueIds, href })
}

function actionButtons(status: string, issueIds: string[], href: string) {
  const buttons = []
  const isRechecking = props.recheckingHref === href
  if (status === 'broken') {
    buttons.push(
      h(UButton, {
        size: 'xs',
        color: 'primary',
        variant: 'ghost',
        icon: isRechecking ? 'i-lucide-loader-circle' : 'i-lucide-refresh-cw',
        label: isRechecking ? 'Checking…' : 'Recheck',
        loading: isRechecking,
        disabled: Boolean(props.recheckingHref),
        onClick: () => runRecheck(issueIds, href)
      }),
      h(UButton, {
        size: 'xs',
        color: 'neutral',
        variant: 'ghost',
        label: 'Dismiss',
        disabled: Boolean(props.recheckingHref),
        onClick: () => runAction(issueIds, 'dismiss')
      }),
      h(UButton, {
        size: 'xs',
        color: 'neutral',
        variant: 'ghost',
        label: 'Fixed',
        disabled: Boolean(props.recheckingHref),
        onClick: () => runAction(issueIds, 'fixed')
      })
    )
  } else {
    buttons.push(
      h(UButton, {
        size: 'xs',
        color: 'primary',
        variant: 'ghost',
        icon: isRechecking ? 'i-lucide-loader-circle' : 'i-lucide-refresh-cw',
        label: isRechecking ? 'Checking…' : 'Recheck',
        loading: isRechecking,
        disabled: Boolean(props.recheckingHref),
        onClick: () => runRecheck(issueIds, href)
      }),
      h(UButton, {
        size: 'xs',
        color: 'neutral',
        variant: 'ghost',
        label: 'Reopen',
        disabled: Boolean(props.recheckingHref),
        onClick: () => runAction(issueIds, 'reopen')
      })
    )
  }
  return h('div', { class: 'flex justify-end gap-1' }, buttons)
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
      enableHiding: false,
      header: ({ column }) => sortableHeader(column, 'Broken URL'),
      cell: ({ row }) => brokenUrlCell(row.original.href)
    },
    {
      accessorKey: 'pageUrl',
      header: ({ column }) => sortableHeader(column, 'Found on'),
      cell: ({ row }) => pageUrlCell(row.original.pageUrl)
    },
    {
      accessorKey: 'status_code',
      header: ({ column }) => sortableHeader(column, 'HTTP', 'right'),
      meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } },
      cell: ({ row }) => httpBadge(row.original.status_code)
    },
    {
      accessorKey: 'link_type',
      header: ({ column }) => sortableHeader(column, 'Type'),
      cell: ({ row }) => typeBadge(row.original.link_type)
    }
  )

  if (props.urlSearchActive) {
    cols.push({
      accessorKey: 'status',
      header: ({ column }) => sortableHeader(column, 'Status'),
      cell: ({ row }) => statusBadge(row.original.status)
    })
  }

  cols.push({
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    header: '',
    meta: { class: { th: 'w-56', td: 'w-56' } },
    cell: ({ row }) => actionButtons(row.original.status, [row.original.id], row.original.href)
  })

  return cols
})

const pagesColumns = computed<TableColumn<PageAggRow>[]>(() => [
  {
    id: 'expand',
    enableSorting: false,
    enableHiding: false,
    meta: { class: { th: 'w-11 max-w-[2.75rem] p-0', td: 'w-11 max-w-[2.75rem] p-0 text-center' } },
    cell: ({ row }) => expandToggle(row, 'Expand broken links on this page')
  },
  {
    accessorKey: 'url',
    enableHiding: false,
    header: ({ column }) => sortableHeader(column, 'Page'),
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
    cell: ({ row }) => h(UBadge, {
      color: 'neutral',
      variant: 'subtle',
      size: 'sm',
      class: 'tabular-nums'
    }, () => String(row.original.count))
  }
])

const linksColumns = computed<TableColumn<LinkAggRow>[]>(() => {
  const cols: TableColumn<LinkAggRow>[] = [
    {
      id: 'expand',
      enableSorting: false,
      enableHiding: false,
      meta: { class: { th: 'w-11 max-w-[2.75rem] p-0', td: 'w-11 max-w-[2.75rem] p-0 text-center' } },
      cell: ({ row }) => expandToggle(row, 'Expand pages that link here')
    },
    {
      accessorKey: 'href',
      enableHiding: false,
      header: ({ column }) => sortableHeader(column, 'Broken URL'),
      cell: ({ row }) => brokenUrlCell(row.original.href)
    }
  ]

  if (props.urlSearchActive) {
    cols.push({
      accessorKey: 'status',
      header: ({ column }) => sortableHeader(column, 'Status'),
      cell: ({ row }) => statusBadge(row.original.status)
    })
  }

  cols.push(
    {
      accessorKey: 'status_code',
      header: ({ column }) => sortableHeader(column, 'HTTP', 'right'),
      meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } },
      cell: ({ row }) => httpBadge(row.original.status_code)
    },
    {
      accessorKey: 'link_type',
      header: ({ column }) => sortableHeader(column, 'Type'),
      cell: ({ row }) => typeBadge(row.original.link_type)
    },
    {
      id: 'pages',
      accessorFn: row => row.pages.length,
      header: ({ column }) => sortableHeader(column, 'Pages', 'right'),
      meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } },
      cell: ({ row }) => h(UBadge, {
        color: 'neutral',
        variant: 'subtle',
        size: 'sm',
        class: 'tabular-nums'
      }, () => `${row.original.pages.length}`)
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      header: '',
      meta: { class: { th: 'w-56', td: 'w-56' } },
      cell: ({ row }) => actionButtons(row.original.status, row.original.issueIds, row.original.href)
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

const tableUi = {
  ...DATA_TABLE_UI,
  tr: 'data-[expanded=true]:bg-elevated/50 border-b border-default last:border-b-0'
}

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

watch(
  () => [props.view, props.links.length, props.urlSearchActive] as const,
  () => {
    expanded.value = {}
  }
)
</script>

<template>
  <div
    ref="tablePanelRef"
    class="broken-links-table-panel space-y-4"
  >
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
            label: 'No broken links',
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
          v-model:expanded="expanded"
          :data="pagesView"
          :columns="pagesColumns"
          :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
          :expanded-options="{ getExpandedRowModel: getExpandedRowModel() }"
          :ui="tableUi"
          :empty-state="{
            icon: 'i-lucide-unlink',
            label: 'No broken links',
            description: emptyDescription
          }"
        >
          <template #expanded="{ row }">
            <div class="broken-links-expanded-panel space-y-2 px-4 py-4">
              <p class="text-xs font-medium uppercase tracking-wide text-muted">
                Broken links on this page
              </p>
              <ul class="divide-y divide-default rounded-lg border border-default bg-default">
                <li
                  v-for="link in row.original.links"
                  :key="link.id"
                  class="flex flex-wrap items-start justify-between gap-3 px-3 py-2.5"
                >
                  <div class="min-w-0 flex-1 space-y-1">
                    <a
                      :href="link.href"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="break-all text-sm font-medium text-primary hover:underline"
                      :title="link.href"
                    >{{ link.href }}</a>
                    <div class="flex flex-wrap items-center gap-2">
                      <UBadge
                        :color="statusColor(link.status_code)"
                        variant="subtle"
                        class="tabular-nums"
                      >
                        {{ httpStatusLabel(link.status_code) }}
                      </UBadge>
                      <UBadge
                        color="neutral"
                        variant="subtle"
                        class="capitalize"
                      >
                        {{ link.link_type }}
                      </UBadge>
                    </div>
                  </div>
                  <div class="flex shrink-0 gap-1">
                    <UButton
                      size="xs"
                      color="primary"
                      variant="ghost"
                      :icon="recheckingHref === link.href ? 'i-lucide-loader-circle' : 'i-lucide-refresh-cw'"
                      :label="recheckingHref === link.href ? 'Checking…' : 'Recheck'"
                      :loading="recheckingHref === link.href"
                      :disabled="Boolean(recheckingHref)"
                      @click="runRecheck([link.id], link.href)"
                    />
                    <template v-if="link.status === 'broken'">
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        label="Dismiss"
                        :disabled="Boolean(recheckingHref)"
                        @click="runAction([link.id], 'dismiss')"
                      />
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        label="Fixed"
                        :disabled="Boolean(recheckingHref)"
                        @click="runAction([link.id], 'fixed')"
                      />
                    </template>
                    <UButton
                      v-else
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      label="Reopen"
                      :disabled="Boolean(recheckingHref)"
                      @click="runAction([link.id], 'reopen')"
                    />
                  </div>
                </li>
              </ul>
            </div>
          </template>
        </UTable>

        <UTable
          v-else
          v-model:sorting="sorting"
          v-model:expanded="expanded"
          :data="linksView"
          :columns="linksColumns"
          :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
          :expanded-options="{ getExpandedRowModel: getExpandedRowModel() }"
          :ui="tableUi"
          :empty-state="{
            icon: 'i-lucide-unlink',
            label: 'No broken links',
            description: emptyDescription
          }"
        >
          <template #expanded="{ row }">
            <div class="broken-links-expanded-panel space-y-2 px-4 py-4">
              <p class="text-xs font-medium uppercase tracking-wide text-muted">
                Found on {{ row.original.pages.length }}
                {{ row.original.pages.length === 1 ? 'page' : 'pages' }}
              </p>
              <ul class="divide-y divide-default rounded-lg border border-default bg-default">
                <li
                  v-for="pageUrl in row.original.pages"
                  :key="pageUrl"
                  class="px-3 py-2.5"
                >
                  <a
                    :href="pageUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-sm text-primary hover:underline break-all"
                    :title="pageUrl"
                  >{{ pageUrl }}</a>
                </li>
              </ul>
            </div>
          </template>
        </UTable>
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
          <span v-if="urlSearchActive && !serverPaginated">. Includes broken and redirected links</span>
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

<style scoped>
.broken-links-table-panel :deep(tr[data-expanded='true'] > td) {
  border-bottom-color: transparent;
}
</style>
