<script setup lang="ts">
import { format } from 'date-fns'
import type { PdfDocument, PdfIssue } from '~/types/accessiq'

definePageMeta({
  middleware: ['auth', 'plan-feature'],
  planFeature: 'pdfAccessibility'
})

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const documentId = computed(() => route.params.documentId as string)
const { activeSiteId } = useSites()

const {
  fetchDocument,
  fetchIssues,
  getFileUrl
} = usePdfDocuments(siteId)

const document = ref<PdfDocument | null>(null)
const issues = ref<PdfIssue[]>([])
const loading = ref(true)
const selectedIssueId = ref<string | null>(null)
const previewRef = useTemplateRef('previewRef')

const selectedIssue = computed(() =>
  issues.value.find(issue => issue.id === selectedIssueId.value) ?? null
)

const fileUrl = computed(() => (document.value ? getFileUrl(document.value) : null))

const headerTimestamp = computed(() => {
  const ts = document.value?.validated_at || document.value?.created
  if (!ts) return ''
  try {
    return format(new Date(ts), 'M/d/yyyy, hh:mm a')
  } catch {
    return ts
  }
})

onMounted(async () => {
  activeSiteId.value = siteId.value
  loading.value = true
  document.value = await fetchDocument(documentId.value)
  if (document.value) {
    issues.value = await fetchIssues(documentId.value)
    if (issues.value.length) {
      selectedIssueId.value = issues.value[0]!.id
    }
  }
  loading.value = false
})

function onSelectIssue(issue: PdfIssue) {
  selectedIssueId.value = issue.id
  if (issue.page_number && previewRef.value?.goToPage) {
    previewRef.value.goToPage(issue.page_number)
  }
}

function onGoToPage(page: number) {
  previewRef.value?.goToPage?.(page)
}
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar :title="document?.filename || 'PDF report'">
        <template #left>
          <div class="flex min-w-0 items-center gap-2 text-sm text-muted">
            <NuxtLink
              :to="`/sites/${siteId}/accessibility/pdfs`"
              class="hover:text-highlighted"
            >
              PDF accessibility
            </NuxtLink>
            <span>/</span>
            <span class="truncate text-highlighted">{{ document?.filename || 'Report' }}</span>
            <span
              v-if="headerTimestamp"
              class="hidden sm:inline"
            >· {{ headerTimestamp }}</span>
          </div>
        </template>
      </DashboardPageNavbar>
    </template>

    <template #body>
      <SitePageToolbar class="mb-2" />

      <div
        v-if="loading"
        class="py-20 text-center text-sm text-muted"
      >
        Loading PDF report…
      </div>

      <div
        v-else-if="!document"
        class="py-20 text-center text-sm text-muted"
      >
        PDF document not found.
      </div>

      <div
        v-else
        class="grid min-h-[70vh] grid-cols-1 overflow-hidden rounded-xl border border-default lg:grid-cols-[280px_1fr] xl:grid-cols-[260px_300px_1fr]"
      >
        <AccessibilityPdfIssueSidebar
          :issues="issues"
          :selected-issue-id="selectedIssueId"
          @select="onSelectIssue"
        />
        <AccessibilityPdfIssueDetailPanel
          class="hidden xl:block"
          :issue="selectedIssue"
          @go-to-page="onGoToPage"
        />
        <AccessibilityPdfPreviewViewer
          ref="previewRef"
          class="min-h-[480px]"
          :file-url="fileUrl"
          :initial-page="selectedIssue?.page_number"
        />
      </div>

      <AccessibilityPdfIssueDetailPanel
        v-if="document && selectedIssue"
        class="mt-4 rounded-xl border border-default xl:hidden"
        :issue="selectedIssue"
        @go-to-page="onGoToPage"
      />
    </template>
  </AppDashboardPanel>
</template>
