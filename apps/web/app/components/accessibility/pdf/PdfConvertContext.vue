<script setup lang="ts">
import type { PdfDocument } from '~/types/sitenook'
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
}>()

const formatOpen = ref(false)

const gutenbergText = computed(() => htmlToGutenbergBlocks(props.structureText.html || ''))

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
    return props.document.structure_error || 'Structure extraction failed. Switch away and back to Convert to retry.'
  }
  return 'No content yet. Structure extraction will start automatically in Convert.'
})

function selectContent(value: PdfContentPaneView) {
  emit('update:content', value)
  formatOpen.value = false
}
</script>

<template>
  <div
    class="flex h-full min-h-0 flex-col bg-default"
    aria-label="Content"
  >
    <div class="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-default px-3">
      <h2 class="text-sm font-semibold text-highlighted">
        Content
      </h2>
      <div class="flex items-center gap-1.5">
        <UPopover
          v-model:open="formatOpen"
          :content="{ align: 'end', side: 'bottom' }"
        >
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            trailing-icon="i-lucide-chevron-down"
            class="min-w-32 justify-between"
            aria-label="Content format"
          >
            {{ contentLabel }}
          </UButton>
          <template #content>
            <div
              class="flex w-48 flex-col gap-0.5 p-2"
              role="listbox"
              aria-label="Content format"
            >
              <button
                v-for="option in PDF_CONTENT_PANE_OPTIONS"
                :key="option.value"
                type="button"
                role="option"
                class="rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-elevated
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                :class="content === option.value
                  ? 'bg-elevated font-medium text-highlighted'
                  : 'text-muted'"
                :aria-selected="content === option.value"
                @click="selectContent(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </template>
        </UPopover>
        <PdfConvertCopyButton
          :disabled="!isPdfConvertTextView(content) || !paneContent(content)"
          :get-text="() => paneContent(content)"
        />
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
        class="h-full min-h-0"
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
        <p class="text-sm text-muted">
          Use the Outline view in the left rail to jump headings once structure is ready.
        </p>
      </div>
      <pre
        v-else
        class="m-0 h-full min-h-0 overflow-auto p-3 text-sm"
      >{{ paneContent(content) }}</pre>
    </div>
  </div>
</template>
