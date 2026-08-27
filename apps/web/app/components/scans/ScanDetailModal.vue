<script setup lang="ts">
import type { Scan } from '~/types/sitenook'
import {
  formatScanModalTitle,
  formatScanTypeLabel,
  scanSiteUrl,
  scanConfigLines,
  scanSummaryLines,
  scanUnscannedUrls,
  showScanErrorSection,
  showUnscannedPagesSection
} from '~/utils/scanDetail'
import { scanTimingPhaseRows, showScanDetailsSection } from '~/utils/scanTiming'
import { buildFullScanLogDownload, triggerScanLogDownload } from '~/utils/scanLogExport'

const props = defineProps<{
  scan: Scan | null
  open: boolean
  siteBusy?: boolean
  actionLoading?: boolean
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  viewResults: [scan: Scan]
  rerun: [scan: Scan]
  delete: [scan: Scan]
}>()

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

const accordionOpen = ref<string | undefined>('summary')

function statusColor(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
  if (status === 'complete') return 'success'
  if (status === 'complete_with_errors') return 'warning'
  if (status === 'failed') return 'error'
  if (status === 'cancelled') return 'neutral'
  if (status === 'running' || status === 'background_scan') return 'info'
  return 'warning'
}

function statusLabel(scan: Scan): string {
  if (scan.status === 'running') return `Running · ${scan.pages_crawled ?? 0} pages`
  if (scan.status === 'background_scan') return `Background scan · ${scan.pages_crawled ?? 0} pages`
  if (scan.status === 'complete') return 'Completed'
  if (scan.status === 'complete_with_errors') return 'Completed with errors'
  if (scan.status === 'failed') return 'Failed'
  if (scan.status === 'cancelled') return 'Cancelled'
  return scan.status
}

const accordionItems = computed(() => {
  const scan = props.scan
  if (!scan) return []

  const items: Array<{ label: string, value: string, slot: string }> = [
    { label: 'Summary', value: 'summary', slot: 'summary' }
  ]

  if (showScanDetailsSection(scan)) {
    items.push({ label: 'Scan details', value: 'details', slot: 'details' })
  }

  items.push({ label: 'Configuration', value: 'configuration', slot: 'configuration' })

  if (showUnscannedPagesSection(scan)) {
    items.push({
      label: `Pages we couldn't scan (${scanUnscannedUrls(scan).length})`,
      value: 'unscanned',
      slot: 'unscanned'
    })
  }

  if (showScanErrorSection(scan)) {
    items.push({ label: 'Error', value: 'error', slot: 'error' })
  }

  return items
})

const unscannedUrls = computed(() => (props.scan ? scanUnscannedUrls(props.scan) : []))
const timingPhases = computed(() => (props.scan ? scanTimingPhaseRows(props.scan) : []))

watch(
  () => props.scan?.id,
  () => {
    accordionOpen.value = 'summary'
  }
)

function onViewResults() {
  if (!props.scan || !['complete', 'complete_with_errors'].includes(props.scan.status)) return
  emit('viewResults', props.scan)
  openModel.value = false
}

function onRerun() {
  if (!props.scan || props.siteBusy) return
  emit('rerun', props.scan)
  openModel.value = false
}

function onDelete() {
  if (!props.scan) return
  emit('delete', props.scan)
}

const { pb } = usePocketBase()
const { sites } = useSites()
const logDownloadLoading = ref(false)

const canDownloadLog = computed(() => Boolean(props.scan?.id))

const modalSiteUrl = computed(() => {
  const scan = props.scan
  if (!scan) return null
  const fromExpand = scanSiteUrl(scan)
  if (fromExpand) return fromExpand
  return sites.value.find(s => s.id === scan.site)?.url?.trim() ?? null
})

const modalTitle = computed(() => {
  const scan = props.scan
  if (!scan) return 'Scan details'
  const site = sites.value.find(s => s.id === scan.site)
  if (site?.name && !scan.expand?.site?.name) {
    return formatScanModalTitle({
      ...scan,
      expand: { site: { id: site.id, name: site.name, url: site.url } }
    })
  }
  return formatScanModalTitle(scan)
})

async function downloadFullLog() {
  const scan = props.scan
  if (!scan?.id) return
  logDownloadLoading.value = true
  try {
    const siteName = scan.expand?.site?.name
    const text = await buildFullScanLogDownload(pb, scan.id, { siteName })
    triggerScanLogDownload(text, scan.id)
  } finally {
    logDownloadLoading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="openModel"
    :title="modalTitle"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template v-if="scan" #body>
      <div class="space-y-4 max-h-[70vh] scroll-region">
        <div class="flex flex-wrap items-center gap-2">
          <span
            v-if="modalSiteUrl"
            class="inline-block max-w-[min(100%,18rem)] truncate align-middle"
            :title="modalSiteUrl"
          >
            <StatusBadge
              :status="modalSiteUrl"
              :color="statusColor(scan.status)"
            />
          </span>
          <StatusBadge :status="statusLabel(scan)" :color="statusColor(scan.status)" />
          <UBadge variant="subtle" color="neutral">
            {{ formatScanTypeLabel(scan.scan_type) }}
          </UBadge>
        </div>

        <UAccordion
          v-model="accordionOpen"
          type="single"
          :items="accordionItems"
          :unmount-on-hide="false"
          class="space-y-1"
        >
          <template #summary-body>
            <dl class="scan-detail-dl pt-2">
              <template v-for="line in scanSummaryLines(scan)" :key="line.label">
                <dt>{{ line.label }}</dt>
                <dd>{{ line.value }}</dd>
              </template>
            </dl>
          </template>

          <template #details-body>
            <div class="pt-2 space-y-5">
              <p v-if="!timingPhases.length" class="text-sm text-muted">
                Timing details are not available for this scan.
              </p>
              <section
                v-for="phase in timingPhases"
                :key="phase.label"
                class="space-y-1"
              >
                <p class="text-sm font-semibold">{{ phase.label }}</p>
                <p class="text-sm">{{ phase.duration }}</p>
                <p class="text-sm text-muted">Started: {{ phase.started }}</p>
                <p class="text-sm text-muted">Finished: {{ phase.finished }}</p>
              </section>
            </div>
          </template>

          <template #configuration-body>
            <dl class="scan-detail-dl pt-2">
              <template v-for="line in scanConfigLines(scan)" :key="line.label">
                <dt>{{ line.label }}</dt>
                <dd>{{ line.value }}</dd>
              </template>
            </dl>
          </template>

          <template #unscanned-body>
            <ul class="pt-2 space-y-2 max-h-48 overflow-y-auto">
              <li
                v-for="url in unscannedUrls"
                :key="url"
                class="text-sm break-all"
              >
                <a
                  :href="url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline"
                >
                  {{ url }}
                </a>
              </li>
            </ul>
          </template>

          <template #error-body>
            <p class="text-sm text-error pt-2 leading-relaxed">
              {{ scan.error_message }}
            </p>
          </template>
        </UAccordion>
      </div>
    </template>

    <template v-if="scan" #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <div class="flex flex-wrap gap-2">
          <UButton
            label="Delete"
            size="sm"
            color="error"
            variant="outline"
            icon="i-lucide-trash-2"
            :loading="actionLoading"
            @click="onDelete"
          />
          <UButton
            v-if="canDownloadLog"
            label="Log"
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-download"
            :loading="logDownloadLoading"
            @click="downloadFullLog"
          />
        </div>
        <div class="flex flex-wrap gap-2 justify-end">
          <UButton
            label="Re-run scan"
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            :disabled="siteBusy"
            @click="onRerun"
          />
          <UButton
            v-if="['complete', 'complete_with_errors'].includes(scan.status)"
            label="View site results"
            size="sm"
            color="success"
            variant="solid"
            icon="i-lucide-external-link"
            @click="onViewResults"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.scan-detail-dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: 1.25rem;
  row-gap: 0.5rem;
  font-size: 0.875rem;
  margin: 0;
}

.scan-detail-dl dt {
  color: var(--ui-text-muted);
  font-weight: 500;
}

.scan-detail-dl dd {
  margin: 0;
  font-weight: 500;
}
</style>
