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
const tableSearch = ref('')
const tableRef = useTemplateRef('tableRef')

const displayed = computed(() => {
  if (statusFilter.value === 'all') return policyMatches.value
  return policyMatches.value.filter(item => item.status === statusFilter.value)
})

const page = ref(1)
const pageSize = ref(1)

watch(displayed, (rows) => {
  pageSize.value = Math.max(1, rows.length)
})

const footerSummary = computed(() => {
  if (loading.value && !displayed.value.length) return ''
  const count = displayed.value.length
  if (!count) return ''
  const searchSuffix = tableSearch.value.trim() ? ' (filtered)' : ''
  return `Showing ${count.toLocaleString()} matches in site target${searchSuffix}`
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
      <DashboardPageNavbar title="Policy Matches" />
    </template>
    <template #body>
      <div class="space-y-4">
        <DataTableToolbar>
          <template #leading>
            <div class="flex min-w-0 flex-nowrap items-center gap-1.5 sm:gap-2">
              <UTabs
                v-model="statusFilter"
                :items="[
                  { label: 'Open', value: 'open' },
                  { label: 'Dismissed', value: 'dismissed' },
                  { label: 'All', value: 'all' }
                ]"
                :content="false"
                size="sm"
                class="w-auto"
              />
              <TableSearchInput
                v-model="tableSearch"
                placeholder="Search matches…"
                aria-label="Search policy matches"
              />
              <UDropdownMenu
                :items="tableRef?.columnMenuItems ?? []"
                :content="{ align: 'start' }"
              >
                <TableToolbarMenuButton
                  label="Columns"
                  icon="i-lucide-columns-3"
                  aria-label="Toggle column visibility"
                />
              </UDropdownMenu>
            </div>
          </template>
          <template #actions>
            <UButton
              to="/policies"
              icon="i-lucide-settings-2"
              label="Manage rules"
              color="neutral"
              variant="outline"
              size="sm"
              class="max-lg:aspect-square max-lg:!px-2"
              :ui="{ base: 'h-8', label: 'hidden lg:inline' }"
            />
            <UButton
              icon="i-lucide-download"
              label="Export to CSV"
              color="neutral"
              variant="outline"
              size="sm"
              class="max-lg:aspect-square max-lg:!px-2"
              :ui="{ base: 'h-8', label: 'hidden lg:inline' }"
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
          ref="tableRef"
          v-model:status-filter="statusFilter"
          v-model:search="tableSearch"
          :show-status-filters="false"
          :items="policyMatches"
          :loading="loading"
          :footer-summary="footerSummary"
          @action="onAction"
        />
      </div>
    </template>
  </AppDashboardPanel>
</template>
