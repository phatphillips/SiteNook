<script setup lang="ts">
import type { PdfDocument, PdfIssue, PdfStructureOutlineItem } from '~/types/sitenook'
import type { PdfContentPaneView, PdfStudioMode } from '~/utils/pdfStructureViews'
import { fetchAuthedPdfBuffer } from '~/utils/fetchAuthedPdf'
import PdfNavRail, { type PdfNavMode } from '~/components/accessibility/pdf/PdfNavRail.vue'
import PdfOutlineNav from '~/components/accessibility/pdf/PdfOutlineNav.vue'
import PdfPageThumbnails from '~/components/accessibility/pdf/PdfPageThumbnails.vue'
import PdfPreviewViewer from '~/components/accessibility/pdf/PdfPreviewViewer.vue'
import PdfAuditContext from '~/components/accessibility/pdf/PdfAuditContext.vue'
import PdfConvertContext from '~/components/accessibility/pdf/PdfConvertContext.vue'

const props = defineProps<{
  mode: PdfStudioMode
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
const navMode = ref<PdfNavMode>('thumbnails')
const selectedOutlineId = ref<string | number | null>(null)
const currentPage = ref(props.initialPage && props.initialPage > 0 ? props.initialPage : 1)
const pdfData = shallowRef<ArrayBuffer | null>(null)
const sourceLoading = ref(false)
const sourceError = ref('')
let loadGeneration = 0

const selectedIssue = computed(() =>
  props.issues.find(issue => issue.id === props.selectedIssueId) ?? null
)
const highlightLabel = computed(() =>
  props.mode === 'audit' ? (selectedIssue.value?.title ?? null) : null
)
const highlightPage = computed(() =>
  props.mode === 'audit' ? (selectedIssue.value?.page_number ?? null) : null
)

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
  void loadSharedSource()
}, { immediate: true })

onBeforeUnmount(() => {
  loadGeneration += 1
})

function onSelectPage(page: number) {
  currentPage.value = page
  previewRef.value?.goToPage?.(page)
  emit('go-to-page', page)
}

function onSelectOutline(item: PdfStructureOutlineItem) {
  selectedOutlineId.value = item.id
  if (item.page) {
    currentPage.value = item.page
    previewRef.value?.goToPage?.(item.page)
    emit('go-to-page', item.page)
  }
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

async function retrySource() {
  await loadSharedSource()
}

defineExpose({
  goToPage: onGoToPage,
  retrySource
})
</script>

<template>
  <div class="pdf-inspector-shell flex h-full min-h-0 flex-col overflow-hidden lg:flex-row">
    <!-- Pages / Outline rail: full height, flush to workspace top -->
    <div class="flex min-h-0 max-lg:max-h-40 max-lg:shrink-0 max-lg:border-b max-lg:border-default lg:h-full">
      <PdfNavRail v-model="navMode" />

      <PdfPageThumbnails
        v-show="navMode === 'thumbnails'"
        class="min-h-0"
        :aria-hidden="navMode !== 'thumbnails' ? true : undefined"
        :inert="navMode !== 'thumbnails' ? true : undefined"
        :file-url="null"
        :pdf-data="pdfData"
        :waiting="sourceLoading && !pdfData"
        :wait-error="sourceError"
        :current-page="currentPage"
        :issues="mode === 'audit' ? issues : undefined"
        @select-page="onSelectPage"
      />

      <PdfOutlineNav
        v-show="navMode === 'outline'"
        :aria-hidden="navMode !== 'outline' ? true : undefined"
        :inert="navMode !== 'outline' ? true : undefined"
        :document="document"
        :structure-loading="structureLoading"
        :selected-item-id="selectedOutlineId"
        @select="onSelectOutline"
      />
    </div>

    <!-- Preview + context: optional chrome sits only over these columns -->
    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        v-if="$slots.toolbar"
        class="flex h-14 shrink-0 items-center border-b border-default bg-elevated px-3"
      >
        <slot name="toolbar" />
      </div>

      <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section
          class="flex min-h-0 min-w-0 flex-1 flex-col border-default lg:border-r"
          aria-label="Preview"
        >
          <div
            v-if="sourceError"
            class="flex shrink-0 items-center justify-end gap-2 border-b border-default px-2 py-1.5"
          >
            <UButton
              size="sm"
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
            />
          </div>
        </section>

        <section
          :key="mode"
          class="min-h-0 w-full shrink-0 overflow-hidden border-t border-default
            lg:w-[320px] lg:border-t-0"
          :aria-label="mode === 'audit' ? 'Issues' : 'Content'"
        >
          <PdfAuditContext
            v-if="mode === 'audit'"
            class="h-full"
            :issues="issues"
            :selected-issue-id="selectedIssueId"
            :current-page="currentPage"
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
          />
        </section>
      </div>
    </div>
  </div>
</template>
