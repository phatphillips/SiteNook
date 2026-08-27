<script setup lang="ts">
import type { PdfDocument, PdfStructureOutlineItem } from '~/types/sitenook'
import type { PdfInspectorPaneView } from '~/utils/pdfStructureViews'
import {
  bboxToCssOverlay,
  isPdfConvertTextView
} from '~/utils/pdfStructureViews'
import { htmlToGutenbergBlocks } from '~/utils/pdfGutenberg'

const props = defineProps<{
  document: PdfDocument
  pdfUrl: string | null
  view1: PdfInspectorPaneView
  view2: PdfInspectorPaneView
  structureText: { html: string, json: string, markdown: string }
  structureLoading?: boolean
  structureError?: string
}>()

const emit = defineEmits<{
  'update:view1': [PdfInspectorPaneView]
  'update:view2': [PdfInspectorPaneView]
  selectItem: [PdfStructureOutlineItem]
}>()

const selectedItemId = ref<string | number | null>(null)
const overlay = ref<{ left: number, top: number, width: number, height: number } | null>(null)
const previewRef = useTemplateRef('previewRef')

const gutenbergText = computed(() => htmlToGutenbergBlocks(props.structureText.html || ''))

const outlineItems = computed(() => props.document.structure_outline?.items ?? [])

function onSelectItem(item: PdfStructureOutlineItem) {
  selectedItemId.value = item.id
  emit('selectItem', item)
  if (item.page && (props.view1 === 'pdf' || props.view2 === 'pdf')) {
    previewRef.value?.goToPage?.(item.page)
  }
  if (item.bbox && item.bbox.length >= 4) {
    overlay.value = bboxToCssOverlay(item.bbox, 612, 792, 600, 800)
  } else {
    overlay.value = null
  }
}

function paneContent(view: PdfInspectorPaneView): string {
  if (view === 'html') return props.structureText.html
  if (view === 'json') return props.structureText.json
  if (view === 'markdown') return props.structureText.markdown
  if (view === 'gutenberg') return gutenbergText.value
  return ''
}
</script>

<template>
  <div class="flex h-[min(75vh,880px)] min-h-[560px] flex-col gap-2">
    <p
      v-if="structureError || document.structure_error"
      class="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
    >
      {{ structureError || document.structure_error }}
    </p>

    <div class="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[220px_1fr_1fr]">
      <aside class="max-h-full overflow-auto rounded-xl border border-default p-2">
        <p class="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted">
          Outline
        </p>
        <button
          v-for="item in outlineItems"
          :key="String(item.id)"
          type="button"
          class="mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-elevated"
          :class="selectedItemId === item.id ? 'bg-elevated text-highlighted' : 'text-muted'"
          @click="onSelectItem(item)"
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
        <p
          v-if="!outlineItems.length"
          class="px-1 text-xs text-muted"
        >
          {{ structureLoading ? 'Loading structure…' : 'No outline yet.' }}
        </p>
      </aside>

      <section class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-default">
        <div class="flex shrink-0 items-center justify-between gap-2 border-b border-default px-2 py-1.5">
          <span class="text-xs font-medium text-muted">View 1</span>
          <div class="flex items-center gap-1.5">
            <AccessibilityPdfConvertCopyButton
              :disabled="!isPdfConvertTextView(view1) || !paneContent(view1)"
              :get-text="() => paneContent(view1)"
            />
            <AccessibilityPdfConvertViewMenu
              :model-value="view1"
              @update:model-value="emit('update:view1', $event)"
            />
          </div>
        </div>
        <div class="relative min-h-0 flex-1 overflow-hidden">
          <AccessibilityPdfPreviewViewer
            v-if="view1 === 'pdf'"
            ref="previewRef"
            class="h-full min-h-0"
            :file-url="pdfUrl"
          />
          <AccessibilityPdfImageExtractPanel
            v-else-if="view1 === 'image'"
            class="h-full min-h-0"
            :pdf-url="pdfUrl"
            :filename-hint="document.filename"
          />
          <div
            v-else-if="view1 === 'html' && !paneContent('html')"
            class="flex h-full min-h-0 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted"
          >
            <p>No HTML structure yet.</p>
            <p>Use <strong class="text-highlighted">More actions → Extract structure</strong> if this stays empty.</p>
          </div>
          <iframe
            v-else-if="view1 === 'html'"
            class="h-full w-full min-h-0 bg-white"
            sandbox=""
            :srcdoc="paneContent('html')"
          />
          <pre
            v-else
            class="m-0 h-full min-h-0 overflow-auto p-3 text-xs"
          >{{ paneContent(view1) || 'No content yet. Extract structure to populate this pane.' }}</pre>
          <div
            v-if="view1 === 'pdf' && overlay"
            class="pointer-events-none absolute border-2 border-primary/80 bg-primary/10"
            :style="{
              left: `${overlay.left}px`,
              top: `${overlay.top}px`,
              width: `${overlay.width}px`,
              height: `${overlay.height}px`
            }"
          />
        </div>
      </section>

      <section class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-default">
        <div class="flex shrink-0 items-center justify-between gap-2 border-b border-default px-2 py-1.5">
          <span class="text-xs font-medium text-muted">View 2</span>
          <div class="flex items-center gap-1.5">
            <AccessibilityPdfConvertCopyButton
              :disabled="!isPdfConvertTextView(view2) || !paneContent(view2)"
              :get-text="() => paneContent(view2)"
            />
            <AccessibilityPdfConvertViewMenu
              :model-value="view2"
              @update:model-value="emit('update:view2', $event)"
            />
          </div>
        </div>
        <div class="relative min-h-0 flex-1 overflow-hidden">
          <AccessibilityPdfPreviewViewer
            v-if="view2 === 'pdf'"
            class="h-full min-h-0"
            :file-url="pdfUrl"
          />
          <AccessibilityPdfImageExtractPanel
            v-else-if="view2 === 'image'"
            class="h-full min-h-0"
            :pdf-url="pdfUrl"
            :filename-hint="document.filename"
          />
          <iframe
            v-else-if="view2 === 'html' && paneContent('html')"
            class="h-full w-full min-h-0 bg-white"
            sandbox=""
            :srcdoc="paneContent('html')"
          />
          <div
            v-else-if="view2 === 'html'"
            class="flex h-full min-h-0 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted"
          >
            <p>No HTML structure yet.</p>
          </div>
          <pre
            v-else
            class="m-0 h-full min-h-0 overflow-auto p-3 text-xs"
          >{{ paneContent(view2) || 'No content yet. Extract structure to populate this pane.' }}</pre>
        </div>
      </section>
    </div>
  </div>
</template>
