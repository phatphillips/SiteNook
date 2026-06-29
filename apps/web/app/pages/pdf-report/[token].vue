<script setup lang="ts">
import { format } from 'date-fns'
import type { PdfDocument, PdfIssue } from '~/types/accessiq'

definePageMeta({
  layout: 'marketing',
  middleware: []
})

const route = useRoute()
const token = computed(() => route.params.token as string)

const document = ref<PdfDocument | null>(null)
const issues = ref<PdfIssue[]>([])
const loading = ref(true)
const error = ref('')
const selectedIssueId = ref<string | null>(null)
const previewRef = useTemplateRef('previewRef')

const { data, error: fetchError } = await useFetch<{
  document: PdfDocument
  issues: PdfIssue[]
  fileUrl: string | null
}>(() => `/api/pdf-report/${token.value}`)

watchEffect(() => {
  if (fetchError.value) {
    error.value = fetchError.value.message || 'Report not found'
    loading.value = false
    return
  }
  if (data.value) {
    document.value = data.value.document
    issues.value = data.value.issues
    if (issues.value.length && !selectedIssueId.value) {
      selectedIssueId.value = issues.value[0]!.id
    }
    loading.value = false
  }
})

const selectedIssue = computed(() =>
  issues.value.find(issue => issue.id === selectedIssueId.value) ?? null
)

const fileUrl = computed(() => (token.value ? `/api/pdf-report/${token.value}/file` : null))

const headerTimestamp = computed(() => {
  const ts = document.value?.validated_at || document.value?.created
  if (!ts) return ''
  try {
    return format(new Date(ts), 'M/d/yyyy, hh:mm a')
  } catch {
    return ts
  }
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
  <div class="min-h-screen bg-default">
    <header class="border-b border-default bg-elevated px-6 py-4">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div class="min-w-0">
          <p class="text-xs uppercase tracking-wide text-muted">
            PDF report
          </p>
          <h1 class="truncate text-lg font-semibold text-highlighted">
            {{ document?.filename || 'Shared PDF report' }}
          </h1>
          <p
            v-if="headerTimestamp"
            class="text-sm text-muted"
          >
            {{ headerTimestamp }}
          </p>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl p-4">
      <div
        v-if="loading"
        class="py-20 text-center text-sm text-muted"
      >
        Loading report…
      </div>
      <div
        v-else-if="error"
        class="py-20 text-center text-sm text-error"
      >
        {{ error }}
      </div>
      <div
        v-else-if="document"
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
    </main>
  </div>
</template>
