import type { PdfDocument, PdfIssue } from '~/types/accessiq'

import { pbAnd, pbRelation, pbSelect } from '~/utils/pbFilter'

import { createDebouncedReload } from '~/utils/reloadScheduler'

import { downloadCsv, buildPdfDocumentsCsv } from '~/utils/pdfExport'



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

    if (!pb) return

    if (!options?.silent) loading.value = true

    error.value = ''

    try {

      uploadDocuments.value = await pb.collection('pdf_documents').getFullList({

        filter: pbSelect('source', 'upload'),

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

    requestValidation,

    requestBulkValidation,

    fetchIssues,

    fetchDocument,

    getFileUrl,

    buildShareUrl,

    copyShareLink,

    exportCsv,

    maxUploadFiles: MAX_UPLOAD_FILES,

    maxFileBytes: MAX_FILE_BYTES,

    maxFileSizeMb: 20

  }

}

