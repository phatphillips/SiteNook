import { randomBytes } from 'node:crypto'
import type PocketBase from 'pocketbase'
import {
  getPocketBase,
  isPocketBaseConnectionError,
  resetPocketBaseClient
} from '../db/pocketbaseClient.js'
import {
  computeScheduleNextRunAt,
  type ComputeNextRunOptions
} from './scheduleNextRun.js'

export type ReportScheduleCadence = 'once' | 'daily' | 'weekly' | 'monthly' | 'every_5d'

export const REPORT_SHARE_TTL_DAYS = 30

export interface ReportScheduleRecord {
  id: string
  org: string
  site?: string
  name: string
  format: 'pdf' | 'csv'
  include_all_sites?: boolean
  sections?: unknown
  cadence: ReportScheduleCadence
  run_at?: string
  schedule_time?: string
  timezone?: string
  next_run_at?: string
  last_run_at?: string
  recipient_ids?: string[] | string
  enabled?: boolean
  last_job?: string
  created_by?: string
}

export function generateReportShareToken(): string {
  return randomBytes(24).toString('hex')
}

export function computeShareExpiresAt(
  from: Date = new Date(),
  ttlDays = REPORT_SHARE_TTL_DAYS
): string {
  return new Date(from.getTime() + ttlDays * 86_400_000).toISOString()
}

export function isReportScheduleDue(
  enabled: boolean | undefined,
  nextRunAt: string | undefined | null,
  now: Date = new Date()
): boolean {
  if (!enabled) return false
  if (!nextRunAt) return false
  return new Date(nextRunAt).getTime() <= now.getTime()
}

export function computeReportScheduleAfterRun(
  cadence: ReportScheduleCadence,
  options: ComputeNextRunOptions = {}
): { next_run_at: string | null, enabled: boolean } {
  if (cadence === 'once') {
    return { next_run_at: null, enabled: false }
  }

  const next = computeScheduleNextRunAt(cadence, {
    scheduleTime: options.scheduleTime ?? '09:00',
    from: options.from ?? options.now ?? new Date(),
    now: options.now ?? new Date(),
    timeZone: options.timeZone ?? 'UTC'
  })
  return { next_run_at: next, enabled: true }
}

export async function listDueReportSchedules(
  pb: PocketBase,
  now: Date = new Date()
): Promise<ReportScheduleRecord[]> {
  const rows = await pb.collection('report_schedules').getFullList({
    filter: 'enabled = true && next_run_at != ""',
    sort: 'next_run_at'
  }) as unknown as ReportScheduleRecord[]
  return rows.filter(schedule => isReportScheduleDue(schedule.enabled, schedule.next_run_at, now))
}

export async function enqueueReportFromSchedule(
  pb: PocketBase,
  schedule: ReportScheduleRecord,
  enqueuedAt: Date = new Date()
): Promise<string | null> {
  const shareToken = generateReportShareToken()
  try {
    const job = await pb.collection('report_jobs').create({
      org: schedule.org,
      site: schedule.site || undefined,
      requested_by: schedule.created_by || undefined,
      schedule: schedule.id,
      format: schedule.format,
      include_all_sites: schedule.include_all_sites !== false,
      sections: schedule.sections,
      status: 'pending',
      progress: 0,
      progress_label: 'Queued',
      share_token: shareToken,
      share_expires_at: computeShareExpiresAt(enqueuedAt)
    })

    const after = computeReportScheduleAfterRun(schedule.cadence, {
      scheduleTime: schedule.schedule_time || '09:00',
      timeZone: schedule.timezone || 'UTC',
      from: enqueuedAt,
      now: enqueuedAt
    })

    await pb.collection('report_schedules').update(schedule.id, {
      last_job: job.id,
      last_run_at: enqueuedAt.toISOString(),
      next_run_at: after.next_run_at,
      enabled: after.enabled
    })

    console.log(
      `Scheduled report enqueued for schedule ${schedule.id} → job ${job.id}` +
      (after.enabled ? ` (next: ${after.next_run_at})` : ' (one-time complete)')
    )
    return job.id
  } catch (err) {
    console.error(`Failed to enqueue scheduled report ${schedule.id}:`, err)
    return null
  }
}

export async function tickReportSchedules(pb: PocketBase): Promise<void> {
  const now = new Date()
  let schedules: ReportScheduleRecord[]
  try {
    schedules = await listDueReportSchedules(pb, now)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('Missing collection') || message.includes("wasn't found")) {
      return
    }
    if (isPocketBaseConnectionError(err)) {
      resetPocketBaseClient()
      console.warn('Report schedule tick: PocketBase connection lost')
      return
    }
    console.error('Report schedule tick could not load schedules:', err)
    return
  }

  for (const schedule of schedules) {
    if (!isReportScheduleDue(schedule.enabled, schedule.next_run_at, now)) continue
    await enqueueReportFromSchedule(pb, schedule, now)
  }
}

export function startReportScheduleLoop(_pb?: PocketBase): void {
  const tickMs = Number(process.env.REPORT_SCHEDULER_TICK_MS || process.env.SCHEDULER_TICK_MS || 60000)

  async function loop() {
    try {
      await tickReportSchedules(getPocketBase())
    } catch (err) {
      if (isPocketBaseConnectionError(err)) {
        resetPocketBaseClient()
        console.warn('Report schedule tick: PocketBase connection lost')
      } else {
        console.error('Report schedule tick error:', err)
      }
    }
    setTimeout(loop, tickMs)
  }

  console.log(`Report schedule loop started (tick every ${tickMs}ms)`)
  setTimeout(loop, tickMs)
}

export async function notifyReportReadyEmail(
  pb: PocketBase,
  jobId: string
): Promise<number> {
  const token = pb.authStore.token
  if (!token) {
    console.warn('[reportNotify] PocketBase admin token missing')
    return 0
  }

  const pbUrl = (process.env.POCKETBASE_URL || 'http://localhost:8090').replace(/\/$/, '')
  try {
    const response = await fetch(`${pbUrl}/api/sitenook/notify-report-ready`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ jobId })
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.warn('[reportNotify] notify failed:', response.status, text)
      return 0
    }
    const payload = await response.json().catch(() => ({})) as { sent?: number }
    return Number(payload.sent ?? 0)
  } catch (err) {
    console.warn('[reportNotify] notify error:', err)
    return 0
  }
}
