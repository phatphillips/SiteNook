<script setup lang="ts">
import type { PdfDocument } from '~/types/accessiq'

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
  copyShareLink,
  requestValidation,
  requestBulkValidation,
  exportCsv,
  maxUploadFiles,
  maxFileSizeMb
} = usePdfDocuments(siteId)

const uploadSearch = ref('')
const crawlSearch = ref('')

const siteNames = computed(() =>
  Object.fromEntries(sites.value.map(site => [site.id, site.name]))
)

const foundOnSiteTitle = computed(() =>
  activeSite.value?.name
    ? `PDFs found on ${activeSite.value.name}`
    : 'PDFs found on this site'
)

const unvalidatedIds = computed(() =>
  crawlDocuments.value
    .filter(doc => doc.status !== 'complete' && doc.status !== 'processing' && doc.status !== 'pending')
    .map(doc => doc.id)
)

const pendingIds = computed(() =>
  crawlDocuments.value
    .filter(doc => doc.status === 'pending' || doc.status === 'failed' || !doc.validated_at)
    .map(doc => doc.id)
)

onMounted(async () => {
  activeSiteId.value = siteId.value
  await fetchSites()
})

async function onUpload(files: File[]) {
  await uploadPdfs(files)
  if (!error.value) {
    toast.add({ title: 'PDFs uploaded', description: 'Validation has been queued.', color: 'success' })
  }
}

async function onDelete(id: string) {
  await deletePdf(id)
  toast.add({ title: 'PDF deleted', color: 'neutral' })
}

async function onCopyShare(token: string) {
  await copyShareLink(token)
  toast.add({ title: 'Share link copied', color: 'success' })
}

async function onValidate(id: string) {
  await requestValidation(id)
  toast.add({ title: 'Validation queued', color: 'success' })
}

async function validateAll() {
  const ids = pendingIds.value.length ? pendingIds.value : unvalidatedIds.value
  if (!ids.length) {
    toast.add({ title: 'No PDFs to validate', color: 'neutral' })
    return
  }
  await requestBulkValidation(ids)
  toast.add({
    title: 'Validation queued',
    description: `${ids.length} PDF(s) queued for validation.`,
    color: 'success'
  })
}

function onOpen(doc: PdfDocument) {
  if (doc.status !== 'complete' && doc.status !== 'failed') return
  navigateTo(`/sites/${siteId.value}/accessibility/pdfs/${doc.id}`)
}
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="PDF accessibility">
        <template #right>
          <UButton
            color="primary"
            icon="i-lucide-play"
            label="Validate all unvalidated"
            @click="validateAll"
          />
          <ScanTriggerButton :site-id="siteId" />
        </template>
      </DashboardPageNavbar>
    </template>

    <template #body>
      <SitePageToolbar class="mb-2" />
      <div class="space-y-6">
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
        />

        <AccessibilityPdfUploadPanel
          :uploading="uploading"
          :max-files="maxUploadFiles"
          :max-file-size-mb="maxFileSizeMb"
          @upload="onUpload"
        />

        <AccessibilityPdfValidatedPdfsTable
          v-model:search="uploadSearch"
          :documents="uploadDocuments"
          :site-id="siteId"
          mode="validate"
          title="Validated PDFs"
          :site-names="siteNames"
          show-site-column
          :loading="loading"
          @delete="onDelete"
          @copy-share="onCopyShare"
          @open="onOpen"
          @export="exportCsv(uploadDocuments)"
        />

        <AccessibilityPdfValidatedPdfsTable
          v-model:search="crawlSearch"
          :documents="crawlDocuments"
          :site-id="siteId"
          mode="audit"
          :title="foundOnSiteTitle"
          :loading="loading"
          @validate="onValidate"
          @open="onOpen"
          @export="exportCsv(crawlDocuments)"
        />
      </div>
    </template>
  </AppDashboardPanel>
</template>
