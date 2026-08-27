export type ReportFormat = 'pdf' | 'csv'
export type ReportStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'cancelled'
export type ReportScheduleCadence = 'once' | 'daily' | 'weekly' | 'monthly' | 'every_5d'

export interface ReportOverviewSectionSelection {
  accessibility: boolean
  qa: boolean
  seo: boolean
  orgSummary: boolean
}

export interface ReportSectionSelection {
  options?: {
    tableOfContents?: boolean
  }
  overview: ReportOverviewSectionSelection
  accessibility: {
    pages: boolean
    issues: boolean
    readability: boolean
    pdfs: boolean
  }
  qa: {
    brokenLinks: boolean
    spelling: boolean
    inventory: boolean
  }
  seo: {
    technical: boolean
    content: boolean
    preview: boolean
  }
}

export interface ReportJobRecord {
  id: string
  org: string
  site?: string
  requested_by?: string
  schedule?: string
  share_token?: string
  share_expires_at?: string
  format: ReportFormat
  status: ReportStatus
  sections: ReportSectionSelection
  include_all_sites?: boolean
  progress?: number
  progress_label?: string
  error_message?: string
  artifact?: string
  artifact_name?: string
  artifact_size_bytes?: number
  artifact_page_count?: number
  started_at?: string
  completed_at?: string
  latest_scan_at?: string
  created: string
  updated: string
  expand?: {
    site?: { id: string, name: string }
    requested_by?: { id: string, name?: string, email?: string }
    schedule?: { id: string, name?: string }
  }
}

export interface ReportJobListResponse {
  items: ReportJobRecord[]
  total: number
  page: number
  perPage: number
}

export interface ReportScheduleRecord {
  id: string
  org: string
  site?: string
  created_by?: string
  name: string
  format: ReportFormat
  include_all_sites?: boolean
  sections: ReportSectionSelection
  cadence: ReportScheduleCadence
  run_at?: string
  schedule_time?: string
  timezone?: string
  next_run_at?: string
  last_run_at?: string
  recipient_ids: string[]
  enabled: boolean
  last_job?: string
  created: string
  updated: string
  expand?: {
    site?: { id: string, name: string }
    created_by?: { id: string, name?: string, email?: string }
    last_job?: { id: string, status?: string, artifact_name?: string }
  }
}

export interface ReportScheduleListResponse {
  items: ReportScheduleRecord[]
  total: number
  page: number
  perPage: number
}

export interface CreateReportSchedulePayload {
  name: string
  format: ReportFormat
  siteId?: string
  includeAllSites: boolean
  sections: ReportSectionSelection
  cadence: ReportScheduleCadence
  runAt?: string
  scheduleTime?: string
  timezone?: string
  recipientIds: string[]
  enabled?: boolean
}

export type UpdateReportSchedulePayload = Partial<CreateReportSchedulePayload> & {
  enabled?: boolean
}
