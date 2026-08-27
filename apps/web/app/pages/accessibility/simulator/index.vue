<script setup lang="ts">
import type { SimulatorPageRow } from '~/utils/simulatorPages'
import { ALL_SITES } from '~/composables/useSites'

definePageMeta({ middleware: 'auth' })

const { siteFilter, isAllSites, resolvedSiteId } = useWorkspaceSiteFilter()

const simulatorSiteId = computed(() =>
  !isAllSites.value && resolvedSiteId.value && resolvedSiteId.value !== ALL_SITES
    ? resolvedSiteId.value
    : null
)

const { rows, loading, error, load } = useSimulatorPages(simulatorSiteId)

const tableSearch = ref('')
const initialLoading = computed(() => loading.value && !rows.value.length)
provide('featurePageBannerLoading', initialLoading)

const footerSummary = computed(() => {
  if (loading.value && !rows.value.length) return ''
  const count = rows.value.length
  if (!count) return ''
  const scope = isAllSites.value ? 'across all sites' : 'in site target'
  return `${count.toLocaleString()} ${count === 1 ? 'page' : 'pages'} with open issues ${scope}`
})

onMounted(() => {
  void load()
})

watch([siteFilter, isAllSites], () => {
  void load()
})

function onSelect(row: SimulatorPageRow) {
  if (row.siteId) {
    navigateTo(`/sites/${row.siteId}/accessibility/simulator/${row.pageId}`)
    return
  }
  navigateTo(`/accessibility/simulator/${row.pageId}`)
}
</script>

<template>
  <OrgFeaturePageShell title="Simulator">
    <div class="space-y-6">
      <p class="text-sm text-muted max-w-3xl">
        Open a page to simulate vision impairments and keyboard tab order on a stored HTML preview,
        then review known accessibility issues for that page.
      </p>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        :title="error"
        icon="i-lucide-alert-circle"
      />

      <div class="space-y-4">
        <DataTableToolbar>
          <template #leading>
            <TableSearchInput
              v-model="tableSearch"
              placeholder="Search pages…"
              aria-label="Search simulator pages"
            />
          </template>
        </DataTableToolbar>

        <AccessibilitySimulatorPagesTable
          v-model:search="tableSearch"
          :rows="rows"
          :loading="loading"
          :footer-summary="footerSummary"
          :show-site-column="isAllSites"
          @select="onSelect"
        />
      </div>
    </div>
  </OrgFeaturePageShell>
</template>
