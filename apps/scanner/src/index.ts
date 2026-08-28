import { chromium } from 'playwright'
import { authenticateAdmin, ensureAuthenticated, getPocketBase, isPocketBaseConnectionError, resetPocketBaseClient, withPocketBaseRetry } from './db/pocketbaseClient.js'
import {
  crawlSite,
  type PageResult
} from './crawler/siteCrawler.js'
import { loadPolicies } from './db/savePageResult.js'
import { axeExcludeSelectorsFromPolicies } from './qa/policyEngine.js'
import { createPageResultPersistence } from './db/pageResultWriter.js'
import { finalizeScan, schedulePostScanReconcile, seoSettingsFromSite } from './db/finalizeScan.js'
import { normalizeSeoUrl } from './seo/linkGraph.js'
import { hasPendingQueueItems, processBackgroundScanStep } from './crawler/backgroundScan.js'
import { initSpellChecker } from './qa/spellChecker.js'
import { enrichScanInventorySizes } from './qa/resolveInventorySizes.js'
import { consolidateScanInventory } from './qa/consolidateScanInventory.js'
import {
  consolidateScanInventoryRefs,
  patchInventoryFoundOnPageCounts
} from './qa/consolidateScanInventoryRefs.js'
import { configForStorage, mergeRawScanConfigs, parseRawConfig } from './config/scanConfig.js'
import { parseSiteSettings } from './config/siteSettings.js'
import { ensureStartUrlInSeeds, shouldUseSitemapSeeds, trySitemapSeedUrls } from './crawler/crawlSeeds.js'
import { parseSitemap } from './crawler/sitemapParser.js'
import { filterUrls } from './crawler/urlPatterns.js'
import { loadRobotsDisallows } from './crawler/robots.js'
import { createAuthenticatedContext } from './crawler/authHandler.js'
import { CHROMIUM_LAUNCH_ARGS } from './crawler/browserProfile.js'
import { reconcileSchedulesOnStartup, scheduleVerificationScan, startSchedulerLoop } from './scheduler/scanScheduler.js'
import { evaluateScanQuality, previousTrustedPageCount } from './crawler/scanQuality.js'
import { startReportScheduleLoop } from './scheduler/reportScheduleScheduler.js'
import { processTeamTrialLifecycle } from './scheduler/trialLifecycle.js'
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
import {
  effectiveOrgPlanForScan,
  heartbeatApplianceLicence,
  isApplianceDeploymentMode,
  resolveLicenceKeyFromPocketBase,
  syncApplianceOrgPlans,
  validateApplianceLicence
} from './licence/applianceLicence.js'
import { enqueueCrawlPdfs } from './pdf/enqueueCrawlPdfs.js'
import { pollPdfValidationQueue, recoverStalePdfJobs } from './pdf/pdfValidationWorker.js'
import { pollPdfRemediationQueue, recoverStaleRemediationJobs } from './pdf/pdfRemediationWorker.js'
import { recomputeDashboardRollupsForSite } from './dashboard/rollupWriter.js'
import { startReportJobLoop } from './reports/reportWorker.js'

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
  message: string,
  crawlFinishedAt?: string
) {
  const pb = getPocketBase()
  console.error(message)
  if (scanId) {
    try {
      const patch: Record<string, unknown> = {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: summarizeScanError(message)
      }
      if (crawlFinishedAt) patch.crawl_finished_at = crawlFinishedAt
      await pb.collection('scans').update(scanId, patch)
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
    return ensureStartUrlInSeeds(
      startUrl,
      filterUrls(urls, config.includePatterns, config.excludePatterns).slice(0, config.maxPages)
    )
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
    crawl_finished_at: now,
    completed_at: now
  })
  try {
    await pb.collection('scan_queue').update(queueId, { status: 'cancelled' })
  } catch (err) {
    console.warn(`Could not update queue ${queueId} to cancelled:`, err)
  }
  console.log(`Scan ${scanId} cancelled (${pagesCrawled} pages saved)`)
}

async function runPostScanHousekeeping(opts: {
  pb: ReturnType<typeof getPocketBase>
  siteId: string
  scanId: string
  trusted: boolean
  qualityReason?: string
  enqueuePdfs: boolean
  queueValidation: boolean
}): Promise<void> {
  const historyDays = await resolveScanHistoryDaysForSite(opts.siteId).catch((err) => {
    console.warn(`Could not resolve scan history days for site ${opts.siteId}:`, err)
    return 0
  })
  if (opts.trusted && historyDays > 0) {
    await pruneSiteScanRetention(opts.siteId, opts.scanId, historyDays).catch((err) => {
      console.warn(`Scan retention prune failed for ${opts.scanId}:`, err)
    })
  } else if (!opts.trusted) {
    console.log(
      `Skipping page retention prune for untrusted scan ${opts.scanId}` +
      (opts.qualityReason ? ` (${opts.qualityReason})` : '')
    )
  }

  if (!opts.enqueuePdfs) return
  try {
    const pdfEnqueued = await enqueueCrawlPdfs(opts.pb, opts.siteId, opts.scanId, {
      queueValidation: opts.queueValidation
    })
    if (pdfEnqueued > 0) {
      console.log(`Enqueued ${pdfEnqueued} crawl PDF(s) for accessibility validation`)
    }
  } catch (err) {
    console.warn('Failed to process crawl PDFs:', err)
  }
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
        orgPlan = effectiveOrgPlanForScan(org.plan)
        planMaxPages = Math.min(envMaxPages, getMaxPagesPerScanForPlan(orgPlan))
      } catch (err) {
        console.warn(`Queue item ${queueId}: could not resolve org plan for maxPages — using env cap`, err)
        orgPlan = effectiveOrgPlanForScan('free')
        planMaxPages = Math.min(envMaxPages, getMaxPagesPerScanForPlan(orgPlan))
      }
    } else if (isApplianceDeploymentMode()) {
      orgPlan = effectiveOrgPlanForScan('free')
      planMaxPages = Math.min(envMaxPages, getMaxPagesPerScanForPlan(orgPlan))
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

    const queuedAt = String(queueItem.created || new Date().toISOString())
    const scan = await pb.collection('scans').create({
      site: site.id,
      status: 'running',
      scan_type: scanType,
      pages_crawled: 0,
      queued_at: queuedAt,
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

      const policies = planHasFeature(orgPlan, 'policies') && siteSettings.runPolicies
        ? await loadPolicies(site.id)
        : []
      const axeExcludeSelectors = axeExcludeSelectorsFromPolicies(policies)
    const robotsDisallows = config.respectRobots
      ? await loadRobotsDisallows(new URL(startUrl).origin)
      : []

    const prebuiltUrls = await buildUrlQueue(startUrl, config, targetUrl)

    let sitemapSeeds: string[] = []
    if (config.mode === 'full' && !targetUrl && prebuiltUrls.length === 0) {
      const seeds = await trySitemapSeedUrls(startUrl, config)
      if (shouldUseSitemapSeeds(seeds.length)) {
        sitemapSeeds = ensureStartUrlInSeeds(startUrl, seeds)
        console.log(`Full crawl: seeding ${sitemapSeeds.length} URL(s) from sitemap`)
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
      axeExcludeSelectors,
      initialUrls: crawlInitialUrls?.slice(0, crawlConfig.maxPages),
      robotsDisallows,
      sharedContext: context,
      shouldAbort: () => isScanCancelled(scan.id),
      onCrawlLog,
      onPageComplete: async (pageResult) => {
        try {
          await pagePersistence.save(pageResult)
        } catch (err) {
          console.error(`Failed to persist page ${pageResult.url}:`, err)
          await logWriter.append({
            level: 'error',
            message: `Failed to save page: ${err instanceof Error ? err.message : String(err)}`,
            url: pageResult.url
          }).catch(() => {})
          throw err
        }
        await logWriter.pageCrawled(pageResult.url, pageResult.title).catch(() => {})
      }
    }, async (crawled) => {
      try {
        await pb.collection('scans').update(scan.id, { pages_crawled: crawled })
      } catch (err) {
        console.warn(
          `Failed to update pages_crawled for scan ${scan.id}:`,
          err instanceof Error ? err.message : err
        )
      }
    })

    const crawlFinishedAt = new Date().toISOString()
    await pb.collection('scans').update(scan.id, { crawl_finished_at: crawlFinishedAt })

    await pagePersistence.flush()

    if (persistInventory) {
      console.log(`Consolidating inventory for scan ${scan.id}...`)
      await consolidateScanInventory(pb, scan.id).catch((err) => {
        console.warn(`Inventory consolidation failed for scan ${scan.id}:`, err)
      })
      await consolidateScanInventoryRefs(pb, scan.id).catch((err) => {
        console.warn(`Inventory ref consolidation failed for scan ${scan.id}:`, err)
      })
      await patchInventoryFoundOnPageCounts(pb, scan.id).catch((err) => {
        console.warn(`Inventory page counts failed for scan ${scan.id}:`, err)
      })
      await enrichScanInventorySizes(pb, scan.id).catch((err) => {
        console.warn(`Inventory size enrichment failed for scan ${scan.id}:`, err)
      })
    }

    await logWriter.crawlSummary(diagnostics, pages.length, crawlConfig.maxPages)

    await context.close()
    await browser.close()
    browser = undefined

    if (await isScanCancelled(scan.id)) {
      await logWriter.append({ level: 'warn', message: 'Scan cancelled — partial results saved' })
      await markScanCancelled(scan.id, queueId, pages.length)
      await recomputeDashboardRollupsForSite(pb, site.id).catch((err) => {
        console.warn(`Rollup recompute skipped for cancelled scan ${scan.id}:`, err)
      })
      return
    }

    const enteringBackground = unscannedUrls.length > 0
    let previousTrustedPages: number | undefined
    try {
      const previous = await pb.collection('scans').getList(1, 20, {
        filter: `site = "${site.id}" && (status = "complete" || status = "complete_with_errors") && id != "${scan.id}"`,
        sort: '-completed_at',
        fields: 'pages_crawled,scan_quality'
      })
      previousTrustedPages = previousTrustedPageCount(
        previous.items as Array<{ pages_crawled?: number, scan_quality?: { trusted?: boolean } }>
      )
    } catch (err) {
      console.warn(
        `Could not load previous trusted page count for site ${site.id}:`,
        err instanceof Error ? err.message : err
      )
    }
    const quality = evaluateScanQuality(diagnostics, pages, {
      mode: config.mode,
      previousTrustedPages
    })

    if (pages.length === 0 && !enteringBackground) {
      await logWriter.append({
        level: 'error',
        message: quality.reason || 'Scan saved no pages — keeping the last trusted results'
      })
      await failScanAndQueue(
        scan.id,
        queueId,
        quality.reason || 'Scan saved no pages',
        crawlFinishedAt
      )
      await scheduleVerificationScan(pb, site.id)
      return
    }

    const trusted = quality.trusted || enteringBackground

    console.log(`Finalizing scan ${scan.id} (${pages.length} page(s))...`)
    const finalized = await withPocketBaseRetry(
      () => finalizeScan(getPocketBase(), {
        scanId: scan.id,
        siteId: site.id,
        startUrl,
        pages,
        inboundLinks: internalLinkGraph,
        sitemapUrls: sitemapUrlSet,
        siteSettings,
        diffFromPrevious: siteSettings.diffFromPrevious && !enteringBackground && trusted,
        runSitePass: !enteringBackground,
        configSitemapUrl: crawlConfig.sitemapUrl,
        updateCurrentA11y: trusted && !enteringBackground
      }),
      { label: `finalize scan ${scan.id}` }
    )
    console.log(`Finalize complete for scan ${scan.id}`)

    const scoreFields = finalized.scoreFields
    const diffSummary = finalized.diffSummary

    if (trusted) {
      await withPocketBaseRetry(
        () => getPocketBase().collection('sites').update(site.id, {
          score_denominators: scoreFields.score_denominators
        }),
        { label: `site score update ${site.id}` }
      )
    }

    await withPocketBaseRetry(
      () => getPocketBase().collection('scan_queue').update(queueId, { status: 'complete' }),
      { label: `queue complete ${queueId}` }
    )

    if (unscannedUrls.length > 0) {
      await logWriter.append({
        level: 'warn',
        message: `Primary crawl finished — ${pages.length} page(s) saved; ${unscannedUrls.length} blocked URL(s) queued for background scan`
      })
      await withPocketBaseRetry(
        () => getPocketBase().collection('scans').update(scan.id, {
          status: 'background_scan',
          pages_crawled: pages.length,
          unscanned_urls: unscannedUrls,
          background_retry: { round: 1, index: 0, queue: [...unscannedUrls] },
          ...scoreFields,
          diff_summary: diffSummary,
          open_issue_count: finalized.openIssueCount,
          broken_link_count: finalized.brokenLinkCount,
          a11y_summary: finalized.a11ySummary,
          scan_quality: quality,
          error_message: ''
        }),
        { label: `background scan update ${scan.id}` }
      )
      await recomputeDashboardRollupsForSite(pb, site.id).catch((err) => {
        console.warn(`Rollup recompute skipped for background scan ${scan.id}:`, err)
      })
      await runPostScanHousekeeping({
        pb,
        siteId: site.id,
        scanId: scan.id,
        trusted,
        qualityReason: quality.reason,
        enqueuePdfs: false,
        queueValidation: false
      })
      console.log(
        `Scan ${scan.id} entering background retry for ${unscannedUrls.length} URL(s) ` +
        `(pending queue items take priority)`
      )
      return
    }

    const status = trusted ? 'complete' : 'complete_with_errors'
    if (!trusted) {
      await logWriter.append({
        level: 'warn',
        message: `${quality.reason || 'Scan completed with errors'} — keeping last trusted site score`
      })
      await scheduleVerificationScan(pb, site.id)
    } else {
      await logWriter.append({
        level: 'success',
        message: `Scan complete — ${pages.length} page(s) saved`
      })
    }

    await withPocketBaseRetry(
      () => getPocketBase().collection('scans').update(scan.id, {
        status,
        pages_crawled: pages.length,
        completed_at: new Date().toISOString(),
        unscanned_urls: [],
        background_retry: null,
        ...scoreFields,
        diff_summary: diffSummary,
        open_issue_count: finalized.openIssueCount,
        broken_link_count: finalized.brokenLinkCount,
        a11y_summary: finalized.a11ySummary,
        scan_quality: quality,
        error_message: trusted ? '' : (quality.reason || 'Scan completed with errors')
      }),
      { label: `complete scan ${scan.id}` }
    )
    await recomputeDashboardRollupsForSite(pb, site.id).catch((err) => {
      console.warn(`Rollup recompute skipped for complete scan ${scan.id}:`, err)
    })
    schedulePostScanReconcile(site.id, {
      elementTotals: scoreFields.score_denominators?.elements,
      updateCurrentA11y: trusted
    })

    console.log(
      `Scan complete for ${startUrl}: ${pages.length} page(s) saved ` +
      `(see crawl diagnostics above; SCANNER_CRAWL_DEBUG=1 for per-URL detail)`
    )

    await runPostScanHousekeeping({
      pb,
      siteId: site.id,
      scanId: scan.id,
      trusted,
      qualityReason: quality.reason,
      enqueuePdfs: planHasFeature(orgPlan, 'inventory'),
      queueValidation: planHasFeature(orgPlan, 'pdfAccessibility')
    }).catch((err) => {
      console.warn(`Post-scan housekeeping failed for ${scan.id}:`, err)
    })
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
  try {
    await ensureAuthenticated()
  } catch (err) {
    console.warn('PocketBase auth recovery failed:', err)
    pollFailures++
    pollBackoffMs = Math.min(5000 * (2 ** Math.min(pollFailures - 1, 3)), 60000)
    setTimeout(pollLoop, pollBackoffMs)
    return
  }

  try {
    await pollQueue()
  } catch (err) {
    if (isPocketBaseConnectionError(err)) {
      console.warn('PocketBase connection lost during queue poll; resetting client')
      resetPocketBaseClient()
      pollFailures++
      pollBackoffMs = Math.min(5000 * (2 ** Math.min(pollFailures - 1, 3)), 60000)
      setTimeout(pollLoop, pollBackoffMs)
      return
    }
  }

  try {
    await pollPdfValidationQueue(getPocketBase())
  } catch (err) {
    if (isPocketBaseConnectionError(err)) {
      console.warn('PocketBase connection lost during PDF poll; resetting client')
      resetPocketBaseClient()
    } else {
      console.warn('PDF validation poll error:', err)
    }
  }

  try {
    await pollPdfRemediationQueue(getPocketBase())
  } catch (err) {
    if (isPocketBaseConnectionError(err)) {
      console.warn('PocketBase connection lost during PDF remediation poll; resetting client')
      resetPocketBaseClient()
    } else {
      console.warn('PDF remediation poll error:', err)
    }
  }
  const delay = pollFailures > 0 ? pollBackoffMs : POLL_INTERVAL
  setTimeout(pollLoop, delay)
}

async function main() {
  console.log('SiteNook Scanner starting...')
  await authenticateAdmin()
  console.log('Authenticated with PocketBase')

  const pb = getPocketBase()
  if (isApplianceDeploymentMode()) {
    const licenceKey = await resolveLicenceKeyFromPocketBase(pb)
    const licence = await validateApplianceLicence({ licenceKey })
    console.log(
      `Appliance licence: tier=${licence.tier} plan=${licence.plan} valid=${licence.licenceValid}`
      + (licence.lastError ? ` (${licence.lastError})` : '')
    )
    const heartbeatMs = Number(process.env.SITENOOK_LICENCE_HEARTBEAT_MS || process.env.ACCESSIQ_LICENCE_HEARTBEAT_MS || 7 * 24 * 60 * 60 * 1000)
    setInterval(() => {
      heartbeatApplianceLicence().catch((err) => {
        console.warn('Licence heartbeat failed:', err)
      })
    }, heartbeatMs)
  }

  await recoverStaleJobs()
  if (isApplianceDeploymentMode()) {
    try {
      const plan = effectiveOrgPlanForScan('free')
      const updated = await syncApplianceOrgPlans(pb, plan)
      if (updated > 0) {
        console.log(`Appliance: synced ${updated} organization(s) to plan=${plan}`)
      }
    } catch (err) {
      console.warn('Appliance: could not sync organization plan from licence', err)
    }
  }
  await recoverStalePdfJobs(pb)
  await recoverStaleRemediationJobs(pb)
  await reconcileSchedulesOnStartup(pb)
  startSchedulerLoop(pb)
  startReportScheduleLoop(pb)
  startReportJobLoop(pb)

  const trialMs = Number(process.env.SCANNER_TRIAL_TICK_MS || 60 * 60 * 1000)
  async function trialLoop() {
    try {
      const result = await processTeamTrialLifecycle(getPocketBase())
      if (result.expired > 0 || result.nudged > 0) {
        console.log(
          `Trial lifecycle: expired=${result.expired} nudged=${result.nudged} errors=${result.errors}`
        )
      }
    } catch (err) {
      console.error('Trial lifecycle tick error:', err)
    }
    setTimeout(trialLoop, trialMs)
  }
  console.log(`Team trial lifecycle enabled (tick every ${trialMs}ms)`)
  setTimeout(trialLoop, Math.min(trialMs, 60_000))

  if (isBullMqEnabled()) {
    await startBullMqScanWorker(runQueueJob)
  }

  if (process.env.SCANNER_PURGE_CLOSED_ORGS === 'true') {
    const purgeMs = Number(process.env.SCANNER_PURGE_TICK_MS || 24 * 60 * 60 * 1000)
    async function purgeLoop() {
      try {
        const result = await purgeDueClosedOrganizations(getPocketBase())
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
