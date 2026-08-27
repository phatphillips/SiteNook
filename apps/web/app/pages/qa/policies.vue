<script setup lang="ts">
import { fetchAllPages } from '~/utils/fetchAllPages'
import { orgApiFetch } from '~/utils/orgApiFetch'
import { buildPolicyMatchesCsv } from '~/utils/export/policyMatchesExport'
import type { PolicyMatchStatusFilter } from '~/components/qa/PolicyMatchesTable.vue'

definePageMeta({ middleware: 'auth' })

const { resolvedSiteId, isAllSites } = useWorkspaceSiteFilter()
const { pb } = usePocketBase()

const statusFilter = ref<PolicyMatchStatusFilter>('open')

const {
  policyMatches,
  loading,
  total,
  page,
  perPage,
  fetchPolicyMatches
} = useOrgQA(resolvedSiteId)

function apiStatus() {
  return statusFilter.value === 'all' ? undefined : statusFilter.value
}

function load() {
  void fetchPolicyMatches({ status: apiStatus() })
}

onMounted(() => {
  load()
})

watch(resolvedSiteId, () => {
  page.value = 1
  load()
})

watch(statusFilter, () => {
  page.value = 1
  load()
})

watch(page, () => {
  load()
})

const scopeLabel = computed(() => resolvedSiteId.value ?? 'org')

const {
  exportModalOpen,
  exportConfig,
  exporting,
  progressMessage,
  runExport
} = useSimpleTableCsvExport({
  total,
  page,
  pageSize: perPage,
  currentRows: policyMatches,
  feature: `policy-matches-${statusFilter.value}`,
  scopeLabel,
  fetchAllRows: async (onProgress) => fetchAllPages(async (pageNum) => {
    const result = await orgApiFetch<{ items: typeof policyMatches.value, total: number, perPage: number }>(
      '/api/org/qa/policy-matches',
      {
        page: pageNum,
        perPage: perPage.value,
        siteId: resolvedSiteId.value,
        status: apiStatus()
      }
    )
    return result
  }, {
    onProgress: (current, totalPages) => onProgress(`Fetching page ${current} of ${totalPages}…`)
  }),
  buildCsv: rows => buildPolicyMatchesCsv(rows, { showSiteColumn: isAllSites.value })
})

async function onAction(payload: {
  issueIds: string[]
  action: 'dismiss' | 'reopen' | 'fixed'
}) {
  const siteId = resolvedSiteId.value || policyMatches.value.find(m => payload.issueIds.includes(m.id))?.siteId
  if (!siteId || !pb?.authStore.token) return
  await $fetch(`/api/sites/${siteId}/qa/issues/bulk-status`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pb.authStore.token}` },
    body: {
      issueIds: payload.issueIds,
      issueType: 'policy_matches',
      action: payload.action
    }
  })
  load()
}
</script>

<template>
  <OrgFeaturePageShell title="Policy Matches">
    <div class="space-y-4">
      <DataTableToolbar>
        <template #actions>
          <UButton
            to="/policies"
            icon="i-lucide-settings-2"
            label="Manage rules"
            color="neutral"
            variant="outline"
          />
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
        server-paginated
        :items="policyMatches"
        :loading="loading"
        :page="page"
        :page-size="perPage"
        :total="total"
        show-site-column
        @update:page="(p) => { page = p }"
        @action="onAction"
      />
    </div>
  </OrgFeaturePageShell>
</template>
