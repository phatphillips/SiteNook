<script setup lang="ts">
import { format } from 'date-fns'
import type { PdfDocument, PdfIssue } from '~/types/sitenook'
import type { PdfContentPaneView, PdfStudioMode } from '~/utils/pdfStructureViews'
import { parsePdfStudioQuery } from '~/utils/pdfStructureViews'
import { displayPdfFilename } from '~/utils/displayPdfFilename'
import PdfInspectorShell from '~/components/accessibility/pdf/PdfInspectorShell.vue'

definePageMeta({
  middleware: ['auth', 'plan-feature'],
  planFeature: 'pdfAccessibility'
})

const route = useRoute()
const router = useRouter()
const documentId = computed(() => route.params.documentId as string)
const siteId = ref('')
const { activeSiteId } = useSites()

const {
  fetchDocument,
  fetchIssues,
  getFileUrl,
  requestStructure,
  loadStructureTexts
} = usePdfDocuments(siteId)

const document = ref<PdfDocument | null>(null)
const issues = ref<PdfIssue[]>([])
const loading = ref(true)
const selectedIssueId = ref<string | null>(null)
const inspectorRef = useTemplateRef('inspectorRef')
const workspaceRef = useTemplateRef<HTMLElement>('workspaceRef')
const structureText = ref({ html: '', json: '', markdown: '' })
const { height: workspaceHeight, update: updateWorkspaceHeight } = useViewportRemainderHeight(workspaceRef)

provide('featurePageBannerLoading', loading)

const studioQuery = computed(() => parsePdfStudioQuery(route.query as Record<string, unknown>))
const mode = computed<PdfStudioMode>({
  get: () => studioQuery.value.mode,
  set: (value) => {
    router.replace({
      query: {
        ...route.query,
        mode: value,
        content: studioQuery.value.content,
        view2: studioQuery.value.content
      }
    })
  }
})
const content = computed<PdfContentPaneView>({
  get: () => studioQuery.value.content,
  set: (value) => {
    router.replace({
      query: {
        ...route.query,
        mode: mode.value,
        content: value,
        view2: value
      }
    })
  }
})

const selectedIssue = computed(() =>
  issues.value.find(issue => issue.id === selectedIssueId.value) ?? null
)

const fileUrl = computed(() => (document.value ? getFileUrl(document.value) : null))
const displayFilename = computed(() => displayPdfFilename(document.value?.filename))

const headerTimestamp = computed(() => {
  const ts = document.value?.validated_at || document.value?.created
  if (!ts) return ''
  try {
    return format(new Date(ts), 'M/d/yyyy, hh:mm a')
  } catch {
    return ts
  }
})

const libraryPath = computed(() =>
  document.value?.site
    ? `/sites/${document.value.site}/accessibility/pdfs`
    : '/accessibility/pdfs'
)

const structureLoading = computed(() => {
  const status = document.value?.structure_status
  return status === 'pending' || status === 'processing'
})

const studioModeItems = [
  { label: 'Audit', value: 'audit' },
  { label: 'Extract', value: 'extract' }
]

async function refreshStudio() {
  document.value = await fetchDocument(documentId.value)
  if (!document.value) return
  if (document.value.site) {
    siteId.value = document.value.site
    activeSiteId.value = document.value.site
  }
  issues.value = await fetchIssues(documentId.value)
  if (issues.value.length && !selectedIssueId.value) {
    selectedIssueId.value = issues.value[0]!.id
  }
  structureText.value = await loadStructureTexts(document.value)
}

async function ensureStructureQueued() {
  if (!document.value) return
  const status = document.value.structure_status
  if (status === 'complete' || status === 'pending' || status === 'processing') return
  try {
    await requestStructure(document.value.id)
    await refreshStudio()
  } catch {
    // Leave empty state in Extract context.
  }
}

onMounted(async () => {
  loading.value = true
  await refreshStudio()
  loading.value = false
  if (mode.value === 'extract') {
    await ensureStructureQueued()
  }
})

watch(mode, async (next) => {
  if (next === 'extract') {
    await ensureStructureQueued()
    for (let i = 0; i < 30; i++) {
      if (!document.value) break
      const status = document.value.structure_status
      if (status === 'complete' || status === 'failed') break
      await new Promise(r => setTimeout(r, 2000))
      await refreshStudio()
    }
  }
})

// Soft-poll while waiting for scanner to store a crawl PDF file for preview.
let filePollGeneration = 0
watch(
  () => [document.value?.id, document.value?.file, document.value?.url] as const,
  async ([id, file, url]) => {
    const generation = ++filePollGeneration
    if (!id || file || !url) return
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 3000))
      if (generation !== filePollGeneration) return
      if (!document.value || document.value.id !== id) return
      await refreshStudio()
      if (generation !== filePollGeneration) return
      if (document.value?.file) {
        await nextTick()
        inspectorRef.value?.retrySource?.()
        return
      }
    }
  },
  { immediate: true }
)

function onSelectIssue(issue: PdfIssue) {
  selectedIssueId.value = issue.id
}

function onGoToPage(page: number) {
  inspectorRef.value?.goToPage?.(page)
}

watch([loading, mode], async () => {
  await nextTick()
  updateWorkspaceHeight()
})
</script>

<template>
  <AppDashboardPanel
    fluid
    hide-feature-banner
  >
    <template #body>
      <div
        v-if="loading"
        class="py-20 text-center text-sm text-muted"
      >
        Loading PDF Inspector…
      </div>

      <div
        v-else-if="!document"
        class="py-20 text-center text-sm text-muted"
      >
        PDF document not found.
      </div>

      <div
        v-else
        class="flex min-h-0 flex-1 flex-col gap-3"
      >
        <UAlert
          v-if="document.structure_status === 'failed'"
          color="warning"
          variant="subtle"
          title="Structure extraction failed"
          :description="document.structure_error || 'Could not parse this PDF. Try switching to Extract again, or upload a copy if the crawl URL is blocked.'"
        />
        <UAlert
          v-else-if="!document.file && document.url"
          color="warning"
          variant="subtle"
          title="Waiting for scanner to store this PDF"
          description="Crawl PDFs are downloaded automatically by the scanner after discovery. If this stays empty, the remote URL may be blocked. Upload a copy from the PDF library, or re-run a site scan."
        />

        <div
          ref="workspaceRef"
          class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-default bg-elevated"
          :style="{ height: workspaceHeight }"
        >
          <PdfInspectorShell
            ref="inspectorRef"
            class="min-h-0 flex-1"
            :mode="mode"
            :document="document"
            :file-url="fileUrl"
            :issues="issues"
            :selected-issue-id="selectedIssueId"
            :content="content"
            :structure-text="structureText"
            :structure-loading="structureLoading"
            :initial-page="selectedIssue?.page_number"
            @select-issue="onSelectIssue"
            @update:content="content = $event"
            @go-to-page="onGoToPage"
          >
            <template #toolbar>
              <div class="flex w-full min-w-0 items-center gap-3">
                <nav
                  class="min-w-0 flex-1"
                  aria-label="Breadcrumb"
                >
                  <div class="flex min-w-0 items-center gap-1.5 text-sm">
                    <NuxtLink
                      :to="libraryPath"
                      class="shrink-0 font-medium text-muted transition-colors hover:text-highlighted"
                    >
                      PDFs
                    </NuxtLink>
                    <span
                      class="shrink-0 text-muted"
                      aria-hidden="true"
                    >/</span>
                    <h1 class="truncate text-sm font-semibold text-highlighted">
                      PDF Inspector
                    </h1>
                    <span
                      v-if="headerTimestamp"
                      class="hidden shrink-0 truncate text-sm font-normal text-muted sm:inline"
                    >· {{ headerTimestamp }}</span>
                  </div>
                  <p
                    class="truncate text-sm text-muted"
                    :title="displayFilename"
                  >
                    {{ displayFilename }}
                  </p>
                </nav>
                <UTabs
                  v-model="mode"
                  :content="false"
                  :items="studioModeItems"
                  color="neutral"
                  size="sm"
                  class="overview-date-range-tabs ms-auto h-8 shrink-0"
                  :ui="{
                    list: 'relative flex h-8 w-auto p-0.5 rounded-lg bg-elevated border border-default',
                    indicator: 'inset-y-0.5 rounded-md shadow-sm bg-default',
                    trigger: [
                      'h-7 grow justify-center px-3 text-sm font-medium min-w-0',
                      'data-[state=inactive]:text-muted hover:data-[state=inactive]:not-disabled:text-default',
                      'data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-highlighted'
                    ].join(' ')
                  }"
                />
              </div>
            </template>
          </PdfInspectorShell>
        </div>
      </div>
    </template>
  </AppDashboardPanel>
</template>
