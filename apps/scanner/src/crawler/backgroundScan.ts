import { chromium } from 'playwright'
import type PocketBase from 'pocketbase'
import { parseRawConfig } from '../config/scanConfig.js'
import { parseSiteSettings } from '../config/siteSettings.js'
import {
  rebuildPageResultsFromScan
} from './siteCrawler.js'
import { createAuthenticatedContext } from './authHandler.js'
import { CHROMIUM_LAUNCH_ARGS } from './browserProfile.js'
import { scanOnePage } from './scanPage.js'
import { loadPolicies, saveSinglePageResult } from '../db/savePageResult.js'
import { finalizeScan, seoSettingsFromSite } from '../db/finalizeScan.js'
import { planHasFeature } from '../config/planLimits.js'
import { enqueueCrawlPdfs } from '../pdf/enqueueCrawlPdfs.js'
import { rebuildInternalLinkGraph } from '../seo/linkGraph.js'
import { ScanLogWriter, type ScanLogEventInput } from '../db/scanLogEvents.js'

export const BACKGROUND_SCAN_ROUNDS = 3
export const BACKGROUND_URL_INTERVAL_MS = 20_000

export interface BackgroundRetryState {
  round: number
  index: number
  queue: string[]
}

function parseBackgroundRetry(raw: unknown): BackgroundRetryState | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const round = Number(o.round)
  const index = Number(o.index)
  const queue = Array.isArray(o.queue) ? o.queue.filter((u): u is string => typeof u === 'string') : []
  if (!Number.isFinite(round) || round < 1 || !Number.isFinite(index) || index < 0 || !queue.length) {
    return null
  }
  return { round, index, queue }
}

function parseUnscannedUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((u): u is string => typeof u === 'string')
}

export async function hasPendingQueueItems(pb: PocketBase): Promise<boolean> {
  const pending = await pb.collection('scan_queue').getList(1, 1, {
    filter: "status = 'pending'"
  })
  return pending.items.length > 0
}

async function isScanCancelled(pb: PocketBase, scanId: string): Promise<boolean> {
  try {
    const scan = await pb.collection('scans').getOne(scanId)
    return scan.status === 'cancelled'
  } catch {
    return true
  }
}

export async function processBackgroundScanStep(pb: PocketBase): Promise<boolean> {
  if (await hasPendingQueueItems(pb)) {
    return false
  }

  const list = await pb.collection('scans').getList(1, 1, {
    filter: "status = 'background_scan'",
    sort: 'started_at'
  })
  if (!list.items.length) return false

  const record = list.items[0] as unknown as {
    id: string
    site: string
    pages_crawled?: number
    unscanned_urls?: unknown
    background_retry?: unknown
    raw_config?: Record<string, unknown>
    scan_type?: string
  }

  if (await isScanCancelled(pb, record.id)) {
    await abandonCancelledBackgroundScan(pb, record.id, record.pages_crawled ?? 0)
    return false
  }

  const site = await pb.collection('sites').getOne(record.site)
  const startUrl = String(site.url || '')
  if (!startUrl) return false

  const config = parseRawConfig(record.raw_config ?? site.default_scan_config)
  const mergedHeaders = {
    ...(site.custom_headers as Record<string, string> | undefined),
    ...(config.customHeaders || {})
  }

  let retry = parseBackgroundRetry(record.background_retry)
  let unscanned = parseUnscannedUrls(record.unscanned_urls)

  if (!retry && unscanned.length) {
    retry = { round: 1, index: 0, queue: [...unscanned] }
    await pb.collection('scans').update(record.id, {
      background_retry: retry,
      unscanned_urls: unscanned
    })
  }
  if (!retry) {
    await finalizeBackgroundScan(pb, record.id, unscanned, record.pages_crawled ?? 0)
    return true
  }

  // Refresh pages_crawled from DB (may have changed since list query).
  try {
    const fresh = await pb.collection('scans').getOne(record.id, { fields: 'pages_crawled' })
    record.pages_crawled = Number(fresh.pages_crawled) || record.pages_crawled
  } catch {
    // continue with cached value
  }

  const logWriter = new ScanLogWriter(pb, record.id, record.site)
  const onCrawlLog = async (event: ScanLogEventInput) => {
    if (event.level === 'error' && event.url) {
      await logWriter.pageFailed(event.url, event.message)
      return
    }
    await logWriter.append(event)
  }

  if (retry.index >= retry.queue.length) {
    if (retry.round >= BACKGROUND_SCAN_ROUNDS) {
      await finalizeBackgroundScan(pb, record.id, unscanned, record.pages_crawled ?? 0)
      return true
    }
    const nextRound = retry.round + 1
    if (!unscanned.length) {
      await finalizeBackgroundScan(pb, record.id, [], record.pages_crawled ?? 0)
      return true
    }
    retry = { round: nextRound, index: 0, queue: [...unscanned] }
    await logWriter.append({
      level: 'info',
      message: `Background scan round ${nextRound}/${BACKGROUND_SCAN_ROUNDS} — ${retry.queue.length} URL(s)`
    })
    await pb.collection('scans').update(record.id, {
      background_retry: retry,
      unscanned_urls: unscanned
    })
    return true
  }

  const url = retry.queue[retry.index]!
  const scanType = String(record.scan_type || 'full')
  const origin = new URL(startUrl).origin

  if (retry.index > 0) {
    await logWriter.append({
      level: 'info',
      message: `Background scan: waiting ${BACKGROUND_URL_INTERVAL_MS / 1000}s before next URL`
    })
    await delay(BACKGROUND_URL_INTERVAL_MS)
    if (await hasPendingQueueItems(pb)) {
      return false
    }
    if (await isScanCancelled(pb, record.id)) {
      await abandonCancelledBackgroundScan(pb, record.id, record.pages_crawled ?? 0)
      return false
    }
  }

  await logWriter.append({
    level: 'info',
    message: `Background scan round ${retry.round}/${BACKGROUND_SCAN_ROUNDS} — trying ${url}`,
    url
  })

  let browser
  try {
    browser = await chromium.launch({ headless: true, args: CHROMIUM_LAUNCH_ARGS })
    const context = await createAuthenticatedContext(browser, {
      auth: config.auth,
      customHeaders: mergedHeaders,
      userAgent: config.userAgent
    })
    const page = await context.newPage()
    try {
      const outcome = await scanOnePage(page, {
        url,
        depth: 0,
        config,
        scanType,
        origin,
        startUrl,
        seoSettings: seoSettingsFromSite(parseSiteSettings(site.site_settings, site.default_scan_config)),
        onCrawlLog
      })

      if (outcome.ok) {
        const policies = await loadPolicies(record.site)
        await saveSinglePageResult(outcome.page, record.id, record.site, startUrl, config, policies)
        unscanned = unscanned.filter(u => u !== url)
        const pagesCrawled = (record.pages_crawled ?? 0) + 1
        await pb.collection('scans').update(record.id, { pages_crawled: pagesCrawled })
        record.pages_crawled = pagesCrawled
        await logWriter.pageCrawled(url, outcome.page.title)
      } else if (!outcome.ok && !unscanned.includes(url)) {
        unscanned.push(url)
      }
    } finally {
      await page.close()
      await context.close()
    }
  } catch (err) {
    console.error(`Background scan failed for ${url}:`, err)
    await logWriter.append({
      level: 'error',
      message: err instanceof Error ? err.message : String(err),
      url
    })
  } finally {
    await browser?.close()
  }

  const nextIndex = retry.index + 1
  const nextRetry: BackgroundRetryState = { ...retry, index: nextIndex }
  await pb.collection('scans').update(record.id, {
    unscanned_urls: unscanned,
    background_retry: nextRetry
  })

  return true
}

async function finalizeBackgroundScan(
  pb: PocketBase,
  scanId: string,
  unscanned: string[],
  pagesCrawled: number
) {
  const scan = await pb.collection('scans').getOne(scanId)
  const logWriter = new ScanLogWriter(pb, scanId, String(scan.site))
  const hasErrors = unscanned.length > 0
  const status = hasErrors ? 'complete_with_errors' : 'complete'

  if (hasErrors) {
    await logWriter.append({
      level: 'warn',
      message: `Background scan finished — ${unscanned.length} page(s) could not be scanned`
    })
  } else {
    await logWriter.append({
      level: 'success',
      message: 'Background scan finished — all retry URLs scanned successfully'
    })
  }

  const site = await pb.collection('sites').getOne(String(scan.site))
  const siteSettings = parseSiteSettings(site.site_settings, site.default_scan_config)
  const pages = await rebuildPageResultsFromScan(pb, scanId)
  const startUrl = String(site.url || '')
  const origin = new URL(startUrl).origin
  const inboundLinks = rebuildInternalLinkGraph(pages, origin)

  const finalized = await finalizeScan(pb, {
    scanId,
    siteId: site.id,
    startUrl,
    pages,
    inboundLinks,
    siteSettings,
    diffFromPrevious: siteSettings.diffFromPrevious,
    configSitemapUrl: typeof site.default_scan_config === 'object'
      && site.default_scan_config
      && 'sitemapUrl' in (site.default_scan_config as object)
      ? String((site.default_scan_config as { sitemapUrl?: string }).sitemapUrl ?? '')
      : undefined
  })
  const scoreFields = finalized.scoreFields

  const orgId = typeof site.organization === 'string' ? site.organization.trim() : ''
  if (orgId) {
    try {
      const org = await pb.collection('organizations').getOne(orgId, { fields: 'plan' })
      const orgPlan = String(org.plan || 'free')
      if (planHasFeature(orgPlan, 'inventory')) {
        const pdfEnqueued = await enqueueCrawlPdfs(pb, site.id, scanId, {
          queueValidation: planHasFeature(orgPlan, 'pdfAccessibility')
        })
        if (pdfEnqueued > 0) {
          console.log(`Background finalize: enqueued ${pdfEnqueued} crawl PDF(s) for validation`)
        }
      }
    } catch (err) {
      console.warn('Background finalize: failed to enqueue crawl PDFs:', err)
    }
  }

  await pb.collection('sites').update(site.id, {
    score_denominators: scoreFields.score_denominators
  })

  await pb.collection('scans').update(scanId, {
    status,
    unscanned_urls: unscanned,
    background_retry: null,
    completed_at: new Date().toISOString(),
    pages_crawled: pagesCrawled,
    open_issue_count: finalized.openIssueCount,
    a11y_summary: finalized.a11ySummary,
    ...scoreFields,
    error_message: hasErrors
      ? `${unscanned.length} page(s) could not be scanned after ${BACKGROUND_SCAN_ROUNDS} background rounds`
      : ''
  })
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** User cancelled during background phase — ensure row stays terminal. */
async function abandonCancelledBackgroundScan(
  pb: PocketBase,
  scanId: string,
  pagesCrawled: number
): Promise<void> {
  try {
    const scan = await pb.collection('scans').getOne(scanId)
    if (scan.status !== 'cancelled') return
    await pb.collection('scans').update(scanId, {
      background_retry: null,
      pages_crawled: pagesCrawled,
      completed_at: scan.completed_at || new Date().toISOString()
    })
  } catch {
    // web update already applied
  }
}
