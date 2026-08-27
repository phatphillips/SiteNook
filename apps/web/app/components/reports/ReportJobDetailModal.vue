<script setup lang="ts">
import type { ReportJobRecord } from '~/types/reports'
import { listSelectedReportSectionLabels } from '~/utils/reportSections'
import {
  clampReportProgress,
  isReportJobActive,
  reportStatusHeadline
} from '~/utils/reportJobProgress'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  job: ReportJobRecord | null
  downloading?: boolean
}>()

const emit = defineEmits<{
  download: [jobId: string]
}>()

function formatDate(raw?: string): string {
  if (!raw) return '—'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

function scopeLabel(job: ReportJobRecord): string {
  if (job.include_all_sites) return 'All sites'
  return job.expand?.site?.name || 'Single site'
}

function requesterLabel(job: ReportJobRecord): string {
  const user = job.expand?.requested_by
  if (!user) return '—'
  return user.name?.trim() || user.email || '—'
}

function statusColor(status: ReportJobRecord['status']): 'success' | 'error' | 'warning' | 'neutral' {
  if (status === 'complete') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'processing' || status === 'pending') return 'warning'
  return 'neutral'
}

function formatFileSize(bytes?: number): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function displayName(job: ReportJobRecord): string {
  if (job.artifact_name?.trim()) {
    return job.artifact_name.replace(/\.(pdf|zip)$/i, '')
  }
  return 'Report summary'
}

const sectionLabels = computed(() =>
  props.job ? listSelectedReportSectionLabels(props.job.sections) : []
)

const progress = computed(() => clampReportProgress(props.job?.progress))
</script>

<template>
  <UModal
    v-model:open="open"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template v-if="job" #header>
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-highlighted">
          {{ displayName(job) }}
        </h2>
        <p class="text-sm text-muted">
          Export details for this report run.
        </p>
      </div>
    </template>

    <template v-if="job" #body>
      <div class="space-y-5">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge variant="subtle" :color="statusColor(job.status)">
            {{ job.status }}
          </UBadge>
          <UBadge variant="subtle">
            {{ String(job.format).toUpperCase() }}
          </UBadge>
          <span class="text-sm text-muted">{{ scopeLabel(job) }}</span>
        </div>

        <div
          v-if="isReportJobActive(job.status)"
          class="space-y-2 rounded-lg border border-default bg-elevated/40 p-3"
        >
          <div class="flex items-center justify-between gap-2 text-sm">
            <span>{{ reportStatusHeadline(job.status, job.progress_label) }}</span>
            <span class="tabular-nums text-muted">{{ progress }}%</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-elevated">
            <div
              class="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              :style="{ width: `${progress}%` }"
            />
          </div>
        </div>

        <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt class="text-xs font-medium uppercase tracking-wide text-muted">Requested by</dt>
            <dd class="mt-1 text-sm">{{ requesterLabel(job) }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium uppercase tracking-wide text-muted">Created</dt>
            <dd class="mt-1 text-sm">{{ formatDate(job.started_at || job.created) }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium uppercase tracking-wide text-muted">Completed</dt>
            <dd class="mt-1 text-sm">{{ formatDate(job.completed_at) }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium uppercase tracking-wide text-muted">File size</dt>
            <dd class="mt-1 text-sm tabular-nums">{{ formatFileSize(job.artifact_size_bytes) }}</dd>
          </div>
          <div v-if="job.format === 'pdf'">
            <dt class="text-xs font-medium uppercase tracking-wide text-muted">PDF pages</dt>
            <dd class="mt-1 text-sm tabular-nums">
              {{ typeof job.artifact_page_count === 'number' && job.artifact_page_count > 0
                ? job.artifact_page_count.toLocaleString()
                : '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium uppercase tracking-wide text-muted">Sections</dt>
            <dd class="mt-1 text-sm tabular-nums">{{ sectionLabels.length }}</dd>
          </div>
        </dl>

        <div v-if="sectionLabels.length" class="space-y-2">
          <p class="text-xs font-medium uppercase tracking-wide text-muted">Included in export</p>
          <ul class="flex flex-wrap gap-1.5">
            <li
              v-for="label in sectionLabels"
              :key="label"
            >
              <UBadge variant="subtle" color="neutral">
                {{ label }}
              </UBadge>
            </li>
          </ul>
        </div>

        <UAlert
          v-if="job.status === 'failed'"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Report failed"
          :description="job.error_message || 'Report generation failed.'"
        />
      </div>
    </template>

    <template v-if="job" #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Close"
          color="neutral"
          variant="subtle"
          @click="open = false"
        />
        <UButton
          v-if="job.status === 'complete'"
          label="Download"
          icon="i-lucide-download"
          :loading="downloading"
          @click="emit('download', job.id)"
        />
      </div>
    </template>
  </UModal>
</template>
