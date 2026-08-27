<script setup lang="ts">
import type { SimulatorPageRow } from '~/utils/simulatorPages'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { activeSiteId, activeSite } = useSites()

const { rows, loading, error, load } = useSimulatorPages(siteId)

const tableSearch = ref('')
const initialLoading = computed(() => loading.value && !rows.value.length)
provide('featurePageBannerLoading', initialLoading)

const footerSummary = computed(() => {
  if (loading.value && !rows.value.length) return ''
  const count = rows.value.length
  if (!count) return ''
  const siteLabel = activeSite.value?.name ? ` for ${activeSite.value.name}` : ''
  return `${count} ${count === 1 ? 'page' : 'pages'} with open issues${siteLabel}`
})

watch(siteId, (id) => {
  activeSiteId.value = id
  void load()
})

onMounted(() => {
  activeSiteId.value = siteId.value
  void load()
})

function onSelect(row: SimulatorPageRow) {
  navigateTo(`/sites/${siteId.value}/accessibility/simulator/${row.pageId}`)
}
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Simulator" />
    </template>

    <template #body>
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
            @select="onSelect"
          />
        </div>
      </div>
    </template>
  </AppDashboardPanel>
</template>
