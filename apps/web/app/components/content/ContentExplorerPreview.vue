<script setup lang="ts">
import type { ContentExplorerEntry } from '~/types/sitenook'
import {
  resolveContentExplorerTitle
} from '~/utils/contentExplorerTree'
import { attachPromptToPageContent } from '~/utils/attachContentPrompt'
import { fetchAuthedText } from '~/utils/fetchAuthedText'
import { markdownToGutenbergBlocks } from '~/utils/markdownToGutenberg'
import { orgApiFetch } from '~/utils/orgApiFetch'
import {
  freezeFrameSandbox,
  livePreviewSandbox,
  previewIframeLayout,
  resolveExplorerPreviewSrc,
  type ExplorerViewMode,
  type PreviewViewportId
} from '~/utils/previewViewport'

const props = defineProps<{
  siteId: string
  entry: ContentExplorerEntry | null
  /** Temporary prompt prepended to text views / copy / download. */
  attachedPrompt?: string | null
}>()

const toast = useToast()
const { pb, awaitAuthReady } = usePocketBase()

const markdown = ref('')
const loadingMarkdown = ref(false)
const markdownError = ref<string | null>(null)
const html = ref('')
const loadingHtml = ref(false)
const htmlError = ref<string | null>(null)
const loadedHtmlPageId = ref<string | null>(null)
const previewObjectUrl = ref<string | null>(null)
const livePreviewUrl = ref<string | null>(null)
const snapshotUrl = ref<string | null>(null)
const previewLoading = ref(false)
const iframeReady = ref(false)
const previewError = ref<string | null>(null)
const previewViewport = defineModel<PreviewViewportId>('viewport', { default: 'desktop' })
const viewMode = defineModel<ExplorerViewMode>('viewMode', { default: 'preview' })
const previewShellRef = ref<HTMLElement | null>(null)
const { width: previewShellWidth, height: previewShellHeight } = useElementSize(previewShellRef)
const previewFrameUrl = computed(() => livePreviewUrl.value || snapshotUrl.value)
const usingLivePreview = computed(() => Boolean(livePreviewUrl.value))
const iframeSandbox = computed(() => {
  if (usingLivePreview.value) {
    const origin = import.meta.client ? window.location.origin : ''
    return livePreviewSandbox(origin)
  }
  return freezeFrameSandbox()
})
const previewLayout = computed(() => previewIframeLayout(
  previewViewport.value,
  previewShellWidth.value,
  previewShellHeight.value
))
const previewIframeStyle = computed(() => {
  const layout = previewLayout.value
  return {
    width: `${layout.width}px`,
    height: `${layout.height}px`,
    transform: layout.scale === 1 ? 'none' : `scale(${layout.scale})`,
    transformOrigin: 'top left'
  }
})

const gutenberg = computed(() => markdownToGutenbergBlocks(markdown.value))
const textLoading = computed(() => viewMode.value === 'html' ? loadingHtml.value : loadingMarkdown.value)
const textError = computed(() => viewMode.value === 'html' ? htmlError.value : markdownError.value)
const sourceText = computed(() => {
  if (viewMode.value === 'html') return html.value
  if (viewMode.value === 'gutenberg') return gutenberg.value
  return markdown.value
})
const promptText = computed(() => props.attachedPrompt?.trim() || '')
const activeText = computed(() => {
  if (viewMode.value === 'preview') return sourceText.value
  if (!promptText.value) return sourceText.value
  const format = viewMode.value === 'html' || viewMode.value === 'gutenberg'
    ? viewMode.value
    : 'markdown'
  return attachPromptToPageContent(sourceText.value, promptText.value, format)
})
const activeTextLabel = computed(() => {
  if (viewMode.value === 'html') return 'Original HTML'
  if (viewMode.value === 'gutenberg') return 'Gutenberg blocks'
  return 'Markdown'
})
const canCopy = computed(() => Boolean(markdown.value.trim() || (viewMode.value !== 'preview' && activeText.value)))

const displayTitle = computed(() => {
  if (!props.entry) return ''
  return resolveContentExplorerTitle(props.entry, markdown.value)
})

function revokePreviewUrl() {
  if (previewObjectUrl.value) {
    URL.revokeObjectURL(previewObjectUrl.value)
    previewObjectUrl.value = null
  }
}

async function loadPreviewImage(pageId: string) {
  await awaitAuthReady()
  const token = pb?.authStore.token
  if (!token) throw new Error('Authentication required')
  const path = `/api/sites/${props.siteId}/accessibility/simulator/preview-image?pageId=${encodeURIComponent(pageId)}`
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) {
    throw new Error(`Preview image failed (${response.status})`)
  }
  const blob = await response.blob()
  revokePreviewUrl()
  previewObjectUrl.value = URL.createObjectURL(blob)
}

watch(() => [props.entry?.blobId, props.siteId] as const, async ([blobId, siteId]) => {
  markdown.value = ''
  markdownError.value = null
  if (!blobId || !siteId) return
  loadingMarkdown.value = true
  try {
    markdown.value = await fetchAuthedText(
      `/api/sites/${siteId}/content/blobs/${blobId}/markdown`
    )
  } catch (err) {
    markdownError.value = err instanceof Error ? err.message : 'Failed to load Markdown'
  } finally {
    loadingMarkdown.value = false
  }
}, { immediate: true })

watch(() => props.entry?.pageId, () => {
  html.value = ''
  htmlError.value = null
  loadedHtmlPageId.value = null
})

watch(() => [props.entry?.pageId, props.siteId, viewMode.value] as const, async ([pageId, siteId, mode]) => {
  if (mode !== 'html') return
  if (!pageId || !siteId) {
    html.value = ''
    htmlError.value = null
    loadedHtmlPageId.value = null
    return
  }
  if (loadedHtmlPageId.value === pageId) return
  loadingHtml.value = true
  htmlError.value = null
  try {
    const text = await fetchAuthedText(
      `/api/sites/${siteId}/content/pages/${pageId}/html`
    )
    if (props.entry?.pageId !== pageId) return
    html.value = text
    loadedHtmlPageId.value = pageId
  } catch (err) {
    if (props.entry?.pageId !== pageId) return
    html.value = ''
    loadedHtmlPageId.value = null
    htmlError.value = err instanceof Error ? err.message : 'Failed to load HTML'
  } finally {
    if (props.entry?.pageId === pageId) loadingHtml.value = false
  }
}, { immediate: true })

watch(() => [props.entry?.pageId, props.siteId] as const, async ([pageId, siteId]) => {
  revokePreviewUrl()
  previewError.value = null
  iframeReady.value = false
  livePreviewUrl.value = null
  snapshotUrl.value = null
  if (!pageId || !siteId) return
  previewLoading.value = true
  try {
    const result = await orgApiFetch<{
      livePreviewUrl?: string | null
      snapshotUrl?: string | null
    }>(
      `/api/sites/${siteId}/pages/${pageId}/snapshot-ticket`
    )
    if (props.entry?.pageId !== pageId) return
    const resolved = resolveExplorerPreviewSrc(result)
    livePreviewUrl.value = resolved.kind === 'live' ? resolved.src : null
    snapshotUrl.value = resolved.kind === 'freeze' ? resolved.src : (result.snapshotUrl || null)
    if (resolved.kind === 'image' || !resolved.src) {
      iframeReady.value = true
      await loadPreviewImage(pageId)
      return
    }
    armIframeReadyFallback()
  } catch (err) {
    if (props.entry?.pageId !== pageId) return
    livePreviewUrl.value = null
    snapshotUrl.value = null
    try {
      await loadPreviewImage(pageId)
      if (props.entry?.pageId !== pageId) {
        revokePreviewUrl()
      }
    } catch (imageErr) {
      if (props.entry?.pageId !== pageId) return
      previewError.value = imageErr instanceof Error
        ? imageErr.message
        : (err instanceof Error ? err.message : 'Failed to load preview')
    }
  } finally {
    if (props.entry?.pageId === pageId) previewLoading.value = false
  }
}, { immediate: true })

let iframeReadyTimer: ReturnType<typeof setTimeout> | undefined

function onPreviewIframeLoad() {
  if (iframeReadyTimer) clearTimeout(iframeReadyTimer)
  iframeReady.value = true
}

async function onPreviewIframeError() {
  if (iframeReadyTimer) clearTimeout(iframeReadyTimer)
  if (livePreviewUrl.value && snapshotUrl.value && snapshotUrl.value !== livePreviewUrl.value) {
    livePreviewUrl.value = null
    iframeReady.value = false
    armIframeReadyFallback()
    return
  }
  livePreviewUrl.value = null
  snapshotUrl.value = null
  iframeReady.value = true
  const pageId = props.entry?.pageId
  if (!pageId) return
  try {
    await loadPreviewImage(pageId)
  } catch (err) {
    previewError.value = err instanceof Error ? err.message : 'Failed to load preview'
  }
}

function armIframeReadyFallback() {
  if (iframeReadyTimer) clearTimeout(iframeReadyTimer)
  iframeReadyTimer = setTimeout(() => {
    iframeReady.value = true
  }, 12_000)
}

onBeforeUnmount(() => {
  if (iframeReadyTimer) clearTimeout(iframeReadyTimer)
  revokePreviewUrl()
})

async function copyContent() {
  const text = viewMode.value === 'preview'
    ? (promptText.value
        ? attachPromptToPageContent(markdown.value, promptText.value, 'markdown')
        : markdown.value)
    : activeText.value
  if (!text) {
    toast.add({ title: 'Nothing to copy', color: 'warning' })
    return
  }
  await navigator.clipboard.writeText(text)
  const label = viewMode.value === 'preview' ? 'Markdown' : activeTextLabel.value
  toast.add({
    title: promptText.value ? `Copied ${label} with prompt` : `Copied ${label}`,
    color: 'success'
  })
}

defineExpose({
  copyContent,
  canCopy
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-default">
    <div
      v-if="!entry"
      class="flex flex-1 items-center justify-center p-8 text-sm text-muted"
    >
      Select a page from the tree to preview content.
    </div>
    <template v-else>
      <div class="min-h-0 flex-1 overflow-auto">
        <div
          v-if="viewMode === 'preview'"
          class="h-full min-h-0"
          role="tabpanel"
        >
          <div
            v-if="previewFrameUrl"
            ref="previewShellRef"
            class="relative h-full min-h-0 overflow-hidden bg-neutral-200 dark:bg-neutral-800"
            :class="previewLayout.centered ? 'flex justify-center' : ''"
          >
            <iframe
              :key="`${entry.pageId}:${previewFrameUrl}`"
              :src="previewFrameUrl"
              :title="`Page preview of ${displayTitle}`"
              class="border-0 bg-white"
              :class="previewLayout.centered ? 'relative shrink-0' : 'absolute left-0 top-0'"
              :style="previewIframeStyle"
              :sandbox="iframeSandbox"
              referrerpolicy="no-referrer-when-downgrade"
              @load="onPreviewIframeLoad"
              @error="onPreviewIframeError"
            />
            <div
              v-if="previewLoading || !iframeReady"
              class="absolute inset-0 flex items-center justify-center bg-white text-sm text-muted"
            >
              Loading preview…
            </div>
          </div>
          <div
            v-else-if="previewLoading"
            class="flex h-full items-center justify-center text-sm text-muted"
          >
            Loading preview…
          </div>
          <img
            v-else-if="previewObjectUrl"
            :src="previewObjectUrl"
            :alt="`Preview of ${displayTitle}`"
            class="h-auto min-h-full w-full object-contain object-top"
          >
          <div
            v-else
            class="flex h-full flex-col items-center justify-center gap-1 p-4 text-center text-sm text-muted"
          >
            <p>{{ previewError || 'Page preview is not available for this page.' }}</p>
            <p class="text-xs">Open the page in a new tab, or re-run a scan to capture HTML for preview.</p>
          </div>
        </div>
        <div
          v-else
          class="flex h-full min-h-0 flex-col"
          role="tabpanel"
        >
          <div
            v-if="textLoading"
            class="flex flex-1 items-center justify-center p-4 text-sm text-muted"
          >
            Loading content…
          </div>
          <p
            v-else-if="textError"
            class="p-4 text-sm text-error"
          >
            {{ textError }}
          </p>
          <pre
            v-else-if="activeText"
            class="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-highlighted"
          >{{ activeText }}</pre>
          <p
            v-else
            class="flex flex-1 items-center justify-center p-4 text-sm text-muted"
          >
            No {{ activeTextLabel }} available for this page.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
