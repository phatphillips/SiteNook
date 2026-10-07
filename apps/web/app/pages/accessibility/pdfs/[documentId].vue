<script setup lang="ts">
import { format } from 'date-fns'
import type { PdfDocument, PdfIssue, PdfRemediation } from '~/types/sitenook'
import type { PdfContentPaneView, PdfStudioMode } from '~/utils/pdfStructureViews'
import { parsePdfStudioQuery } from '~/utils/pdfStructureViews'
import { remediationStatusLabel, structureStatusLabel } from '~/utils/pdfRemediationExport'
import { displayPdfFilename } from '~/utils/displayPdfFilename'
import PdfInspectorShell from '~/components/accessibility/pdf/PdfInspectorShell.vue'
import PdfComparePanel from '~/components/accessibility/pdf/PdfComparePanel.vue'

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
  fetchLatestRemediation,
  requestStructure,
  requestRemediation,
  getSuggestedFileUrl,
  getRemediationPackUrl,
  downloadAuthed,
  loadStructureTexts,
  exportIssuesCsv,
  buildShareUrl,
  copyShareLink,
  setPdfIgnored
} = usePdfDocuments(siteId)

const document = ref<PdfDocument | null>(null)
const issues = ref<PdfIssue[]>([])
const remediation = ref<PdfRemediation | null>(null)
const loading = ref(true)
const remediating = ref(false)
const ignoring = ref(false)

provide('featurePageBannerLoading', loading)
const selectedIssueId = ref<string | null>(null)
const inspectorRef = useTemplateRef('inspectorRef')
const structureText = ref({ html: '', json: '', markdown: '' })
const toast = useToast()

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
const suggestedUrl = computed(() =>
  remediation.value?.id && remediation.value.status === 'complete'
    ? getSuggestedFileUrl(remediation.value.id)
    : null
)

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

const libraryPath = computed(() => '/accessibility/pdfs')

const structureLoading = computed(() => {
  const status = document.value?.structure_status
  return status === 'pending' || status === 'processing'
})

const moreActionsItems = computed(() => [[
  {
    label: 'Extract structure',
    icon: 'i-lucide-layers',
    disabled: !document.value,
    onSelect: () => { void onRequestStructure() }
  },
  {
    label: 'Issue CSV',
    icon: 'i-lucide-file-spreadsheet',
    disabled: !issues.value.length,
    onSelect: () => onExportIssues()
  },
  {
    label: 'Remediation pack',
    icon: 'i-lucide-package',
    disabled: !document.value,
    onSelect: () => { void onExportPack() }
  },
  {
    label: 'Share',
    icon: 'i-lucide-share-2',
    disabled: !document.value?.share_token,
    onSelect: () => { void onShareCompare() }
  }
]])

const scoreBadgeLabel = computed(() => {
  const score = document.value?.accessibility_score
  if (score == null) return null
  const count = issues.value.length
  return count > 0 ? `Score ${score} · ${count} issues` : `Score ${score}`
})

async function refreshStudio() {
  document.value = await fetchDocument(documentId.value)
  if (!document.value) return
  issues.value = await fetchIssues(documentId.value)
  if (issues.value.length && !selectedIssueId.value) {
    selectedIssueId.value = issues.value[0]!.id
  }
  remediation.value = await fetchLatestRemediation(documentId.value)
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
    // Leave UI to show Extract structure CTA.
  }
}

onMounted(async () => {
  loading.value = true
  await refreshStudio()
  if (document.value?.site) {
    siteId.value = document.value.site
    activeSiteId.value = document.value.site
  }
  loading.value = false
  if (mode.value === 'convert') {
    await ensureStructureQueued()
  }
})

watch(mode, async (next) => {
  if (next === 'convert') {
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

async function onGenerateSuggested() {
  if (!document.value) return
  const remediationSiteId = document.value.site || siteId.value
  if (!remediationSiteId) {
    toast.add({
      title: 'Assisted fix needs a site',
      description: 'Assign this PDF to a site before generating an assisted fix.',
      color: 'warning'
    })
    return
  }
  remediating.value = true
  try {
    remediation.value = await requestRemediation(document.value.id, remediationSiteId)
    toast.add({
      title: 'Generating assisted fix',
      description: 'OpenDataLoader will apply an assisted structural fix, then veraPDF re-checks it.',
      color: 'primary'
    })
    mode.value = 'compare'
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000))
      await refreshStudio()
      if (document.value?.remediation_status === 'complete' || document.value?.remediation_status === 'failed') {
        break
      }
    }
  } catch (err) {
    toast.add({
      title: 'Assisted fix failed',
      description: err instanceof Error ? err.message : 'Could not queue assisted fix',
      color: 'error'
    })
  } finally {
    remediating.value = false
  }
}

async function onRequestStructure() {
  if (!document.value) return
  await requestStructure(document.value.id)
  toast.add({ title: 'Structure extraction queued', color: 'primary' })
  mode.value = 'convert'
  for (let i = 0; i < 45; i++) {
    await new Promise(r => setTimeout(r, 2000))
    await refreshStudio()
    if (document.value?.structure_status === 'complete' || document.value?.structure_status === 'failed') break
  }
}

async function onDownloadSuggested() {
  if (!remediation.value?.id) return
  await downloadAuthed(
    getSuggestedFileUrl(remediation.value.id),
    `assisted-fix-${displayFilename.value}`
  )
}

async function onExportPack() {
  if (!document.value) return
  await downloadAuthed(
    getRemediationPackUrl(document.value.id),
    `${displayFilename.value.replace(/\.pdf$/i, '')}-remediation-pack.zip`
  )
}

function onExportIssues() {
  exportIssuesCsv(issues.value, document.value)
}

async function onShareCompare() {
  if (!document.value?.share_token) return
  await copyShareLink(document.value.share_token)
  toast.add({
    title: 'Share link copied',
    description: buildShareUrl(document.value.share_token),
    color: 'success'
  })
}

async function onIgnoredChange(ignored: boolean) {
  if (!document.value) return
  ignoring.value = true
  try {
    await setPdfIgnored(document.value.id, ignored)
    document.value = { ...document.value, ignored }
    toast.add({
      title: ignored ? 'PDF ignored in future scans' : 'PDF will be scanned again',
      color: 'neutral'
    })
  } catch (err) {
    toast.add({
      title: 'Could not update ignore setting',
      description: err instanceof Error ? err.message : 'Try again',
      color: 'error'
    })
  } finally {
    ignoring.value = false
  }
}
</script>

<template>
  <AppDashboardPanel full-width>
    <template #header>
      <DashboardPageNavbar>
        <template #title>
          <nav
            class="flex min-w-0 flex-col gap-0.5"
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
              <span class="truncate font-semibold text-highlighted">
                PDF Inspector
              </span>
              <span
                v-if="headerTimestamp"
                class="hidden shrink-0 truncate text-xs font-normal text-muted sm:inline"
              >· {{ headerTimestamp }}</span>
            </div>
            <p
              v-if="document"
              class="truncate text-xs text-muted"
              :title="displayFilename"
            >
              {{ displayFilename }}
            </p>
          </nav>
        </template>
        <template #right>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              size="sm"
              color="primary"
              :loading="remediating"
              :disabled="!document"
              @click="onGenerateSuggested"
            >
              Generate assisted fix
            </UButton>
            <UDropdownMenu
              :items="moreActionsItems"
              :content="{ align: 'end' }"
            >
              <UButton
                size="sm"
                color="neutral"
                variant="outline"
                icon="i-lucide-ellipsis"
                aria-label="More actions"
              />
            </UDropdownMenu>
          </div>
        </template>
      </DashboardPageNavbar>
    </template>

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
        class="flex min-h-0 flex-1 flex-col gap-4"
      >
        <AccessibilityPdfDocumentProperties
          :document="document"
          :issue-count="issues.length"
          :ignoring="ignoring"
          @update:ignored="onIgnoredChange"
        />

        <div class="flex flex-wrap items-center justify-between gap-3">
          <UTabs
            v-model="mode"
            :content="false"
            :items="[
              { label: 'Audit', value: 'audit' },
              { label: 'Convert', value: 'convert' },
              { label: 'Before & after', value: 'compare' }
            ]"
            class="w-full max-w-lg"
          />
          <div class="flex flex-wrap gap-2 text-xs text-muted">
            <UBadge
              variant="subtle"
              color="neutral"
            >
              {{ structureStatusLabel(document.structure_status) }}
            </UBadge>
            <UBadge
              variant="subtle"
              color="neutral"
            >
              {{ remediationStatusLabel(document.remediation_status) }}
            </UBadge>
            <UBadge
              v-if="scoreBadgeLabel"
              variant="subtle"
              color="neutral"
            >
              {{ scoreBadgeLabel }}
            </UBadge>
          </div>
        </div>

        <p class="text-xs text-muted sm:text-sm">
          Assisted fix is remediation help. Not certified PDF/UA. Re-check with validation, then export a pack.
        </p>

        <UAlert
          v-if="document.structure_status === 'failed'"
          color="warning"
          variant="subtle"
          title="Structure extraction failed"
          :description="document.structure_error || 'Could not parse this PDF. Try Extract structure again, or use an uploaded copy if the crawl URL is blocked.'"
        />
        <UAlert
          v-else-if="!document.file && document.url"
          color="warning"
          variant="subtle"
          title="Waiting for scanner to store this PDF"
          description="Crawl PDFs are downloaded automatically by the scanner after discovery. If this stays empty, the remote URL may be blocked. Upload a copy from the PDF library, or re-run a site scan."
        />

        <component
          :is="PdfInspectorShell"
          v-if="mode === 'audit' || mode === 'convert'"
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
        />

        <component
          :is="PdfComparePanel"
          v-else
          class="min-h-0 flex-1"
          :document="document"
          :remediation="remediation"
          :original-url="fileUrl"
          :suggested-url="suggestedUrl"
          :issues="issues"
          @download-suggested="onDownloadSuggested"
          @export-pack="onExportPack"
        />
      </div>
    </template>
  </AppDashboardPanel>
</template>
