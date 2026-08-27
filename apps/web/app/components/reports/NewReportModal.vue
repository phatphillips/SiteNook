<script setup lang="ts">
import type {
  CreateReportSchedulePayload,
  ReportFormat,
  ReportJobRecord,
  ReportScheduleCadence,
  ReportScheduleRecord,
  ReportSectionSelection
} from '~/types/reports'
import {
  canSubmitReportSections,
  countSelectedReportSections,
  defaultReportSectionSelection,
  REPORT_OVERVIEW_SECTION_LABELS
} from '~/utils/reportSections'
import {
  activeReportProgressStage,
  clampReportProgress,
  isReportJobActive,
  reportStatusHeadline,
  REPORT_PROGRESS_STAGES
} from '~/utils/reportJobProgress'
import {
  formatReportCadenceLabel,
  REPORT_SCHEDULE_CADENCE_LABELS
} from '~/utils/reportSchedule'

type DeliveryMode = 'now' | 'schedule'
type WizardStep = 'content' | 'delivery'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{
  schedule?: ReportScheduleRecord | null
  initialMode?: DeliveryMode
}>()
const emit = defineEmits<{
  created: []
  saved: []
}>()

const { sites, fetchSites } = useSites()
const { members, fetchMembers } = useTeamMembers()
const { createJob, createLoading, getJob, downloadJob, downloadingJobId } = useReportJobs()
const { createSchedule, updateSchedule, saving } = useReportSchedules()
const toast = useToast()

const step = ref<WizardStep>('content')
const deliveryMode = ref<DeliveryMode>('now')
const name = ref('')
const format = ref<ReportFormat>('pdf')
const includeAllSites = ref(true)
const siteId = ref('')
const sections = ref(defaultReportSectionSelection())
const cadenceMode = ref<'once' | 'recurring'>('recurring')
const cadence = ref<ReportScheduleCadence>('weekly')
const scheduleTime = ref('09:00')
const timezone = ref(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
const runAtLocal = ref('')
const recipientIds = ref<string[]>([])

const createdJob = ref<ReportJobRecord | null>(null)
const generating = ref(false)
const displayProgress = ref(0)

let pollTimer: ReturnType<typeof setInterval> | null = null
let progressRaf: number | null = null

const isEdit = computed(() => !!props.schedule?.id)
const isScheduleMode = computed(() => deliveryMode.value === 'schedule' || isEdit.value)
const selectedCount = computed(() => countSelectedReportSections(sections.value))
const siteItems = computed(() => sites.value.map(site => ({ label: site.name, value: site.id })))
const overviewPdfOnly = computed(() => format.value === 'csv')
const recurringCadenceItems = computed(() =>
  (['daily', 'weekly', 'monthly', 'every_5d'] as ReportScheduleCadence[]).map(value => ({
    label: REPORT_SCHEDULE_CADENCE_LABELS[value],
    value
  }))
)

const canContinueContent = computed(() =>
  canSubmitReportSections(sections.value, format.value)
  && (includeAllSites.value || !!siteId.value)
)

const canSubmitSchedule = computed(() =>
  !!name.value.trim()
  && canContinueContent.value
  && recipientIds.value.length > 0
  && (cadenceMode.value === 'recurring' || !!runAtLocal.value || !!scheduleTime.value)
)

const canSubmit = computed(() =>
  isScheduleMode.value ? canSubmitSchedule.value : canContinueContent.value
)

const submitting = computed(() => createLoading.value || saving.value)

const modalTitle = computed(() => {
  if (generating.value) return 'Generating report'
  if (isEdit.value) return 'Edit scheduled report'
  return 'New report'
})

const modalSubtitle = computed(() => {
  if (generating.value) return progressHeadline.value
  if (step.value === 'content') return 'Choose format, scope, and what to include.'
  if (isEdit.value) return 'Update when it runs and who receives the link.'
  if (isScheduleMode.value) return 'Email a download link on a cadence you choose.'
  return 'Generate now, or schedule delivery to your team.'
})

const contentSummary = computed(() => {
  const bits = [
    format.value.toUpperCase(),
    includeAllSites.value ? 'All sites' : (sites.value.find(s => s.id === siteId.value)?.name || 'One site'),
    `${selectedCount.value} section${selectedCount.value === 1 ? '' : 's'}`
  ]
  return bits.join(' · ')
})

const scheduleSummary = computed(() => {
  if (!isScheduleMode.value) return 'Download when ready'
  if (cadenceMode.value === 'once') {
    return runAtLocal.value
      ? `Once · ${new Date(runAtLocal.value).toLocaleString()}`
      : 'Once'
  }
  return `${formatReportCadenceLabel(cadence.value)} · ${scheduleTime.value}`
})

const primaryLabel = computed(() => {
  if (isEdit.value) return 'Save changes'
  if (isScheduleMode.value) return 'Create schedule'
  return 'Generate report'
})

const primaryIcon = computed(() =>
  isScheduleMode.value ? 'i-lucide-calendar-check' : 'i-lucide-file-output'
)

const jobStatus = computed(() => createdJob.value?.status)
const jobProgress = computed(() => clampReportProgress(createdJob.value?.progress))
const progressHeadline = computed(() =>
  reportStatusHeadline(jobStatus.value, createdJob.value?.progress_label)
)
const activeStage = computed(() => activeReportProgressStage(jobProgress.value))
const isJobActive = computed(() => isReportJobActive(jobStatus.value))
const isComplete = computed(() => jobStatus.value === 'complete')
const isFailed = computed(() => jobStatus.value === 'failed')
const isDownloading = computed(() =>
  !!createdJob.value && downloadingJobId.value === createdJob.value.id
)

const sectionPresets = [
  { id: 'accessibility', label: 'Accessibility', icon: 'i-lucide-accessibility' },
  { id: 'qa', label: 'QA', icon: 'i-lucide-shield-check' },
  { id: 'seo', label: 'SEO', icon: 'i-lucide-search' },
  { id: 'full', label: 'Full report', icon: 'i-lucide-layout-dashboard' }
] as const

function applyPreset(id: typeof sectionPresets[number]['id']) {
  const next = defaultReportSectionSelection()
  next.options!.tableOfContents = format.value === 'pdf'
  next.overview.accessibility = false
  next.overview.qa = false
  next.overview.seo = false
  next.overview.orgSummary = false
  next.accessibility = { pages: false, issues: false, readability: false, pdfs: false }
  next.qa = { brokenLinks: false, spelling: false, inventory: false }
  next.seo = { technical: false, content: false, preview: false }

  if (id === 'accessibility' || id === 'full') {
    next.overview.accessibility = format.value === 'pdf'
    next.accessibility.issues = true
    next.accessibility.readability = id === 'full'
    next.accessibility.pdfs = id === 'full'
  }
  if (id === 'qa' || id === 'full') {
    next.overview.qa = format.value === 'pdf'
    next.qa.brokenLinks = true
    next.qa.spelling = id === 'full'
    next.qa.inventory = id === 'full'
  }
  if (id === 'seo' || id === 'full') {
    next.overview.seo = format.value === 'pdf'
    next.seo.technical = true
    next.seo.content = id === 'full'
    next.seo.preview = false
  }
  if (id === 'full' && includeAllSites.value && format.value === 'pdf') {
    next.overview.orgSummary = true
  }
  sections.value = next
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function stopProgressAnimation() {
  if (progressRaf != null) {
    cancelAnimationFrame(progressRaf)
    progressRaf = null
  }
}

function animateProgressTo(target: number) {
  stopProgressAnimation()
  const start = displayProgress.value
  const delta = target - start
  if (Math.abs(delta) < 0.5) {
    displayProgress.value = target
    return
  }
  const startedAt = performance.now()
  const duration = Math.min(650, Math.max(220, Math.abs(delta) * 12))

  const tick = (now: number) => {
    const elapsed = now - startedAt
    const ratio = Math.min(1, elapsed / duration)
    const eased = 1 - (1 - ratio) ** 3
    displayProgress.value = Math.round(start + delta * eased)
    if (ratio < 1) {
      progressRaf = requestAnimationFrame(tick)
    } else {
      progressRaf = null
    }
  }

  progressRaf = requestAnimationFrame(tick)
}

function toLocalDatetimeValue(iso?: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function resetForm(mode: DeliveryMode = 'now') {
  step.value = 'content'
  deliveryMode.value = mode
  name.value = ''
  format.value = 'pdf'
  includeAllSites.value = true
  siteId.value = ''
  sections.value = defaultReportSectionSelection()
  cadenceMode.value = 'recurring'
  cadence.value = 'weekly'
  scheduleTime.value = '09:00'
  timezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  runAtLocal.value = ''
  recipientIds.value = []
  createdJob.value = null
  generating.value = false
  displayProgress.value = 0
}

function loadSchedule(schedule: ReportScheduleRecord) {
  step.value = 'content'
  deliveryMode.value = 'schedule'
  name.value = schedule.name
  format.value = schedule.format
  includeAllSites.value = schedule.include_all_sites !== false
  siteId.value = schedule.site || ''
  sections.value = {
    ...defaultReportSectionSelection(),
    ...schedule.sections,
    overview: { ...defaultReportSectionSelection().overview, ...schedule.sections?.overview },
    accessibility: { ...defaultReportSectionSelection().accessibility, ...schedule.sections?.accessibility },
    qa: { ...defaultReportSectionSelection().qa, ...schedule.sections?.qa },
    seo: { ...defaultReportSectionSelection().seo, ...schedule.sections?.seo },
    options: { ...defaultReportSectionSelection().options, ...schedule.sections?.options }
  } as ReportSectionSelection
  if (schedule.cadence === 'once') {
    cadenceMode.value = 'once'
    cadence.value = 'once'
    runAtLocal.value = toLocalDatetimeValue(schedule.run_at || schedule.next_run_at)
  } else {
    cadenceMode.value = 'recurring'
    cadence.value = schedule.cadence
  }
  scheduleTime.value = schedule.schedule_time || '09:00'
  timezone.value = schedule.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  recipientIds.value = Array.isArray(schedule.recipient_ids) ? [...schedule.recipient_ids] : []
  createdJob.value = null
  generating.value = false
  displayProgress.value = 0
}

function toggleRecipient(id: string, checked: boolean | 'indeterminate') {
  const on = checked === true
  if (on) {
    if (!recipientIds.value.includes(id)) recipientIds.value = [...recipientIds.value, id]
    return
  }
  recipientIds.value = recipientIds.value.filter(item => item !== id)
}

function selectAllRecipients() {
  recipientIds.value = members.value.map(m => m.id)
}

function clearRecipients() {
  recipientIds.value = []
}

function buildSchedulePayload(): CreateReportSchedulePayload {
  const resolvedCadence: ReportScheduleCadence = cadenceMode.value === 'once' ? 'once' : cadence.value
  return {
    name: name.value.trim(),
    format: format.value,
    includeAllSites: includeAllSites.value,
    siteId: includeAllSites.value ? undefined : siteId.value,
    sections: sections.value,
    cadence: resolvedCadence,
    scheduleTime: scheduleTime.value,
    timezone: timezone.value,
    runAt: cadenceMode.value === 'once' && runAtLocal.value
      ? new Date(runAtLocal.value).toISOString()
      : undefined,
    recipientIds: recipientIds.value,
    enabled: true
  }
}

function goNext() {
  if (!canContinueContent.value) {
    toast.add({
      title: 'Choose report content',
      description: includeAllSites.value
        ? 'Select at least one section to continue.'
        : 'Pick a site and at least one section.',
      color: 'warning'
    })
    return
  }
  step.value = 'delivery'
  if (deliveryMode.value === 'schedule' || isEdit.value) void loadMembers()
}

function goBack() {
  step.value = 'content'
}

async function loadMembers() {
  try {
    await fetchMembers()
  } catch (error) {
    toast.add({
      title: 'Could not load team members',
      description: error instanceof Error ? error.message : 'Request failed',
      color: 'error'
    })
  }
}

watch(jobProgress, (value) => {
  animateProgressTo(value)
}, { immediate: true })

watch(format, (value) => {
  if (value !== 'csv') return
  sections.value.overview.accessibility = false
  sections.value.overview.qa = false
  sections.value.overview.seo = false
  sections.value.overview.orgSummary = false
  if (sections.value.options) sections.value.options.tableOfContents = false
})

watch(includeAllSites, (value) => {
  if (!value) sections.value.overview.orgSummary = false
})

watch(cadenceMode, (mode) => {
  if (mode === 'recurring' && cadence.value === 'once') cadence.value = 'weekly'
})

watch(deliveryMode, (mode) => {
  if (mode === 'schedule') void loadMembers()
})

watch(open, (value) => {
  if (!value) {
    stopPolling()
    stopProgressAnimation()
    return
  }
  void fetchSites().catch(() => {})
  if (props.schedule) {
    loadSchedule(props.schedule)
    void loadMembers()
  } else {
    resetForm(props.initialMode || 'now')
    if ((props.initialMode || 'now') === 'schedule') void loadMembers()
  }
})

watch(() => props.schedule, (schedule) => {
  if (!open.value) return
  if (schedule) loadSchedule(schedule)
  else resetForm(props.initialMode || 'now')
})

watch(jobStatus, (status) => {
  if (status === 'complete') {
    toast.add({
      title: 'Report ready',
      description: 'Your report finished generating. Download it when you are ready.',
      color: 'success',
      icon: 'i-lucide-file-check-2'
    })
  } else if (status === 'failed') {
    toast.add({
      title: 'Report failed',
      description: createdJob.value?.error_message || 'Report generation failed.',
      color: 'error'
    })
  }
})

onUnmounted(() => {
  stopPolling()
  stopProgressAnimation()
})

async function pollJob() {
  if (!createdJob.value) return
  createdJob.value = await getJob(createdJob.value.id)
  if (!isReportJobActive(createdJob.value.status)) stopPolling()
}

async function submitGenerateNow() {
  if (!canContinueContent.value || createLoading.value) return
  generating.value = true
  displayProgress.value = 0
  try {
    createdJob.value = await createJob({
      format: format.value,
      includeAllSites: includeAllSites.value,
      siteId: includeAllSites.value ? undefined : siteId.value,
      sections: sections.value
    })
    emit('created')
    stopPolling()
    pollTimer = setInterval(() => { void pollJob() }, 1200)
    await pollJob()
  } catch (error) {
    generating.value = false
    toast.add({
      title: 'Could not start report',
      description: error instanceof Error ? error.message : 'Request failed',
      color: 'error'
    })
  }
}

async function submitSchedule() {
  if (!canSubmitSchedule.value || saving.value) return
  try {
    const payload = buildSchedulePayload()
    if (isEdit.value && props.schedule) {
      await updateSchedule(props.schedule.id, payload)
      toast.add({
        title: 'Schedule updated',
        description: `"${payload.name}" was saved.`,
        color: 'success',
        icon: 'i-lucide-check'
      })
    } else {
      await createSchedule(payload)
      toast.add({
        title: 'Schedule created',
        description: `"${payload.name}" will run on the selected cadence.`,
        color: 'success',
        icon: 'i-lucide-calendar-check'
      })
    }
    emit('saved')
    open.value = false
  } catch (error) {
    toast.add({
      title: isEdit.value ? 'Could not update schedule' : 'Could not create schedule',
      description: error instanceof Error ? error.message : 'Request failed',
      color: 'error'
    })
  }
}

async function submit() {
  if (isScheduleMode.value) await submitSchedule()
  else await submitGenerateNow()
}

async function handleDownload() {
  if (!createdJob.value || isDownloading.value) return
  try {
    await downloadJob(createdJob.value.id)
    toast.add({
      title: 'Download started',
      description: createdJob.value.artifact_name || 'Your report file is downloading.',
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

function startOver() {
  stopPolling()
  createdJob.value = null
  generating.value = false
  displayProgress.value = 0
  step.value = 'delivery'
}
</script>

<template>
  <UModal
    v-model:open="open"
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #header>
      <div class="space-y-4">
        <div class="flex items-start gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <UIcon
              :name="generating
                ? 'i-lucide-loader-circle'
                : isScheduleMode ? 'i-lucide-calendar-clock' : 'i-lucide-file-output'"
              class="size-5 text-primary"
              :class="{ 'animate-spin': generating && !isComplete && !isFailed }"
            />
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="text-lg font-semibold text-highlighted">
              {{ modalTitle }}
            </h2>
            <p class="mt-0.5 text-sm text-muted">
              {{ modalSubtitle }}
            </p>
          </div>
        </div>

        <div
          v-if="!generating"
          class="flex items-center gap-2"
          aria-label="Report wizard steps"
        >
          <button
            type="button"
            class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-150"
            :class="step === 'content'
              ? 'bg-elevated text-default'
              : 'text-muted hover:text-default'"
            @click="step = 'content'"
          >
            <span
              class="flex size-5 items-center justify-center rounded-full text-[10px] font-semibold"
              :class="step === 'content' ? 'bg-primary text-white' : 'bg-elevated text-muted'"
            >1</span>
            Content
          </button>
          <UIcon name="i-lucide-chevron-right" class="size-3.5 text-muted" />
          <button
            type="button"
            class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-150"
            :class="step === 'delivery'
              ? 'bg-elevated text-default'
              : canContinueContent ? 'text-muted hover:text-default' : 'text-muted/50'"
            :disabled="!canContinueContent && step !== 'delivery'"
            @click="canContinueContent && (step = 'delivery')"
          >
            <span
              class="flex size-5 items-center justify-center rounded-full text-[10px] font-semibold"
              :class="step === 'delivery' ? 'bg-primary text-white' : 'bg-elevated text-muted'"
            >2</span>
            Delivery
          </button>
        </div>
      </div>
    </template>

    <template #body>
      <Transition
        mode="out-in"
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <!-- Step 1: Content -->
        <div
          v-if="!generating && step === 'content'"
          key="content"
          class="space-y-5"
        >
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              class="rounded-xl border px-3 py-3 text-left transition-colors duration-150"
              :class="format === 'pdf'
                ? 'border-primary/40 bg-primary/5'
                : 'border-default hover:border-primary/25'"
              @click="format = 'pdf'"
            >
              <p class="text-sm font-medium">
                PDF
              </p>
              <p class="mt-0.5 text-xs text-muted">
                Charts + tables
              </p>
            </button>
            <button
              type="button"
              class="rounded-xl border px-3 py-3 text-left transition-colors duration-150"
              :class="format === 'csv'
                ? 'border-primary/40 bg-primary/5'
                : 'border-default hover:border-primary/25'"
              @click="format = 'csv'"
            >
              <p class="text-sm font-medium">
                CSV
              </p>
              <p class="mt-0.5 text-xs text-muted">
                Zip of data files
              </p>
            </button>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-medium">
                Scope
              </p>
              <UCheckbox
                v-model="includeAllSites"
                label="All sites"
              />
            </div>
            <USelectMenu
              v-if="!includeAllSites"
              v-model="siteId"
              value-key="value"
              :items="siteItems"
              placeholder="Select a site"
              class="w-full"
            />
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-medium">
                Sections
              </p>
              <span class="text-xs tabular-nums text-muted">{{ selectedCount }} selected</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="preset in sectionPresets"
                :key="preset.id"
                size="xs"
                color="neutral"
                variant="outline"
                :icon="preset.icon"
                :label="preset.label"
                @click="applyPreset(preset.id)"
              />
            </div>

            <div class="space-y-1 rounded-xl border border-default p-3">
              <p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Detail
              </p>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <UCheckbox v-model="sections.accessibility.issues" label="Accessibility issues" />
                <UCheckbox v-model="sections.accessibility.readability" label="Readability" />
                <UCheckbox v-model="sections.accessibility.pdfs" label="PDFs" />
                <UCheckbox v-model="sections.qa.brokenLinks" label="Broken links" />
                <UCheckbox v-model="sections.qa.spelling" label="Spelling" />
                <UCheckbox v-model="sections.qa.inventory" label="Inventory" />
                <UCheckbox v-model="sections.seo.technical" label="SEO technical" />
                <UCheckbox v-model="sections.seo.content" label="SEO content" />
              </div>
            </div>

            <div
              class="space-y-1 rounded-xl border border-default p-3 transition-opacity duration-150"
              :class="{ 'opacity-50': overviewPdfOnly }"
            >
              <div class="mb-2 flex items-center justify-between gap-2">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Overview charts
                </p>
                <span class="text-[11px] text-muted">PDF only</span>
              </div>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <UCheckbox
                  v-model="sections.overview.accessibility"
                  :disabled="overviewPdfOnly"
                  :label="REPORT_OVERVIEW_SECTION_LABELS.accessibility"
                />
                <UCheckbox
                  v-model="sections.overview.qa"
                  :disabled="overviewPdfOnly"
                  :label="REPORT_OVERVIEW_SECTION_LABELS.qa"
                />
                <UCheckbox
                  v-model="sections.overview.seo"
                  :disabled="overviewPdfOnly"
                  :label="REPORT_OVERVIEW_SECTION_LABELS.seo"
                />
                <UCheckbox
                  v-model="sections.overview.orgSummary"
                  :disabled="overviewPdfOnly || !includeAllSites"
                  :label="REPORT_OVERVIEW_SECTION_LABELS.orgSummary"
                />
              </div>
              <UCheckbox
                v-model="sections.options!.tableOfContents"
                :disabled="overviewPdfOnly"
                class="mt-2"
                label="Table of contents"
              />
            </div>
          </div>
        </div>

        <!-- Step 2: Delivery -->
        <div
          v-else-if="!generating && step === 'delivery'"
          key="delivery"
          class="space-y-5"
        >
          <div class="rounded-xl bg-elevated/60 px-3.5 py-3 text-sm text-muted">
            <span class="font-medium text-default">{{ contentSummary }}</span>
            <button
              type="button"
              class="ml-2 text-xs text-primary hover:underline"
              @click="step = 'content'"
            >
              Edit
            </button>
          </div>

          <div v-if="!isEdit" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              class="rounded-xl border px-3.5 py-3.5 text-left transition-colors duration-150"
              :class="deliveryMode === 'now'
                ? 'border-primary/40 bg-primary/5'
                : 'border-default hover:border-primary/25'"
              @click="deliveryMode = 'now'"
            >
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-zap" class="size-4 text-primary" />
                <p class="text-sm font-medium">
                  Generate now
                </p>
              </div>
              <p class="mt-1 text-xs text-muted">
                Build and download in this session
              </p>
            </button>
            <button
              type="button"
              class="rounded-xl border px-3.5 py-3.5 text-left transition-colors duration-150"
              :class="deliveryMode === 'schedule'
                ? 'border-primary/40 bg-primary/5'
                : 'border-default hover:border-primary/25'"
              @click="deliveryMode = 'schedule'"
            >
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-calendar-clock" class="size-4 text-primary" />
                <p class="text-sm font-medium">
                  Schedule
                </p>
              </div>
              <p class="mt-1 text-xs text-muted">
                Email a download link later
              </p>
            </button>
          </div>

          <Transition
            mode="out-in"
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div v-if="isScheduleMode" key="schedule-fields" class="space-y-4">
              <UFormField label="Schedule name" required>
                <UInput
                  v-model="name"
                  placeholder="Weekly accessibility digest"
                  maxlength="200"
                  class="w-full"
                />
              </UFormField>

              <div class="space-y-2">
                <p class="text-sm font-medium">
                  When
                </p>
                <div class="flex gap-2">
                  <UButton
                    size="sm"
                    :color="cadenceMode === 'once' ? 'primary' : 'neutral'"
                    :variant="cadenceMode === 'once' ? 'soft' : 'outline'"
                    label="One-time"
                    @click="cadenceMode = 'once'"
                  />
                  <UButton
                    size="sm"
                    :color="cadenceMode === 'recurring' ? 'primary' : 'neutral'"
                    :variant="cadenceMode === 'recurring' ? 'soft' : 'outline'"
                    label="Recurring"
                    @click="cadenceMode = 'recurring'"
                  />
                </div>
                <UInput
                  v-if="cadenceMode === 'once'"
                  v-model="runAtLocal"
                  type="datetime-local"
                  class="w-full"
                />
                <div v-else class="grid grid-cols-2 gap-2">
                  <USelectMenu
                    v-model="cadence"
                    value-key="value"
                    :items="recurringCadenceItems"
                  />
                  <UInput
                    v-model="scheduleTime"
                    type="time"
                  />
                </div>
                <p class="text-xs text-muted">
                  {{ timezone }}
                </p>
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-sm font-medium">
                    Recipients
                  </p>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="text-xs text-primary hover:underline"
                      @click="selectAllRecipients"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      class="text-xs text-muted hover:underline"
                      @click="clearRecipients"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div class="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-default p-2">
                  <label
                    v-for="member in members"
                    :key="member.id"
                    class="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-elevated/80"
                  >
                    <UCheckbox
                      :model-value="recipientIds.includes(member.id)"
                      @update:model-value="(v) => toggleRecipient(member.id, v)"
                    />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm">{{ member.name }}</span>
                      <span class="block truncate text-xs text-muted">{{ member.email }}</span>
                    </span>
                  </label>
                  <p v-if="!members.length" class="px-2 py-3 text-xs text-muted">
                    No team members found.
                  </p>
                </div>
                <p class="text-xs text-muted">
                  {{ recipientIds.length }} selected · they get a link, not an attachment
                </p>
              </div>
            </div>

            <div v-else key="now-hint" class="rounded-xl border border-dashed border-default px-4 py-6 text-center">
              <UIcon name="i-lucide-file-output" class="mx-auto size-8 text-muted" />
              <p class="mt-2 text-sm font-medium">
                Ready to generate
              </p>
              <p class="mt-1 text-xs text-muted">
                We’ll build {{ contentSummary.toLowerCase() }} and show progress here.
              </p>
            </div>
          </Transition>
        </div>

        <!-- Generating -->
        <div v-else key="progress" class="space-y-5 py-2">
          <div class="flex flex-col items-center gap-3 text-center">
            <div
              class="flex size-14 items-center justify-center rounded-full border transition-colors duration-300"
              :class="isComplete
                ? 'border-green-500/30 bg-green-500/10'
                : isFailed
                  ? 'border-red-500/30 bg-red-500/10'
                  : 'border-primary/20 bg-primary/5'"
            >
              <UIcon
                v-if="isComplete"
                name="i-lucide-circle-check"
                class="size-7 text-green-500"
              />
              <UIcon
                v-else-if="isFailed"
                name="i-lucide-circle-x"
                class="size-7 text-red-500"
              />
              <UIcon
                v-else
                name="i-lucide-loader-circle"
                class="size-7 animate-spin text-primary"
              />
            </div>
            <div class="space-y-1">
              <p class="text-sm font-medium text-default">
                {{ isComplete ? 'Report ready' : isFailed ? 'Generation failed' : 'Generating report' }}
              </p>
              <p class="text-sm text-muted" aria-live="polite">
                {{ progressHeadline }}
              </p>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs text-muted">
              <span>{{ activeStage.label }}</span>
              <span class="tabular-nums">{{ displayProgress }}%</span>
            </div>
            <UProgress
              :model-value="displayProgress"
              :animation="isJobActive"
              size="md"
            />
          </div>

          <ol class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <li
              v-for="stage in REPORT_PROGRESS_STAGES.filter(s => s.id !== 'complete')"
              :key="stage.id"
              class="rounded-lg border px-3 py-2 text-xs transition-colors duration-200"
              :class="jobProgress >= stage.minProgress
                ? 'border-primary/30 bg-primary/5 text-default'
                : 'border-default bg-elevated/20 text-muted'"
            >
              <span class="font-medium">{{ stage.label }}</span>
            </li>
          </ol>

          <UAlert
            v-if="isFailed"
            color="error"
            variant="subtle"
            title="Report generation failed"
            :description="createdJob?.error_message || 'Something went wrong while building this report.'"
          />
        </div>
      </Transition>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <template v-if="!generating">
          <UButton
            v-if="step === 'delivery'"
            label="Back"
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-left"
            :disabled="submitting"
            @click="goBack"
          />
          <UButton
            v-else
            label="Cancel"
            color="neutral"
            variant="ghost"
            :disabled="submitting"
            @click="open = false"
          />

          <div class="flex items-center gap-2">
            <p
              v-if="step === 'delivery'"
              class="hidden text-xs text-muted sm:block"
            >
              {{ scheduleSummary }}
            </p>
            <UButton
              v-if="step === 'content'"
              label="Continue"
              icon="i-lucide-arrow-right"
              trailing
              :disabled="!canContinueContent"
              @click="goNext"
            />
            <template v-else>
              <UButton
                label="Cancel"
                color="neutral"
                variant="ghost"
                class="sm:hidden"
                :disabled="submitting"
                @click="open = false"
              />
              <UButton
                :label="primaryLabel"
                :icon="primaryIcon"
                :loading="submitting"
                :disabled="!canSubmit || submitting"
                @click="submit"
              />
            </template>
          </div>
        </template>

        <template v-else>
          <div />
          <div class="flex gap-2">
            <UButton
              v-if="isFailed"
              label="Try again"
              color="neutral"
              variant="outline"
              @click="startOver"
            />
            <UButton
              v-if="isComplete"
              label="Download"
              icon="i-lucide-download"
              :loading="isDownloading"
              :disabled="isDownloading"
              @click="handleDownload"
            />
            <UButton
              label="Close"
              color="neutral"
              variant="ghost"
              :disabled="isDownloading"
              @click="open = false"
            />
          </div>
        </template>
      </div>
    </template>
  </UModal>
</template>
