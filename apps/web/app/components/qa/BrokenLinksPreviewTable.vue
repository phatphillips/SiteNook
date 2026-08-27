<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { BrokenLink } from '~/types/sitenook'
import { QA_BROKEN_LINKS_PREVIEW_SKELETON_COLUMNS } from '~/utils/dataTableSkeletonColumns'
import { DATA_TABLE_UI } from '~/utils/dataTableUi'

const props = withDefaults(defineProps<{
  links: BrokenLink[]
  loading?: boolean
  siteId: string
}>(), {
  loading: false
})

const UBadge = resolveComponent('UBadge')
const stableLoading = useStableLoading(toRef(() => props.loading))
const showInitialSkeleton = computed(() => stableLoading.value && !props.links.length)

type PreviewRow = {
  href: string
  pageUrl: string
  status_code: number
  link_type: string
}

const rows = computed<PreviewRow[]>(() =>
  props.links.map(link => ({
    href: link.href,
    pageUrl: link.expand?.page?.url || link.page,
    status_code: link.status_code,
    link_type: link.link_type
  }))
)

function statusColor(code: number) {
  if (code === 404) return 'error'
  if (code >= 500) return 'warning'
  if (code >= 300) return 'info'
  return 'neutral'
}

function urlCell(url: string) {
  if (!url) return '—'
  return h('a', {
    href: url,
    target: '_blank',
    rel: 'noopener',
    class: 'text-sm text-primary hover:underline break-all',
    title: url
  }, url)
}

const columns = computed((): TableColumn<PreviewRow>[] => [
  {
    accessorKey: 'href',
    header: 'URL',
    cell: ({ row }) => urlCell(row.original.href)
  },
  {
    accessorKey: 'pageUrl',
    header: 'Page',
    cell: ({ row }) => urlCell(row.original.pageUrl)
  },
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
  }
])
</script>

<template>
  <div class="table-surface">
    <div class="border-b border-default px-4 py-3">
      <h3 class="text-sm font-medium text-default">
        Top broken links
      </h3>
    </div>

    <DataTableSkeleton
      v-if="showInitialSkeleton"
      :layout="QA_BROKEN_LINKS_PREVIEW_SKELETON_COLUMNS"
      :rows="5"
    />

    <template v-else-if="rows.length">
      <UTable
        :data="rows"
        :columns="columns"
        :loading="stableLoading && !!rows.length"
        :ui="{
          ...DATA_TABLE_UI,
          tr: 'border-b border-default last:border-b-0'
        }"
      >
        <template #loading>
          <DataTableSkeleton
            :layout="QA_BROKEN_LINKS_PREVIEW_SKELETON_COLUMNS"
            :rows="Math.min(5, rows.length)"
            :show-header="false"
          />
        </template>
      </UTable>

      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-4 py-2">
        <p class="text-xs text-muted">
          Showing top {{ rows.length }} broken link{{ rows.length === 1 ? '' : 's' }}
        </p>
        <TableFooterLinkButton
          :to="`/sites/${siteId}/qa/links`"
          label="View all broken links"
        />
      </div>
    </template>

    <p v-else class="px-4 py-6 text-sm text-muted text-center">
      No broken links on the latest scan.
    </p>
  </div>
</template>
