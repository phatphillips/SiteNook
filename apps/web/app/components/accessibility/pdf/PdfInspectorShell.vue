<script setup lang="ts">
import type { PdfDocument, PdfIssue } from '~/types/sitenook'
import type { PdfContentPaneView, PdfStudioMode } from '~/utils/pdfStructureViews'
import { fitPdfPreviewScale } from '~/utils/pdfStructureViews'
import { fetchAuthedPdfBuffer } from '~/utils/fetchAuthedPdf'
import PdfPageThumbnails from '~/components/accessibility/pdf/PdfPageThumbnails.vue'
import PdfPreviewViewer from '~/components/accessibility/pdf/PdfPreviewViewer.vue'
import PdfAuditContext from '~/components/accessibility/pdf/PdfAuditContext.vue'
import PdfConvertContext from '~/components/accessibility/pdf/PdfConvertContext.vue'

const props = defineProps<{
  mode: Extract<PdfStudioMode, 'audit' | 'convert'>
  document: PdfDocument
  fileUrl: string | null
  issues: PdfIssue[]
  selectedIssueId?: string | null
  content: PdfContentPaneView
  structureText: { html: string, json: string, markdown: string }
  structureLoading?: boolean
  initialPage?: number
}>()

const emit = defineEmits<{
  selectIssue: [issue: PdfIssue]
  'update:content': [PdfContentPaneView]
  'go-to-page': [page: number]
}>()

const { pb } = usePocketBase()

const previewRef = useTemplateRef('previewRef')
const previewColumnRef = useTemplateRef<HTMLElement>('previewColumnRef')
const currentPage = ref(props.initialPage && props.initialPage > 0 ? props.initialPage : 1)
const pdfData = shallowRef<ArrayBuffer | null>(null)
const sourceLoading = ref(false)
const sourceError = ref('')
/** Natural PDF page size in points (scale 1). */
const naturalPageSize = ref<{ width: number, height: number } | null>(null)
const previewColumnWidth = ref(0)
let loadGeneration = 0
let columnResizeObserver: ResizeObserver | null = null

const PANE_HEADER_PX = 52
const PREVIEW_PAD_PX = 48
const SHELL_MIN_PX = 480
const SHELL_MAX_PX = 920
const SHELL_FALLBACK_PX = 640

const selectedIssue = computed(() =>
  props.issues.find(issue => issue.id === props.selectedIssueId) ?? null
)
const highlightLabel = computed(() =>
  props.mode === 'audit' ? (selectedIssue.value?.title ?? null) : null
)
const highlightPage = computed(() =>
  props.mode === 'audit' ? (selectedIssue.value?.page_number ?? null) : null
)

/**
 * Shell height from page aspect × preview column width.
 * Uses natural PDF metrics + column WIDTH only — never fitted canvas height —
 * so ResizeObserver re-fits cannot recurse into shell height.
 */
const shellHeightPx = computed(() => {
  const page = naturalPageSize.value
  const colW = previewColumnWidth.value
  if (!page || page.width <= 0 || page.height <= 0 || colW <= 0) {
    return SHELL_FALLBACK_PX
  }
  const scale = fitPdfPreviewScale(page.width, colW, PREVIEW_PAD_PX)
  const pageCssHeight = page.height * scale
  const next = Math.round(pageCssHeight + PANE_HEADER_PX + PREVIEW_PAD_PX)
  return Math.min(SHELL_MAX_PX, Math.max(SHELL_MIN_PX, next))
})

function measurePreviewColumn() {
  const el = previewColumnRef.value
  if (!el) return
  const width = Math.round(el.getBoundingClientRect().width)
  if (width > 0 && Math.abs(width - previewColumnWidth.value) >= 1) {
    previewColumnWidth.value = width
  }
}

async function loadSharedSource() {
  if (!import.meta.client || !props.fileUrl) {
    pdfData.value = null
    sourceError.value = props.fileUrl ? '' : 'No PDF file available for preview.'
    return
  }

  const generation = ++loadGeneration
  sourceLoading.value = true
  sourceError.value = ''
  try {
    const buffer = await fetchAuthedPdfBuffer(props.fileUrl, pb?.authStore?.token)
    if (generation !== loadGeneration) return
    pdfData.value = buffer
  } catch (err) {
    if (generation !== loadGeneration) return
    pdfData.value = null
    sourceError.value = err instanceof Error ? err.message : 'Failed to load PDF'
  } finally {
    if (generation === loadGeneration) sourceLoading.value = false
  }
}

watch(() => props.fileUrl, () => {
  naturalPageSize.value = null
  void loadSharedSource()
}, { immediate: true })

onMounted(() => {
  if (!import.meta.client) return
  measurePreviewColumn()
  if (typeof ResizeObserver === 'undefined') return
  columnResizeObserver = new ResizeObserver(() => measurePreviewColumn())
  if (previewColumnRef.value) columnResizeObserver.observe(previewColumnRef.value)
})

watch(previewColumnRef, (el, prev) => {
  if (!columnResizeObserver) return
  if (prev) columnResizeObserver.unobserve(prev)
  if (el) {
    columnResizeObserver.observe(el)
    measurePreviewColumn()
  }
})

onBeforeUnmount(() => {
  loadGeneration += 1
  columnResizeObserver?.disconnect()
  columnResizeObserver = null
})

function onSelectPage(page: number) {
  currentPage.value = page
  previewRef.value?.goToPage?.(page)
  emit('go-to-page', page)
}

function onSelectIssue(issue: PdfIssue) {
  emit('selectIssue', issue)
  if (issue.page_number) {
    currentPage.value = issue.page_number
    previewRef.value?.goToPage?.(issue.page_number)
  }
}

function onGoToPage(page: number) {
  currentPage.value = page
  previewRef.value?.goToPage?.(page)
  emit('go-to-page', page)
}

function onPreviewPageChange(page: number) {
  currentPage.value = page
}

function onPageSize(size: { width: number, height: number }) {
  if (size.width <= 0 || size.height <= 0) return
  const prev = naturalPageSize.value
  if (
    prev
    && Math.abs(prev.width - size.width) < 0.5
    && Math.abs(prev.height - size.height) < 0.5
  ) {
    return
  }
  naturalPageSize.value = { width: size.width, height: size.height }
}

async function retrySource() {
  await loadSharedSource()
}

defineExpose({
  goToPage: onGoToPage,
  retrySource
})
</script>

<template>
  <div
    class="pdf-inspector-shell flex min-h-[480px] flex-col overflow-hidden rounded-xl border border-default"
    :style="{ height: `${shellHeightPx}px` }"
  >
    <!--
      < xl: Pages strip on top, then Preview | Context (row from lg)
      xl+: equal-width Pages | Preview | Context (33% each)
    -->
    <div class="flex min-h-0 flex-1 flex-col xl:flex-row">
      <PdfPageThumbnails
        class="min-h-0 max-xl:max-h-36 max-xl:shrink-0 max-xl:border-b xl:w-1/3 xl:shrink-0 xl:border-r"
        :file-url="null"
        :pdf-data="pdfData"
        :waiting="sourceLoading && !pdfData"
        :wait-error="sourceError"
        :current-page="currentPage"
        :issues="mode === 'audit' ? issues : undefined"
        @select-page="onSelectPage"
      />

      <div class="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row xl:contents">
        <section
          ref="previewColumnRef"
          class="flex min-h-0 min-w-0 flex-1 flex-col border-default lg:border-r xl:w-1/3 xl:shrink-0"
          aria-label="Preview"
        >
          <div class="flex shrink-0 items-center justify-between gap-2 border-b border-default px-3 py-2.5">
            <div class="min-w-0">
              <h2 class="text-sm font-semibold text-highlighted">
                Preview
              </h2>
              <p class="text-xs text-muted">
                View the current page
              </p>
            </div>
            <UButton
              v-if="sourceError"
              size="xs"
              color="neutral"
              variant="outline"
              icon="i-lucide-refresh-cw"
              label="Retry"
              :loading="sourceLoading"
              @click="retrySource"
            />
          </div>
          <div class="relative min-h-0 flex-1 overflow-hidden">
            <div
              v-if="sourceLoading && !pdfData"
              class="flex h-full items-center justify-center text-sm text-muted"
            >
              Loading PDF preview…
            </div>
            <div
              v-else-if="sourceError && !pdfData"
              class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
            >
              <p class="max-w-md text-sm text-error">
                {{ sourceError }}
              </p>
              <UButton
                size="sm"
                color="primary"
                variant="soft"
                icon="i-lucide-refresh-cw"
                label="Try again"
                :loading="sourceLoading"
                @click="retrySource"
              />
            </div>
            <PdfPreviewViewer
              v-else
              ref="previewRef"
              class="h-full min-h-0"
              :file-url="fileUrl"
              :pdf-data="pdfData"
              :initial-page="initialPage"
              :highlight-label="highlightLabel"
              :highlight-page="highlightPage"
              @update:page="onPreviewPageChange"
              @update:page-size="onPageSize"
            />
          </div>
        </section>

        <section
          :key="mode"
          class="min-h-0 w-full shrink-0 overflow-hidden border-t border-default
            transition-opacity duration-200
            lg:min-h-0 lg:w-[min(100%,340px)] lg:border-t-0
            xl:w-1/3 xl:shrink-0"
          :aria-label="mode === 'audit' ? 'Issues' : 'Content'"
        >
          <PdfAuditContext
            v-if="mode === 'audit'"
            class="h-full"
            :issues="issues"
            :selected-issue-id="selectedIssueId"
            @select="onSelectIssue"
            @go-to-page="onGoToPage"
          />
          <PdfConvertContext
            v-else
            class="h-full"
            :document="document"
            :pdf-url="fileUrl"
            :content="content"
            :structure-text="structureText"
            :structure-loading="structureLoading"
            @update:content="emit('update:content', $event)"
            @go-to-page="onGoToPage"
          />
        </section>
      </div>
    </div>
  </div>
</template>
