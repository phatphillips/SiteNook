<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { PolicyMatch } from '~/types/sitenook'
import {
  POLICY_MATCHES_TABLE_SKELETON_COLUMNS,
  POLICY_MATCHES_TABLE_WITH_SITE_SKELETON_COLUMNS
} from '~/utils/dataTableSkeletonColumns'
import { DATA_TABLE_UI } from '~/utils/dataTableUi'
import { scrollDataTableIntoView } from '~/utils/dataTableScroll'

export type PolicyMatchStatusFilter = 'open' | 'dismissed' | 'all'

type PolicyMatchRow = PolicyMatch & { siteName?: string }

const props = withDefaults(defineProps<{
  items: PolicyMatchRow[]
  showSiteColumn?: boolean
  serverPaginated?: boolean
  total?: number
  page?: number
  pageSize?: number
  loading?: boolean
  statusFilter?: PolicyMatchStatusFilter
}>(), {
  showSiteColumn: false,
  serverPaginated: false,
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  statusFilter: 'open'
})

const emit = defineEmits<{
  'update:page': [page: number]
  'update:statusFilter': [status: PolicyMatchStatusFilter]
  action: [payload: { issueIds: string[], action: 'dismiss' | 'reopen' | 'fixed' }]
}>()

const statusModel = computed({
  get: () => props.statusFilter,
  set: value => emit('update:statusFilter', value)
})

const displayed = computed(() => {
  if (props.serverPaginated) return props.items
  if (props.statusFilter === 'all') return props.items
  return props.items.filter(item => item.status === props.statusFilter)
})

const skeletonLayout = computed(() =>
  props.showSiteColumn
    ? POLICY_MATCHES_TABLE_WITH_SITE_SKELETON_COLUMNS
    : POLICY_MATCHES_TABLE_SKELETON_COLUMNS
)

const columns = computed((): TableColumn<PolicyMatchRow>[] => [
  ...(props.showSiteColumn
    ? [{
        accessorKey: 'siteName',
        header: 'Site',
        cell: ({ row }: { row: { original: PolicyMatchRow } }) => row.original.siteName || '—'
      }]
    : []),
  {
    id: 'policy',
    header: 'Policy',
    cell: ({ row }: { row: { original: PolicyMatchRow } }) =>
      row.original.expand?.policy?.name || row.original.policy
  },
  { accessorKey: 'matched_text', header: 'Matched Text' },
  { accessorKey: 'context', header: 'Context' },
  {
    id: 'page',
    header: 'Page URL',
    cell: ({ row }: { row: { original: PolicyMatchRow } }) => row.original.expand?.page?.url || ''
  },
  {
    id: 'severity',
    header: 'Severity',
    cell: ({ row }: { row: { original: PolicyMatchRow } }) =>
      row.original.expand?.policy?.severity || '—'
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }: { row: { original: PolicyMatchRow } }) => row.original.status
  },
  {
    id: 'actions',
    header: ''
  }
])

const stableLoading = useStableLoading(toRef(() => props.loading))

const showInitialSkeleton = computed(
  () => stableLoading.value && !props.items.length
)

const showPagination = computed(
  () => props.serverPaginated && props.total > props.pageSize
)

const footerSummary = computed(() => {
  if (!showPagination.value) return ''
  const pageStart = props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1
  const pageEnd = Math.min(props.page * props.pageSize, props.total)
  return `Showing ${pageStart}-${pageEnd} of ${props.total.toLocaleString()}`
})

const tablePanelRef = useTemplateRef<HTMLElement>('tablePanelRef')

function onPaginationChange(nextPage: number) {
  scrollDataTableIntoView(tablePanelRef.value)
  emit('update:page', nextPage)
}

function runAction(issueId: string, action: 'dismiss' | 'reopen' | 'fixed') {
  emit('action', { issueIds: [issueId], action })
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
  <div ref="tablePanelRef" class="space-y-4">
    <div class="flex flex-wrap gap-2">
      <UButton
        :variant="statusModel === 'open' ? 'solid' : 'outline'"
        @click="statusModel = 'open'"
      >
        Open
      </UButton>
      <UButton
        :variant="statusModel === 'dismissed' ? 'solid' : 'outline'"
        @click="statusModel = 'dismissed'"
      >
        Dismissed
      </UButton>
      <UButton
        :variant="statusModel === 'all' ? 'solid' : 'outline'"
        @click="statusModel = 'all'"
      >
        All
      </UButton>
    </div>

    <DataTableSkeleton
      v-if="showInitialSkeleton"
      :rows="pageSize"
      :layout="skeletonLayout"
    />

    <div v-else class="overflow-x-auto rounded-lg border border-default">
      <UTable
        :data="displayed"
        :columns="columns"
        :loading="stableLoading"
        :ui="DATA_TABLE_UI"
      >
        <template #loading>
          <DataTableSkeleton
            :rows="Math.min(pageSize, 5)"
            :layout="skeletonLayout"
            :show-header="false"
          />
        </template>
        <template #matched_text-cell="{ row }">
          <code class="text-xs">{{ row.original.matched_text }}</code>
        </template>
        <template #context-cell="{ row }">
          <span class="line-clamp-2 text-sm text-muted">{{ row.original.context }}</span>
        </template>
        <template #severity-cell="{ row }">
          <UBadge
            :color="row.original.expand?.policy?.severity === 'error' ? 'error' : 'warning'"
            variant="subtle"
          >
            {{ row.original.expand?.policy?.severity || '—' }}
          </UBadge>
        </template>
        <template #status-cell="{ row }">
          <UBadge variant="subtle">
            {{ row.original.status }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UButton
              v-if="row.original.status === 'open'"
              size="xs"
              color="neutral"
              variant="ghost"
              label="Dismiss"
              @click="runAction(row.original.id, 'dismiss')"
            />
            <UButton
              v-if="row.original.status === 'open'"
              size="xs"
              color="neutral"
              variant="ghost"
              label="Fixed"
              @click="runAction(row.original.id, 'fixed')"
            />
            <UButton
              v-if="row.original.status !== 'open'"
              size="xs"
              color="neutral"
              variant="ghost"
              label="Reopen"
              @click="runAction(row.original.id, 'reopen')"
            />
          </div>
        </template>
      </UTable>
    </div>

    <div
      v-if="showPagination"
      class="flex flex-wrap items-center justify-between gap-3"
    >
      <p class="text-sm text-muted">
        {{ footerSummary }}
      </p>
      <UPagination
        :page="page"
        :items-per-page="pageSize"
        :total="total"
        @update:page="onPaginationChange"
      />
    </div>

    <p
      v-else-if="!stableLoading && !displayed.length"
      class="text-sm text-muted"
    >
      No policy matches for this filter.
    </p>
  </div>
</template>
