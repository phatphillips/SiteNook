<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { AffectedPageSummary } from '~/utils/affectedPages'
import { pageDisplayTitle } from '~/utils/affectedPages'

const props = defineProps<{
  pages: AffectedPageSummary[]
  rescanningUrl?: string | null
}>()

const emit = defineEmits<{
  rescan: [url: string]
}>()

const columns: TableColumn<AffectedPageSummary>[] = [
  {
    id: 'page',
    accessorFn: row => `${pageDisplayTitle(row)} ${row.url}`,
    header: 'Title',
    cell: ({ row }) => {
      const title = pageDisplayTitle(row.original)
      return h('div', { class: 'min-w-0 py-0.5' }, [
        h('a', {
          href: row.original.url,
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'text-sm font-medium text-primary hover:underline line-clamp-2',
          title
        }, title),
        h('p', {
          class: 'text-xs text-muted truncate mt-0.5',
          title: row.original.url
        }, row.original.url)
      ])
    }
  },
  {
    id: 'occurrences',
    accessorKey: 'occurrences',
    header: 'Occurrences',
    meta: { class: { th: 'text-right tabular-nums w-28', td: 'text-right tabular-nums' } },
    cell: ({ row }) => String(row.original.occurrences)
  },
  {
    id: 'rescan',
    header: 'Rescan',
    enableSorting: false,
    meta: { class: { th: 'text-right w-24', td: 'text-right' } },
    cell: ({ row }) => {
      const busy = props.rescanningUrl === row.original.url
      return h(resolveComponent('UButton'), {
        icon: 'i-lucide-refresh-cw',
        color: 'neutral',
        variant: 'ghost',
        square: true,
        loading: busy,
        'aria-label': `Rescan ${pageDisplayTitle(row.original)}`,
        onClick: () => emit('rescan', row.original.url)
      })
    }
  }
]
</script>

<template>
  <div class="issue-affected-pages space-y-2">
    <h3 class="text-xs font-semibold text-muted uppercase tracking-wide">
      Pages with this issue
    </h3>
    <div class="rounded-md border border-default overflow-hidden bg-elevated/30">
      <UTable
        :data="pages"
        :columns="columns"
        :ui="{
          root: 'relative w-full',
          th: 'text-xs',
          td: 'align-middle'
        }"
      />
    </div>
  </div>
</template>
