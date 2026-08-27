<script setup lang="ts">
import type { PdfDocument, PdfStructureOutlineItem } from '~/types/sitenook'
import type { PdfContentPaneView } from '~/utils/pdfStructureViews'
import {
  PDF_CONTENT_PANE_OPTIONS,
  isPdfConvertTextView
} from '~/utils/pdfStructureViews'
import { htmlToGutenbergBlocks } from '~/utils/pdfGutenberg'
import { displayPdfFilename } from '~/utils/displayPdfFilename'
import PdfConvertCopyButton from '~/components/accessibility/pdf/PdfConvertCopyButton.vue'
import PdfImageExtractPanel from '~/components/accessibility/pdf/PdfImageExtractPanel.vue'

const props = defineProps<{
  document: PdfDocument
  pdfUrl: string | null
  content: PdfContentPaneView
  structureText: { html: string, json: string, markdown: string }
  structureLoading?: boolean
}>()

const emit = defineEmits<{
  'update:content': [PdfContentPaneView]
  'go-to-page': [page: number]
}>()

const outlineOpen = ref(false)
const selectedItemId = ref<string | number | null>(null)

const gutenbergText = computed(() => htmlToGutenbergBlocks(props.structureText.html || ''))
const outlineItems = computed(() => props.document.structure_outline?.items ?? [])
const contentLabel = computed(() =>
  PDF_CONTENT_PANE_OPTIONS.find(o => o.value === props.content)?.label ?? 'Content'
)

function paneContent(view: PdfContentPaneView): string {
  if (view === 'html') return props.structureText.html
  if (view === 'json') return props.structureText.json
  if (view === 'markdown') return props.structureText.markdown
  if (view === 'gutenberg') return gutenbergText.value
  return ''
}

const emptyHint = computed(() => {
  if (props.structureLoading || props.document.structure_status === 'pending' || props.document.structure_status === 'processing') {
    return 'Extracting structure…'
  }
  if (props.document.structure_status === 'failed') {
    return props.document.structure_error || 'Structure extraction failed. Try Extract structure again.'
  }
  return 'No content yet. Use More actions → Extract structure.'
})

function onSelectOutline(item: PdfStructureOutlineItem) {
  selectedItemId.value = item.id
  if (item.page) emit('go-to-page', item.page)
}

function selectContent(value: PdfContentPaneView) {
  emit('update:content', value)
}
</script>

<template>
  <div
    class="flex h-full min-h-0 flex-col bg-default"
    aria-label="Content"
  >
    <div class="flex shrink-0 items-center justify-between gap-2 border-b border-default px-3 py-2.5">
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-highlighted">
          Content
        </h2>
        <p class="text-xs text-muted">
          Extracted structure and text
        </p>
      </div>
      <div class="flex items-center gap-1.5">
        <PdfConvertCopyButton
          :disabled="!isPdfConvertTextView(content) || !paneContent(content)"
          :get-text="() => paneContent(content)"
        />
        <UPopover :content="{ align: 'end', side: 'bottom' }">
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            trailing-icon="i-lucide-chevron-down"
            class="min-w-28 justify-between"
          >
            {{ contentLabel }}
          </UButton>
          <template #content>
            <div class="flex w-44 flex-col gap-0.5 p-2">
              <button
                v-for="option in PDF_CONTENT_PANE_OPTIONS"
                :key="option.value"
                type="button"
                class="rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-elevated"
                :class="content === option.value ? 'bg-elevated font-medium text-highlighted' : 'text-muted'"
                @click="selectContent(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </template>
        </UPopover>
      </div>
    </div>

    <div
      v-if="outlineItems.length"
      class="shrink-0 border-b border-default"
    >
      <button
        type="button"
        class="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-muted hover:bg-elevated"
        :aria-expanded="outlineOpen"
        @click="outlineOpen = !outlineOpen"
      >
        <span>Structure outline ({{ outlineItems.length }})</span>
        <UIcon
          :name="outlineOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="size-3.5"
        />
      </button>
      <div
        v-if="outlineOpen"
        class="max-h-36 overflow-auto px-2 pb-2"
      >
        <button
          v-for="item in outlineItems"
          :key="String(item.id)"
          type="button"
          class="mb-0.5 w-full rounded-md px-2 py-1 text-left text-[11px] transition-colors hover:bg-elevated"
          :class="selectedItemId === item.id ? 'bg-elevated text-highlighted' : 'text-muted'"
          @click="onSelectOutline(item)"
        >
          <span class="font-medium capitalize text-highlighted">{{ item.type }}</span>
          <span
            v-if="item.page"
            class="ml-1 text-muted"
          >p.{{ item.page }}</span>
          <div class="truncate">
            {{ item.content || '—' }}
          </div>
        </button>
      </div>
    </div>

    <div class="relative min-h-0 flex-1 overflow-hidden">
      <PdfImageExtractPanel
        v-if="content === 'image'"
        class="h-full min-h-0"
        :pdf-url="pdfUrl"
        :filename-hint="displayPdfFilename(document.filename)"
      />
      <div
        v-else-if="content === 'html' && paneContent('html')"
        class="h-full min-h-0 transition-opacity duration-200"
      >
        <iframe
          class="h-full w-full min-h-0 bg-white"
          sandbox=""
          :srcdoc="paneContent('html')"
          title="Extracted HTML"
        />
      </div>
      <div
        v-else-if="!paneContent(content)"
        class="flex h-full min-h-0 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted"
      >
        <UIcon
          v-if="structureLoading || document.structure_status === 'pending' || document.structure_status === 'processing'"
          name="i-lucide-loader-circle"
          class="size-6 animate-spin text-muted"
        />
        <p>{{ emptyHint }}</p>
      </div>
      <pre
        v-else
        class="m-0 h-full min-h-0 overflow-auto p-3 text-xs transition-opacity duration-200"
      >{{ paneContent(content) }}</pre>
    </div>
  </div>
</template>
