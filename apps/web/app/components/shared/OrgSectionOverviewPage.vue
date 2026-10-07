<script setup lang="ts">
import type { DashboardSectionId } from '~/utils/dashboardSectionOrder'
import { DASHBOARD_SECTION_LABELS } from '~/utils/dashboardSectionOrder'
import { planHasFeature } from '~/utils/planLimits'

const props = defineProps<{
  section: DashboardSectionId
}>()

const { sites, fetchSites, loading: sitesLoading } = useSites()
const { organization } = useTenantOrg()

const {
  loading: orgLoading,
  aggregates,
  loadError: orgLoadError,
  dataAsOf,
  fetchOrgDashboard
} = useOrgDashboard()

const seoEnabled = computed(() =>
  planHasFeature(organization.value?.plan, 'seoModule')
)

const pageTitle = computed(() => DASHBOARD_SECTION_LABELS[props.section])
const hasSites = computed(() => sites.value.length > 0)

const emptyContext = computed((): 'accessibility' | 'qa' | 'seo' | 'home' => {
  if (props.section === 'accessibility' || props.section === 'qa' || props.section === 'seo') {
    return props.section
  }
  return 'home'
})

const dataAsOfLabel = computed(() => {
  if (!dataAsOf.value) return null
  const date = new Date(dataAsOf.value)
  if (Number.isNaN(date.getTime())) return null
  return `Data as of ${date.toLocaleString()}`
})

onMounted(async () => {
  await fetchSites().catch(() => {})
  if (sites.value.length > 0) {
    await fetchOrgDashboard()
  }
})
</script>

<template>
  <AppDashboardPanel full-width>
    <template #header>
      <DashboardPageNavbar :title="pageTitle" />
    </template>
    <template #body>
      <DashboardEmptySitesState
        v-if="!sitesLoading && !hasSites"
        :context="emptyContext"
      />

      <template v-else-if="hasSites">
        <UAlert
          v-if="orgLoadError"
          color="error"
          variant="subtle"
          title="Could not load org dashboard"
          :description="orgLoadError"
          class="mb-6"
        />

        <UCard
          v-else-if="orgLoading && !aggregates"
          class="mb-6"
          :ui="{ body: 'p-6 flex justify-center' }"
        >
          <UIcon name="i-lucide-loader-circle" class="size-7 animate-spin text-muted" />
        </UCard>

        <p
          v-if="dataAsOfLabel"
          class="mb-4 text-xs text-muted"
        >
          {{ dataAsOfLabel }}
        </p>

        <DashboardSectionsAccessibilitySection
          v-if="section === 'accessibility' && aggregates"
          :org-aggregates="aggregates"
          :org-loading="orgLoading"
        />
        <DashboardSectionsQualityAssuranceSection
          v-else-if="section === 'qa' && aggregates"
          :org-aggregates="aggregates"
          :org-loading="orgLoading"
        />
        <DashboardSectionsSeoSection
          v-else-if="section === 'seo' && aggregates"
          :org-aggregates="aggregates"
          :org-loading="orgLoading"
        />

        <DashboardOrgSitesTable
          v-if="aggregates"
          class="mt-10"
          :snapshots="aggregates.siteSnapshots"
          :seo-enabled="seoEnabled"
          :show-qa="section !== 'accessibility'"
          :show-seo="section === 'seo' && seoEnabled"
        />
      </template>

      <UCard
        v-else
        class="mb-6"
        :ui="{ body: 'p-6 flex justify-center' }"
      >
        <UIcon name="i-lucide-loader-circle" class="size-7 animate-spin text-muted" />
      </UCard>
    </template>
  </AppDashboardPanel>
</template>
