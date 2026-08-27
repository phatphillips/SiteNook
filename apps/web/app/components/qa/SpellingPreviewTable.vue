<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { SpellingIssue } from '~/types/sitenook'
import { QA_SPELLING_PREVIEW_SKELETON_COLUMNS } from '~/utils/dataTableSkeletonColumns'
import { DATA_TABLE_UI } from '~/utils/dataTableUi'

const props = withDefaults(defineProps<{
  items: SpellingIssue[]
  loading?: boolean
  siteId: string
}>(), {
  loading: false
})

const stableLoading = useStableLoading(toRef(() => props.loading))
const showInitialSkeleton = computed(() => stableLoading.value && !props.items.length)

const columns = computed((): TableColumn<SpellingIssue>[] => [
  { accessorKey: 'word', header: 'Word' },
  {
    accessorKey: 'context',
    header: 'Context',
    cell: ({ row }) => row.original.context || '—'
  },
  {
    id: 'page',
    header: 'Page URL',
    cell: ({ row }) => row.original.expand?.page?.url || '—'
  }
])
</script>

<template>
  <div class="table-surface">
    <div class="border-b border-default px-4 py-3">
      <h3 class="text-sm font-medium text-default">
        Top misspellings
      </h3>
    </div>

    <DataTableSkeleton
      v-if="showInitialSkeleton"
      :layout="QA_SPELLING_PREVIEW_SKELETON_COLUMNS"
      :rows="5"
    />

    <template v-else-if="items.length">
      <UTable
        :data="items"
        :columns="columns"
        :loading="stableLoading && !!items.length"
        :ui="{
          ...DATA_TABLE_UI,
          tr: 'border-b border-default last:border-b-0'
        }"
      >
        <template #loading>
          <DataTableSkeleton
            :layout="QA_SPELLING_PREVIEW_SKELETON_COLUMNS"
            :rows="Math.min(5, items.length)"
            :show-header="false"
          />
        </template>
      </UTable>

      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-4 py-2">
        <p class="text-xs text-muted">
          Showing top {{ items.length }} misspelling{{ items.length === 1 ? '' : 's' }}
        </p>
        <TableFooterLinkButton
          :to="`/sites/${siteId}/qa/spelling`"
          label="View all misspellings"
        />
      </div>
    </template>

    <p v-else class="px-4 py-6 text-sm text-muted text-center">
      No misspellings on the latest scan.
    </p>
  </div>
</template>
