<script setup lang="ts">
import type { PdfIssue } from '~/types/sitenook'
import { fetchAuthedPdfBuffer } from '~/utils/fetchAuthedPdf'

const props = defineProps<{
  fileUrl: string | null
  /** Shared bytes from parent. Avoids a second network fetch when set. */
  pdfData?: ArrayBuffer | null
  currentPage?: number
  issues?: PdfIssue[]
  /** Parent is loading the shared buffer (no local fetch). */
  waiting?: boolean
  /** Parent failed to load the shared buffer. */
  waitError?: string
}>()

const emit = defineEmits<{
  selectPage: [page: number]
  'update:numPages': [n: number]
}>()

const { pb } = usePocketBase()

const thumbs = ref<{ page: number, url: string }[]>([])
const loading = ref(false)
const error = ref('')
const numPages = ref(0)

const issueCountByPage = computed(() => {
  const map = new Map<number, number>()
  for (const issue of props.issues ?? []) {
    const page = issue.page_number
    if (!page || page < 1) continue
    map.set(page, (map.get(page) ?? 0) + 1)
  }
  return map
})

let loadGeneration = 0
const objectUrls: string[] = []

function revokeObjectUrls() {
  while (objectUrls.length) {
    URL.revokeObjectURL(objectUrls.pop()!)
  }
}

async function renderThumbnails(data: ArrayBuffer) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const task = pdfjs.getDocument({ data })
  const pdf = await task.promise
  numPages.value = pdf.numPages
  emit('update:numPages', pdf.numPages)

  const next: { page: number, url: string }[] = []
  const concurrency = 3
  let cursor = 1

  async function worker() {
    while (cursor <= pdf.numPages) {
      const pageNum = cursor++
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 0.18 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      await page.render({ canvasContext: ctx, viewport }).promise
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.72))
      if (!blob) continue
      const url = URL.createObjectURL(blob)
      objectUrls.push(url)
      next.push({ page: pageNum, url })
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, pdf.numPages) }, () => worker()))
  next.sort((a, b) => a.page - b.page)
  thumbs.value = next
}

async function load() {
  if (!import.meta.client) return
  const generation = ++loadGeneration
  loading.value = true
  error.value = ''
  thumbs.value = []
  revokeObjectUrls()

  try {
    let data = props.pdfData ?? null
    if (!data) {
      if (!props.fileUrl) {
        error.value = 'No PDF available.'
        loading.value = false
        return
      }
      data = await fetchAuthedPdfBuffer(props.fileUrl, pb?.authStore?.token)
    }
    if (generation !== loadGeneration) return
    // Copy so pdf.js can take ownership without detaching parent buffer
    await renderThumbnails(data.slice(0))
    if (generation !== loadGeneration) return
  } catch (err) {
    if (generation !== loadGeneration) return
    error.value = err instanceof Error ? err.message : 'Failed to build page thumbnails'
  } finally {
    if (generation === loadGeneration) loading.value = false
  }
}

watch(
  () => [props.fileUrl, props.pdfData, props.waiting, props.waitError] as const,
  () => {
    if (props.pdfData) {
      void load()
      return
    }
    if (props.waiting) {
      thumbs.value = []
      error.value = ''
      loading.value = true
      return
    }
    if (props.waitError) {
      thumbs.value = []
      error.value = props.waitError
      loading.value = false
      return
    }
    if (props.fileUrl) {
      void load()
      return
    }
    thumbs.value = []
    error.value = 'No PDF available.'
    loading.value = false
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  loadGeneration += 1
  revokeObjectUrls()
})

function onSelect(page: number) {
  emit('selectPage', page)
}

function pageAriaLabel(page: number): string {
  const count = issueCountByPage.value.get(page) ?? 0
  if (count > 0) {
    return `Go to page ${page}, ${count} ${count === 1 ? 'issue' : 'issues'}`
  }
  return `Go to page ${page}`
}
</script>

<template>
  <aside
    id="pdf-nav-pane-thumbnails"
    class="pdf-pages-rail flex h-full min-h-0 w-[160px] shrink-0 flex-col border-r border-default bg-elevated"
    aria-label="Pages"
  >
    <div class="flex h-14 shrink-0 flex-col justify-center border-b border-default px-2.5">
      <h2 class="text-sm font-semibold leading-tight text-highlighted">
        Pages
      </h2>
      <p class="text-xs leading-tight text-muted">
        Jump to a page
      </p>
    </div>

    <div class="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-1.5">
      <div
        v-if="loading && !thumbs.length"
        class="flex flex-col gap-1.5"
      >
        <div
          v-for="n in 4"
          :key="n"
          class="mx-auto h-24 w-[104px] shrink-0 animate-pulse rounded-md bg-muted/60"
        />
      </div>

      <p
        v-else-if="error"
        class="px-1 py-3 text-sm text-error"
      >
        {{ error }}
      </p>

      <p
        v-else-if="!thumbs.length"
        class="px-1 py-3 text-sm text-muted"
      >
        No pages yet.
      </p>

      <button
        v-for="thumb in thumbs"
        :key="thumb.page"
        type="button"
        class="group relative mx-auto flex w-full max-w-[120px] shrink-0 flex-col items-center gap-0.5 rounded-md border p-1
          transition-colors duration-150
          hover:border-primary/40 hover:bg-muted/40
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :class="currentPage === thumb.page
          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
          : 'border-transparent'"
        :aria-label="pageAriaLabel(thumb.page)"
        :aria-current="currentPage === thumb.page ? 'page' : undefined"
        @click="onSelect(thumb.page)"
      >
        <img
          :src="thumb.url"
          :alt="`Page ${thumb.page}`"
          class="max-h-28 w-full rounded-sm object-contain bg-white shadow-sm"
          draggable="false"
        >
        <span class="text-xs font-medium text-muted group-hover:text-highlighted">
          {{ thumb.page }}
        </span>
        <UBadge
          v-if="(issueCountByPage.get(thumb.page) ?? 0) > 0"
          color="error"
          variant="solid"
          size="sm"
          class="absolute top-0.5 right-0.5 min-w-4 justify-center px-1"
        >
          {{ issueCountByPage.get(thumb.page) }}
        </UBadge>
      </button>
    </div>
  </aside>
</template>
