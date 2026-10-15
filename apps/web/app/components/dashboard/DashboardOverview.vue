<script setup lang="ts">
import {
  dashboardOrgSectionViewPath,
  dashboardSectionViewPath,
  type DashboardSectionId
} from '~/utils/dashboardSectionOrder'
import type { OverviewDateRange } from '~/utils/overviewDateRange'
import { planHasFeature } from '~/utils/planLimits'

const props = withDefaults(defineProps<{
  siteId?: string
  allSites?: boolean
  title?: string
}>(), {
  allSites: false
})

const { sites, selectSite, loading: sitesLoading } = useSites()
const { organization } = useTenantOrg()

const isAllSitesMode = computed(() => props.allSites || !props.siteId)
const hasSites = computed(() => sites.value.length > 0)

const pageTitle = computed(() => {
  if (props.title) return props.title
  if (isAllSitesMode.value) return 'All sites'
  return sites.value.find(site => site.id === props.siteId)?.name ?? 'Site'
})

const seoEnabled = computed(() =>
  planHasFeature(organization.value?.plan, 'seoModule')
)

const { sectionOrder } = useDashboardSectionOrder()

const {
  loading: orgLoading,
  aggregates,
  loadError: orgLoadError,
  dataAsOf,
  fetchOrgDashboard
} = useOrgDashboard()

const overviewDateRange = ref<OverviewDateRange>({ preset: 30 })

const dataAsOfLabel = computed(() => {
  if (!dataAsOf.value) return null
  const date = new Date(dataAsOf.value)
  if (Number.isNaN(date.getTime())) return null
  return `Data as of ${date.toLocaleString()}`
})

function viewPath(sectionId: DashboardSectionId) {
  if (isAllSitesMode.value) return dashboardOrgSectionViewPath(sectionId)
  return dashboardSectionViewPath(sectionId, props.siteId!)
}

onMounted(() => {
  if (isAllSitesMode.value) {
    void fetchOrgDashboard()
  }
})

watch(
  () => props.siteId,
  (siteId) => {
    if (siteId && !isAllSitesMode.value) {
      selectSite(siteId)
    }
  }
)
</script>

<template>
  <AppDashboardPanel full-width>
    <template #header>
      <DashboardPageNavbar :title="pageTitle">
        <template #right>
          <AccessibilityOverviewDateRangeControls
            v-if="!isAllSitesMode && hasSites"
            v-model="overviewDateRange"
          />
          <ScanTriggerButton v-if="!isAllSitesMode" :site-id="siteId" />
        </template>
      </DashboardPageNavbar>
    </template>

    <template #body>
      <DashboardEmptySitesState
        v-if="!sitesLoading && !hasSites"
        context="home"
      />

      <template v-else-if="hasSites">
        <UAlert
          v-if="isAllSitesMode && orgLoadError"
          color="error"
          variant="subtle"
          title="Could not load org dashboard"
          :description="orgLoadError"
          class="mb-6"
        />

        <UCard
          v-else-if="isAllSitesMode && orgLoading && !aggregates"
          class="mb-6"
          :ui="{ body: 'p-6 flex justify-center' }"
        >
          <UIcon name="i-lucide-loader-circle" class="size-7 animate-spin text-muted" />
        </UCard>

        <p
          v-if="isAllSitesMode && dataAsOfLabel"
          class="mb-4 text-xs text-muted"
        >
          {{ dataAsOfLabel }}
        </p>

        <DashboardOrgSitesTable
          v-if="isAllSitesMode && aggregates"
          class="mb-10"
          :snapshots="aggregates.siteSnapshots"
          :seo-enabled="seoEnabled"
        />

        <div class="dashboard-sections">
          <DashboardSectionShell
            v-for="sectionId in sectionOrder"
            :key="sectionId"
            :section-id="sectionId"
            :view-full-to="isAllSitesMode ? undefined : viewPath(sectionId)"
            :show-heading="!isAllSitesMode"
          >
            <DashboardSectionsAccessibilitySection
              v-if="sectionId === 'accessibility'"
              :site-id="isAllSitesMode ? undefined : siteId"
              :org-aggregates="isAllSitesMode ? aggregates : undefined"
              :org-loading="orgLoading"
              v-model:date-range="overviewDateRange"
            />
            <DashboardSectionsQualityAssuranceSection
              v-else-if="sectionId === 'qa'"
              :site-id="isAllSitesMode ? undefined : siteId"
              :org-aggregates="isAllSitesMode ? aggregates : undefined"
              :org-loading="orgLoading"
              v-model:date-range="overviewDateRange"
            />
            <DashboardSectionsSeoSection
              v-else-if="sectionId === 'seo'"
              :site-id="isAllSitesMode ? undefined : siteId"
              :org-aggregates="isAllSitesMode ? aggregates : undefined"
              :org-loading="orgLoading"
              v-model:date-range="overviewDateRange"
            />
          </DashboardSectionShell>
        </div>
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
