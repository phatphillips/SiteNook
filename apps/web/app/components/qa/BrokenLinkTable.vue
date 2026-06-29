<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { BrokenLink } from '~/types/accessiq'

const props = defineProps<{
  links: BrokenLink[]
  view: 'pages' | 'links'
  urlSearchActive?: boolean
  loading?: boolean
}>()

const UBadge = resolveComponent('UBadge')

const visibleLinks = computed(() =>
  props.urlSearchActive
    ? props.links
    : props.links.filter(link => link.status === 'broken')
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
  return h('a', {
    href: url,
    target: '_blank',
    rel: 'noopener',
    class: 'text-sm text-primary hover:underline break-all',
    title: url
  }, url)
}

const pagesColumns = computed<TableColumn<{ url: string, count: number }>[]>(() => [
  {
    accessorKey: 'url',
    header: 'Page URL',
    cell: ({ row }) => pageUrlCell(row.original.url)
  },
  {
    accessorKey: 'count',
    header: props.urlSearchActive ? 'Matching links' : 'Broken links',
    meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } },
    cell: ({ row }) => h('span', { class: 'text-sm tabular-nums' }, String(row.original.count))
  }
])

const linksColumns = computed<TableColumn<{
  href: string
  status_code: number
  link_type: string
  status: string
  pages: string[]
}>[]>(() => {
  const cols: TableColumn<{
    href: string
    status_code: number
    link_type: string
    status: string
    pages: string[]
  }>[] = [
    {
      accessorKey: 'href',
      header: 'URL',
      cell: ({ row }) => pageUrlCell(row.original.href)
    }
  ]

  if (props.urlSearchActive) {
    cols.push({
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => h(UBadge, {
        color: linkStatusColor(row.original.status),
        variant: 'subtle'
      }, () => row.original.status)
    })
  }

  cols.push(
    {
      accessorKey: 'status_code',
      header: 'HTTP status',
      meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } },
      cell: ({ row }) => h(UBadge, {
        color: statusColor(row.original.status_code),
        variant: 'subtle',
        class: 'tabular-nums'
      }, () => String(row.original.status_code || 'ERR'))
    },
    {
      accessorKey: 'link_type',
      header: 'Type',
      cell: ({ row }) => h('span', { class: 'text-sm capitalize' }, row.original.link_type)
    },
    {
      id: 'pages',
      header: 'Pages affected',
      meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } },
      cell: ({ row }) => h('span', { class: 'text-sm tabular-nums' }, String(row.original.pages.length))
    }
  )

  return cols
})

const footerSummary = computed(() => {
  if (props.loading || !visibleLinks.value.length) return ''
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
</script>

<template>
  <div class="broken-links-table-panel space-y-4">
    <div
      v-if="loading"
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
      <UTable
        v-if="view === 'pages'"
        :data="pagesView"
        :columns="pagesColumns"
        :ui="{ root: 'relative w-full' }"
        :empty-state="{
          icon: 'i-lucide-unlink',
          label: 'No links',
          description: emptyDescription
        }"
      />
      <UTable
        v-else
        :data="linksView"
        :columns="linksColumns"
        :ui="{ root: 'relative w-full' }"
        :empty-state="{
          icon: 'i-lucide-unlink',
          label: 'No links',
          description: emptyDescription
        }"
      />

      <div
        v-if="footerSummary"
        class="border-t border-default px-4 py-2"
      >
        <p class="text-xs text-muted">
          {{ footerSummary }}
          <span v-if="urlSearchActive"> — includes broken and redirected links</span>
        </p>
      </div>
    </div>
  </div>
</template>
