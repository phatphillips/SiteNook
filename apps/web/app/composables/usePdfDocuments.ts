import type { PdfDocument, PdfIssue, PdfRemediation } from '~/types/sitenook'

import { pbAnd, pbRelation, pbSelect } from '~/utils/pbFilter'

import { createDebouncedReload } from '~/utils/reloadScheduler'

import { downloadCsv } from '~/utils/csvExport'
import { buildPdfDocumentsCsv } from '~/utils/pdfExport'
import { buildPdfIssuesCsv } from '~/utils/pdfRemediationExport'

const MAX_UPLOAD_FILES = 10

const MAX_FILE_BYTES = 20 * 1024 * 1024

function pocketBaseErrorMessage(error: unknown): string {

  if (error && typeof error === 'object' && 'message' in error) {

    return String((error as { message: string }).message)

  }

  return 'PDF operation failed'

}

function generateShareToken(): string {

  if (typeof crypto !== 'undefined' && crypto.randomUUID) {

    return crypto.randomUUID().replace(/-/g, '')

  }

  return `${Date.now()}_${Math.random().toString(36).slice(2)}`

}

export function usePdfDocuments(siteId: Ref<string> | string) {

  const { pb } = usePocketBase()

  const id = computed(() => (typeof siteId === 'object' ? siteId.value : siteId))

  const uploadDocuments = ref<PdfDocument[]>([])

  const crawlDocuments = ref<PdfDocument[]>([])

  const loading = ref(false)

  const uploading = ref(false)

  const error = ref('')

  let unsubscribe: (() => void) | null = null

  async function fetchUploadDocuments(options?: { silent?: boolean }) {

    if (!id.value || !pb) return

    if (!options?.silent) loading.value = true

    error.value = ''

    try {

      uploadDocuments.value = await pb.collection('pdf_documents').getFullList({

        filter: pbAnd([pbRelation('site', id.value), pbSelect('source', 'upload')]),

        sort: '-validated_at,-id'

      }) as unknown as PdfDocument[]

    } catch (err) {

      const message = pocketBaseErrorMessage(err)

      if (message.includes('Missing collection') || message.includes('wasn\'t found')) {

        error.value = 'PDF collections are not available yet. Restart PocketBase to apply migrations.'

      } else if (!options?.silent) {

        error.value = message

      }

    }

  }

  async function fetchCrawlDocuments(options?: { silent?: boolean }) {

    if (!id.value || !pb) return

    if (!options?.silent) loading.value = true

    error.value = ''

    try {

      crawlDocuments.value = await pb.collection('pdf_documents').getFullList({

        filter: pbAnd([pbRelation('site', id.value), pbSelect('source', 'crawl')]),

        sort: '-validated_at,-id'

      }) as unknown as PdfDocument[]

    } catch (err) {

      const message = pocketBaseErrorMessage(err)

      if (message.includes('Missing collection') || message.includes('wasn\'t found')) {

        error.value = 'PDF collections are not available yet. Restart PocketBase to apply migrations.'

      } else if (!options?.silent) {

        error.value = message

      }

    }

  }

  async function fetchDocuments(options?: { silent?: boolean }) {

    if (!options?.silent) loading.value = true

    error.value = ''

    try {

      await Promise.all([

        fetchUploadDocuments({ silent: true }),

        fetchCrawlDocuments({ silent: true })

      ])

    } finally {

      if (!options?.silent) loading.value = false

    }

  }

  const debouncedReload = createDebouncedReload(() => fetchDocuments({ silent: true }))

  let subscribeGeneration = 0

  function teardownSubscribe() {

    if (typeof unsubscribe === 'function') {

      unsubscribe()

    }

    unsubscribe = null

    debouncedReload.cancel()

  }

  async function subscribe() {

    if (!import.meta.client || !pb) return

    const generation = ++subscribeGeneration

    teardownSubscribe()

    try {

      const unsub = await pb.collection('pdf_documents').subscribe('*', (event) => {

        const record = event.record as unknown as PdfDocument

        if (record.source === 'upload') {

          debouncedReload.schedule()

          return

        }

        if (record.site === id.value) {

          debouncedReload.schedule()

        }

      })

      if (generation !== subscribeGeneration) {

        unsub()

        return

      }

      unsubscribe = unsub

    } catch {

      // Realtime optional when collection is unavailable.

    }

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

  async function uploadPdfs(files: File[]) {

    const validationError = validateUploadFiles(files)

    if (validationError) {

      error.value = validationError

      return

    }

    if (!pb) {

      error.value = 'Session not ready. Please refresh the page.'

      return

    }

    uploading.value = true

    error.value = ''

    try {

      const userId = pb.authStore.record?.id

      for (const file of files) {

        const formData = new FormData()

        formData.append('site', id.value)

        formData.append('source', 'upload')

        formData.append('file', file)

        formData.append('filename', file.name)

        formData.append('status', 'pending')

        formData.append('share_token', generateShareToken())

        if (userId) formData.append('uploaded_by', userId)

        const orgId = typeof pb.authStore.record?.organization === 'string'
          ? pb.authStore.record.organization
          : ''
        if (orgId) formData.append('organization', orgId)

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

    await pb.collection('pdf_documents').delete(documentId)

    uploadDocuments.value = uploadDocuments.value.filter(doc => doc.id !== documentId)

    crawlDocuments.value = crawlDocuments.value.filter(doc => doc.id !== documentId)

  }

  function patchLocalDocument(documentId: string, patch: Partial<PdfDocument>) {
    const apply = (list: typeof uploadDocuments) => {
      const idx = list.value.findIndex(doc => doc.id === documentId)
      if (idx >= 0) list.value[idx] = { ...list.value[idx], ...patch }
    }
    apply(uploadDocuments)
    apply(crawlDocuments)
  }

  async function setPdfIgnored(documentId: string, ignored: boolean) {
    if (!pb) return
    const payload: Record<string, unknown> = {
      ignored,
      ignored_at: ignored ? new Date().toISOString() : null
    }
    await pb.collection('pdf_documents').update(documentId, payload)
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

  async function deletePdfs(documentIds: string[]) {
    for (const documentId of documentIds) {
      await deletePdf(documentId)
    }
  }

  async function requestValidation(documentId: string, priority = 10) {

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

  async function fetchIssues(documentId: string): Promise<PdfIssue[]> {

    return await pb.collection('pdf_issues').getFullList({

      filter: pbRelation('pdf_document', documentId),

      sort: 'category,severity'

    }) as unknown as PdfIssue[]

  }

  async function fetchDocument(documentId: string): Promise<PdfDocument | null> {

    try {

      return await pb.collection('pdf_documents').getOne(documentId) as unknown as PdfDocument

    } catch {

      return null

    }

  }

  function getFileUrl(doc: PdfDocument): string | null {

    if (!doc.file && !doc.url) return null

    return `/api/pdf-documents/${doc.id}/file`

  }

  function buildShareUrl(token: string): string {

    const config = useRuntimeConfig()

    const base = config.public.appUrl || (import.meta.client ? window.location.origin : '')

    return `${base.replace(/\/$/, '')}/pdf-report/${token}`

  }

  async function copyShareLink(token: string) {

    const url = buildShareUrl(token)

    await navigator.clipboard.writeText(url)

    return url

  }

  function exportCsv(rows?: PdfDocument[]) {

    const content = buildPdfDocumentsCsv(rows ?? [...uploadDocuments.value, ...crawlDocuments.value])

    downloadCsv(`pdf-documents-${id.value}.csv`, content)

  }

  async function fetchRemediation(remediationId: string): Promise<PdfRemediation | null> {
    if (!pb || !remediationId) return null
    try {
      return await pb.collection('pdf_remediations').getOne(remediationId) as unknown as PdfRemediation
    } catch {
      return null
    }
  }

  async function fetchLatestRemediation(documentId: string): Promise<PdfRemediation | null> {
    if (!pb) return null
    try {
      const doc = await pb.collection('pdf_documents').getOne(documentId) as unknown as PdfDocument
      if (doc.latest_remediation_id) {
        try {
          return await pb.collection('pdf_remediations').getOne(doc.latest_remediation_id) as unknown as PdfRemediation
        } catch {
          // Fall through to list query.
        }
      }
      const list = await pb.collection('pdf_remediations').getList(1, 1, {
        filter: pbRelation('pdf_document', documentId),
        // Prefer -created when autodate exists; -id always works.
        sort: '-id'
      })
      return (list.items[0] as unknown as PdfRemediation) || null
    } catch {
      return null
    }
  }

  async function requestStructure(documentId: string, priority = 5) {
    if (!pb) return
    await pb.collection('pdf_documents').update(documentId, {
      structure_status: 'pending',
      structure_error: ''
    })
    await pb.collection('pdf_remediation_queue').create({
      pdf_document: documentId,
      job_type: 'structure',
      status: 'pending',
      priority
    })
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
    return remediation as unknown as PdfRemediation
  }

  async function requestBulkRemediation(documentIds: string[]) {
    for (const documentId of documentIds) {
      await requestRemediation(documentId, id.value, 5)
    }
  }

  function getSuggestedFileUrl(remediationId: string): string {
    return `/api/pdf-remediations/${remediationId}/file`
  }

  function getStructureArtifactUrl(
    documentId: string,
    field: 'structure_json' | 'structure_html' | 'structure_markdown'
  ): string {
    return `/api/pdf-documents/${documentId}/structure?field=${field}`
  }

  function getRemediationPackUrl(documentId: string): string {
    return `/api/pdf-documents/${documentId}/remediation-pack`
  }

  async function fetchAuthedBlob(url: string): Promise<Blob> {
    const token = pb?.authStore.token
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`)
    }
    return await response.blob()
  }

  async function downloadAuthed(url: string, filename: string) {
    const blob = await fetchAuthedBlob(url)
    const objectUrl = URL.createObjectURL(blob)
    const a = globalThis.document.createElement('a')
    a.href = objectUrl
    a.download = filename
    a.click()
    URL.revokeObjectURL(objectUrl)
  }

  async function loadStructureTexts(doc: PdfDocument): Promise<{ html: string, json: string, markdown: string }> {
    const empty = { html: '', json: '', markdown: '' }
    if (!doc.id || doc.structure_status !== 'complete') return empty
    try {
      const [html, json, markdown] = await Promise.all([
        doc.structure_html
          ? fetchAuthedBlob(getStructureArtifactUrl(doc.id, 'structure_html')).then(b => b.text())
          : Promise.resolve(''),
        doc.structure_json
          ? fetchAuthedBlob(getStructureArtifactUrl(doc.id, 'structure_json')).then(b => b.text())
          : Promise.resolve(''),
        doc.structure_markdown
          ? fetchAuthedBlob(getStructureArtifactUrl(doc.id, 'structure_markdown')).then(b => b.text())
          : Promise.resolve('')
      ])
      return { html, json, markdown }
    } catch {
      return empty
    }
  }

  function exportIssuesCsv(issues: PdfIssue[], documentRow?: PdfDocument | null) {
    const content = buildPdfIssuesCsv(issues, documentRow)
    downloadCsv(`pdf-issues-${documentRow?.id || id.value}.csv`, content)
  }

  async function cacheCrawlPdf(documentId: string): Promise<{ alreadyStored: boolean }> {
    if (!pb?.authStore?.token) {
      throw new Error('Sign in again to store this PDF for preview.')
    }
    const response = await fetch(`/api/pdf-documents/${documentId}/cache-file`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pb.authStore.token}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    })
    if (!response.ok) {
      let detail = ''
      try {
        const body = await response.json() as { statusMessage?: string, message?: string }
        detail = body.statusMessage || body.message || ''
      } catch {
        // ignore
      }
      throw new Error(detail || `Could not store PDF (${response.status})`)
    }
    return await response.json() as { alreadyStored: boolean }
  }

  onMounted(async () => {

    await fetchDocuments()

    await subscribe()

  })

  onUnmounted(() => {

    subscribeGeneration += 1

    teardownSubscribe()

  })

  watch(id, async () => {

    subscribeGeneration += 1

    teardownSubscribe()

    await fetchDocuments()

    await subscribe()

  })

  return {

    uploadDocuments,

    crawlDocuments,

    loading,

    uploading,

    error,

    fetchDocuments,

    uploadPdfs,

    deletePdf,

    deletePdfs,

    setPdfIgnored,

    setBulkPdfIgnored,

    requestValidation,

    requestBulkValidation,

    fetchIssues,

    fetchDocument,

    getFileUrl,

    buildShareUrl,

    copyShareLink,

    exportCsv,
    fetchRemediation,
    fetchLatestRemediation,
    requestStructure,
    requestRemediation,
    requestBulkRemediation,
    getSuggestedFileUrl,
    getStructureArtifactUrl,
    getRemediationPackUrl,
    downloadAuthed,
    loadStructureTexts,
    exportIssuesCsv,
    cacheCrawlPdf,
    maxUploadFiles: MAX_UPLOAD_FILES,

    maxFileBytes: MAX_FILE_BYTES,

    maxFileSizeMb: 20

  }

}

