<script setup lang="ts">
import type { ContentExplorerEntry } from '~/types/sitenook'
import type { ExplorerViewMode, PreviewViewportId } from '~/utils/previewViewport'
import { resolveContentExplorerTitle } from '~/utils/contentExplorerTree'
import {
  formatCompactRelativeTime,
  formatScanTimestampLabel
} from '~/utils/formatCompactRelativeTime'

const search = defineModel<string>('search', { default: '' })
const addPrompt = defineModel<boolean>('addPrompt', { default: false })
const viewport = defineModel<PreviewViewportId>('viewport', { default: 'desktop' })
const viewMode = defineModel<ExplorerViewMode>('viewMode', { default: 'preview' })

const props = withDefaults(defineProps<{
  entry: ContentExplorerEntry | null
  showCopy?: boolean
  canCopy?: boolean
  showDownload?: boolean
  canDownload?: boolean
  downloadTooltip?: string
  exporting?: boolean
  showPrompt?: boolean
  showViewport?: boolean
  scanCompletedAt?: string | null
}>(), {
  showCopy: false,
  canCopy: false,
  showDownload: false,
  canDownload: false,
  downloadTooltip: 'Download',
  exporting: false,
  showPrompt: false,
  showViewport: false,
  scanCompletedAt: null
})

const emit = defineEmits<{
  copy: []
  download: []
  'edit-prompt': []
}>()

const viewportOptions = [
  { id: 'fit' as const, label: 'Fit', icon: 'i-lucide-unfold-horizontal' },
  { id: 'desktop' as const, label: 'Desktop', icon: 'i-lucide-monitor' },
  { id: 'tablet' as const, label: 'Tablet', icon: 'i-lucide-tablet' },
  { id: 'mobile' as const, label: 'Mobile', icon: 'i-lucide-smartphone' }
]

const viewOptions = [
  { label: 'Preview', value: 'preview', icon: 'i-lucide-app-window' },
  { label: 'HTML', value: 'html', icon: 'i-lucide-code' },
  { label: 'Markdown', value: 'markdown', icon: 'i-lucide-file-text' },
  { label: 'Gutenberg', value: 'gutenberg', icon: 'i-lucide-blocks' }
]

const displayTitle = computed(() => {
  if (!props.entry) return ''
  return resolveContentExplorerTitle(props.entry)
})
const relativeScanTime = computed(() => {
  if (!props.scanCompletedAt) return ''
  return formatCompactRelativeTime(props.scanCompletedAt)
})
const scanTimeLabel = computed(() => {
  if (!props.scanCompletedAt) return ''
  return formatScanTimestampLabel(props.scanCompletedAt)
})
const showActions = computed(() => props.showCopy || props.showDownload || props.showPrompt)
const showViewportGroup = computed(() => props.showViewport && viewMode.value === 'preview')
</script>

<template>
  <div class="flex h-12 min-h-12 shrink-0 items-center gap-2 overflow-x-auto border-b border-default px-3">
    <TableSearchInput
      v-model="search"
      placeholder="Filter pages…"
      aria-label="Filter pages"
      class="shrink-0"
    />

    <a
      v-if="entry"
      :href="entry.url"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex min-w-0 max-w-80 shrink items-center gap-1.5 rounded-md px-1 py-1 text-sm font-semibold text-highlighted hover:bg-elevated"
      :title="entry.url"
      aria-label="Open page in new tab"
    >
      <span class="min-w-0 truncate">{{ displayTitle }}</span>
      <UIcon
        name="i-lucide-external-link"
        class="size-3.5 shrink-0 text-muted"
      />
    </a>

    <div class="min-w-2 flex-1" />

    <div class="flex shrink-0 items-center gap-1.5">
      <div
        v-if="showActions"
        class="flex items-center gap-1"
      >
        <UTooltip
          v-if="showCopy"
          text="Copy"
        >
          <span class="inline-flex">
            <UButton
              size="sm"
              color="neutral"
              variant="ghost"
              icon="i-lucide-copy"
              square
              aria-label="Copy"
              :disabled="!canCopy"
              @click="emit('copy')"
            />
          </span>
        </UTooltip>
        <UTooltip
          v-if="showDownload"
          :text="downloadTooltip"
        >
          <span class="inline-flex">
            <UButton
              size="sm"
              color="neutral"
              variant="ghost"
              icon="i-lucide-download"
              square
              :aria-label="downloadTooltip"
              :disabled="!canDownload"
              :loading="exporting"
              @click="emit('download')"
            />
          </span>
        </UTooltip>
        <div
          v-if="showPrompt"
          class="inline-flex items-center gap-1.5 px-1"
        >
          <USwitch
            v-model="addPrompt"
            size="sm"
            aria-label="Add prompt to page content"
          />
          <span class="whitespace-nowrap text-xs text-muted">Add prompt</span>
        </div>
        <UTooltip
          v-if="showPrompt"
          text="Edit prompt"
        >
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            icon="i-lucide-pencil"
            square
            aria-label="Edit prompt"
            @click="emit('edit-prompt')"
          />
        </UTooltip>
      </div>

      <div
        v-if="showActions && showViewportGroup"
        class="h-5 w-px shrink-0 bg-default"
        aria-hidden="true"
      />

      <div
        v-if="showViewportGroup"
        class="inline-flex rounded-lg border border-default bg-elevated/50 p-0.5"
        role="group"
        aria-label="Preview viewport"
      >
        <UTooltip
          v-for="option in viewportOptions"
          :key="option.id"
          :text="option.label"
        >
          <button
            type="button"
            :aria-label="option.label"
            :aria-pressed="viewport === option.id"
            class="inline-flex size-7 items-center justify-center rounded-md transition-colors"
            :class="viewport === option.id
              ? 'bg-default text-highlighted shadow-sm'
              : 'text-muted hover:text-highlighted'"
            @click="viewport = option.id"
          >
            <UIcon
              :name="option.icon"
              class="size-3.5"
            />
          </button>
        </UTooltip>
      </div>

      <div
        v-if="showViewportGroup"
        class="h-5 w-px shrink-0 bg-default"
        aria-hidden="true"
      />

      <USelectMenu
        v-model="viewMode"
        :items="viewOptions"
        value-key="value"
        size="sm"
        class="w-[8.75rem]"
        :search-input="false"
        aria-label="Content format"
      />

      <div
        v-if="relativeScanTime"
        class="h-5 w-px shrink-0 bg-default"
        aria-hidden="true"
      />

      <UTooltip
        v-if="relativeScanTime"
        :text="scanTimeLabel"
      >
        <span class="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted">
          <UIcon
            name="i-lucide-clock"
            class="size-3.5 shrink-0"
          />
          {{ relativeScanTime }}
        </span>
      </UTooltip>
    </div>
  </div>
</template>
