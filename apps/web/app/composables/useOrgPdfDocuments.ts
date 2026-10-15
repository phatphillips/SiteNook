import type { PdfDocument } from '~/types/sitenook'
import { ALL_SITES } from '~/composables/useSites'
import { pbAnd, pbEmptyRelation, pbRelation } from '~/utils/pbFilter'

function pocketBaseErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: string }).message)
  }
  return 'PDF operation failed'
}

const MAX_UPLOAD_FILES = 10
const MAX_FILE_BYTES = 20 * 1024 * 1024

function isOrgLibraryDocument(doc: PdfDocument): boolean {
  return !doc.site
}

/** Org-library PDFs (no site). Prefer server filter; fall back to client filter if PB rejects it. */
async function fetchOrgLibraryDocuments(
  pb: { collection: (name: string) => {
    getFullList: (opts: Record<string, unknown>) => Promise<unknown[]>
  } },
  orgId: string
): Promise<PdfDocument[]> {
  try {
    return await pb.collection('pdf_documents').getFullList({
      filter: pbAnd([
        pbRelation('organization', orgId),
        pbEmptyRelation('site')
      ]),
      sort: '-validated_at,-id'
    }) as unknown as PdfDocument[]
  } catch {
    // Some PocketBase builds reject empty-relation filters; narrow client-side instead.
    try {
      const rows = await pb.collection('pdf_documents').getFullList({
        filter: pbRelation('organization', orgId),
        sort: '-validated_at,-id'
      }) as unknown as PdfDocument[]
      return rows.filter(isOrgLibraryDocument)
    } catch {
      return []
    }
  }
}

export function useOrgPdfDocuments(siteFilter: Ref<string> | ComputedRef<string>) {
  const { pb } = usePocketBase()
  const { sites, fetchSites } = useSites()

  const documents = ref<PdfDocument[]>([])
  const loading = ref(false)
  const uploading = ref(false)
  const error = ref('')

  const siteNames = computed(() =>
    Object.fromEntries(sites.value.map(site => [site.id, site.name]))
  )

  const targetSiteIds = computed(() => {
    if (siteFilter.value === ALL_SITES) return sites.value.map(site => site.id)
    return sites.value.filter(site => site.id === siteFilter.value).map(site => site.id)
  })

  async function fetchDocuments(options?: { silent?: boolean }) {
    if (!pb) return
    if (!options?.silent) loading.value = true
    error.value = ''
    try {
      await fetchSites().catch(() => {})
      const siteIds = targetSiteIds.value
      const orgId = typeof pb.authStore.record?.organization === 'string'
        ? pb.authStore.record.organization
        : ''

      if (siteFilter.value === ALL_SITES) {
        const lists = await Promise.all([
          ...siteIds.map(siteId =>
            pb.collection('pdf_documents').getFullList({
              filter: pbRelation('site', siteId),
              sort: '-validated_at,-id'
            }) as Promise<PdfDocument[]>
          ),
          orgId
            ? fetchOrgLibraryDocuments(pb, orgId)
            : Promise.resolve([] as PdfDocument[])
        ])
        const byId = new Map<string, PdfDocument>()
        for (const doc of lists.flat()) byId.set(doc.id, doc)
        documents.value = [...byId.values()]
        return
      }

      if (!siteIds.length) {
        documents.value = []
        return
      }

      documents.value = await pb.collection('pdf_documents').getFullList({
        filter: pbRelation('site', siteFilter.value),
        sort: '-validated_at,-id'
      }) as unknown as PdfDocument[]
    } catch (err) {
      const message = pocketBaseErrorMessage(err)
      if (!options?.silent) error.value = message
    } finally {
      if (!options?.silent) loading.value = false
    }
  }

  function patchLocalDocument(documentId: string, patch: Partial<PdfDocument>) {
    const idx = documents.value.findIndex(doc => doc.id === documentId)
    if (idx >= 0) documents.value[idx] = { ...documents.value[idx]!, ...patch }
  }

  function removeLocalDocument(documentId: string) {
    documents.value = documents.value.filter(doc => doc.id !== documentId)
  }

  function validateUploadFiles(files: File[]): string | null {
    if (!files.length) return 'Select at least one PDF file.'
    if (files.length > MAX_UPLOAD_FILES) {
      return `Upload up to ${MAX_UPLOAD_FILES} files at a time.`
    }
    for (const file of files) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        return `${file.name} is not a PDF file.`
      }
      if (file.size > MAX_FILE_BYTES) {
        return `${file.name} exceeds the 20MB limit.`
      }
    }
    return null
  }

  async function uploadPdfs(files: File[], siteId?: string) {
    const validationError = validateUploadFiles(files)
    if (validationError) {
      error.value = validationError
      return
    }
    if (!pb) {
      error.value = 'Session not ready. Please refresh the page.'
      return
    }

    const orgId = typeof pb.authStore.record?.organization === 'string'
      ? pb.authStore.record.organization
      : ''
    if (!siteId && !orgId) {
      error.value = 'Could not determine your organization for this upload.'
      return
    }

    uploading.value = true
    error.value = ''
    try {
      const userId = pb.authStore.record?.id
      for (const file of files) {
        const formData = new FormData()
        if (siteId) formData.append('site', siteId)
        if (orgId) formData.append('organization', orgId)
        formData.append('source', 'upload')
        formData.append('file', file)
        formData.append('filename', file.name)
        formData.append('status', 'pending')
        if (userId) formData.append('uploaded_by', userId)

        const doc = await pb.collection('pdf_documents').create(formData)
        await pb.collection('pdf_validation_queue').create({
          pdf_document: doc.id,
          status: 'pending',
          priority: 10
        })
      }
      await fetchDocuments({ silent: true })
    } catch (err) {
      error.value = pocketBaseErrorMessage(err)
    } finally {
      uploading.value = false
    }
  }

  async function deletePdf(documentId: string) {
    if (!pb) return
    await pb.collection('pdf_documents').delete(documentId)
    removeLocalDocument(documentId)
  }

  async function deletePdfs(documentIds: string[]) {
    for (const documentId of documentIds) {
      await deletePdf(documentId)
    }
  }

  async function setPdfIgnored(documentId: string, ignored: boolean) {
    if (!pb) return
    await pb.collection('pdf_documents').update(documentId, {
      ignored,
      ignored_at: ignored ? new Date().toISOString() : null
    })
    patchLocalDocument(documentId, {
      ignored,
      ignored_at: ignored ? new Date().toISOString() : undefined
    })
  }

  async function setBulkPdfIgnored(documentIds: string[], ignored: boolean) {
    for (const documentId of documentIds) {
      await setPdfIgnored(documentId, ignored)
    }
  }

  async function requestValidation(documentId: string, priority = 10) {
    if (!pb) return
    await pb.collection('pdf_documents').update(documentId, {
      status: 'pending',
      error_message: ''
    })
    await pb.collection('pdf_validation_queue').create({
      pdf_document: documentId,
      status: 'pending',
      priority
    })
    await fetchDocuments({ silent: true })
  }

  async function requestBulkValidation(documentIds: string[]) {
    for (const documentId of documentIds) {
      await requestValidation(documentId, 5)
    }
  }

  async function requestRemediation(documentId: string, siteId: string, priority = 10) {
    if (!pb) return null
    const doc = await pb.collection('pdf_documents').getOne(documentId) as unknown as PdfDocument
    const remediation = await pb.collection('pdf_remediations').create({
      pdf_document: documentId,
      site: siteId,
      status: 'pending',
      engine: 'opendataloader',
      artifact_kind: 'suggested_tagged',
      before_score: doc.accessibility_score ?? 0,
      before_issue_count: doc.issue_count ?? 0
    })
    await pb.collection('pdf_documents').update(documentId, {
      remediation_status: 'pending',
      latest_remediation_id: remediation.id
    })
    await pb.collection('pdf_remediation_queue').create({
      pdf_document: documentId,
      job_type: 'remediate',
      status: 'pending',
      priority,
      remediation: remediation.id
    })
    return remediation
  }

  async function requestBulkRemediation(documentIds: string[]) {
    for (const documentId of documentIds) {
      const doc = documents.value.find(d => d.id === documentId)
      if (!doc?.site) continue
      await requestRemediation(documentId, doc.site, 5)
    }
    await fetchDocuments({ silent: true })
  }

  return {
    documents,
    loading,
    uploading,
    error,
    siteNames,
    fetchDocuments,
    uploadPdfs,
    deletePdf,
    deletePdfs,
    setPdfIgnored,
    setBulkPdfIgnored,
    requestValidation,
    requestBulkValidation,
    requestBulkRemediation,
    maxUploadFiles: MAX_UPLOAD_FILES,
    maxFileSizeMb: 20
  }
}
