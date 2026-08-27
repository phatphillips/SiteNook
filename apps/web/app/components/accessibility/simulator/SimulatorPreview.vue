<script setup lang="ts">
import {
  SIMULATOR_CVD_SVG_FILTERS,
  visionCssFilter,
  visionOverlayClass,
  type SimulatorVisionId
} from '~/utils/simulatorChecks'
import {
  scaleTabOrderMarkers,
  type ScaledTabMarker,
  type SimulatorTabOrderPayload
} from '~/utils/simulatorTabOrder'
import { orgApiFetch } from '~/utils/orgApiFetch'

const props = defineProps<{
  siteId: string
  pageId: string
  pageUrl?: string | null
  loading?: boolean
  visionId: SimulatorVisionId
  tabOrder: boolean
}>()

const toast = useToast()
const { pb, awaitAuthReady } = usePocketBase()

const previewSource = ref<'screenshot' | null>(null)
const previewObjectUrl = ref<string | null>(null)
const tabOrderPayload = ref<SimulatorTabOrderPayload | null>(null)
const previewLoading = ref(false)
const previewError = ref<string | null>(null)

const imageRef = ref<HTMLImageElement | null>(null)
const displaySize = ref({ width: 0, height: 0 })
const naturalSize = ref({ width: 0, height: 0 })

const showLoading = computed(() => props.loading || previewLoading.value)

const filterStyle = computed(() => {
  const filter = visionCssFilter(props.visionId)
  return filter ? { filter } : undefined
})

const overlayClass = computed(() => visionOverlayClass(props.visionId))

const markers = computed<ScaledTabMarker[]>(() => {
  if (!props.tabOrder) return []
  return scaleTabOrderMarkers(
    tabOrderPayload.value,
    displaySize.value.width,
    displaySize.value.height,
    naturalSize.value.width,
    naturalSize.value.height
  )
})

function revokeObjectUrl() {
  if (previewObjectUrl.value) {
    URL.revokeObjectURL(previewObjectUrl.value)
    previewObjectUrl.value = null
  }
}

function updateDisplayMetrics() {
  const img = imageRef.value
  if (!img) return
  displaySize.value = {
    width: img.clientWidth,
    height: img.clientHeight
  }
  naturalSize.value = {
    width: img.naturalWidth,
    height: img.naturalHeight
  }
}

async function loadPreviewImage(path: string) {
  await awaitAuthReady()
  const token = pb?.authStore.token
  if (!token) throw new Error('Authentication required')

  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!response.ok) {
    throw new Error(`Preview image failed (${response.status})`)
  }
  const blob = await response.blob()
  revokeObjectUrl()
  previewObjectUrl.value = URL.createObjectURL(blob)
}

async function loadPreview() {
  if (!props.siteId || !props.pageId) return
  previewLoading.value = true
  previewError.value = null
  try {
    const result = await orgApiFetch<{
      source: 'screenshot' | null
      previewImageUrl: string | null
      tabOrder: SimulatorTabOrderPayload | null
      pageUrl: string
      title: string
    }>(`/api/sites/${props.siteId}/accessibility/simulator/preview`, {
      pageId: props.pageId
    })

    tabOrderPayload.value = result.tabOrder
    previewSource.value = result.source

    if (result.previewImageUrl) {
      await loadPreviewImage(result.previewImageUrl)
    } else {
      revokeObjectUrl()
      previewError.value = 'No screenshot preview yet. Re-run a scan to generate one.'
    }
  } catch (e) {
    revokeObjectUrl()
    previewSource.value = null
    tabOrderPayload.value = null
    previewError.value = e instanceof Error ? e.message : String(e)
    toast.add({
      title: 'Preview unavailable',
      description: previewError.value,
      color: 'warning'
    })
  } finally {
    previewLoading.value = false
  }
}

watch(
  () => [props.siteId, props.pageId] as const,
  () => { void loadPreview() },
  { immediate: true }
)

onMounted(() => {
  if (!import.meta.client) return
  window.addEventListener('resize', updateDisplayMetrics)
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('resize', updateDisplayMetrics)
  }
  revokeObjectUrl()
})
</script>

<template>
  <div class="flex flex-col min-h-0 h-full rounded-lg border border-default bg-default overflow-hidden">
    <div class="px-4 py-3 border-b border-default flex items-center justify-between gap-2 shrink-0">
      <div>
        <h2 class="text-sm font-semibold text-default">Page preview</h2>
        <p class="text-xs text-muted mt-0.5">
          <template v-if="previewSource === 'screenshot'">
            Screenshot from the latest crawl
          </template>
          <template v-else>
            Loading page preview…
          </template>
        </p>
      </div>
      <UButton
        v-if="pageUrl"
        size="xs"
        color="neutral"
        variant="outline"
        icon="i-lucide-external-link"
        label="Open live page"
        :to="pageUrl"
        target="_blank"
        external
      />
    </div>

    <div class="relative flex-1 min-h-[28rem] bg-muted/30 overflow-auto">
      <div
        v-if="showLoading"
        class="absolute inset-0 flex items-center justify-center"
      >
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>

      <div
        v-else-if="previewError || !previewObjectUrl"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <UIcon name="i-lucide-image-off" class="size-10 text-muted" />
        <p class="text-sm text-muted max-w-sm">
          {{ previewError || 'No screenshot is available for this page preview.' }}
          Re-run a scan to capture a rendered preview.
        </p>
        <div class="flex flex-wrap gap-2 justify-center">
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            label="Retry"
            @click="loadPreview"
          />
          <UButton
            v-if="pageUrl"
            size="sm"
            icon="i-lucide-external-link"
            label="Open live page"
            :to="pageUrl"
            target="_blank"
            external
          />
        </div>
      </div>

      <div
        v-else
        class="relative w-full simulator-preview-stage"
        :class="overlayClass"
      >
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="sr-only" aria-hidden="true" v-html="SIMULATOR_CVD_SVG_FILTERS" />
        <div class="relative inline-block min-w-full" :style="filterStyle">
          <img
            ref="imageRef"
            class="simulator-preview-image block w-full h-auto"
            :src="previewObjectUrl"
            alt="Simulated page preview"
            @load="updateDisplayMetrics"
          >
          <div
            v-if="tabOrder && markers.length"
            class="absolute inset-0 pointer-events-none"
            aria-hidden="true"
          >
            <span
              v-for="marker in markers"
              :key="marker.index"
              class="simulator-tab-badge"
              :style="{ left: `${marker.left}px`, top: `${marker.top}px` }"
              :title="marker.label"
            >
              {{ marker.index }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.simulator-preview-stage {
  position: relative;
}

.simulator-preview-image {
  background: white;
}

.simulator-tab-badge {
  position: absolute;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  background: #2563eb;
  color: #fff;
  font: 700 11px/1 system-ui, sans-serif;
  box-shadow: 0 0 0 2px #fff;
  transform: translate(-25%, -25%);
  z-index: 3;
}

.simulator-overlay--tunnel::after {
  content: '';
  pointer-events: none;
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at center,
    transparent 18%,
    rgba(0, 0, 0, 0.35) 42%,
    rgba(0, 0, 0, 0.92) 72%
  );
  z-index: 2;
}
</style>
