import { getPocketBase } from './pocketbaseClient.js'
import { getPlanLimits } from '../config/planLimits.js'
import { deleteWebpageSearchDocsByPageIds } from '../search/searchIndexer.js'

const PAGE_DELETE_BATCH = 50
const CHILD_DELETE_COLLECTIONS = [
  'accessibility_issues',
  'qa_broken_links',
  'qa_spelling',
  'seo_issues',
  'scan_log_events'
] as const

type ScanRow = {
  id: string
  site: string
  status: string
  completed_at?: string
  started_at?: string
  created?: string
}

function scanTime(scan: ScanRow): string {
  return String(scan.completed_at ?? scan.started_at ?? scan.created ?? '')
}

function scanTimestamp(scan: ScanRow): number {
  const raw = scanTime(scan)
  const ms = raw ? Date.parse(raw) : NaN
  return Number.isFinite(ms) ? ms : 0
}

export function historyCutoffMs(scanHistoryDays: number, now = new Date()): number {
  const days = Math.max(1, scanHistoryDays)
  return now.getTime() - days * 24 * 60 * 60 * 1000
}

export function isScanWithinHistory(
  scan: ScanRow,
  scanHistoryDays: number,
  now = new Date()
): boolean {
  const ts = scanTimestamp(scan)
  if (!ts) return true
  return ts >= historyCutoffMs(scanHistoryDays, now)
}

/** Scan that should keep full page/issue data for a site (latest successful run). */
export function pickScanIdForRetention(scans: ScanRow[]): string | null {
  const complete = scans
    .filter(s => s.status === 'complete' || s.status === 'complete_with_errors')
    .slice()
    .sort((a, b) => scanTime(b).localeCompare(scanTime(a)))
  return complete[0]?.id ?? null
}

/** Short, user-facing failure text (stored on scan log rows). */
export function summarizeScanError(message: string, maxLen = 200): string {
  const trimmed = message
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^scan failed[:\s-]*/i, '')
  if (!trimmed) return 'Could not complete scan'
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen - 1)}…`
}

/**
 * Drop per-page findings for a scan while keeping the scan log row (scores, diff, timestamps).
 */
export async function pruneScanDetail(scanId: string): Promise<void> {
  const pb = getPocketBase()

  let page = 1
  for (;;) {
    const batch = await pb.collection('pages').getList(page, PAGE_DELETE_BATCH, {
      filter: `scan = "${scanId}"`,
      fields: 'id'
    })
    if (!batch.items.length) break
    const pageIds = batch.items.map(item => item.id)
    await deleteWebpageSearchDocsByPageIds(pageIds).catch(err => {
      console.warn(`Search index delete failed for scan ${scanId}:`, err instanceof Error ? err.message : err)
    })
    await Promise.all(batch.items.map(item => pb.collection('pages').delete(item.id)))
    if (batch.items.length < PAGE_DELETE_BATCH) break
    page += 1
  }

  const inventory = await pb.collection('qa_inventory').getFullList({
    filter: `scan = "${scanId}"`,
    fields: 'id'
  })
  await Promise.all(inventory.map(item => pb.collection('qa_inventory').delete(item.id)))

  const policyMatches = await pb.collection('policy_matches').getFullList({
    filter: `scan = "${scanId}"`,
    fields: 'id'
  })
  await Promise.all(policyMatches.map(item => pb.collection('policy_matches').delete(item.id)))

  try {
    await pb.collection('scans').update(scanId, { raw_config: null })
  } catch (err) {
    console.warn(`Could not clear raw_config for pruned scan ${scanId}:`, err)
  }
}

/**
 * Keep full crawl data only on `keepScanId`; older terminal scans within the plan
 * history window become log-only rows; scans outside the window are deleted.
 */
export async function pruneSiteScanRetention(
  siteId: string,
  keepScanId: string,
  scanHistoryDays: number,
  now = new Date()
): Promise<void> {
  const pb = getPocketBase()
  const scans = await pb.collection('scans').getFullList({
    filter: `site = "${siteId}"`,
    fields: 'id,site,status,completed_at,started_at,created'
  }) as unknown as ScanRow[]

  const cutoff = historyCutoffMs(scanHistoryDays, now)

  for (const scan of scans) {
    if (scan.id === keepScanId) continue

    const ts = scanTimestamp(scan)
    const terminal = scan.status === 'complete'
      || scan.status === 'complete_with_errors'
      || scan.status === 'failed'
      || scan.status === 'cancelled'

    if (terminal && ts > 0 && ts < cutoff) {
      try {
        await deleteScanRecord(scan.id)
      } catch (err) {
        console.warn(`Retention delete failed for scan ${scan.id}:`, err)
      }
      continue
    }

    if (
      terminal
      && scan.id !== keepScanId
      && isScanWithinHistory(scan, scanHistoryDays, now)
    ) {
      try {
        await pruneScanDetail(scan.id)
      } catch (err) {
        console.warn(`Retention prune failed for scan ${scan.id}:`, err)
      }
    }
  }
}

/** @deprecated Use pruneSiteScanRetention */
export async function pruneSupersededScanDetails(
  siteId: string,
  keepScanId: string
): Promise<void> {
  await pruneSiteScanRetention(siteId, keepScanId, 365)
}

export async function resolveScanHistoryDaysForSite(siteId: string): Promise<number> {
  const pb = getPocketBase()
  try {
    const site = await pb.collection('sites').getOne(siteId, {
      fields: 'organization',
      expand: 'organization'
    })
    const org = site.expand?.organization as { plan?: string } | undefined
    const orgId = typeof site.organization === 'string' ? site.organization : ''
    if (org?.plan) {
      return getPlanLimits(org.plan).scanHistoryDays
    }
    if (orgId) {
      const orgRecord = await pb.collection('organizations').getOne(orgId, { fields: 'plan' })
      return getPlanLimits(orgRecord.plan).scanHistoryDays
    }
  } catch (err) {
    console.warn(`Could not resolve scan history days for site ${siteId}:`, err)
  }
  return getPlanLimits('free').scanHistoryDays
}

async function deleteChildRecordsForScan(scanId: string): Promise<void> {
  const pb = getPocketBase()
  for (const collection of CHILD_DELETE_COLLECTIONS) {
    try {
      const rows = await pb.collection(collection).getFullList({
        filter: `scan = "${scanId}"`,
        fields: 'id'
      })
      await Promise.all(rows.map(row => pb.collection(collection).delete(row.id)))
    } catch (err) {
      console.warn(`Could not delete ${collection} for scan ${scanId}:`, err)
    }
  }
}

export async function deleteScanRecord(scanId: string): Promise<void> {
  const pb = getPocketBase()
  await pruneScanDetail(scanId)
  await deleteChildRecordsForScan(scanId)
  await pb.collection('scans').delete(scanId)
}

export interface RetentionBackfillResult {
  sitesProcessed: number
  sitesWithCompleteScan: number
  scansPruned: number
  skipped: string[]
}

/**
 * One-time / maintenance pass: for each site, keep full detail on the latest
 * completed scan only; all other terminal scans become log-only rows.
 */
export async function backfillRetentionForAllSites(options?: {
  dryRun?: boolean
  onSite?: (siteId: string, keepScanId: string | null, pruneCount: number) => void
}): Promise<RetentionBackfillResult> {
  const pb = getPocketBase()
  const dryRun = options?.dryRun ?? false
  const sites = await pb.collection('sites').getFullList({ fields: 'id,name' })
  const result: RetentionBackfillResult = {
    sitesProcessed: 0,
    sitesWithCompleteScan: 0,
    scansPruned: 0,
    skipped: []
  }

  for (const site of sites) {
    const siteId = site.id
    const scans = await pb.collection('scans').getFullList({
      filter: `site = "${siteId}"`,
      fields: 'id,site,status,completed_at,started_at,created'
    }) as unknown as ScanRow[]

    const keepScanId = pickScanIdForRetention(scans)
    const terminal = scans.filter(s =>
      s.status === 'complete' || s.status === 'failed' || s.status === 'cancelled'
    )
    const toPrune = keepScanId
      ? terminal.filter(s => s.id !== keepScanId)
      : terminal

    result.sitesProcessed += 1
    if (keepScanId) result.sitesWithCompleteScan += 1

    options?.onSite?.(siteId, keepScanId, toPrune.length)

    if (dryRun) {
      result.scansPruned += toPrune.length
      continue
    }

    if (keepScanId) {
      await pruneSupersededScanDetails(siteId, keepScanId)
      result.scansPruned += toPrune.length
    } else if (toPrune.length) {
      for (const scan of toPrune) {
        try {
          await pruneScanDetail(scan.id)
          result.scansPruned += 1
        } catch (err) {
          result.skipped.push(`${scan.id}: ${err}`)
        }
      }
    }
  }

  return result
}
