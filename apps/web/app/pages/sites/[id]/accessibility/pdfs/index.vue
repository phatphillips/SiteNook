<script setup lang="ts">
import type { PdfDocument } from '~/types/sitenook'
import { buildPdfDocumentsCsv } from '~/utils/pdfExport'
import { computePdfLibraryKpis } from '~/utils/pdfKpis'
import PdfTableSelectionBar from '~/components/accessibility/pdf/PdfTableSelectionBar.vue'

definePageMeta({
  middleware: ['auth', 'plan-feature'],
  planFeature: 'pdfAccessibility'
})

const route = useRoute()
const toast = useToast()
const siteId = computed(() => route.params.id as string)
const { activeSiteId, activeSite, sites, fetchSites } = useSites()

const {
  uploadDocuments,
  crawlDocuments,
  loading,
  uploading,
  error,
  uploadPdfs,
  deletePdf,
  deletePdfs,
  copyShareLink,
  requestValidation,
  requestBulkValidation,
  maxUploadFiles,
  maxFileSizeMb
} = usePdfDocuments(siteId)

const allDocuments = computed(() => [...uploadDocuments.value, ...crawlDocuments.value])
const libraryKpis = computed(() => computePdfLibraryKpis(allDocuments.value))

const tableSearch = ref('')
const tableRef = useTemplateRef('tableRef')
const selectedCount = ref(0)
const bulkScanning = ref(false)
const bulkRemoving = ref(false)
const showRemoveModal = ref(false)

const siteNames = computed(() =>
  Object.fromEntries(sites.value.map(site => [site.id, site.name]))
)

const pdfsInitialLoading = computed(
  () => loading.value && !allDocuments.value.length
)

provide('featurePageBannerLoading', pdfsInitialLoading)

const footerSummary = computed(() => {
  if (loading.value && !allDocuments.value.length) return ''
  const count = allDocuments.value.length
  if (!count) return ''
  const siteLabel = activeSite.value?.name ? ` for ${activeSite.value.name}` : ''
  return `${count} ${count === 1 ? 'PDF' : 'PDFs'}${siteLabel}`
})

onMounted(async () => {
  activeSiteId.value = siteId.value
  await fetchSites()
})

async function onUpload(files: File[]) {
  await uploadPdfs(files)
  if (!error.value) {
    toast.add({ title: 'PDFs uploaded', description: 'Scan has been queued.', color: 'success' })
  }
}

async function onDelete(id: string) {
  await deletePdf(id)
  toast.add({ title: 'PDF removed', color: 'neutral' })
}

async function onCopyShare(token: string) {
  await copyShareLink(token)
  toast.add({ title: 'Share link copied', color: 'success' })
}

async function onValidate(id: string) {
  await requestValidation(id)
  toast.add({ title: 'Scan queued', color: 'success' })
}

function onOpen(doc: PdfDocument) {
  navigateTo(`/sites/${siteId.value}/accessibility/pdfs/${doc.id}`)
}

function onSelectionChange(ids: string[]) {
  selectedCount.value = ids.length
}

function clearSelection() {
  tableRef.value?.clearSelection?.()
  selectedCount.value = 0
}

async function onBulkScan() {
  const ids = tableRef.value?.getSelectedIds?.() ?? []
  if (!ids.length) return
  bulkScanning.value = true
  try {
    await requestBulkValidation(ids)
    toast.add({
      title: 'Scans queued',
      description: `${ids.length} ${ids.length === 1 ? 'PDF' : 'PDFs'} queued for scanning.`,
      color: 'success'
    })
    clearSelection()
  } catch (e: unknown) {
    toast.add({
      title: 'Failed to queue scans',
      description: String(e),
      color: 'error'
    })
  } finally {
    bulkScanning.value = false
  }
}

async function confirmBulkRemove() {
  const ids = tableRef.value?.getSelectedIds?.() ?? []
  if (!ids.length) return
  bulkRemoving.value = true
  try {
    await deletePdfs(ids)
    toast.add({
      title: 'PDFs removed',
      description: `Removed ${ids.length} ${ids.length === 1 ? 'PDF' : 'PDFs'}.`,
      color: 'neutral'
    })
    showRemoveModal.value = false
    clearSelection()
  } catch (e: unknown) {
    toast.add({
      title: 'Failed to remove PDFs',
      description: String(e),
      color: 'error'
    })
  } finally {
    bulkRemoving.value = false
  }
}

const exportPage = ref(1)
const exportPageSize = ref(20)
const exportRows = ref<PdfDocument[]>([])

const {
  exportModalOpen,
  exportConfig,
  exporting,
  progressMessage,
  runExport
} = useSimpleTableCsvExport({
  total: computed(() => exportRows.value.length),
  page: exportPage,
  pageSize: exportPageSize,
  currentRows: exportRows,
  feature: 'pdf-documents',
  scopeLabel: siteId,
  fetchAllRows: async () => exportRows.value,
  buildCsv: rows => buildPdfDocumentsCsv(rows)
})

function openExportModal() {
  const state = tableRef.value?.getExportState?.()
  exportRows.value = state?.rows ?? allDocuments.value
  exportPage.value = (state?.pageIndex ?? 0) + 1
  exportPageSize.value = state?.pageSize ?? 20
  exportModalOpen.value = true
}
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="PDF Accessibility" />
    </template>

    <template #body>
      <div class="space-y-6">
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
        />

        <AccessibilityPdfLibraryKpis :kpis="libraryKpis" />

        <p class="text-sm text-muted">
          PDFs discovered during site scans appear here. Open PDF Inspector to audit issues,
          convert content, generate an assisted fix, or ignore a file on future crawls.
        </p>

        <AccessibilityPdfUploadPanel
          :uploading="uploading"
          :max-files="maxUploadFiles"
          :max-file-size-mb="maxFileSizeMb"
          @upload="onUpload"
        />

        <section class="space-y-4">
          <h2 class="text-base font-semibold text-highlighted">
            PDFs
          </h2>

          <DataTableToolbar>
            <template #leading>
              <TableSearchInput
                v-model="tableSearch"
                placeholder="Search PDFs…"
                aria-label="Search PDFs"
              />
              <UDropdownMenu
                :items="tableRef?.columnMenuItems ?? []"
                :content="{ align: 'start' }"
              >
                <TableToolbarMenuButton
                  label="Columns"
                  icon="i-lucide-columns-3"
                  aria-label="Toggle column visibility"
                />
              </UDropdownMenu>
            </template>
            <template #actions>
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-download"
                label="Export to CSV"
                @click="openExportModal"
              />
            </template>
          </DataTableToolbar>

          <AccessibilityPdfValidatedPdfsTable
            ref="tableRef"
            v-model:search="tableSearch"
            hide-toolbar
            show-select
            mode="library"
            :documents="allDocuments"
            :site-id="siteId"
            :site-names="siteNames"
            :loading="loading"
            :footer-summary="footerSummary"
            @delete="onDelete"
            @validate="onValidate"
            @copy-share="onCopyShare"
            @open="onOpen"
            @selection-change="onSelectionChange"
          />
        </section>

        <TableExportModal
          v-model:open="exportModalOpen"
          :config="exportConfig"
          :exporting="exporting"
          :progress-message="progressMessage"
          @export="runExport"
        />
      </div>
    </template>
  </AppDashboardPanel>

  <PdfTableSelectionBar
    :count="selectedCount"
    :scanning="bulkScanning"
    :removing="bulkRemoving"
    @scan="onBulkScan"
    @remove="showRemoveModal = true"
    @clear="clearSelection"
  />

  <UModal
    v-model:open="showRemoveModal"
    :title="`Remove ${selectedCount} PDF${selectedCount === 1 ? '' : 's'}?`"
    description="This permanently removes the selected PDFs and their accessibility results."
  >
    <template #body>
      <div class="flex justify-end gap-2">
        <UButton
          label="Cancel"
          color="neutral"
          variant="subtle"
          @click="showRemoveModal = false"
        />
        <UButton
          label="Remove"
          color="error"
          :loading="bulkRemoving"
          @click="confirmBulkRemove"
        />
      </div>
    </template>
  </UModal>
</template>
