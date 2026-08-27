import type {
  CreateReportSchedulePayload,
  ReportScheduleListResponse,
  ReportScheduleRecord,
  UpdateReportSchedulePayload
} from '~/types/reports'
import { orgApiFetch } from '~/utils/orgApiFetch'

export function useReportSchedules() {
  const schedules = ref<ReportScheduleRecord[]>([])
  const loading = ref(false)
  const total = ref(0)
  const page = ref(1)
  const perPage = ref(20)
  const search = ref('')
  const saving = ref(false)
  const deletingId = ref<string | null>(null)
  const runningId = ref<string | null>(null)

  async function fetchSchedules(options: { silent?: boolean } = {}) {
    if (!options.silent) loading.value = true
    try {
      const result = await orgApiFetch<ReportScheduleListResponse>('/api/reports/schedules', {
        page: page.value,
        perPage: perPage.value,
        q: search.value.trim() || undefined
      })
      schedules.value = result.items
      total.value = result.total
      page.value = result.page
      perPage.value = result.perPage
    } finally {
      if (!options.silent) loading.value = false
    }
  }

  async function createSchedule(payload: CreateReportSchedulePayload): Promise<ReportScheduleRecord> {
    saving.value = true
    try {
      return await orgApiFetch<ReportScheduleRecord>('/api/reports/schedules', undefined, {
        method: 'POST',
        body: payload
      })
    } finally {
      saving.value = false
    }
  }

  async function updateSchedule(
    id: string,
    payload: UpdateReportSchedulePayload
  ): Promise<ReportScheduleRecord> {
    saving.value = true
    try {
      return await orgApiFetch<ReportScheduleRecord>(`/api/reports/schedules/${id}`, undefined, {
        method: 'PATCH',
        body: payload
      })
    } finally {
      saving.value = false
    }
  }

  async function deleteSchedule(id: string): Promise<void> {
    deletingId.value = id
    try {
      await orgApiFetch<{ ok: boolean }>(`/api/reports/schedules/${id}`, undefined, {
        method: 'DELETE'
      })
      schedules.value = schedules.value.filter(item => item.id !== id)
      total.value = Math.max(0, total.value - 1)
    } finally {
      deletingId.value = null
    }
  }

  async function setEnabled(id: string, enabled: boolean): Promise<ReportScheduleRecord> {
    return updateSchedule(id, { enabled })
  }

  async function runNow(id: string): Promise<unknown> {
    runningId.value = id
    try {
      return await orgApiFetch(`/api/reports/schedules/${id}/run`, undefined, {
        method: 'POST'
      })
    } finally {
      runningId.value = null
    }
  }

  return {
    schedules,
    loading,
    total,
    page,
    perPage,
    search,
    saving,
    deletingId,
    runningId,
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    setEnabled,
    runNow
  }
}
