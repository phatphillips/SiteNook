<script setup lang="ts">
import { fetchAllPages } from '~/utils/fetchAllPages'
import { orgApiFetch } from '~/utils/orgApiFetch'
import { buildPolicyMatchesCsv } from '~/utils/export/policyMatchesExport'
import type { PolicyMatchStatusFilter } from '~/components/qa/PolicyMatchesTable.vue'

definePageMeta({ middleware: 'auth' })

const { resolvedSiteId, isAllSites } = useWorkspaceSiteFilter()
const { pb } = usePocketBase()

const statusFilter = ref<PolicyMatchStatusFilter>('open')
const tableSearch = ref('')
const tableRef = useTemplateRef('tableRef')

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

const footerSummary = computed(() => {
  if (loading.value && !policyMatches.value.length) return ''
  if (!total.value) return ''
  const start = (page.value - 1) * perPage.value + 1
  const end = Math.min(page.value * perPage.value, total.value)
  const scope = isAllSites.value ? 'across all sites' : 'in site target'
  const searchSuffix = tableSearch.value.trim() ? ' (filtered)' : ''
  return `Showing ${start}-${end} of ${total.value.toLocaleString()} matches ${scope}${searchSuffix}`
})

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
  buildCsv: rows => buildPolicyMatchesCsv(rows, {
    showSiteColumn: isAllSites.value
  })
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
        server-paginated
        :items="policyMatches"
        :loading="loading"
        :page="page"
        :page-size="perPage"
        :total="total"
        :footer-summary="footerSummary"
        :show-site-column="isAllSites"
        @update:page="(p) => { page = p }"
        @action="onAction"
      />
    </div>
  </OrgFeaturePageShell>
</template>
