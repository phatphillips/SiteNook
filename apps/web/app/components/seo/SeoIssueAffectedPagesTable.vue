<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { getSortedRowModel } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { Column, Row, SortingState } from '@tanstack/vue-table'
import type { SeoAffectedPageRow } from '~/utils/seoIssues'
import { parsePageUrl } from '~/utils/issueExplanation'
import { DATA_TABLE_UI_DENSE } from '~/utils/dataTableUi'

defineProps<{
  pages: SeoAffectedPageRow[]
}>()

const emit = defineEmits<{
  select: [issueId: string]
}>()

const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')
const sorting = ref<SortingState>([])

function sortableHeader(
  column: Column<SeoAffectedPageRow, unknown>,
  label: string
) {
  const isSorted = column.getIsSorted()
  return h(UButton, {
    color: 'neutral',
    variant: 'ghost',
    size: 'xs',
    label,
    icon: isSorted
      ? (isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow')
      : 'i-lucide-arrow-up-down',
    class: '-ms-2',
    ui: {
      base: 'font-medium',
      leadingIcon: 'size-3.5'
    },
    onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
  })
}

function onRowSelect(_event: Event, row: Row<SeoAffectedPageRow>) {
  emit('select', row.original.issueId)
}

const columns = computed<TableColumn<SeoAffectedPageRow>[]>(() => [
  {
    id: 'page',
    accessorFn: row => `${row.url} ${row.title || ''}`,
    header: ({ column }) => sortableHeader(column, 'Page'),
    cell: ({ row }) => {
      const parsed = parsePageUrl(row.original.url)
      return h('div', { class: 'min-w-0 max-w-[min(28rem,50vw)]' }, [
        h('a', {
          href: row.original.url,
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'text-primary hover:underline block truncate',
          title: row.original.url,
          onClick: (e: Event) => e.stopPropagation()
        }, [
          h('span', { class: 'font-medium' }, parsed.domain),
          h('span', { class: 'text-muted' }, parsed.path)
        ]),
        row.original.title
          ? h('p', {
              class: 'text-xs text-muted truncate mt-0.5',
              title: row.original.title
            }, row.original.title)
          : null
      ])
    }
  },
  {
    id: 'currentValue',
    accessorKey: 'currentValue',
    header: ({ column }) => sortableHeader(column, 'Current value'),
    meta: { class: { th: 'max-w-[12rem]', td: 'max-w-[12rem]' } },
    cell: ({ row }) => h('span', {
      class: 'text-muted text-xs truncate block',
      title: row.original.currentValue
    }, row.original.currentValue || '—')
  },
  {
    id: 'actions',
    enableSorting: false,
    meta: { class: { th: 'w-10', td: 'w-10 text-right' } },
    cell: () => h(UIcon, { name: 'i-lucide-chevron-right', class: 'text-muted size-4' })
  }
])
</script>

<template>
  <div class="space-y-2">
    <h3 class="text-xs font-semibold text-muted uppercase tracking-wide">
      Affected pages
    </h3>
    <div class="rounded-md border border-default overflow-hidden bg-elevated/30">
      <UTable
        v-model:sorting="sorting"
        :data="pages"
        :columns="columns"
        :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
        :on-select="onRowSelect"
        :ui="{
          ...DATA_TABLE_UI_DENSE,
          tr: 'cursor-pointer hover:bg-elevated/40 border-b border-default/60 last:border-0'
        }"
      />
    </div>
  </div>
</template>
