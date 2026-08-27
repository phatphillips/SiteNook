import type { ReportFormat, ReportJobListResponse, ReportJobRecord, ReportSectionSelection } from '~/types/reports'
import { orgApiFetch } from '~/utils/orgApiFetch'

export interface CreateReportJobPayload {
  format: ReportFormat
  siteId?: string
  includeAllSites: boolean
  sections: ReportSectionSelection
}

export function useReportJobs() {
  const jobs = ref<ReportJobRecord[]>([])
  const loading = ref(false)
  const total = ref(0)
  const page = ref(1)
  const perPage = ref(20)
  const search = ref('')
  const createLoading = ref(false)
  const downloadingJobId = ref<string | null>(null)
  const deleting = ref(false)

  async function fetchJobs(options: { silent?: boolean } = {}) {
    if (!options.silent) loading.value = true
    try {
      const result = await orgApiFetch<ReportJobListResponse>('/api/reports/jobs', {
        page: page.value,
        perPage: perPage.value,
        q: search.value.trim() || undefined
      })
      jobs.value = result.items
      total.value = result.total
      page.value = result.page
      perPage.value = result.perPage
    } finally {
      if (!options.silent) loading.value = false
    }
  }

  async function createJob(payload: CreateReportJobPayload): Promise<ReportJobRecord> {
    createLoading.value = true
    try {
      return await orgApiFetch<ReportJobRecord>('/api/reports/jobs', undefined, {
        method: 'POST',
        body: payload
      })
    } finally {
      createLoading.value = false
    }
  }

  async function getJob(jobId: string): Promise<ReportJobRecord> {
    return await orgApiFetch<ReportJobRecord>(`/api/reports/jobs/${jobId}`)
  }

  async function downloadJob(jobId: string): Promise<void> {
    if (downloadingJobId.value) return
    downloadingJobId.value = jobId
    try {
      const { pb, awaitAuthReady } = usePocketBase()
      await awaitAuthReady()
      if (!pb) throw new Error('PocketBase client unavailable')
      const token = pb.authStore.token
      if (!token) throw new Error('Authentication required')
      const blob = await $fetch.raw(`/api/reports/jobs/${jobId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      })
      const contentType = blob.headers.get('content-type') || 'application/octet-stream'
      const disposition = blob.headers.get('content-disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/i)
      const filename = match?.[1] || `report-${jobId}`
      const fileBlob = new Blob([blob._data as BlobPart], { type: contentType })
      const url = URL.createObjectURL(fileBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } finally {
      downloadingJobId.value = null
    }
  }

  async function deleteJobs(ids: string[]): Promise<number> {
    const uniqueIds = [...new Set(ids.map(id => String(id || '').trim()).filter(Boolean))]
    if (!uniqueIds.length) return 0
    deleting.value = true
    try {
      const result = await orgApiFetch<{ ok: boolean, deleted: number }>('/api/reports/jobs/delete', undefined, {
        method: 'POST',
        body: { ids: uniqueIds }
      })
      const idSet = new Set(uniqueIds)
      jobs.value = jobs.value.filter(job => !idSet.has(job.id))
      total.value = Math.max(0, total.value - (result.deleted || uniqueIds.length))
      return result.deleted || uniqueIds.length
    } finally {
      deleting.value = false
    }
  }

  return {
    jobs,
    loading,
    total,
    page,
    perPage,
    search,
    createLoading,
    downloadingJobId,
    deleting,
    fetchJobs,
    createJob,
    getJob,
    downloadJob,
    deleteJobs
  }
}
