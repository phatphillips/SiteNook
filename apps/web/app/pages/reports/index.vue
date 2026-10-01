<script setup lang="ts">
import type { ReportJobRecord, ReportScheduleRecord } from '~/types/reports'

definePageMeta({ middleware: 'auth' })

const activeTab = ref<'history' | 'scheduled'>('history')
const modalOpen = ref(false)
const detailOpen = ref(false)
const detailJob = ref<ReportJobRecord | null>(null)
const editingSchedule = ref<ReportScheduleRecord | null>(null)
const initialMode = ref<'now' | 'schedule'>('now')
const togglingId = ref<string | null>(null)
const showDeleteModal = ref(false)
const historySearchInput = ref('')
const schedulesSearchInput = ref('')

const historyTable = useTemplateRef<{
  selectedCount: number
  selectedIds: string[]
  selectedJobs: ReportJobRecord[]
  columnMenuItems: Array<{
    label: string
    type: 'checkbox'
    checked: boolean
    onUpdateChecked: (checked: boolean) => void
    onSelect: (e: Event) => void
  }>
  clearSelection: () => void
}>('historyTable')

const schedulesTable = useTemplateRef<{
  columnMenuItems: Array<{
    label: string
    type: 'checkbox'
    checked: boolean
    onUpdateChecked: (checked: boolean) => void
    onSelect: (e: Event) => void
  }>
}>('schedulesTable')

const {
  jobs,
  loading,
  total: jobsTotal,
  page: jobsPage,
  perPage: jobsPerPage,
  search: jobsSearch,
  fetchJobs,
  downloadJob,
  downloadingJobId,
  deleteJobs,
  deleting
} = useReportJobs()

const {
  schedules,
  loading: schedulesLoading,
  total: schedulesTotal,
  page: schedulesPage,
  perPage: schedulesPerPage,
  search: schedulesSearch,
  fetchSchedules,
  deleteSchedule,
  setEnabled,
  runNow,
  deletingId,
  runningId
} = useReportSchedules()

const toast = useToast()
const stableHistoryLoading = useStableLoading(loading)
const stableSchedulesLoading = useStableLoading(schedulesLoading)

const selectedCount = computed(() => historyTable.value?.selectedCount ?? 0)
const searchPlaceholder = computed(() =>
  activeTab.value === 'history' ? 'Search reports…' : 'Search schedules…'
)
const searchModel = computed({
  get: () => (activeTab.value === 'history' ? historySearchInput.value : schedulesSearchInput.value),
  set: (value: string) => {
    if (activeTab.value === 'history') historySearchInput.value = value
    else schedulesSearchInput.value = value
  }
})

let listPollTimer: ReturnType<typeof setInterval> | null = null
let searchDebounce: ReturnType<typeof setTimeout> | null = null

function hasActiveJobs() {
  return jobs.value.some(job => job.status === 'pending' || job.status === 'processing')
}

function stopListPolling() {
  if (listPollTimer) {
    clearInterval(listPollTimer)
    listPollTimer = null
  }
}

function syncListPolling() {
  if (hasActiveJobs()) {
    if (!listPollTimer) {
      listPollTimer = setInterval(() => {
        void refreshHistory({ silent: true })
      }, 2500)
    }
    return
  }
  stopListPolling()
}

async function refreshHistory(options: { silent?: boolean } = {}) {
  try {
    await fetchJobs({ silent: options.silent })
    syncListPolling()
  } catch (error) {
    if (!options.silent) {
      toast.add({
        title: 'Could not load reports',
        description: error instanceof Error ? error.message : 'Request failed',
        color: 'error'
      })
    }
  }
}

async function refreshSchedules(options: { silent?: boolean } = {}) {
  try {
    await fetchSchedules({ silent: options.silent })
  } catch (error) {
    if (!options.silent) {
      toast.add({
        title: 'Could not load schedules',
        description: error instanceof Error ? error.message : 'Request failed',
        color: 'error'
      })
    }
  }
}

async function handleDownload(jobId: string) {
  try {
    await downloadJob(jobId)
    toast.add({
      title: 'Download started',
      description: 'Your report file is downloading.',
      color: 'success',
      icon: 'i-lucide-download'
    })
  } catch (error) {
    toast.add({
      title: 'Download failed',
      description: error instanceof Error ? error.message : 'Request failed',
      color: 'error'
    })
  }
}

async function handleBulkDownload() {
  const selected = historyTable.value?.selectedJobs || []
  const complete = selected.filter(job => job.status === 'complete')
  if (!complete.length) {
    toast.add({
      title: 'Nothing to download',
      description: 'Select at least one completed report.',
      color: 'warning'
    })
    return
  }
  for (const job of complete) {
    await handleDownload(job.id)
  }
}

async function confirmDeleteSelected() {
  const ids = historyTable.value?.selectedIds || []
  if (!ids.length) return
  try {
    const deleted = await deleteJobs(ids)
    showDeleteModal.value = false
    historyTable.value?.clearSelection()
    if (detailJob.value && ids.includes(detailJob.value.id)) {
      detailOpen.value = false
      detailJob.value = null
    }
    toast.add({
      title: deleted === 1 ? 'Report deleted' : 'Reports deleted',
      description: `${deleted} report${deleted === 1 ? '' : 's'} removed.`,
      color: 'success',
      icon: 'i-lucide-trash-2'
    })
    await refreshHistory({ silent: true })
  } catch (error) {
    toast.add({
      title: 'Could not delete reports',
      description: error instanceof Error ? error.message : 'Request failed',
      color: 'error'
    })
  }
}

function openNewReport() {
  editingSchedule.value = null
  initialMode.value = activeTab.value === 'scheduled' ? 'schedule' : 'now'
  modalOpen.value = true
}

function openEditSchedule(schedule: ReportScheduleRecord) {
  editingSchedule.value = schedule
  initialMode.value = 'schedule'
  modalOpen.value = true
}

function openJobDetail(job: ReportJobRecord) {
  detailJob.value = job
  detailOpen.value = true
}

async function handleToggle(schedule: ReportScheduleRecord) {
  togglingId.value = schedule.id
  try {
    await setEnabled(schedule.id, !schedule.enabled)
    toast.add({
      title: schedule.enabled ? 'Schedule paused' : 'Schedule resumed',
      description: `"${schedule.name}" is now ${schedule.enabled ? 'paused' : 'active'}.`,
      color: 'success',
      icon: schedule.enabled ? 'i-lucide-pause' : 'i-lucide-play'
    })
    await refreshSchedules({ silent: true })
  } catch (error) {
    toast.add({
      title: 'Could not update schedule',
      description: error instanceof Error ? error.message : 'Request failed',
      color: 'error'
    })
  } finally {
    togglingId.value = null
  }
}

async function handleRunNow(schedule: ReportScheduleRecord) {
  try {
    await runNow(schedule.id)
    toast.add({
      title: 'Report queued',
      description: `"${schedule.name}" is generating now. Check History when it finishes.`,
      color: 'success',
      icon: 'i-lucide-zap'
    })
    activeTab.value = 'history'
    await Promise.all([
      refreshHistory({ silent: true }),
      refreshSchedules({ silent: true })
    ])
  } catch (error) {
    toast.add({
      title: 'Could not run schedule',
      description: error instanceof Error ? error.message : 'Request failed',
      color: 'error'
    })
  }
}

async function handleDelete(schedule: ReportScheduleRecord) {
  try {
    await deleteSchedule(schedule.id)
    toast.add({
      title: 'Schedule deleted',
      description: `"${schedule.name}" was removed.`,
      color: 'success',
      icon: 'i-lucide-trash-2'
    })
  } catch (error) {
    toast.add({
      title: 'Could not delete schedule',
      description: error instanceof Error ? error.message : 'Request failed',
      color: 'error'
    })
  }
}

async function handleScheduleSaved() {
  activeTab.value = 'scheduled'
  await refreshSchedules({ silent: true })
  editingSchedule.value = null
}

async function handleJobCreated() {
  activeTab.value = 'history'
  await refreshHistory({ silent: true })
}

function onHistoryPage(page: number) {
  jobsPage.value = page
  void refreshHistory()
}

function onSchedulesPage(page: number) {
  schedulesPage.value = page
  void refreshSchedules()
}

watch(activeTab, (tab) => {
  if (tab === 'scheduled' && !schedules.value.length) {
    void refreshSchedules()
  }
})

watch(historySearchInput, (value) => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    jobsSearch.value = value
    jobsPage.value = 1
    void refreshHistory({ silent: true })
  }, 250)
})

watch(schedulesSearchInput, (value) => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    schedulesSearch.value = value
    schedulesPage.value = 1
    void refreshSchedules({ silent: true })
  }, 250)
})

watch(jobs, (list) => {
  if (!detailJob.value) return
  const updated = list.find(job => job.id === detailJob.value?.id)
  if (updated) detailJob.value = updated
})

onMounted(() => {
  void refreshHistory()
  void refreshSchedules({ silent: true })
})

onUnmounted(() => {
  stopListPolling()
  if (searchDebounce) clearTimeout(searchDebounce)
})
</script>

<template>
  <AppDashboardPanel id="reports">
    <template #header>
      <DashboardPageNavbar title="Reports" />
    </template>

    <template #body>
      <div class="space-y-4">
        <DataTableToolbar>
          <template #leading>
            <UTabs
              v-model="activeTab"
              :items="[
                { label: 'History', value: 'history' },
                { label: 'Scheduled', value: 'scheduled' }
              ]"
              :content="false"
              size="sm"
              class="w-auto"
            />
            <TableSearchInput
              v-model="searchModel"
              :placeholder="searchPlaceholder"
              :aria-label="searchPlaceholder"
            />
            <UDropdownMenu
              :items="(activeTab === 'history' ? historyTable?.columnMenuItems : schedulesTable?.columnMenuItems) ?? []"
              :content="{ align: 'start' }"
            >
              <TableToolbarMenuButton
                label="Columns"
                icon="i-lucide-columns-3"
                aria-label="Toggle column visibility"
              />
            </UDropdownMenu>
          </template>
          <template #actions>
            <template v-if="activeTab === 'history' && selectedCount">
              <UButton
                label="Download"
                icon="i-lucide-download"
                color="neutral"
                variant="outline"
                :disabled="!!downloadingJobId"
                @click="handleBulkDownload"
              />
              <UButton
                :label="`Delete (${selectedCount})`"
                icon="i-lucide-trash-2"
                color="error"
                variant="outline"
                @click="showDeleteModal = true"
              />
            </template>
            <UButton
              label="New"
              icon="i-lucide-plus"
              @click="openNewReport"
            />
          </template>
        </DataTableToolbar>

        <Transition
          mode="out-in"
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div v-if="activeTab === 'history'" key="history">
            <ReportsHistoryTable
              ref="historyTable"
              :jobs="jobs"
              :loading="stableHistoryLoading"
              :total="jobsTotal"
              :page="jobsPage"
              :per-page="jobsPerPage"
              @open="openJobDetail"
              @update:page="onHistoryPage"
            />
          </div>
          <div v-else key="scheduled">
            <ScheduledReportsTable
              ref="schedulesTable"
              :schedules="schedules"
              :loading="stableSchedulesLoading"
              :total="schedulesTotal"
              :page="schedulesPage"
              :per-page="schedulesPerPage"
              :deleting-id="deletingId"
              :running-id="runningId"
              :toggling-id="togglingId"
              @edit="openEditSchedule"
              @toggle="handleToggle"
              @run="handleRunNow"
              @remove="handleDelete"
              @update:page="onSchedulesPage"
            />
          </div>
        </Transition>
      </div>

      <NewReportModal
        v-model:open="modalOpen"
        :schedule="editingSchedule"
        :initial-mode="initialMode"
        @created="handleJobCreated"
        @saved="handleScheduleSaved"
      />

      <ReportJobDetailModal
        v-model:open="detailOpen"
        :job="detailJob"
        :downloading="!!detailJob && downloadingJobId === detailJob.id"
        @download="handleDownload"
      />

      <UModal
        v-model:open="showDeleteModal"
        :title="`Delete ${selectedCount} report${selectedCount === 1 ? '' : 's'}`"
        description="This permanently removes the selected report history and any stored files."
      >
        <template #body>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="subtle"
              @click="showDeleteModal = false"
            />
            <UButton
              label="Delete"
              color="error"
              :loading="deleting"
              @click="confirmDeleteSelected"
            />
          </div>
        </template>
      </UModal>
    </template>
  </AppDashboardPanel>
</template>
