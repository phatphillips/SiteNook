<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { PolicyMatch } from '~/types/sitenook'
import { QA_POLICY_MATCHES_PREVIEW_SKELETON_COLUMNS } from '~/utils/dataTableSkeletonColumns'
import { DATA_TABLE_UI } from '~/utils/dataTableUi'

const props = withDefaults(defineProps<{
  items: PolicyMatch[]
  loading?: boolean
  siteId: string
}>(), {
  loading: false
})

const UBadge = resolveComponent('UBadge')
const stableLoading = useStableLoading(toRef(() => props.loading))
const showInitialSkeleton = computed(() => stableLoading.value && !props.items.length)

function severityColor(severity: string | undefined) {
  if (severity === 'error') return 'error'
  if (severity === 'warning') return 'warning'
  return 'neutral'
}

const columns = computed((): TableColumn<PolicyMatch>[] => [
  {
    id: 'policy',
    header: 'Policy',
    cell: ({ row }) => row.original.expand?.policy?.name || row.original.policy
  },
  {
    accessorKey: 'matched_text',
    header: 'Matched text',
    cell: ({ row }) => row.original.matched_text || '—'
  },
  {
    id: 'severity',
    header: 'Severity',
    cell: ({ row }) => h(UBadge, {
      color: severityColor(row.original.expand?.policy?.severity),
      variant: 'subtle'
    }, () => row.original.expand?.policy?.severity || '—')
  }
])
</script>

<template>
  <div class="table-surface">
    <div class="border-b border-default px-4 py-3">
      <h3 class="text-sm font-medium text-default">
        Top policy matches
      </h3>
    </div>

    <DataTableSkeleton
      v-if="showInitialSkeleton"
      :layout="QA_POLICY_MATCHES_PREVIEW_SKELETON_COLUMNS"
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
            :layout="QA_POLICY_MATCHES_PREVIEW_SKELETON_COLUMNS"
            :rows="Math.min(5, items.length)"
            :show-header="false"
          />
        </template>
      </UTable>

      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-4 py-2">
        <p class="text-xs text-muted">
          Showing top {{ items.length }} policy match{{ items.length === 1 ? '' : 'es' }}
        </p>
        <TableFooterLinkButton
          :to="`/sites/${siteId}/qa/policies`"
          label="View all policy matches"
        />
      </div>
    </template>

    <p v-else class="px-4 py-6 text-sm text-muted text-center">
      No open policy matches on the latest scan.
    </p>
  </div>
</template>
