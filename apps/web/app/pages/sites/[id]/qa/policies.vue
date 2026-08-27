<script setup lang="ts">
import { buildPolicyMatchesCsv } from '~/utils/export/policyMatchesExport'
import type { PolicyMatchStatusFilter } from '~/components/qa/PolicyMatchesTable.vue'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const {
  policyMatches,
  loading,
  updateQaIssueStatuses
} = useQA(siteId, { summary: false, parts: ['policies'] })

const statusFilter = ref<PolicyMatchStatusFilter>('open')

const displayed = computed(() => {
  if (statusFilter.value === 'all') return policyMatches.value
  return policyMatches.value.filter(item => item.status === statusFilter.value)
})

const page = ref(1)
const pageSize = ref(1)

watch(displayed, (rows) => {
  pageSize.value = Math.max(1, rows.length)
})

const {
  exportModalOpen,
  exportConfig,
  exporting,
  progressMessage,
  runExport
} = useSimpleTableCsvExport({
  total: computed(() => displayed.value.length),
  page,
  pageSize,
  currentRows: displayed,
  feature: `policy-matches-${statusFilter.value}`,
  scopeLabel: siteId,
  fetchAllRows: async () => displayed.value,
  buildCsv: rows => buildPolicyMatchesCsv(rows)
})

async function onAction(payload: {
  issueIds: string[]
  action: 'dismiss' | 'reopen' | 'fixed'
}) {
  await updateQaIssueStatuses({
    issueIds: payload.issueIds,
    issueType: 'policy_matches',
    action: payload.action
  })
}
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Policy Matches">
        <template #right>
          <UButton
            to="/policies"
            icon="i-lucide-settings-2"
            label="Manage rules"
            color="neutral"
            variant="outline"
          />
        </template>
      </DashboardPageNavbar>
    </template>
    <template #body>
      <div class="space-y-4">
        <DataTableToolbar>
          <template #actions>
            <UButton
              icon="i-lucide-download"
              label="Export to CSV"
              color="neutral"
              variant="outline"
              @click="exportModalOpen = true"
            />
          </template>
        </DataTableToolbar>

        <TableExportModal
          v-model:open="exportModalOpen"
          :config="exportConfig"
          :exporting="exporting"
          :progress-message="progressMessage"
          @export="runExport"
        />

        <QaPolicyMatchesTable
          v-model:status-filter="statusFilter"
          :items="policyMatches"
          :loading="loading"
          @action="onAction"
        />
      </div>
    </template>
  </AppDashboardPanel>
</template>
