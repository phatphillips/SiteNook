<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { upperFirst } from 'scule'
import type { TableColumn } from '@nuxt/ui'
import type { GlobalSearchResultItem } from '~/types/globalSearch'
import { highlightSnippet } from '~/utils/globalSearch'

const props = withDefaults(defineProps<{
  items: GlobalSearchResultItem[]
  loading?: boolean
  showSiteColumn?: boolean
  page?: number
  totalPages?: number
  totalItems?: number
  query?: string
}>(), {
  loading: false,
  showSiteColumn: true,
  page: 1,
  totalPages: 1,
  totalItems: 0,
  query: ''
})

const emit = defineEmits<{
  'update:page': [page: number]
}>()

const UButton = resolveComponent('UButton')
const table = useTemplateRef<{ tableApi?: {
  getAllColumns: () => Array<{ id: string, getCanHide: () => boolean, getIsVisible: () => boolean }>
  getColumn: (id: string) => { toggleVisibility: (v: boolean) => void } | undefined
} }>('table')

const columnVisibility = ref<Record<string, boolean>>({})

const COLUMN_LABELS: Record<string, string> = {
  siteName: 'Site',
  url: 'URL',
  type: 'Type',
  snippet: 'Snippet',
  actions: 'Actions'
}

function typeLabel(type: GlobalSearchResultItem['type']): string {
  return type === 'pdf' ? 'PDF' : 'Webpage'
}

function linkCell(url: string) {
  if (!url) return '—'
  return h('a', {
    href: url,
    target: '_blank',
    rel: 'noopener',
    class: 'text-sm text-primary hover:underline block truncate max-w-md',
    title: url
  }, url)
}

function snippetCell(snippet: string) {
  const html = highlightSnippet(snippet, props.query)
  return h('span', {
    class: 'text-sm text-default block max-w-xl truncate search-snippet-cell',
    title: snippet,
    innerHTML: html || '—'
  })
}

const columns = computed<TableColumn<GlobalSearchResultItem>[]>(() => {
  const cols: TableColumn<GlobalSearchResultItem>[] = []

  if (props.showSiteColumn) {
    cols.push({
      id: 'siteName',
      accessorKey: 'siteName',
      header: 'Site',
      cell: ({ row }) => h('span', { class: 'text-sm' }, row.original.siteName)
    })
  }

  cols.push(
    {
      id: 'url',
      accessorKey: 'url',
      header: 'URL',
      cell: ({ row }) => linkCell(row.original.url)
    },
    {
      id: 'type',
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => h('span', { class: 'text-sm' }, typeLabel(row.original.type))
    },
    {
      id: 'snippet',
      accessorKey: 'snippet',
      header: 'Snippet',
      cell: ({ row }) => snippetCell(row.original.snippet)
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      enableHiding: false,
      meta: { class: { td: 'text-right' } },
      cell: ({ row }) => {
        const buttons = []
        if (row.original.url) {
          buttons.push(h('a', {
            href: row.original.url,
            target: '_blank',
            rel: 'noopener',
            class: 'inline-flex'
          }, [
            h(UButton, {
              color: 'neutral',
              variant: 'ghost',
              size: 'xs',
              icon: 'i-lucide-external-link',
              label: 'Open',
              tabindex: -1
            })
          ]))
        }
        if (row.original.type === 'pdf' && row.original.pdfDocumentId) {
          buttons.push(h(UButton, {
            color: 'neutral',
            variant: 'ghost',
            size: 'xs',
            icon: 'i-lucide-file-text',
            label: 'PDF report',
            to: `/sites/${row.original.siteId}/accessibility/pdfs`
          }))
        }
        return h('div', { class: 'flex justify-end gap-1' }, buttons)
      }
    }
  )

  return cols
})

type ColumnMenuItem = {
  label: string
  type: 'checkbox'
  checked: boolean
  onUpdateChecked: (checked: boolean) => void
  onSelect: (e: Event) => void
}

const columnMenuItems = computed((): ColumnMenuItem[] => {
  const api = table.value?.tableApi
  if (!api) return []
  return api.getAllColumns()
    .filter(column => column.getCanHide())
    .map(column => ({
      label: COLUMN_LABELS[column.id] ?? upperFirst(column.id),
      type: 'checkbox' as const,
      checked: column.getIsVisible(),
      onUpdateChecked(checked: boolean) {
        api.getColumn(column.id)?.toggleVisibility(!!checked)
      },
      onSelect(e: Event) {
        e.preventDefault()
      }
    }))
})

const footerSummary = computed(() => {
  if (props.totalItems <= 0) return ''
  const noun = props.totalItems === 1 ? 'result' : 'results'
  return `${props.totalItems.toLocaleString()} ${noun}`
})

function goToPage(nextPage: number) {
  if (nextPage < 1 || nextPage > props.totalPages) return
  emit('update:page', nextPage)
}

defineExpose({
  get columnMenuItems() {
    return columnMenuItems.value
  }
})
</script>

<template>
  <div class="global-search-results-panel">
    <div class="table-surface">
      <UTable
        ref="table"
        v-model:column-visibility="columnVisibility"
        :data="items"
        :columns="columns"
        :loading="loading"
        :ui="{ root: 'relative w-full', tr: 'data-[expanded=true]:bg-elevated/50' }"
        :empty-state="{
          icon: 'i-lucide-search-x',
          label: 'No results',
          description: 'Try a different query, content type, or site filter.'
        }"
      />

      <div
        v-if="totalItems > 0"
        class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-4 py-2"
      >
        <p class="text-xs text-muted">
          {{ footerSummary }}
        </p>
        <div class="flex items-center gap-2 ms-auto">
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-chevron-left"
            aria-label="Previous page"
            :disabled="page <= 1 || loading"
            @click="goToPage(page - 1)"
          />
          <span class="text-xs text-muted tabular-nums">Page {{ page }} of {{ totalPages }}</span>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-chevron-right"
            aria-label="Next page"
            :disabled="page >= totalPages || loading"
            @click="goToPage(page + 1)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
