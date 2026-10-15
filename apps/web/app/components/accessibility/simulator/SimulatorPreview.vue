<script setup lang="ts">
import {
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
import {
  freezeFrameSandbox,
  previewIframeLayout,
  type PreviewViewportId
} from '~/utils/previewViewport'

const props = defineProps<{
  siteId: string
  pageId: string
  pageUrl?: string | null
  loading?: boolean
  visionId: SimulatorVisionId
  tabOrder: boolean
}>()

const toast = useToast()

const tabOrderPayload = ref<SimulatorTabOrderPayload | null>(null)
const previewLoading = ref(false)
const previewError = ref<string | null>(null)
const snapshotUrl = ref<string | null>(null)
const iframeReady = ref(false)
const previewViewport = ref<PreviewViewportId>('fit')

const previewShellRef = ref<HTMLElement | null>(null)
const iframeRef = ref<HTMLIFrameElement | null>(null)
const { width: previewShellWidth, height: previewShellHeight } = useElementSize(previewShellRef)
const displaySize = ref({ width: 0, height: 0 })

const showLoading = computed(() => props.loading || previewLoading.value || !iframeReady.value)
const previewFrameUrl = computed(() => snapshotUrl.value)
/** Freeze-frame only — same-origin so CSS vision filters apply to iframe paint. */
const iframeSandbox = computed(() => freezeFrameSandbox())

const previewLayout = computed(() => previewIframeLayout(
  previewViewport.value,
  previewShellWidth.value,
  previewShellHeight.value
))

const previewIframeStyle = computed(() => {
  const layout = previewLayout.value
  const filter = visionCssFilter(props.visionId)
  return {
    width: `${layout.width}px`,
    height: `${layout.height}px`,
    transform: layout.scale === 1 ? 'none' : `scale(${layout.scale})`,
    transformOrigin: 'top left',
    // Apply on the iframe itself — parent wrappers often do not filter iframe paint.
    ...(filter ? { filter } : {})
  }
})

const overlayClass = computed(() => visionOverlayClass(props.visionId))

const markers = computed<ScaledTabMarker[]>(() => {
  if (!props.tabOrder) return []
  return scaleTabOrderMarkers(
    tabOrderPayload.value,
    displaySize.value.width,
    displaySize.value.height,
    tabOrderPayload.value?.pageWidth,
    tabOrderPayload.value?.pageHeight
  )
})

function updateDisplayMetrics() {
  const el = iframeRef.value
  if (!el) return
  const layout = previewLayout.value
  displaySize.value = {
    width: layout.width * layout.scale,
    height: layout.height * layout.scale
  }
}

let iframeReadyTimer: ReturnType<typeof setTimeout> | undefined

function armIframeReadyFallback() {
  if (iframeReadyTimer) clearTimeout(iframeReadyTimer)
  iframeReadyTimer = setTimeout(() => {
    iframeReady.value = true
  }, 12_000)
}

const VISION_STYLE_ID = 'sitenook-simulator-vision-filter'

/** Inject filter into the freeze-frame document (iframe CSS filter is unreliable). */
function applyVisionFilterToSnapshot() {
  const iframe = iframeRef.value
  if (!iframe) return
  try {
    const doc = iframe.contentDocument
    if (!doc?.documentElement) return
    let styleEl = doc.getElementById(VISION_STYLE_ID) as HTMLStyleElement | null
    const filter = visionCssFilter(props.visionId)
    if (!filter) {
      styleEl?.remove()
      return
    }
    if (!styleEl) {
      styleEl = doc.createElement('style')
      styleEl.id = VISION_STYLE_ID
      doc.documentElement.appendChild(styleEl)
    }
    styleEl.textContent = `html { filter: ${filter} !important; }`
  } catch {
    // Cross-origin or sandbox blocked — outer iframe filter is the fallback.
  }
}

function onPreviewIframeLoad() {
  if (iframeReadyTimer) clearTimeout(iframeReadyTimer)
  iframeReady.value = true
  nextTick(() => {
    updateDisplayMetrics()
    applyVisionFilterToSnapshot()
  })
}

async function onPreviewIframeError() {
  if (iframeReadyTimer) clearTimeout(iframeReadyTimer)
  snapshotUrl.value = null
  iframeReady.value = true
  previewError.value = 'Page snapshot is not available for this page.'
}

async function loadPreview() {
  if (!props.siteId || !props.pageId) return
  previewLoading.value = true
  previewError.value = null
  iframeReady.value = false
  snapshotUrl.value = null
  tabOrderPayload.value = null

  try {
    const [ticket, meta] = await Promise.all([
      orgApiFetch<{
        livePreviewUrl?: string | null
        snapshotUrl?: string | null
      }>(`/api/sites/${props.siteId}/pages/${props.pageId}/snapshot-ticket`),
      orgApiFetch<{
        tabOrder: SimulatorTabOrderPayload | null
      }>(`/api/sites/${props.siteId}/accessibility/simulator/preview`, {
        pageId: props.pageId
      }).catch(() => ({ tabOrder: null }))
    ])

    const requestPageId = props.pageId
    tabOrderPayload.value = meta.tabOrder
    if (props.pageId !== requestPageId) return

    // Prefer freeze-frame (same-origin). Live cross-origin iframes ignore CSS filters.
    snapshotUrl.value = ticket.snapshotUrl || null

    if (!snapshotUrl.value) {
      previewError.value = 'No page snapshot yet. Re-run a scan to capture one.'
      iframeReady.value = true
      return
    }

    armIframeReadyFallback()
  } catch (e) {
    snapshotUrl.value = null
    tabOrderPayload.value = null
    previewError.value = e instanceof Error ? e.message : String(e)
    iframeReady.value = true
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

watch([previewShellWidth, previewShellHeight, previewLayout], () => {
  updateDisplayMetrics()
})

watch(() => props.visionId, () => {
  applyVisionFilterToSnapshot()
})

onMounted(() => {
  if (!import.meta.client) return
  window.addEventListener('resize', updateDisplayMetrics)
})

onBeforeUnmount(() => {
  if (iframeReadyTimer) clearTimeout(iframeReadyTimer)
  if (import.meta.client) {
    window.removeEventListener('resize', updateDisplayMetrics)
  }
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-elevated">
    <div class="relative min-h-0 flex-1 overflow-hidden bg-neutral-200 dark:bg-neutral-800">
      <div
        v-if="showLoading && !previewError"
        class="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-6 animate-spin text-muted"
        />
      </div>

      <div
        v-if="previewError && !previewFrameUrl"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <UIcon
          name="i-lucide-app-window"
          class="size-10 text-muted"
        />
        <p class="max-w-sm text-sm text-muted">
          {{ previewError }}
          Re-run a scan to capture a page snapshot.
        </p>
        <div class="flex flex-wrap justify-center gap-2">
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
        v-else-if="previewFrameUrl"
        ref="previewShellRef"
        class="relative h-full min-h-0 overflow-hidden"
        :class="[
          overlayClass,
          previewLayout.centered ? 'flex justify-center' : ''
        ]"
      >
        <div
          class="relative h-full min-h-0"
          :class="previewLayout.centered ? 'shrink-0' : 'absolute inset-0'"
        >
          <iframe
            ref="iframeRef"
            :key="`${pageId}:${previewFrameUrl}`"
            :src="previewFrameUrl"
            title="Simulated page snapshot"
            class="simulator-preview-iframe border-0 bg-white"
            :class="previewLayout.centered ? 'relative shrink-0' : 'absolute left-0 top-0'"
            :style="previewIframeStyle"
            :sandbox="iframeSandbox"
            referrerpolicy="no-referrer-when-downgrade"
            @load="onPreviewIframeLoad"
            @error="onPreviewIframeError"
          />
        </div>
        <div
          v-if="tabOrder && markers.length"
          class="pointer-events-none absolute inset-0"
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
</template>

<style scoped>
.simulator-preview-iframe {
  /* Force a composited layer so CSS filter paints over iframe content reliably. */
  will-change: filter;
  isolation: isolate;
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
