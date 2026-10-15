<script setup lang="ts">
import type { ContentExplorerEntry } from '~/types/sitenook'
import { attachPromptToPageContent } from '~/utils/attachContentPrompt'
import { markdownExportFilename } from '~/utils/contentExplorerTree'
import { pickDefaultContentExplorerEntry } from '~/utils/pickDefaultContentExplorerEntry'
import { downloadAuthed } from '~/utils/downloadAuthed'
import { fetchAuthedText } from '~/utils/fetchAuthedText'
import type { HandoffSectionId } from '~/utils/handoffSectionPrompts'
import type { ExplorerViewMode, PreviewViewportId } from '~/utils/previewViewport'

definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const toast = useToast()

const {
  entries,
  latestScan,
  loading,
  error,
  fetchExplorerData
} = useContentExplorer(siteId)

const {
  activePrompt,
  historyFor,
  usingDefault,
  save: savePrompt,
  reset: resetPrompt
} = useHandoffPrompts(siteId)

const { isRunning } = useWorkspaceScanState(siteId)

const selectedIds = ref<Set<string>>(new Set())
const activeEntry = ref<ContentExplorerEntry | null>(null)
const exporting = ref(false)
const promptModalOpen = ref(false)
const addPrompt = ref(false)
const treeSearch = ref('')
const previewViewport = ref<PreviewViewportId>('desktop')
const viewMode = ref<ExplorerViewMode>('preview')
const handoffSection: HandoffSectionId = 'content'
const workspaceRef = useTemplateRef<HTMLElement>('workspaceRef')
const { height: workspaceHeight, update: updateWorkspaceHeight } = useViewportRemainderHeight(workspaceRef)

const contentPrompt = computed(() => activePrompt(handoffSection))
const selectedExportable = computed(() =>
  entries.value.filter(e => selectedIds.value.has(e.id) && e.blobId)
)
const selectedExportableCount = computed(() => selectedExportable.value.length)
const isZipDownload = computed(() => selectedExportableCount.value > 1)
const downloadTarget = computed(() => {
  if (selectedExportableCount.value === 1) return selectedExportable.value[0] ?? null
  if (selectedExportableCount.value === 0) return activeEntry.value?.blobId ? activeEntry.value : null
  return null
})
const canDownload = computed(() => isZipDownload.value || Boolean(downloadTarget.value?.blobId))
const promptAttachedToPreview = computed(() => {
  if (!addPrompt.value) return null
  const prompt = contentPrompt.value.trim()
  return prompt || null
})

const previewRef = useTemplateRef<{
  copyContent: () => Promise<void>
  canCopy: boolean
}>('previewRef')

watch(isRunning, (running, wasRunning) => {
  if (wasRunning && !running) {
    void fetchExplorerData()
  }
})

watch(entries, (list) => {
  if (!list.length) {
    activeEntry.value = null
    return
  }
  const currentId = activeEntry.value?.id
  if (currentId) {
    const stillPresent = list.find(entry => entry.id === currentId)
    if (stillPresent) {
      activeEntry.value = stillPresent
      return
    }
  }
  activeEntry.value = pickDefaultContentExplorerEntry(list)
}, { immediate: true })

watch([loading, error, latestScan], async () => {
  await nextTick()
  updateWorkspaceHeight()
})

function onSelect(entry: ContentExplorerEntry) {
  activeEntry.value = entry
}

function onToggle(entry: ContentExplorerEntry, checked: boolean) {
  const next = new Set(selectedIds.value)
  if (checked) next.add(entry.id)
  else next.delete(entry.id)
  selectedIds.value = next
}

function onToggleAll(checked: boolean) {
  if (!checked) {
    selectedIds.value = new Set()
    return
  }
  selectedIds.value = new Set(
    entries.value.filter(e => e.hasContent && e.blobId).map(e => e.id)
  )
}

function triggerBlobDownload(contents: string, filename: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.split('/').pop() || 'page.md'
  a.click()
  URL.revokeObjectURL(url)
}

async function copyActivePage() {
  await previewRef.value?.copyContent()
}

async function downloadSelection() {
  if (isZipDownload.value) {
    const blobIds = selectedExportable.value.map(e => e.blobId!)
    exporting.value = true
    try {
      const params = new URLSearchParams({ blobIds: blobIds.join(',') })
      await downloadAuthed(`/api/sites/${siteId.value}/content/export?${params.toString()}`, 'content-export.zip')
    } finally {
      exporting.value = false
    }
    return
  }

  const entry = downloadTarget.value
  if (!entry?.blobId) return
  exporting.value = true
  try {
    let text = await fetchAuthedText(`/api/sites/${siteId.value}/content/blobs/${entry.blobId}/markdown`)
    if (addPrompt.value) {
      text = attachPromptToPageContent(text, contentPrompt.value, 'markdown')
    }
    triggerBlobDownload(
      text,
      markdownExportFilename(entry.url, entry.title),
      'text/markdown;charset=utf-8'
    )
  } catch (err) {
    toast.add({
      title: 'Download failed',
      description: err instanceof Error ? err.message : 'Could not download page',
      color: 'error'
    })
  } finally {
    exporting.value = false
  }
}

async function onSavePrompt(prompt: string) {
  try {
    await savePrompt(handoffSection, prompt)
    toast.add({ title: 'Prompt saved', color: 'success' })
  } catch (err) {
    toast.add({
      title: 'Save failed',
      description: err instanceof Error ? err.message : 'Could not save prompt',
      color: 'error'
    })
  }
}

async function onResetPrompt() {
  try {
    await resetPrompt(handoffSection)
    toast.add({ title: 'Prompt reset to default', color: 'success' })
  } catch (err) {
    toast.add({
      title: 'Reset failed',
      description: err instanceof Error ? err.message : 'Could not reset prompt',
      color: 'error'
    })
  }
}
</script>

<template>
  <AppDashboardPanel fluid>
    <template #header>
      <DashboardPageNavbar title="Content Explorer">
        <template #right>
          <ScanTriggerButton :site-id="siteId" />
        </template>
      </DashboardPageNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="error"
        class="mb-4"
        color="error"
        variant="subtle"
        :title="error"
      />

      <div class="space-y-3">
        <div
          ref="workspaceRef"
          class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-default bg-elevated"
          :style="{ height: workspaceHeight }"
        >
          <ContentExplorerToolbar
            v-model:add-prompt="addPrompt"
            v-model:viewport="previewViewport"
            v-model:view-mode="viewMode"
            :entry="activeEntry"
            show-copy
            :can-copy="Boolean(activeEntry)"
            show-download
            :can-download="canDownload"
            :download-tooltip="isZipDownload ? 'Download ZIP' : 'Download'"
            :exporting="exporting"
            show-prompt
            show-viewport
            :scan-completed-at="latestScan?.completed_at || latestScan?.created || null"
            @copy="copyActivePage"
            @download="downloadSelection"
            @edit-prompt="promptModalOpen = true"
          />
          <div class="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 overflow-hidden lg:grid-cols-[minmax(20rem,28%)_1fr] lg:grid-rows-1">
            <ContentExplorerTree
              v-model:search="treeSearch"
              class="min-h-0 lg:border-r lg:border-default"
              :entries="entries"
              :loading="loading"
              :selected-ids="selectedIds"
              :active-entry-id="activeEntry?.id"
              @select="onSelect"
              @toggle="onToggle"
              @toggle-all="onToggleAll"
            />
            <ContentExplorerPreview
              ref="previewRef"
              v-model:viewport="previewViewport"
              v-model:view-mode="viewMode"
              :site-id="siteId"
              :entry="activeEntry"
              :attached-prompt="promptAttachedToPreview"
            />
          </div>
        </div>
      </div>

      <HandoffPromptEditorModal
        v-model:open="promptModalOpen"
        :section="handoffSection"
        :active-prompt="contentPrompt"
        :history="historyFor(handoffSection)"
        :using-default="usingDefault(handoffSection)"
        @save="onSavePrompt"
        @reset="onResetPrompt"
      />
    </template>
  </AppDashboardPanel>
</template>
