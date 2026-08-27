<script setup lang="ts">
import type { ExtractedPdfImage } from '~/utils/pdfImageExtract'
import {
  downloadUint8Array,
  extractPdfEmbeddedImages,
  loadPdfJsFromFileUrl,
  revokeExtractedImages
} from '~/utils/pdfImageExtract'
import type { ExtractedPdfSvgPage, ExtractedSvgObject } from '~/utils/pdfVectorSvg'
import {
  extractPdfVectors,
  revokeExtractedSvgObjects
} from '~/utils/pdfVectorSvg'
import { zipStoreFiles } from '~/utils/zipStore'
const props = defineProps<{
  pdfUrl: string | null
  filenameHint?: string
}>()
const { pb } = usePocketBase()
const toast = useToast()
const busy = ref(false)
const downloading = ref(false)
const error = ref('')
const images = ref<ExtractedPdfImage[]>([])
const svgObjects = ref<ExtractedSvgObject[]>([])
const svgPages = ref<ExtractedPdfSvgPage[]>([])
const pagePreviewUrls = ref<string[]>([])
const selected = ref<Set<string>>(new Set())
type GalleryItem = {
  key: string
  kind: 'page' | 'svg' | 'raster'
  label: string
  meta: string
  objectUrl: string
  downloadName: string
  zipFolder: string
  bytes?: Uint8Array
  svgText?: string
}
const gallery = computed<GalleryItem[]>(() => {
  const items: GalleryItem[] = []
  for (let i = 0; i < svgPages.value.length; i++) {
    const page = svgPages.value[i]!
    const url = pagePreviewUrls.value[i]
    if (!url) continue
    const name = `page-${String(page.page).padStart(3, '0')}-preview.svg`
    items.push({
      key: `page-${page.page}`,
      kind: 'page',
      label: name,
      meta: `Page · p.${page.page} · ${page.pathCount} path${page.pathCount === 1 ? '' : 's'}`,
      objectUrl: url,
      downloadName: name,
      zipFolder: 'pages',
      svgText: page.svg
    })
  }
  for (const obj of svgObjects.value) {
    items.push({
      key: obj.id,
      kind: 'svg',
      label: obj.name,
      meta: `SVG · ${obj.pathCount} path${obj.pathCount === 1 ? '' : 's'} · p.${obj.page}`,
      objectUrl: obj.objectUrl,
      downloadName: obj.name,
      zipFolder: 'svg',
      svgText: obj.svg
    })
  }
  for (const image of images.value) {
    items.push({
      key: `raster-${image.name}`,
      kind: 'raster',
      label: image.name,
      meta: `${image.mimeType === 'image/jpeg' ? 'JPEG' : 'PNG'} · p.${image.page} · ${image.width}×${image.height}`,
      objectUrl: image.objectUrl,
      downloadName: image.name,
      zipFolder: 'raster',
      bytes: image.data
    })
  }
  return items
})
const selectedCount = computed(() => selected.value.size)
const allSelected = computed(() =>
  gallery.value.length > 0 && selected.value.size === gallery.value.length
)
function revokePagePreviews() {
  for (const url of pagePreviewUrls.value) URL.revokeObjectURL(url)
  pagePreviewUrls.value = []
}
function clearAssets() {
  revokeExtractedImages(images.value)
  images.value = []
  revokeExtractedSvgObjects(svgObjects.value)
  svgObjects.value = []
  revokePagePreviews()
  svgPages.value = []
  selected.value = new Set()
}
onBeforeUnmount(() => {
  clearAssets()
})
function fileBase() {
  return (props.filenameHint || 'document').replace(/\.pdf$/i, '')
}
function isSelected(key: string) {
  return selected.value.has(key)
}
function toggleSelected(key: string, value: boolean | 'indeterminate') {
  const next = new Set(selected.value)
  if (value === true) next.add(key)
  else next.delete(key)
  selected.value = next
}
function toggleSelectAll(value: boolean | 'indeterminate') {
  if (value === true) {
    selected.value = new Set(gallery.value.map(item => item.key))
  } else {
    selected.value = new Set()
  }
}
async function onExtractImages() {
  if (!props.pdfUrl) {
    error.value = 'No PDF available for image export.'
    return
  }
  if (busy.value) return
  busy.value = true
  error.value = ''
  clearAssets()
  try {
    const doc = await loadPdfJsFromFileUrl(props.pdfUrl, pb?.authStore?.token)
    const [{ pages, objects }, rasters] = await Promise.all([
      extractPdfVectors(doc),
      extractPdfEmbeddedImages(doc)
    ])
    svgPages.value = pages
    svgObjects.value = objects
    images.value = rasters
    const encoder = new TextEncoder()
    pagePreviewUrls.value = pages.map((page) => {
      const blob = new Blob([encoder.encode(page.svg)], { type: 'image/svg+xml' })
      return URL.createObjectURL(blob)
    })
    await nextTick()
    selected.value = new Set(gallery.value.map(item => item.key))
    if (!pages.length && !objects.length && !rasters.length) {
      error.value = 'No images were found in this PDF.'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Image extraction failed'
  } finally {
    busy.value = false
  }
}
async function onDownloadSelected() {
  const chosen = gallery.value.filter(item => selected.value.has(item.key))
  if (!chosen.length) {
    toast.add({ title: 'Select at least one image', color: 'warning' })
    return
  }
  downloading.value = true
  try {
    const files: Record<string, Uint8Array> = {}
    const encoder = new TextEncoder()
    for (const item of chosen) {
      const path = `${item.zipFolder}/${item.downloadName}`
      if (item.svgText) {
        files[path] = encoder.encode(item.svgText)
      } else if (item.bytes) {
        files[path] = item.bytes
      }
    }
    const zip = zipStoreFiles(files)
    downloadUint8Array(zip, `${fileBase()}-images.zip`, 'application/zip')
    toast.add({
      title: 'Images downloaded',
      description: `${chosen.length} file${chosen.length === 1 ? '' : 's'}`,
      color: 'success'
    })
  } catch (err) {
    toast.add({
      title: 'Download failed',
      description: err instanceof Error ? err.message : 'Could not build ZIP',
      color: 'error'
    })
  } finally {
    downloading.value = false
  }
}
</script>
<template>
  <div class="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
    <div class="flex flex-wrap items-center justify-center gap-2">
      <UButton
        color="primary"
        size="sm"
        icon="i-lucide-images"
        :loading="busy"
        :disabled="!pdfUrl"
        @click="onExtractImages"
      >
        Extract images
      </UButton>
      <UButton
        v-if="gallery.length"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-download"
        :loading="downloading"
        :disabled="!selectedCount"
        @click="onDownloadSelected"
      >
        Download selected ({{ selectedCount }})
      </UButton>
    </div>
    <p
      v-if="error"
      class="text-center text-sm text-error"
    >
      {{ error }}
    </p>
    <section
      v-if="gallery.length"
      class="flex min-h-0 flex-col gap-3"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs font-medium text-highlighted">
          Images · {{ gallery.length }}
        </p>
        <UCheckbox
          :model-value="allSelected"
          label="Select all"
          @update:model-value="toggleSelectAll"
        />
      </div>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <figure
          v-for="item in gallery"
          :key="item.key"
          class="relative overflow-hidden rounded-lg border border-default bg-elevated"
          :class="isSelected(item.key) ? 'ring-2 ring-primary' : ''"
        >
          <div class="absolute left-2 top-2 z-10">
            <UCheckbox
              :model-value="isSelected(item.key)"
              @update:model-value="(v) => toggleSelected(item.key, v)"
            />
          </div>
          <button
            type="button"
            class="block w-full text-left"
            @click="toggleSelected(item.key, !isSelected(item.key))"
          >
            <img
              :src="item.objectUrl"
              :alt="item.label"
              class="aspect-square w-full object-contain bg-white"
            >
            <figcaption class="truncate px-2 py-1 text-[10px] text-muted">
              {{ item.meta }}
            </figcaption>
          </button>
        </figure>
      </div>
    </section>
  </div>
</template>
