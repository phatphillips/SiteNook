<script setup lang="ts">
import Sortable from 'sortablejs'
import {
  DASHBOARD_SECTION_LABELS,
  dashboardOrgSectionViewPath,
  dashboardSectionViewPath,
  type DashboardSectionId
} from '~/utils/dashboardSectionOrder'
import { planHasFeature } from '~/utils/planLimits'

const props = withDefaults(defineProps<{
  siteId?: string
  allSites?: boolean
  title?: string
}>(), {
  allSites: false
})

const { sites, selectSite } = useSites()
const { organization } = useTenantOrg()

const isAllSitesMode = computed(() => props.allSites || !props.siteId)
const siteIdRef = computed(() => props.siteId ?? undefined)

const pageTitle = computed(() => {
  if (props.title) return props.title
  if (isAllSitesMode.value) return 'All sites'
  return sites.value.find(site => site.id === props.siteId)?.name ?? 'Site'
})

const seoEnabled = computed(() =>
  planHasFeature(organization.value?.plan, 'seoModule')
)

const { sectionOrder } = useDashboardSectionOrder()
const sectionsContainerRef = ref<HTMLElement | null>(null)
const reorderAnnouncement = ref('')

let sortable: { destroy?: () => void } | null = null

onMounted(() => {
  if (!sectionsContainerRef.value) return
  sortable = new Sortable(sectionsContainerRef.value, {
    handle: '.dashboard-section-drag-handle',
    animation: 150,
    onEnd: (event: { newIndex?: number | null, oldIndex?: number | null }) => {
      const newIndex = typeof event.newIndex === 'number' ? event.newIndex : -1
      const oldIndex = typeof event.oldIndex === 'number' ? event.oldIndex : -1
      if (newIndex < 0 || oldIndex < 0 || newIndex === oldIndex) return
      const [moved] = sectionOrder.value.splice(oldIndex, 1)
      if (moved) {
        sectionOrder.value.splice(newIndex, 0, moved)
      }
      if (newIndex < 0) return
      const movedId = sectionOrder.value[newIndex]
      if (movedId) {
        reorderAnnouncement.value = `${DASHBOARD_SECTION_LABELS[movedId]} moved to position ${newIndex + 1}`
      }
    }
  })
})

const {
  lastTerminalScan,
  runningScan,
  refresh: refreshScanState
} = useWorkspaceScanState(siteIdRef)

const {
  loading: orgLoading,
  aggregates,
  loadError: orgLoadError,
  dataAsOf,
  fetchOrgDashboard
} = useOrgDashboard()

const dataAsOfLabel = computed(() => {
  if (!dataAsOf.value) return null
  const date = new Date(dataAsOf.value)
  if (Number.isNaN(date.getTime())) return null
  return `Data as of ${date.toLocaleString()}`
})

const summaryScan = computed(() => {
  if (isAllSitesMode.value) return null
  return runningScan.value ?? lastTerminalScan.value
})

function viewPath(sectionId: DashboardSectionId) {
  if (isAllSitesMode.value) return dashboardOrgSectionViewPath(sectionId)
  return dashboardSectionViewPath(sectionId, props.siteId!)
}

function viewFullLabel() {
  return isAllSitesMode.value ? 'View full →' : 'View full →'
}

onMounted(() => {
  if (isAllSitesMode.value) {
    void fetchOrgDashboard()
    return
  }

  if (props.siteId) {
    void refreshScanState()
  }
})

watch(
  () => props.siteId,
  (siteId) => {
    if (siteId && !isAllSitesMode.value) {
      selectSite(siteId)
      void refreshScanState()
    }
  }
)

onUnmounted(() => {
  sortable?.destroy?.()
  sortable = null
})
</script>

<template>
  <AppDashboardPanel full-width>
    <template #header>
      <DashboardPageNavbar :title="pageTitle">
        <template #right>
          <ScanTriggerButton v-if="!isAllSitesMode" :site-id="siteId" />
        </template>
      </DashboardPageNavbar>
    </template>

    <template #body>
      <ScanStatusSummaryCard
        v-if="!isAllSitesMode"
        :scan="summaryScan"
        title="Latest scan"
        class="mb-6"
      />

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

      <div
        id="dashboard-dnd-describedby"
        class="sr-only"
        aria-live="polite"
      >
        {{ reorderAnnouncement }}
      </div>

      <div
        ref="sectionsContainerRef"
        class="dashboard-sections pl-6"
      >
        <DashboardSectionShell
          v-for="sectionId in sectionOrder"
          :key="sectionId"
          :section-id="sectionId"
          :title="DASHBOARD_SECTION_LABELS[sectionId]"
          :view-full-to="viewPath(sectionId)"
          :view-full-label="viewFullLabel()"
        >
          <DashboardSectionsAccessibilitySection
            v-if="sectionId === 'accessibility'"
            :site-id="isAllSitesMode ? undefined : siteId"
            :org-aggregates="isAllSitesMode ? aggregates : undefined"
            :org-loading="orgLoading"
          />
          <DashboardSectionsQualityAssuranceSection
            v-else-if="sectionId === 'qa'"
            :site-id="isAllSitesMode ? undefined : siteId"
            :org-aggregates="isAllSitesMode ? aggregates : undefined"
            :org-loading="orgLoading"
          />
          <DashboardSectionsSeoSection
            v-else-if="sectionId === 'seo'"
            :site-id="isAllSitesMode ? undefined : siteId"
            :org-aggregates="isAllSitesMode ? aggregates : undefined"
            :org-loading="orgLoading"
          />
        </DashboardSectionShell>
      </div>

      <DashboardOrgSitesTable
        v-if="isAllSitesMode && aggregates"
        class="mt-10"
        :snapshots="aggregates.siteSnapshots"
        :seo-enabled="seoEnabled"
      />
    </template>
  </AppDashboardPanel>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
