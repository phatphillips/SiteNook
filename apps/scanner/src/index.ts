import { chromium } from 'playwright'
import { authenticateAdmin, getPocketBase } from './db/pocketbaseClient.js'
import {
  crawlSite,
  type PageResult
} from './crawler/siteCrawler.js'
import { loadPolicies } from './db/savePageResult.js'
import { createPageResultPersistence } from './db/pageResultWriter.js'
import { finalizeScan, seoSettingsFromSite } from './db/finalizeScan.js'
import { normalizeSeoUrl } from './seo/linkGraph.js'
import { hasPendingQueueItems, processBackgroundScanStep } from './crawler/backgroundScan.js'
import { initSpellChecker } from './qa/spellChecker.js'
import { configForStorage, mergeRawScanConfigs, parseRawConfig } from './config/scanConfig.js'
import { parseSiteSettings } from './config/siteSettings.js'
import { shouldUseSitemapSeeds, trySitemapSeedUrls } from './crawler/crawlSeeds.js'
import { parseSitemap } from './crawler/sitemapParser.js'
import { filterUrls } from './crawler/urlPatterns.js'
import { loadRobotsDisallows } from './crawler/robots.js'
import { createAuthenticatedContext } from './crawler/authHandler.js'
import { CHROMIUM_LAUNCH_ARGS } from './crawler/browserProfile.js'
import { reconcileSchedulesOnStartup, startSchedulerLoop } from './scheduler/scanScheduler.js'
import { purgeDueClosedOrganizations } from './db/purgeClosedOrgs.js'
import {
  enqueuePendingScansToBullMq,
  isBullMqEnabled,
  startBullMqScanWorker
} from './queue/bullmqWorker.js'
import {
  pruneSiteScanRetention,
  resolveScanHistoryDaysForSite,
  summarizeScanError
} from './db/scanRetention.js'
import { ScanLogWriter, type ScanLogEventInput } from './db/scanLogEvents.js'
import { getMaxPagesPerScanForPlan, planHasFeature } from './config/planLimits.js'
import { enqueueCrawlPdfs } from './pdf/enqueueCrawlPdfs.js'
import { pollPdfValidationQueue, recoverStalePdfJobs } from './pdf/pdfValidationWorker.js'

const POLL_INTERVAL = Number(process.env.SCANNER_POLL_INTERVAL_MS || 10000)
const MAX_PAGES = Number(process.env.MAX_PAGES_PER_SCAN || 500)

let pollFailures = 0
let pollBackoffMs = 5000
let missingCollectionLogged = false
let isProcessingQueue = false

async function recoverStaleJobs() {
  const pb = getPocketBase()

  try {
    const stuckQueue = await pb.collection('scan_queue').getFullList({
      filter: "status = 'processing'"
    })
    for (const item of stuckQueue) {
      const related = await pb.collection('scans').getList(1, 1, {
        filter: `site = "${item.site}"`,
        sort: '-started_at'
      })
      const latest = related.items[0]
      if (latest && ['complete', 'failed', 'cancelled'].includes(String(latest.status))) {
        await pb.collection('scan_queue').update(item.id, { status: latest.status })
        console.warn(`Recovered stuck queue item ${item.id} (processing → ${latest.status})`)
      } else {
        await pb.collection('scan_queue').update(item.id, { status: 'pending' })
        console.warn(`Recovered stuck queue item ${item.id} (processing → pending)`)
      }
    }

    const stuckScans = await pb.collection('scans').getFullList({
      filter: "status = 'running'"
    })
    for (const scan of stuckScans) {
      await pb.collection('scans').update(scan.id, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: summarizeScanError('Scan interrupted — worker restarted')
      })
      console.warn(`Marked orphaned scan ${scan.id} as failed`)
    }
  } catch (err) {
    console.warn('Stale job recovery skipped:', err)
  }
}

async function failScanAndQueue(
  scanId: string | undefined,
  queueId: string,
  message: string
) {
  const pb = getPocketBase()
  console.error(message)
  if (scanId) {
    try {
      await pb.collection('scans').update(scanId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: summarizeScanError(message)
      })
    } catch (err) {
      console.error(`Could not mark scan ${scanId} as failed:`, err)
    }
  }
  try {
    await pb.collection('scan_queue').update(queueId, { status: 'failed' })
  } catch (err) {
    console.error(`Could not mark queue item ${queueId} as failed:`, err)
  }
}

async function buildUrlQueue(
  startUrl: string,
  config: ReturnType<typeof parseRawConfig>,
  targetUrl?: string
): Promise<string[]> {
  if (targetUrl) {
    return filterUrls([targetUrl], config.includePatterns, config.excludePatterns)
  }

  if (config.mode === 'pages') {
    return filterUrls(config.pages, config.includePatterns, config.excludePatterns)
  }

  if (config.mode === 'sitemap') {
    const sitemapUrl = config.sitemapUrl || new URL('/sitemap.xml', startUrl).href
    const urls = await parseSitemap(sitemapUrl, config.maxPages * 2)
    return filterUrls(urls, config.includePatterns, config.excludePatterns).slice(0, config.maxPages)
  }

  return []
}

async function isScanCancelled(scanId: string): Promise<boolean> {
  const pb = getPocketBase()
  try {
    const scan = await pb.collection('scans').getOne(scanId)
    return scan.status === 'cancelled'
  } catch (err) {
    console.warn(`Could not read scan ${scanId} cancel state (assuming active):`, err)
    return false
  }
}

async function markScanCancelled(scanId: string, queueId: string, pagesCrawled: number) {
  const pb = getPocketBase()
  const now = new Date().toISOString()
  await pb.collection('scans').update(scanId, {
    status: 'cancelled',
    pages_crawled: pagesCrawled,
    completed_at: now
  })
  try {
    await pb.collection('scan_queue').update(queueId, { status: 'cancelled' })
  } catch (err) {
    console.warn(`Could not update queue ${queueId} to cancelled:`, err)
  }
  console.log(`Scan ${scanId} cancelled (${pagesCrawled} pages saved)`)
}

async function processQueueItem(queueId: string) {
  const pb = getPocketBase()
  let scanId: string | undefined

  try {
    const queueItem = await pb.collection('scan_queue').getOne(queueId, { expand: 'site' })

    if (queueItem.status === 'cancelled') {
      console.log(`Queue item ${queueId} was cancelled before processing`)
      return
    }

    const site = queueItem.expand?.site as {
      id: string
      url: string
      organization?: string
      custom_headers?: Record<string, string>
      default_scan_config?: Record<string, unknown>
      site_settings?: Record<string, unknown>
    }
    const targetUrl = queueItem.target_url as string | undefined
    const rawConfig = queueItem.raw_config
    const mergedRaw = mergeRawScanConfigs(site?.default_scan_config, rawConfig)
    const config = parseRawConfig(mergedRaw)
    const siteSettings = parseSiteSettings(site?.site_settings, site?.default_scan_config)
    const envMaxPages = Number(process.env.MAX_PAGES_PER_SCAN || 500)
    let planMaxPages = envMaxPages
    let orgPlan: string = 'free'
    const orgId = typeof site?.organization === 'string' ? site.organization.trim() : ''
    if (orgId) {
      try {
        const org = await pb.collection('organizations').getOne(orgId, { fields: 'plan' })
        orgPlan = String(org.plan || 'free')
        planMaxPages = Math.min(envMaxPages, getMaxPagesPerScanForPlan(org.plan))
      } catch (err) {
        console.warn(`Queue item ${queueId}: could not resolve org plan for maxPages — using env cap`, err)
      }
    }

    if (!rawConfig) {
      config.maxPages = planMaxPages
      console.warn(`Queue item ${queueId}: raw_config missing — using plan/env default maxPages=${planMaxPages}`)
    } else {
      config.maxPages = Math.min(config.maxPages, planMaxPages)
    }

    console.log(
      `Scan ${queueId} config: mode=${config.mode} maxPages=${config.maxPages} maxDepth=${config.maxDepth} ` +
      `stayOnDomain=${config.stayOnDomain} pages=${config.pages.length}`
    )

    if (config.mode === 'pages' && config.pages.length === 0) {
      await failScanAndQueue(undefined, queueId, 'Pages mode requires at least one URL')
      return
    }

    if (!site?.url) {
      await failScanAndQueue(undefined, queueId, `Queue item ${queueId}: site URL missing`)
      return
    }

    const startUrl = targetUrl || site.url
    const scanType = (queueItem.scan_type as string) || 'full'

    const mergedHeaders = {
      ...(site.custom_headers || {}),
      ...(config.customHeaders || {})
    }

    const storedConfig = configForStorage(config)

    const scan = await pb.collection('scans').create({
      site: site.id,
      status: 'running',
      scan_type: scanType,
      pages_crawled: 0,
      started_at: new Date().toISOString(),
      wcag_version: '2.2',
      raw_config: storedConfig
    })
    scanId = scan.id

    let browser
    try {
      browser = await chromium.launch({
        headless: true,
        args: CHROMIUM_LAUNCH_ARGS
      })
    } catch (err) {
      await failScanAndQueue(scanId, queueId, `Browser launch failed: ${err}`)
      return
    }

    try {
      try {
        await initSpellChecker()
      } catch (err) {
        console.warn('Spell checker unavailable, continuing without spelling checks:', err)
      }

      const policies = planHasFeature(orgPlan, 'policies')
        ? await loadPolicies(site.id)
        : []
    const robotsDisallows = config.respectRobots
      ? await loadRobotsDisallows(new URL(startUrl).origin)
      : []

    const prebuiltUrls = await buildUrlQueue(startUrl, config, targetUrl)

    let sitemapSeeds: string[] = []
    if (config.mode === 'full' && !targetUrl && prebuiltUrls.length === 0) {
      const seeds = await trySitemapSeedUrls(startUrl, config)
      if (shouldUseSitemapSeeds(seeds.length)) {
        console.log(`Full crawl: seeding ${seeds.length} URL(s) from sitemap`)
        sitemapSeeds = seeds
      }
    }

    const crawlInitialUrls = prebuiltUrls.length
      ? prebuiltUrls
      : sitemapSeeds.length
        ? sitemapSeeds
        : undefined
    const useUrlList = config.mode !== 'full' || sitemapSeeds.length > 0

    const context = await createAuthenticatedContext(browser, {
      auth: config.auth,
      customHeaders: mergedHeaders,
      userAgent: config.userAgent
    })

    const crawlConfig = {
      ...config,
      maxPages: useUrlList && prebuiltUrls.length && config.mode !== 'full'
        ? Math.min(config.maxPages, prebuiltUrls.length)
        : config.maxPages
    }

    const persistInventory = planHasFeature(orgPlan, 'inventory')
    const pagePersistence = createPageResultPersistence({
      scanId: scan.id,
      siteId: site.id,
      startUrl,
      config,
      policies,
      options: { persistInventory }
    })

    const logWriter = new ScanLogWriter(pb, scan.id, site.id)
    await logWriter.append({
      level: 'info',
      message: `Starting ${config.mode} crawl · max ${crawlConfig.maxPages} pages · depth ${config.maxDepth} · concurrency ${config.concurrency}`
    })
    if (sitemapSeeds.length > 0) {
      await logWriter.append({
        level: 'info',
        message: `Seeded ${sitemapSeeds.length} URL(s) from sitemap (also following links)`
      })
    }

    const onCrawlLog = async (event: ScanLogEventInput) => {
      if (event.level === 'error' && event.url) {
        await logWriter.pageFailed(event.url, event.message)
        return
      }
      await logWriter.append(event)
    }

    const seoSettings = seoSettingsFromSite(siteSettings)
    if (!planHasFeature(orgPlan, 'seoModule')) {
      seoSettings.checkSeo = false
    }
    const sitemapUrlSet = sitemapSeeds.length
      ? new Set(sitemapSeeds.map(u => normalizeSeoUrl(u)))
      : undefined

    const { pages, diagnostics, unscannedUrls, internalLinkGraph } = await crawlSite(browser, {
      startUrl,
      config: crawlConfig,
      scanType,
      seoSettings,
      initialUrls: crawlInitialUrls?.slice(0, crawlConfig.maxPages),
      robotsDisallows,
      sharedContext: context,
      shouldAbort: () => isScanCancelled(scan.id),
      onCrawlLog,
      onPageComplete: async (pageResult) => {
        try {
          await pagePersistence.save(pageResult)
          await logWriter.pageCrawled(pageResult.url, pageResult.title)
        } catch (err) {
          console.error(`Failed to persist page ${pageResult.url}:`, err)
          await logWriter.append({
            level: 'error',
            message: `Failed to save page: ${err instanceof Error ? err.message : String(err)}`,
            url: pageResult.url
          })
        }
      }
    }, async (crawled) => {
      await pb.collection('scans').update(scan.id, { pages_crawled: crawled })
    })

    await pagePersistence.flush()

    await logWriter.crawlSummary(diagnostics, pages.length, crawlConfig.maxPages)

    await context.close()

    if (await isScanCancelled(scan.id)) {
      await logWriter.append({ level: 'warn', message: 'Scan cancelled — partial results saved' })
      await markScanCancelled(scan.id, queueId, pages.length)
      return
    }

    const enteringBackground = unscannedUrls.length > 0

    const finalized = await finalizeScan(pb, {
      scanId: scan.id,
      siteId: site.id,
      startUrl,
      pages,
      inboundLinks: internalLinkGraph,
      sitemapUrls: sitemapUrlSet,
      siteSettings,
      diffFromPrevious: siteSettings.diffFromPrevious && !enteringBackground,
      runSitePass: !enteringBackground,
      configSitemapUrl: crawlConfig.sitemapUrl
    })

    if (!enteringBackground && planHasFeature(orgPlan, 'inventory')) {
      try {
        const pdfEnqueued = await enqueueCrawlPdfs(pb, site.id, scan.id, {
          queueValidation: planHasFeature(orgPlan, 'pdfAccessibility')
        })
        if (pdfEnqueued > 0) {
          console.log(`Enqueued ${pdfEnqueued} crawl PDF(s) for accessibility validation`)
        }
      } catch (err) {
        console.warn('Failed to process crawl PDFs:', err)
      }
    }

    const scoreFields = finalized.scoreFields
    const diffSummary = finalized.diffSummary

    await pb.collection('sites').update(site.id, {
      score_denominators: scoreFields.score_denominators
    })

    const historyDays = await resolveScanHistoryDaysForSite(site.id)
    await pruneSiteScanRetention(site.id, scan.id, historyDays)
    await pb.collection('scan_queue').update(queueId, { status: 'complete' })

    if (unscannedUrls.length > 0) {
      await logWriter.append({
        level: 'warn',
        message: `Primary crawl finished — ${pages.length} page(s) saved; ${unscannedUrls.length} blocked URL(s) queued for background scan`
      })
      await pb.collection('scans').update(scan.id, {
        status: 'background_scan',
        pages_crawled: pages.length,
        unscanned_urls: unscannedUrls,
        background_retry: { round: 1, index: 0, queue: [...unscannedUrls] },
        ...scoreFields,
        diff_summary: diffSummary,
        open_issue_count: finalized.openIssueCount,
        a11y_summary: finalized.a11ySummary,
        error_message: ''
      })
      console.log(
        `Scan ${scan.id} entering background retry for ${unscannedUrls.length} URL(s) ` +
        `(pending queue items take priority)`
      )
      return
    }

    await logWriter.append({
      level: 'success',
      message: `Scan complete — ${pages.length} page(s) saved`
    })

    await pb.collection('scans').update(scan.id, {
      status: 'complete',
      pages_crawled: pages.length,
      completed_at: new Date().toISOString(),
      unscanned_urls: [],
      background_retry: null,
      ...scoreFields,
      diff_summary: diffSummary,
      open_issue_count: finalized.openIssueCount,
      a11y_summary: finalized.a11ySummary,
      error_message: ''
    })

      console.log(
        `Scan complete for ${startUrl}: ${pages.length} page(s) saved ` +
        `(see crawl diagnostics above; SCANNER_CRAWL_DEBUG=1 for per-URL detail)`
      )
    } catch (err) {
      await failScanAndQueue(scanId, queueId, `Scan failed: ${err}`)
    } finally {
      await browser?.close()
    }
  } catch (err) {
    await failScanAndQueue(scanId, queueId, `Queue item ${queueId} failed before scan start: ${err}`)
  }
}

function getPollErrorStatus(err: unknown): number {
  if (err && typeof err === 'object' && 'status' in err) {
    return Number((err as { status: number }).status)
  }
  return 0
}

function getPollErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: string }).message)
  }
  return String(err)
}

async function claimQueueItemById(queueId: string): Promise<boolean> {
  const pb = getPocketBase()
  const stale = await pb.collection('scan_queue').getOne(queueId)
  if (stale.status !== 'pending') return false

  await pb.collection('scan_queue').update(queueId, { status: 'processing' })
  const claimed = await pb.collection('scan_queue').getOne(queueId)
  return claimed.status === 'processing'
}

async function runQueueJob(queueId: string): Promise<void> {
  const claimed = await claimQueueItemById(queueId)
  if (!claimed) return
  await processQueueItem(queueId)
}

async function claimNextPendingQueueItem() {
  const pb = getPocketBase()
  const pending = await pb.collection('scan_queue').getList(1, 1, {
    filter: "status = 'pending'",
    sort: '-priority,id'
  })
  if (!pending.items.length) return null

  const item = pending.items[0]
  const stale = await pb.collection('scan_queue').getOne(item.id)
  if (stale.status !== 'pending') {
    return null
  }

  await pb.collection('scan_queue').update(item.id, {
    status: 'processing'
  })

  const claimed = await pb.collection('scan_queue').getOne(item.id)
  if (claimed.status !== 'processing') {
    return null
  }
  return claimed
}

async function pollQueue() {
  const pb = getPocketBase()

  try {
    pollFailures = 0
    pollBackoffMs = 5000
    missingCollectionLogged = false

    if (isBullMqEnabled()) {
      await enqueuePendingScansToBullMq(pb)
    } else {
      const item = await claimNextPendingQueueItem()
      if (item) {
        isProcessingQueue = true
        try {
          await processQueueItem(item.id)
        } finally {
          isProcessingQueue = false
        }
        return
      }
    }

    if (isProcessingQueue) return
    isProcessingQueue = true
    try {
      const maxBackgroundSteps = Math.max(
        1,
        Number(process.env.SCANNER_BACKGROUND_STEPS_PER_POLL || 3)
      )
      for (let step = 0; step < maxBackgroundSteps; step++) {
        const progressed = await processBackgroundScanStep(pb)
        if (!progressed) break
        if (await hasPendingQueueItems(pb)) break
      }
    } finally {
      isProcessingQueue = false
    }
  } catch (err: unknown) {
    const status = getPollErrorStatus(err)
    const message = getPollErrorMessage(err)

    if (status === 404) {
      pollFailures++
      pollBackoffMs = Math.min(5000 * (2 ** Math.min(pollFailures - 1, 3)), 60000)
      console.log(`scan_queue not found, retrying in ${pollBackoffMs / 1000}s...`)

      if (pollFailures >= 10 && !missingCollectionLogged) {
        console.error('ERROR: scan_queue collection missing. Check PocketBase bootstrap.')
        missingCollectionLogged = true
        pollBackoffMs = 60000
      }
      return
    }

    if (status === 400) {
      console.error(`Queue poll failed (400): ${message}`)
      return
    }

    console.error('Queue poll error:', err)
  }
}

async function pollLoop() {
  await pollQueue()
  try {
    await pollPdfValidationQueue(getPocketBase())
  } catch (err) {
    console.warn('PDF validation poll error:', err)
  }
  const delay = pollFailures > 0 ? pollBackoffMs : POLL_INTERVAL
  setTimeout(pollLoop, delay)
}

async function main() {
  console.log('AccessIQ Scanner starting...')
  await authenticateAdmin()
  console.log('Authenticated with PocketBase')
  await recoverStaleJobs()
  const pb = getPocketBase()
  await recoverStalePdfJobs(pb)
  await reconcileSchedulesOnStartup(pb)
  startSchedulerLoop(pb)

  if (isBullMqEnabled()) {
    await startBullMqScanWorker(runQueueJob)
  }

  if (process.env.SCANNER_PURGE_CLOSED_ORGS === 'true') {
    const purgeMs = Number(process.env.SCANNER_PURGE_TICK_MS || 24 * 60 * 60 * 1000)
    async function purgeLoop() {
      try {
        const result = await purgeDueClosedOrganizations(pb)
        if (result.organizationsPurged > 0) {
          console.log(`Purge tick: removed ${result.organizationsPurged} closed organization(s)`)
        }
      } catch (err) {
        console.error('Closed-org purge tick error:', err)
      }
      setTimeout(purgeLoop, purgeMs)
    }
    console.log(`Closed-org purge enabled (tick every ${purgeMs}ms)`)
    setTimeout(purgeLoop, purgeMs)
  }

  console.log('Polling queue...')
  pollLoop()
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
