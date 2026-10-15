<script setup lang="ts">
import { fitPdfPreviewScale } from '~/utils/pdfStructureViews'
import { fetchAuthedPdfBuffer } from '~/utils/fetchAuthedPdf'

const props = defineProps<{
  fileUrl: string | null
  /** Shared ArrayBuffer from parent. Skips network fetch when set. */
  pdfData?: ArrayBuffer | null
  initialPage?: number
  /** Optional audit cue shown when current page matches highlightPage. */
  highlightLabel?: string | null
  highlightPage?: number | null
}>()

const emit = defineEmits<{
  'update:page': [page: number]
  /** Natural PDF page size in points (scale 1). Used by shell to size without a fit feedback loop. */
  'update:pageSize': [size: { width: number, height: number }]
}>()

const { pb } = usePocketBase()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const pdfDoc = shallowRef<{
  numPages: number
  getPage: (page: number) => Promise<{
    getViewport: (opts: { scale: number }) => { width: number, height: number }
    render: (ctx: {
      canvasContext: CanvasRenderingContext2D
      viewport: { width: number, height: number }
    }) => { promise: Promise<void>, cancel: () => Promise<void> }
  }>
} | null>(null)

const pageNumber = ref(1)
const scale = ref(1)
const fitScale = ref(1)
const loading = ref(false)
const error = ref('')
const suppressPageScaleWatch = ref(false)

let renderGeneration = 0
let currentRenderTask: { cancel: () => Promise<void> } | null = null
let loadGeneration = 0
let resizeObserver: ResizeObserver | null = null
let resizeFitTimer: ReturnType<typeof setTimeout> | null = null
let fitRenderChain: Promise<void> = Promise.resolve()

async function cancelCurrentRender() {
  if (!currentRenderTask) return
  try {
    await currentRenderTask.cancel()
  } catch {
    // Ignore cancel races.
  }
  currentRenderTask = null
}

async function loadDocument() {
  if (!import.meta.client) return

  const generation = ++loadGeneration
  loading.value = true
  error.value = ''
  await cancelCurrentRender()
  pdfDoc.value = null
  pageNumber.value = props.initialPage && props.initialPage > 0 ? props.initialPage : 1

  try {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()

    let source: string | { data: ArrayBuffer }
    if (props.pdfData) {
      source = { data: props.pdfData.slice(0) }
    } else if (props.fileUrl) {
      const buffer = await fetchAuthedPdfBuffer(props.fileUrl, pb?.authStore?.token)
      if (generation !== loadGeneration) return
      source = { data: buffer }
    } else {
      loading.value = false
      return
    }

    if (generation !== loadGeneration) return

    const task = pdfjs.getDocument(
      typeof source === 'string' ? source : { data: source.data }
    )
    pdfDoc.value = await task.promise as unknown as NonNullable<typeof pdfDoc.value>
    if (generation !== loadGeneration) return

    loading.value = false
    await nextTick()
    await emitNaturalPageSize(pageNumber.value)
    await enqueueFitAndRender()
  } catch (err) {
    if (generation !== loadGeneration) return
    error.value = err instanceof Error ? err.message : 'Failed to load PDF preview'
    loading.value = false
  }
}

watch(
  () => [props.fileUrl, props.pdfData] as const,
  () => { void loadDocument() },
  { immediate: true }
)

watch([pageNumber, scale], () => {
  if (suppressPageScaleWatch.value || loading.value) return
  void enqueueFitAndRender(false)
})

watch(pageNumber, (page) => {
  emit('update:page', page)
  void emitNaturalPageSize(page)
})

function enqueueFitAndRender(doFit = true) {
  fitRenderChain = fitRenderChain
    .then(async () => {
      if (doFit) await fitToContainer()
      await renderPage()
    })
    .catch(() => {
      // Errors surface via error ref in renderPage paths.
    })
  return fitRenderChain
}

async function fitToContainer() {
  if (!pdfDoc.value || !containerRef.value) return

  const page = await pdfDoc.value.getPage(pageNumber.value)
  const viewport = page.getViewport({ scale: 1 })
  const nextFit = fitPdfPreviewScale(viewport.width, containerRef.value.clientWidth)
  fitScale.value = nextFit

  suppressPageScaleWatch.value = true
  scale.value = nextFit
  await nextTick()
  suppressPageScaleWatch.value = false
}

async function renderPage() {
  if (!pdfDoc.value || !canvasRef.value) return

  const generation = ++renderGeneration
  await cancelCurrentRender()
  if (generation !== renderGeneration) return

  const page = await pdfDoc.value.getPage(pageNumber.value)
  if (generation !== renderGeneration) return

  const pixelRatio = window.devicePixelRatio || 1
  const renderScale = scale.value * pixelRatio
  const viewport = page.getViewport({ scale: renderScale })
  const canvas = canvasRef.value
  const context = canvas.getContext('2d')
  if (!context) return

  canvas.width = viewport.width
  canvas.height = viewport.height
  canvas.style.width = `${viewport.width / pixelRatio}px`
  canvas.style.height = `${viewport.height / pixelRatio}px`

  const renderTask = page.render({ canvasContext: context, viewport })
  currentRenderTask = renderTask
  try {
    await renderTask.promise
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : ''
    if (name === 'RenderingCancelledException') return
    throw err
  } finally {
    if (currentRenderTask === renderTask) currentRenderTask = null
  }
}

async function emitNaturalPageSize(pageNum: number) {
  if (!pdfDoc.value) return
  try {
    const page = await pdfDoc.value.getPage(pageNum)
    const natural = page.getViewport({ scale: 1 })
    emit('update:pageSize', { width: natural.width, height: natural.height })
  } catch {
    // ignore. Page may have changed mid-load
  }
}

function scheduleFitOnResize() {
  if (!pdfDoc.value || loading.value || !canvasRef.value) return
  if (resizeFitTimer) clearTimeout(resizeFitTimer)
  resizeFitTimer = setTimeout(() => {
    void enqueueFitAndRender(true)
  }, 120)
}

onMounted(() => {
  if (!import.meta.client || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => {
    scheduleFitOnResize()
  })
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }
})

watch(containerRef, (el, prev) => {
  if (!resizeObserver) return
  if (prev) resizeObserver.unobserve(prev)
  if (el) resizeObserver.observe(el)
})

onBeforeUnmount(() => {
  loadGeneration += 1
  renderGeneration += 1
  if (resizeFitTimer) clearTimeout(resizeFitTimer)
  resizeObserver?.disconnect()
  resizeObserver = null
  void cancelCurrentRender()
})

function zoomIn() {
  scale.value = Math.min(scale.value + 0.25, 3)
}

function zoomOut() {
  scale.value = Math.max(scale.value - 0.25, 0.4)
}

function resetZoom() {
  scale.value = fitScale.value
}

function prevPage() {
  if (pageNumber.value > 1) pageNumber.value -= 1
}

function nextPage() {
  if (pdfDoc.value && pageNumber.value < pdfDoc.value.numPages) {
    pageNumber.value += 1
  }
}

function goToPage(page: number) {
  if (!pdfDoc.value) {
    pageNumber.value = Math.max(1, page)
    return
  }
  pageNumber.value = Math.min(Math.max(1, page), pdfDoc.value.numPages)
}

async function retry() {
  await loadDocument()
}

defineExpose({ goToPage, retry })
</script>

<template>
  <div class="relative flex h-full min-h-[320px] flex-col bg-muted/20">
    <div
      v-if="highlightLabel && highlightPage && pageNumber === highlightPage && !loading && !error"
      class="absolute top-14 left-1/2 z-10 max-w-[min(90%,28rem)] -translate-x-1/2 rounded-lg border border-warning/40 bg-elevated/95 px-3 py-1.5 text-center shadow-sm backdrop-blur-sm transition-opacity duration-200"
      role="status"
    >
      <p class="text-sm font-medium text-highlighted">
        Issue on this page
      </p>
      <p class="truncate text-sm text-muted">
        {{ highlightLabel }}
      </p>
    </div>
    <div class="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-default bg-elevated px-2 py-1 shadow-sm">
      <UButton
        size="sm"
        color="neutral"
        variant="ghost"
        icon="i-lucide-minus"
        aria-label="Zoom out"
        @click="zoomOut"
      />
      <button
        type="button"
        class="min-w-12 text-center text-sm text-muted transition-colors hover:text-highlighted"
        title="Reset zoom to fit"
        @click="resetZoom"
      >
        {{ Math.round(scale * 100) }}%
      </button>
      <UButton
        size="sm"
        color="neutral"
        variant="ghost"
        icon="i-lucide-plus"
        aria-label="Zoom in"
        @click="zoomIn"
      />
      <span class="mx-1 h-4 w-px bg-default" />
      <UButton
        size="sm"
        color="neutral"
        variant="ghost"
        icon="i-lucide-chevron-up"
        aria-label="Previous page"
        @click="prevPage"
      />
      <span class="text-sm text-muted whitespace-nowrap">
        Page {{ pageNumber }} / {{ pdfDoc?.numPages ?? '—' }}
      </span>
      <UButton
        size="sm"
        color="neutral"
        variant="ghost"
        icon="i-lucide-chevron-down"
        aria-label="Next page"
        @click="nextPage"
      />
    </div>

    <div
      ref="containerRef"
      class="flex flex-1 items-start justify-center overflow-auto p-6"
    >
      <div
        v-if="loading"
        class="py-20 text-sm text-muted"
      >
        Loading PDF preview…
      </div>
      <div
        v-else-if="error"
        class="flex max-w-md flex-col items-center gap-3 py-20 text-center"
      >
        <p class="text-sm text-error">
          {{ error }}
        </p>
        <UButton
          size="sm"
          color="primary"
          variant="soft"
          icon="i-lucide-refresh-cw"
          label="Try again"
          @click="retry"
        />
      </div>
      <div
        v-else-if="!fileUrl && !pdfData"
        class="py-20 text-sm text-muted"
      >
        No PDF file available for preview.
      </div>
      <canvas
        v-else
        ref="canvasRef"
        class="max-w-full bg-white shadow-lg transition-opacity duration-200"
      />
    </div>
  </div>
</template>
