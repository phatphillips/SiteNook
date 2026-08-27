<script setup lang="ts">
import type { ActiveScanRow, Scan, Site } from '~/types/sitenook'

definePageMeta({ middleware: 'auth' })

const toast = useToast()
const { sites, activeSiteId, fetchSites } = useSites()
const {
  activeRows,
  activeLoading,
  hasFetchedActiveOnce,
  error,
  rescanModalOpen,
  rescanSite,
  rescanRawConfig,
  isSiteBusy,
  refreshAll,
  openRescan,
  closeRescanModal,
  cancelActiveScan,
  deleteScan,
  restartScan,
  subscribeRealtime,
  unsubscribeRealtime,
  latestScanBySiteId,
  latestCompleteScanBySiteId
} = useScans()

const stoppingRowId = ref<string | null>(null)
const actionLoadingId = ref<string | null>(null)
const pendingCancelRowIds = ref<string[]>([])
const configureSite = ref<Site | null>(null)
const selectedActiveRowId = ref<string | null>(null)

const scanTriggerSiteId = computed(() => activeSiteId.value || sites.value[0]?.id)

function siteNameForId(siteId: string): string {
  return sites.value.find(s => s.id === siteId)?.name ?? 'site'
}

function notifyScanQueued(siteId?: string, siteName?: string) {
  const name = siteName ?? (siteId ? siteNameForId(siteId) : 'site')
  toast.add({
    title: 'Scan queued',
    description: `Scan queued for ${name}.`
  })
}

async function handleStopActive(row: ActiveScanRow) {
  stoppingRowId.value = row.id
  if (!pendingCancelRowIds.value.includes(row.id)) {
    pendingCancelRowIds.value = [...pendingCancelRowIds.value, row.id]
  }
  try {
    await cancelActiveScan(row)
    await refreshAll()
  } catch (e: unknown) {
    pendingCancelRowIds.value = pendingCancelRowIds.value.filter(id => id !== row.id)
    stoppingRowId.value = null
    toast.add({
      title: 'Could not stop scan',
      description: toErrorMessage(e),
      color: 'error'
    })
  }
}

function clearPendingCancel(rowId: string) {
  pendingCancelRowIds.value = pendingCancelRowIds.value.filter(id => id !== rowId)
  if (stoppingRowId.value === rowId) {
    stoppingRowId.value = null
  }
}

function onCancelConfirmed(rowId: string) {
  if (!pendingCancelRowIds.value.includes(rowId)) return
  clearPendingCancel(rowId)
  toast.add({ title: 'Scan stopped', color: 'success' })
}

watch(activeRows, (rows) => {
  for (const pendingId of [...pendingCancelRowIds.value]) {
    const row = rows.find(r => r.id === pendingId)
    if (!row || row.status === 'cancelled') {
      onCancelConfirmed(pendingId)
    }
  }
})

async function handleDeleteScan(scan: Scan) {
  actionLoadingId.value = scan.id
  try {
    await deleteScan(scan.id, scan.site)
    toast.add({ title: 'Scan deleted' })
    await refreshAll()
  } catch (e: unknown) {
    toast.add({
      title: 'Could not delete scan',
      description: toErrorMessage(e),
      color: 'error'
    })
  } finally {
    actionLoadingId.value = null
  }
}

async function handleStartAgain(scan: Scan) {
  if (isSiteBusy(scan.site)) {
    toast.add({
      title: 'Site busy',
      description: 'Wait for the current scan to finish or stop it first.',
      color: 'warning'
    })
    return
  }
  actionLoadingId.value = scan.id
  try {
    const ok = await restartScan(scan)
    if (!ok) {
      toast.add({ title: 'Site busy', color: 'warning' })
      return
    }
    notifyScanQueued(scan.site, siteNameForId(scan.site))
    await refreshAll()
  } catch (e: unknown) {
    toast.add({
      title: 'Could not start scan',
      description: toErrorMessage(e),
      color: 'error'
    })
  } finally {
    actionLoadingId.value = null
  }
}

function toErrorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as { message: string }).message)
  }
  return 'Request failed'
}

function viewResults(scan: Scan) {
  activeSiteId.value = scan.site
  navigateTo(`/sites/${scan.site}/accessibility`)
}

async function handleRescan(scan: Scan) {
  if (isSiteBusy(scan.site)) {
    toast.add({
      title: 'Scan already queued',
      description: 'This site has a scan pending or in progress.',
      color: 'warning'
    })
    return
  }
  const ok = await openRescan(scan)
  if (!ok) {
    toast.add({
      title: 'Could not open configure',
      description: 'Site details are unavailable.',
      color: 'error'
    })
  }
}

function handleConfigureSite(site: Site) {
  if (isSiteBusy(site.id)) {
    toast.add({
      title: 'Site busy',
      description: 'Wait for the current scan to finish first.',
      color: 'warning'
    })
    return
  }
  configureSite.value = site
  rescanSite.value = site
  rescanRawConfig.value = site.default_scan_config ?? null
  rescanModalOpen.value = true
}

function onScanQueuedFromModal() {
  const site = rescanSite.value ?? configureSite.value
  notifyScanQueued(site?.id, site?.name)
  closeRescanModal()
  configureSite.value = null
  refreshAll()
}

function onScanQueuedFromTrigger() {
  const siteId = scanTriggerSiteId.value
  if (siteId) {
    notifyScanQueued(siteId)
  }
  refreshAll()
}

onMounted(async () => {
  try {
    await fetchSites()
  } catch (e: unknown) {
    error.value = `Could not load sites: ${toErrorMessage(e)}`
  }
  void subscribeRealtime()
  await refreshAll()
})

onUnmounted(() => {
  unsubscribeRealtime()
})
</script>

<template>
  <AppDashboardPanel id="scans">
    <template #header>
      <DashboardPageNavbar title="Scans">
        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            :loading="activeLoading"
            aria-label="Refresh scans"
            @click="refreshAll()"
          />
          <ScanTriggerButton
            :site-id="scanTriggerSiteId"
            label="New scan"
            @queued="onScanQueuedFromTrigger"
          />
        </template>
      </DashboardPageNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="error"
        class="mb-4"
        color="error"
        variant="subtle"
        :title="error"
      />

      <section class="mb-8">
        <ActiveScansTable
          v-model:selected-row-id="selectedActiveRowId"
          :rows="activeRows"
          :loading="activeLoading"
          :has-loaded="hasFetchedActiveOnce"
          :stopping-row-id="stoppingRowId"
          :is-site-busy="isSiteBusy"
          :action-loading-id="actionLoadingId"
          @stop="handleStopActive"
          @view-results="viewResults"
          @delete="handleDeleteScan"
          @rerun="handleRescan"
        />
      </section>

      <section>
        <div class="mb-4">
          <h2 class="font-semibold">
            Sites
          </h2>
          <p class="text-sm text-muted mt-1">
            Manage schedules, configure scans, and expand a row to view run history.
          </p>
        </div>

        <SiteScansTable
          :sites="sites"
          :latest-scan-by-site-id="latestScanBySiteId"
          :latest-complete-scan-by-site-id="latestCompleteScanBySiteId"
          :action-loading-id="actionLoadingId"
          :is-site-busy="isSiteBusy"
          @view-results="viewResults"
          @configure-scan="handleConfigureSite"
          @start-again="handleStartAgain"
          @delete="handleDeleteScan"
          @refresh="refreshAll()"
        />
      </section>

      <ScanConfigModal
        v-model:open="rescanModalOpen"
        :site="rescanSite"
        :initial-raw-config="rescanRawConfig"
        @queued="onScanQueuedFromModal"
        @schedule-saved="onScanQueuedFromModal"
      />
    </template>
  </AppDashboardPanel>
</template>
