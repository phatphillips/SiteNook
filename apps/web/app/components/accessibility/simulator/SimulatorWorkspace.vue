<script setup lang="ts">
import type { ContentExplorerEntry } from '~/types/sitenook'
import { pickDefaultContentExplorerEntry } from '~/utils/pickDefaultContentExplorerEntry'
import type { SimulatorVisionId } from '~/utils/simulatorChecks'

const props = defineProps<{
  siteId: string
}>()

const visionId = defineModel<SimulatorVisionId>('visionId', { default: 'none' })
const tabOrder = defineModel<boolean>('tabOrder', { default: false })

const route = useRoute()
const router = useRouter()

const siteIdRef = computed(() => props.siteId || undefined)
const {
  entries,
  latestScan,
  loading,
  error,
  fetchExplorerData
} = useContentExplorer(siteIdRef as Ref<string | undefined>)

const { isRunning } = useWorkspaceScanState(siteIdRef)

const activeEntry = ref<ContentExplorerEntry | null>(null)
const treeSearch = ref('')
const workspaceRef = useTemplateRef<HTMLElement>('workspaceRef')
const { height: workspaceHeight, update: updateWorkspaceHeight } = useViewportRemainderHeight(workspaceRef)

const pageQuery = computed(() => {
  const raw = route.query.page
  return typeof raw === 'string' ? raw : null
})

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
  const fromQuery = pageQuery.value
    ? list.find(entry => entry.id === pageQuery.value || entry.pageId === pageQuery.value)
    : null
  if (fromQuery) {
    activeEntry.value = fromQuery
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

async function onSelect(entry: ContentExplorerEntry) {
  activeEntry.value = entry
  visionId.value = 'none'
  await router.replace({
    query: {
      ...route.query,
      page: entry.id
    }
  })
}
</script>

<template>
  <div class="space-y-3">
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
      icon="i-lucide-alert-circle"
    />

    <div
      ref="workspaceRef"
      class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-default bg-elevated"
      :style="{ height: workspaceHeight }"
    >
      <div class="flex h-12 min-h-12 shrink-0 items-center gap-2 overflow-x-auto border-b border-default bg-elevated px-3">
        <a
          v-if="activeEntry"
          :href="activeEntry.url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex min-w-0 max-w-80 shrink items-center gap-1.5 rounded-md px-1 py-1 text-sm font-semibold text-highlighted hover:bg-default"
          :title="activeEntry.url"
          aria-label="Open page in new tab"
        >
          <span class="min-w-0 truncate">{{ activeEntry.title || activeEntry.url }}</span>
          <UIcon
            name="i-lucide-external-link"
            class="size-3.5 shrink-0 text-muted"
          />
        </a>
        <div class="min-w-2 flex-1" />
        <label class="inline-flex shrink-0 cursor-pointer items-center gap-2 text-sm text-highlighted">
          <UCheckbox v-model="tabOrder" />
          <span>Tab order</span>
        </label>
        <AccessibilitySimulatorImpairmentSelect v-model:vision-id="visionId" />
      </div>

      <div class="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 overflow-hidden lg:grid-cols-[minmax(20rem,28%)_1fr] lg:grid-rows-1">
        <ContentExplorerTree
          v-model:search="treeSearch"
          class="min-h-0 lg:border-r lg:border-default"
          :entries="entries"
          :loading="loading"
          :active-entry-id="activeEntry?.id"
          :show-multi-select="false"
          @select="onSelect"
        />
        <div class="min-h-0 overflow-hidden">
          <AccessibilitySimulatorPreview
            v-if="activeEntry"
            class="h-full min-h-[20rem]"
            :site-id="siteId"
            :page-id="activeEntry.pageId || activeEntry.id"
            :page-url="activeEntry.url"
            :loading="loading"
            :vision-id="visionId"
            :tab-order="tabOrder"
          />
          <div
            v-else
            class="flex h-full min-h-[20rem] items-center justify-center text-sm text-muted"
          >
            Select a page to preview its crawl snapshot.
          </div>
        </div>
      </div>
    </div>

    <AccessibilitySimulatorImpairmentInfoCard :vision-id="visionId" />
  </div>
</template>
