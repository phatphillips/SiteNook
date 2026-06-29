import type PocketBase from 'pocketbase'
import { deriveScanTypeFromRaw } from '../config/scanConfig.js'
import { planHasFeature } from '../config/planLimits.js'
import { queuePriorityForPlan } from '../config/planQueuePriority.js'
import {
  computeScheduleNextRunAt,
  getScheduleTimeFromConfig,
  getScheduleTimezoneFromConfig,
  getZonedParts,
  isSiteDue,
  parseScheduleTime,
  rawConfigForEnqueue,
  zonedTimeToUtc
} from './scheduleNextRun.js'

const ACTIVE_ORG_SITE_FILTER = "crawl_schedule != 'manual' && crawl_schedule != '' && organization.status != 'closing' && organization.subscription_status != 'canceled'"

export interface ScheduledSiteRecord {
  id: string
  crawl_schedule?: string
  schedule_next_run_at?: string
  default_scan_config?: Record<string, unknown>
  expand?: {
    organization?: {
      plan?: string
      subscription_status?: string
      status?: string
    }
  }
}

export async function isSiteBusy(pb: PocketBase, siteId: string): Promise<boolean> {
  try {
    const [queueActive, runningScans] = await Promise.all([
      pb.collection('scan_queue').getList(1, 1, {
        filter: `site = "${siteId}" && (status = 'pending' || status = 'processing')`
      }),
      pb.collection('scans').getList(1, 1, {
        filter: `site = "${siteId}" && status = 'running'`
      })
    ])
    return queueActive.items.length > 0 || runningScans.items.length > 0
  } catch (err) {
    console.warn(`Could not check busy state for site ${siteId}:`, err)
    return true
  }
}

export function buildScheduleFieldsAfterEnqueue(
  site: ScheduledSiteRecord,
  enqueuedAt: Date
): { schedule_last_enqueued_at: string, schedule_next_run_at: string | null } {
  const crawlSchedule = site.crawl_schedule || 'manual'
  const scheduleTime = getScheduleTimeFromConfig(site.default_scan_config)
  const timeZone = getScheduleTimezoneFromConfig(site.default_scan_config)
  const scheduleNextRunAt = computeScheduleNextRunAt(crawlSchedule, {
    scheduleTime,
    from: enqueuedAt,
    now: enqueuedAt,
    timeZone
  })
  return {
    schedule_last_enqueued_at: enqueuedAt.toISOString(),
    schedule_next_run_at: scheduleNextRunAt
  }
}

export async function enqueueScheduledScan(
  pb: PocketBase,
  site: ScheduledSiteRecord,
  enqueuedAt: Date = new Date(),
  priority = 0
): Promise<boolean> {
  const rawConfig = rawConfigForEnqueue(site.default_scan_config)
  const scanType = deriveScanTypeFromRaw(rawConfig)

  try {
    await pb.collection('scan_queue').create({
      site: site.id,
      scan_type: scanType,
      priority,
      status: 'pending',
      raw_config: rawConfig
    })
  } catch (err) {
    console.error(`Failed to enqueue scheduled scan for site ${site.id}:`, err)
    return false
  }

  const scheduleFields = buildScheduleFieldsAfterEnqueue(site, enqueuedAt)
  let scheduleUpdated = false
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await pb.collection('sites').update(site.id, scheduleFields)
      scheduleUpdated = true
      break
    } catch (err) {
      if (attempt === 3) {
        console.error(
          `Scheduled scan enqueued for site ${site.id} but failed to update schedule fields:`,
          err
        )
      }
      await new Promise(resolve => setTimeout(resolve, 250 * attempt))
    }
  }

  console.log(
    `Scheduled scan enqueued for site ${site.id} (next run: ${
      scheduleUpdated ? scheduleFields.schedule_next_run_at ?? 'none' : 'pending schedule update'
    })`
  )
  // Queue creation is the source of truth for scheduled work. Even if schedule fields fail to update,
  // returning true prevents duplicate enqueue attempts on subsequent ticks.
  return true
}

/** Set schedule_next_run_at when missing so null is not treated as "due immediately". */
export async function ensureSiteScheduleInitialized(
  pb: PocketBase,
  site: ScheduledSiteRecord,
  now: Date = new Date()
): Promise<ScheduledSiteRecord> {
  if (site.schedule_next_run_at || !site.crawl_schedule || site.crawl_schedule === 'manual') {
    return site
  }

  const scheduleTime = getScheduleTimeFromConfig(site.default_scan_config)
  const timeZone = getScheduleTimezoneFromConfig(site.default_scan_config)
  const next = computeScheduleNextRunAt(site.crawl_schedule, {
    scheduleTime,
    from: now,
    now,
    timeZone
  })
  if (!next) return site

  try {
    await pb.collection('sites').update(site.id, { schedule_next_run_at: next })
    return { ...site, schedule_next_run_at: next }
  } catch (err) {
    console.warn(`Could not initialize schedule for site ${site.id}:`, err)
    return site
  }
}

/**
 * Sites left "due" while the scanner was down should not auto-enqueue on startup.
 * Roll schedule_next_run_at forward from now instead (next daily slot, etc.).
 */
export async function pushOverdueScheduleForward(
  pb: PocketBase,
  site: ScheduledSiteRecord,
  now: Date = new Date()
): Promise<ScheduledSiteRecord> {
  if (!site.crawl_schedule || site.crawl_schedule === 'manual') return site
  if (!site.schedule_next_run_at) return site
  if (new Date(site.schedule_next_run_at).getTime() > now.getTime()) return site
  if (await isSiteBusy(pb, site.id)) return site

  const scheduleTime = getScheduleTimeFromConfig(site.default_scan_config)
  const timeZone = getScheduleTimezoneFromConfig(site.default_scan_config)
  const next = computeScheduleNextRunAt(site.crawl_schedule, {
    scheduleTime,
    from: now,
    now,
    timeZone
  })
  if (!next) return site

  try {
    await pb.collection('sites').update(site.id, { schedule_next_run_at: next })
    console.log(
      `Skipped stale scheduled enqueue for site ${site.id}; next run set to ${next}`
    )
    return { ...site, schedule_next_run_at: next }
  } catch (err) {
    console.warn(`Could not roll forward schedule for site ${site.id}:`, err)
    return site
  }
}

/** On worker boot: initialize missing schedules and clear stale "due now" without queueing. */
export async function reconcileSchedulesOnStartup(pb: PocketBase): Promise<void> {
  const now = new Date()
  let sites: ScheduledSiteRecord[]
  try {
    sites = await pb.collection('sites').getFullList({
      filter: ACTIVE_ORG_SITE_FILTER,
      expand: 'organization'
    }) as unknown as ScheduledSiteRecord[]
  } catch (err) {
    console.error('Schedule startup reconcile failed:', err)
    return
  }

  for (const rawSite of sites) {
    let site = await ensureSiteScheduleInitialized(pb, rawSite, now)
    site = await pushOverdueScheduleForward(pb, site, now)
  }
}

/** Skip scheduled enqueue when a full scan already completed in the current calendar day (site TZ). */
export async function hasFullScanCompletedToday(
  pb: PocketBase,
  siteId: string,
  timeZone: string,
  now: Date = new Date()
): Promise<boolean> {
  const parts = getZonedParts(now, timeZone)
  const startOfDay = zonedTimeToUtc(parts.year, parts.month, parts.day, 0, 0, timeZone)
  try {
    const result = await pb.collection('scans').getList(1, 1, {
      filter: [
        `site = "${siteId}"`,
        `scan_type = "full"`,
        `(status = "complete" || status = "complete_with_errors")`,
        `completed_at >= "${startOfDay.toISOString()}"`
      ].join(' && ')
    })
    return result.items.length > 0
  } catch (err) {
    console.warn(`Could not check today's full scans for site ${siteId}:`, err)
    return false
  }
}

export async function skipScheduledRunIfFullScanAlreadyRan(
  pb: PocketBase,
  site: ScheduledSiteRecord,
  now: Date = new Date()
): Promise<ScheduledSiteRecord> {
  if (!site.crawl_schedule || site.crawl_schedule === 'manual') return site
  if (site.crawl_schedule !== 'daily') return site

  const timeZone = getScheduleTimezoneFromConfig(site.default_scan_config)
  if (!(await hasFullScanCompletedToday(pb, site.id, timeZone, now))) return site

  const scheduleTime = getScheduleTimeFromConfig(site.default_scan_config)
  const { hour, minute } = parseScheduleTime(scheduleTime)
  const parts = getZonedParts(now, timeZone)
  const todaySlot = zonedTimeToUtc(parts.year, parts.month, parts.day, hour, minute, timeZone)
  const from = now < todaySlot ? todaySlot : now
  const next = computeScheduleNextRunAt(site.crawl_schedule, {
    scheduleTime,
    from,
    now,
    timeZone
  })
  if (!next || next === site.schedule_next_run_at) return site

  try {
    await pb.collection('sites').update(site.id, { schedule_next_run_at: next })
    console.log(
      `Skipped scheduled scan for site ${site.id}; full scan already ran today (next: ${next})`
    )
    return { ...site, schedule_next_run_at: next }
  } catch (err) {
    console.warn(`Could not skip scheduled run for site ${site.id}:`, err)
    return site
  }
}

export async function tickScheduler(pb: PocketBase): Promise<void> {
  const now = new Date()

  let sites: ScheduledSiteRecord[]
  try {
    sites = await pb.collection('sites').getFullList({
      filter: ACTIVE_ORG_SITE_FILTER,
      expand: 'organization'
    }) as unknown as ScheduledSiteRecord[]
  } catch (err) {
    console.error('Scheduler could not load sites:', err)
    return
  }

  for (const rawSite of sites) {
    const orgPlan = rawSite.expand?.organization?.plan
    if (orgPlan && !planHasFeature(orgPlan, 'scheduledScans')) continue

    let site = await ensureSiteScheduleInitialized(pb, rawSite, now)
    if (!isSiteDue(site.crawl_schedule, site.schedule_next_run_at, now)) continue
    site = await skipScheduledRunIfFullScanAlreadyRan(pb, site, now)
    if (!isSiteDue(site.crawl_schedule, site.schedule_next_run_at, now)) continue
    if (await isSiteBusy(pb, site.id)) continue
    await enqueueScheduledScan(pb, site, now, queuePriorityForPlan(orgPlan))
  }
}

export function startSchedulerLoop(pb: PocketBase): void {
  const tickMs = Number(process.env.SCHEDULER_TICK_MS || 60000)

  async function loop() {
    try {
      await tickScheduler(pb)
    } catch (err) {
      console.error('Scheduler tick error:', err)
    }
    setTimeout(loop, tickMs)
  }

  console.log(`Scheduler started (tick every ${tickMs}ms, per-site timezone from config)`)
  // Defer first enqueue tick so startup reconcile finishes first.
  setTimeout(loop, tickMs)
}
