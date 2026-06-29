<script setup lang="ts">

const props = defineProps<{

  fileUrl: string | null

  initialPage?: number

}>()



const { pb } = usePocketBase()



const canvasRef = ref<HTMLCanvasElement | null>(null)

const containerRef = ref<HTMLElement | null>(null)

const pdfDoc = shallowRef<{

  numPages: number

  getPage: (page: number) => Promise<{

    getViewport: (opts: { scale: number }) => { width: number, height: number }

    render: (ctx: { canvasContext: CanvasRenderingContext2D, viewport: { width: number, height: number } }) => { promise: Promise<void> }

  }>

} | null>(null)



const pageNumber = ref(1)

const scale = ref(1)

const fitScale = ref(1)

const loading = ref(false)

const error = ref('')



watch(() => props.fileUrl, async (url) => {

  if (!url || !import.meta.client) return

  loading.value = true

  error.value = ''

  pdfDoc.value = null

  pageNumber.value = props.initialPage && props.initialPage > 0 ? props.initialPage : 1



  try {

    const pdfjs = await import('pdfjs-dist')

    pdfjs.GlobalWorkerOptions.workerSrc = new URL(

      'pdfjs-dist/build/pdf.worker.min.mjs',

      import.meta.url

    ).toString()



    const needsAuth = url.startsWith('/api/')

    const task = pdfjs.getDocument(

      needsAuth && pb?.authStore?.token

        ? {

            url,

            httpHeaders: { Authorization: `Bearer ${pb.authStore.token}` }

          }

        : url

    )

    pdfDoc.value = await task.promise as unknown as NonNullable<typeof pdfDoc.value>

    await nextTick()

    await fitToContainer()

    await renderPage()

  } catch (err) {

    error.value = err instanceof Error ? err.message : 'Failed to load PDF preview'

  } finally {

    loading.value = false

  }

}, { immediate: true })



watch([pageNumber, scale], () => {

  void renderPage()

})



async function fitToContainer() {

  if (!pdfDoc.value || !containerRef.value) return

  const page = await pdfDoc.value.getPage(pageNumber.value)

  const viewport = page.getViewport({ scale: 1 })

  const containerWidth = Math.max(containerRef.value.clientWidth - 48, 320)

  fitScale.value = Math.min(1.5, Math.max(0.4, containerWidth / viewport.width))

  scale.value = fitScale.value

}



async function renderPage() {

  if (!pdfDoc.value || !canvasRef.value) return

  const page = await pdfDoc.value.getPage(pageNumber.value)

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



  await page.render({ canvasContext: context, viewport }).promise

}



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

  if (!pdfDoc.value) return

  pageNumber.value = Math.min(Math.max(1, page), pdfDoc.value.numPages)

}



defineExpose({ goToPage })

</script>



<template>

  <div class="relative flex h-full min-h-[480px] flex-col bg-muted/20">

    <div class="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-default bg-elevated px-2 py-1 shadow-sm">

      <UButton

        size="xs"

        color="neutral"

        variant="ghost"

        icon="i-lucide-minus"

        aria-label="Zoom out"

        @click="zoomOut"

      />

      <button

        type="button"

        class="min-w-12 text-center text-xs text-muted hover:text-highlighted"

        title="Reset zoom to fit"

        @click="resetZoom"

      >

        {{ Math.round(scale * 100) }}%

      </button>

      <UButton

        size="xs"

        color="neutral"

        variant="ghost"

        icon="i-lucide-plus"

        aria-label="Zoom in"

        @click="zoomIn"

      />

      <span class="mx-1 h-4 w-px bg-default" />

      <UButton

        size="xs"

        color="neutral"

        variant="ghost"

        icon="i-lucide-chevron-up"

        aria-label="Previous page"

        @click="prevPage"

      />

      <span class="text-xs text-muted whitespace-nowrap">

        Page {{ pageNumber }} / {{ pdfDoc?.numPages ?? '—' }}

      </span>

      <UButton

        size="xs"

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

        class="max-w-md py-20 text-center text-sm text-error"

      >

        {{ error }}

      </div>

      <div

        v-else-if="!fileUrl"

        class="py-20 text-sm text-muted"

      >

        No PDF file available for preview.

      </div>

      <canvas

        v-else

        ref="canvasRef"

        class="max-w-full bg-white shadow-lg"

      />

    </div>

  </div>

</template>


