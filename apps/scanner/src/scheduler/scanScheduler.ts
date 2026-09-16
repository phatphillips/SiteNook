import type PocketBase from 'pocketbase'
import { deriveScanTypeFromRaw } from '../config/scanConfig.js'
import { queuePriorityForPlan } from '../config/planQueuePriority.js'
import { isCommercialEnabled } from '../config/commercial.js'
import { getPocketBase, isPocketBaseConnectionError, resetPocketBaseClient } from '../db/pocketbaseClient.js'
import {
  computeScheduleNextRunAt,
  getScheduleTimeFromConfig,
  getScheduleTimezoneFromConfig,
  isSiteDue,
  latestScanActivityMs,
  MIN_SCAN_GAP_MS,
  rawConfigForEnqueue
} from './scheduleNextRun.js'

const ACTIVE_ORG_SITE_FILTER = isCommercialEnabled()
  ? "crawl_schedule != 'manual' && crawl_schedule != '' && organization.status != 'closing' && organization.subscription_status != 'canceled'"
  : "crawl_schedule != 'manual' && crawl_schedule != '' && organization.status != 'closing'"

export const VERIFICATION_DELAY_MS = 24 * 60 * 60 * 1000

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
    const [queueActive, activeScans] = await Promise.all([
      pb.collection('scan_queue').getList(1, 1, {
        filter: `site = "${siteId}" && (status = 'pending' || status = 'processing')`
      }),
      pb.collection('scans').getList(1, 1, {
        filter: `site = "${siteId}" && (status = 'running' || status = 'background_scan')`
      })
    ])
    return queueActive.items.length > 0 || activeScans.items.length > 0
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

/** Queue a one-off rescan without advancing the regular crawl schedule. */
export async function enqueueOneOffScan(
  pb: PocketBase,
  site: ScheduledSiteRecord,
  priority = 0
): Promise<boolean> {
  const rawConfig = {
    ...rawConfigForEnqueue(site.default_scan_config),
    verification: true
  }
  const scanType = deriveScanTypeFromRaw(rawConfig)

  try {
    await pb.collection('scan_queue').create({
      site: site.id,
      scan_type: scanType,
      priority,
      status: 'pending',
      raw_config: rawConfig
    })
    return true
  } catch (err) {
    console.error(`Failed to enqueue verification scan for site ${site.id}:`, err)
    return false
  }
}

/**
 * After a poor-quality crawl, schedule one verification in ~24h unless the
 * regular schedule already fires sooner.
 */
export async function scheduleVerificationScan(
  pb: PocketBase,
  siteId: string,
  now: Date = new Date()
): Promise<void> {
  try {
    const site = await pb.collection('sites').getOne(siteId, {
      fields: 'id,verification_due_at,schedule_next_run_at,crawl_schedule,default_scan_config'
    }) as ScheduledSiteRecord & { verification_due_at?: string }

    if (site.verification_due_at) return
    if (await isSiteBusy(pb, siteId)) return

    const dueMs = now.getTime() + VERIFICATION_DELAY_MS
    const nextScheduled = site.schedule_next_run_at
      ? Date.parse(site.schedule_next_run_at)
      : NaN
    if (
      site.crawl_schedule
      && site.crawl_schedule !== 'manual'
      && Number.isFinite(nextScheduled)
      && nextScheduled <= dueMs
    ) {
      return
    }

    await pb.collection('sites').update(siteId, {
      verification_due_at: new Date(dueMs).toISOString()
    })
    console.log(`Verification scan scheduled for site ${siteId} at ${new Date(dueMs).toISOString()}`)
  } catch (err) {
    console.warn(`Could not schedule verification for site ${siteId}:`, err)
  }
}

export async function tickVerificationScans(pb: PocketBase, now: Date = new Date()): Promise<void> {
  let due: Array<ScheduledSiteRecord & { verification_due_at?: string }>
  try {
    due = await pb.collection('sites').getFullList({
      filter: `verification_due_at != null && verification_due_at <= "${now.toISOString()}"`,
      expand: 'organization'
    }) as Array<ScheduledSiteRecord & { verification_due_at?: string }>
  } catch (err) {
    console.warn('Verification tick could not load sites:', err)
    return
  }

  for (const site of due) {
    if (await isSiteBusy(pb, site.id)) continue
    const orgPlan = site.expand?.organization?.plan
    const enqueued = await enqueueOneOffScan(pb, site, queuePriorityForPlan(orgPlan))
    if (enqueued) {
      try {
        await pb.collection('sites').update(site.id, { verification_due_at: null })
      } catch (err) {
        console.warn(`Enqueued verification for ${site.id} but failed to clear verification_due_at:`, err)
      }
    }
  }
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

/** Skip scheduled enqueue when a scan started or finished within the minimum gap window. */
export async function skipScheduledRunIfWithinMinGap(
  pb: PocketBase,
  site: ScheduledSiteRecord,
  now: Date = new Date()
): Promise<ScheduledSiteRecord> {
  if (!site.crawl_schedule || site.crawl_schedule === 'manual') return site

  let latestScan: { started_at?: string, completed_at?: string, created?: string } | undefined
  try {
    const result = await pb.collection('scans').getList(1, 1, {
      filter: `site = "${site.id}"`,
      sort: '-started_at'
    })
    latestScan = result.items[0] as typeof latestScan
  } catch (err) {
    console.warn(`Could not load latest scan for site ${site.id}:`, err)
    return site
  }

  if (!latestScan) return site

  const activityMs = latestScanActivityMs(latestScan)
  if (!activityMs) return site

  const gapEndMs = activityMs + MIN_SCAN_GAP_MS
  if (now.getTime() >= gapEndMs) return site

  const next = new Date(gapEndMs).toISOString()
  if (!next || next === site.schedule_next_run_at) return site

  try {
    await pb.collection('sites').update(site.id, { schedule_next_run_at: next })
    console.log(
      `Skipped scheduled scan for site ${site.id}; last activity within ${MIN_SCAN_GAP_MS / 60000}m (next: ${next})`
    )
    return { ...site, schedule_next_run_at: next }
  } catch (err) {
    console.warn(`Could not skip scheduled run for site ${site.id}:`, err)
    return site
  }
}

export async function tickScheduler(pb: PocketBase): Promise<void> {
  const now = new Date()
  await tickVerificationScans(pb, now)

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

    let site = await ensureSiteScheduleInitialized(pb, rawSite, now)
    if (!isSiteDue(site.crawl_schedule, site.schedule_next_run_at, now)) continue
    site = await skipScheduledRunIfWithinMinGap(pb, site, now)
    if (!isSiteDue(site.crawl_schedule, site.schedule_next_run_at, now)) continue
    if (await isSiteBusy(pb, site.id)) continue
    await enqueueScheduledScan(pb, site, now, queuePriorityForPlan(orgPlan))
  }
}

export function startSchedulerLoop(_pb?: PocketBase): void {
  const tickMs = Number(process.env.SCHEDULER_TICK_MS || 60000)

  async function loop() {
    try {
      await tickScheduler(getPocketBase())
    } catch (err) {
      if (isPocketBaseConnectionError(err)) {
        resetPocketBaseClient()
        console.warn('Scheduler tick: PocketBase connection lost')
      } else {
        console.error('Scheduler tick error:', err)
      }
    }
    setTimeout(loop, tickMs)
  }

  console.log(`Scheduler started (tick every ${tickMs}ms, per-site timezone from config)`)
  // Defer first enqueue tick so startup reconcile finishes first.
  setTimeout(loop, tickMs)
}
