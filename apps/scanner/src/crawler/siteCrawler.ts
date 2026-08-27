import type PocketBase from 'pocketbase'
import type { Browser, BrowserContext, Page } from 'playwright'
import PQueue from 'p-queue'
import { DEFAULT_AXE_TAGS, runAxeOnPage } from '../accessibility/axeRunner.js'
import { getPostLoadDelay, getWaitUntil, VIEWPORT_SIZES, type ParsedScanConfig } from '../config/scanConfig.js'
import { checkLinksOnPage, extractLinkHrefsFromPage } from './linkChecker.js'
import { checkSpelling } from '../qa/spellChecker.js'
import { countWords, extractMainContentFromPage } from '../qa/extractMainContent.js'
import { scoreReadability, scoreAllReadabilityMethods, parseStoredReadabilityScores } from '../qa/readability.js'
import { truncateHtmlSnapshot } from '../utils/truncateHtmlSnapshot.js'
import { filterUrls } from './urlPatterns.js'
import { isDisallowedByRobots } from './robots.js'
import { applyFormAuth } from './authHandler.js'
import {
  calculateQaScore,
  calculateSiteimproveScores,
  countElementsFromHtmlSnapshots,
  countQaDenominatorsFromPages,
  emptyElementTotals,
  issuesFromPages,
  mergeElementTotalsMax,
  resolveElementTotals,
  scoreBestPracticeCategory,
  type ElementTotals,
  type QaDenominators,
  type ScoreDenominators,
  type SiteimproveScoreIssue,
  type WcagLevel
} from '../accessibility/siteimproveScore.js'
import { mergeA11yCheckStats, type A11yCheckStats } from '../accessibility/a11yCheckStats.js'
import { FALLBACK_AXE_CATALOG } from '../accessibility/axeCheckCatalog.js'
import { inventoryAssetFromUrl } from '../qa/inventoryUrl.js'
import { isHttpUrl } from '../db/recordSanitize.js'
import { classifyCrawlError, CrawlDiagnostics, type CrawlStopReason } from './crawlDiagnostics.js'
import { settlePageForAxe } from './settlePageForAxe.js'
import {
  challengeBlockLogMessage,
  isWafBlockedStatus,
  resolveNavigationChallenge,
  responseHasSgCaptcha
} from './challengePage.js'
import { retryForbiddenWithBackoff } from './wafRetry.js'
import type { ScanLogEventInput } from '../db/scanLogEvents.js'
import { recordInternalLinks } from '../seo/linkGraph.js'
import { runPageSeoChecks, shouldRunAccessibility, shouldRunQa, shouldRunSeo } from '../seo/scanSeo.js'
import type { SeoSettings } from '../seo/types.js'
import { DEFAULT_SEO_SETTINGS } from '../seo/types.js'
import { captureSimulatorPreview, preparePageForPreviewCapture, waitForRenderedContent } from './captureSimulatorPreview.js'
import { serializeRenderedPage, inlinePageAssetsForPreview } from './serializeRenderedHtml.js'
import { renderedHtmlBufferFromSnapshot } from '../db/attachPageRenderedHtml.js'
import { extractContentMarkdown } from '../content/extractContentMarkdown.js'

export interface CrawlOptions {
  startUrl: string
  config: ParsedScanConfig
  scanType: string
  seoSettings?: SeoSettings
  /** CSS selectors excluded from axe (from exclude_from_accessibility policies). */
  axeExcludeSelectors?: string[]
  initialUrls?: string[]
  robotsDisallows?: string[]
  sharedContext?: BrowserContext
  /** When true, stops crawling and returns pages collected so far. */
  shouldAbort?: () => boolean | Promise<boolean>
  /** Called after each page is crawled (for incremental persistence). */
  onPageComplete?: (page: PageResult) => void | Promise<void>
  /** Verbose per-URL crawl logging (default: SCANNER_CRAWL_DEBUG env). */
  crawlDebug?: boolean
  /** Stream events to PocketBase / live UI. */
  onCrawlLog?: (event: ScanLogEventInput) => void | Promise<void>
}

export interface CrawlSiteResult {
  pages: PageResult[]
  diagnostics: CrawlDiagnostics
  unscannedUrls: string[]
  internalLinkGraph: Map<string, Set<string>>
}

export interface PageResult {
  url: string
  title: string
  statusCode: number
  wordCount: number
  readabilityScore: number
  readabilityScores: import('../qa/readabilityMethods.js').ReadabilityScores
  crawlDepth: number
  htmlSnapshot: string
  htmlSizeBytes: number
  issues: import('../accessibility/axeRunner.js').AxeIssueRecord[]
  checkStats?: import('../accessibility/a11yCheckStats.js').A11yCheckStats
  brokenLinks: Awaited<ReturnType<typeof checkLinksOnPage>>
  linkHrefs: string[]
  spelling: Awaited<ReturnType<typeof checkSpelling>>
  inventory: Array<{ url: string, content_type: string, mime_type: string, is_pdf: boolean, size_bytes: number }>
  seoSnapshot?: import('../seo/types.js').SeoSnapshot
  seoIssues?: import('../seo/types.js').SeoIssueDraft[]
  /** Full-page JPEG for accessibility simulator (optional; best-effort). */
  previewImage?: Buffer
  /** Untruncated rendered HTML for same-origin content preview (optional; skipped if over 8MB). */
  renderedHtml?: Buffer
  /** Keyboard tab-order geometry matching the preview image. */
  tabOrder?: import('./captureSimulatorPreview.js').SimulatorTabOrderPayload
  /** Clean Markdown extracted from rendered HTML (pre-truncation). */
  contentMarkdown?: string
  /** True when axe threw; issues are empty and must not be treated as a clean scan. */
  a11yFailed?: boolean
}

/** Drop large binary fields after they have been uploaded so the crawl result list stays small. */
export function releasePageResultBinaries(page: PageResult): void {
  page.renderedHtml = undefined
  page.previewImage = undefined
}

export async function crawlSite(
  browser: Browser,
  options: CrawlOptions,
  onProgress?: (crawled: number, total: number) => void | Promise<void>
): Promise<CrawlSiteResult> {
  const { config, startUrl } = options
  const origin = new URL(startUrl).origin
  const viewport = VIEWPORT_SIZES[config.viewport] || VIEWPORT_SIZES.desktop
  const waitUntil = getWaitUntil(config.waitStrategy)
  const postDelay = getPostLoadDelay(config.waitStrategy)
  const timeoutMs = (config.timeout || 30) * 1000

  const visited = new Set<string>()
  const results: PageResult[] = []
  const internalLinkGraph = new Map<string, Set<string>>()
  const pQueue = new PQueue({ concurrency: config.concurrency })
  const diag = new CrawlDiagnostics(options.crawlDebug)
  const seoSettings = options.seoSettings ?? DEFAULT_SEO_SETTINGS

  let queue: Array<{ url: string, depth: number }>

  if (options.initialUrls?.length) {
    queue = options.initialUrls.map(url => ({ url: normalizeUrl(url), depth: 0 }))
    diag.recordSeed(options.initialUrls.length)
  } else {
    queue = [{ url: normalizeUrl(startUrl), depth: 0 }]
    diag.recordSeed(1)
  }

  // Full-site mode always follows links (including when seeded from a sitemap).
  const followLinks = config.mode === 'full'
  const ownsContext = !options.sharedContext
  let context = options.sharedContext || await browser.newContext()
  let crashRelaunched = false
  const retried = new Set<string>()

  if (config.auth.type === 'form') {
    const authPage = await context.newPage()
    try {
      await applyFormAuth(authPage, config.auth)
    } finally {
      await authPage.close()
    }
  }

  const maxPages = config.maxPages

  async function emitLog(event: ScanLogEventInput): Promise<void> {
    if (options.onCrawlLog) await options.onCrawlLog(event)
  }

  async function aborted(): Promise<boolean> {
    return options.shouldAbort ? await options.shouldAbort() : false
  }

  let stopReason: CrawlStopReason = 'queue_empty'
  /** Consecutive WAF/challenge blocks; after 3, skip further in-crawl 403 retries. */
  let consecutiveWafBlocks = 0
  let wafBlocked = false
  let wafCircuitLogged = false

  const noteWafBlock = async (url: string) => {
    consecutiveWafBlocks++
    if (consecutiveWafBlocks >= 3) {
      wafBlocked = true
      if (!wafCircuitLogged) {
        wafCircuitLogged = true
        await emitLog({
          level: 'warn',
          message:
            'Host appears blocked by WAF — skipping further WAF retries for this crawl; remaining URLs queue for background scan'
        })
      }
    }
  }

  const noteWafSuccess = () => {
    consecutiveWafBlocks = 0
    wafBlocked = false
  }

  while (queue.length > 0 && results.length < maxPages) {
    if (await aborted()) {
      stopReason = 'aborted'
      break
    }

    const batch: Array<{ url: string, depth: number }> = []
    const queueBeforeBatch = queue.length
    while (queue.length > 0 && batch.length < config.concurrency && results.length + batch.length < maxPages) {
      const item = queue.shift()!
      if (visited.has(item.url)) {
        diag.recordDequeueSkip('visited')
        continue
      }
      if (config.respectRobots && isDisallowedByRobots(item.url, options.robotsDisallows || [])) {
        diag.recordDequeueSkip('robots')
        continue
      }
      visited.add(item.url)
      batch.push(item)
    }

    if (batch.length === 0) {
      stopReason = queueBeforeBatch > 0 ? 'stuck_queue' : 'queue_empty'
      if (stopReason === 'stuck_queue' && diag.enabled) {
        console.warn(
          `[crawl] No batch formed but ${queueBeforeBatch} item(s) were shifted (duplicates/robots). Remaining queue: ${queue.length}`
        )
      }
      break
    }

    await Promise.all(batch.map(item => pQueue.add(async () => {
      if (await aborted()) return

      if (!retried.has(item.url)) diag.recordAttempt()
      let page: Page | undefined
      try {
        try {
          page = await context.newPage()
        } catch (err) {
          if (!crashRelaunched) {
            crashRelaunched = true
            console.warn('Playwright page create failed — relaunching browser context once:', err)
            if (ownsContext) {
              await context.close().catch(() => {})
              context = await browser.newContext()
            }
            page = await context.newPage()
          } else {
            throw err
          }
        }
        await page.setViewportSize(viewport)
        let response = await page.goto(item.url, { waitUntil, timeout: timeoutMs }).catch(async (err) => {
          if (waitUntil === 'networkidle') {
            console.warn(`networkidle timeout for ${item.url}, retrying with load`)
            await emitLog({
              level: 'warn',
              message: 'networkidle timeout — retrying with load',
              url: item.url
            })
            return page.goto(item.url, { waitUntil: 'load', timeout: timeoutMs })
          }
          throw err
        })

        let statusCode = response?.status() || 0
        const initialSgCaptcha = responseHasSgCaptcha(response)
        if (isWafBlockedStatus(statusCode) || initialSgCaptcha) {
          if (wafBlocked) {
            diag.recordHttpError(statusCode || 403, item.url)
            if (statusCode !== 403 && statusCode !== 202) diag.recordUnscanned(item.url)
            await noteWafBlock(item.url)
            await emitLog({
              level: 'warn',
              message: 'Host still blocked by WAF/challenge — skipping retries, queuing for background scan',
              url: item.url
            })
            return
          }
          const wafResult = await retryForbiddenWithBackoff(page, item.url, {
            timeoutMs,
            onWafRetry: async ({ attempt, delayMs }) => {
              const sec = Math.round(delayMs / 1000)
              await emitLog({
                level: 'warn',
                message: `HTTP ${statusCode || 403} (WAF) — retry ${attempt}/2 in ${sec}s`,
                url: item.url
              })
            }
          })
          response = wafResult.response
          statusCode = wafResult.statusCode
        }

        if (postDelay > 0) await page.waitForTimeout(postDelay)

        const challenge = await resolveNavigationChallenge(
          page,
          response,
          wafBlocked ? { softWaitMs: 0, settleMs: 0 } : undefined
        )
        if (challenge.blocked && challenge.kind) {
          diag.recordUnscanned(item.url)
          await noteWafBlock(item.url)
          await emitLog({
            level: 'error',
            message: challengeBlockLogMessage(challenge.kind),
            url: item.url
          })
          return
        }

        if (statusCode >= 500 && !retried.has(item.url)) {
          retried.add(item.url)
          visited.delete(item.url)
          queue.push(item)
          diag.recordHttpError(statusCode, item.url)
          await emitLog({
            level: 'warn',
            message: `HTTP ${statusCode} — retrying once`,
            url: item.url
          })
          return
        }

        if (statusCode >= 400) {
          diag.recordHttpError(statusCode, item.url)
          if (isWafBlockedStatus(statusCode)) await noteWafBlock(item.url)
          await emitLog({
            level: 'error',
            message: `HTTP ${statusCode} — page not scanned`,
            url: item.url
          })
          return
        }

        noteWafSuccess()

        await settlePageForAxe(page)

        let storedUrl = item.url
        try {
          const finalUrl = page.url()
          if (finalUrl.startsWith('http')) {
            storedUrl = normalizeUrl(finalUrl)
            if (storedUrl !== item.url) visited.add(storedUrl)
          }
        } catch {
          // keep queued URL
        }

        const title = await page.title()
        const textContent = await extractMainContentFromPage(page)
        const wordCount = countWords(textContent)
        const readabilityScores = scoreAllReadabilityMethods(textContent)
        const readabilityScore = scoreReadability(textContent)

        let issues: PageResult['issues'] = []
        let checkStats: PageResult['checkStats']
        let a11yFailed = false
        let brokenLinks: PageResult['brokenLinks'] = []
        let linkHrefs: string[] = []
        let spelling: PageResult['spelling'] = []

        if (shouldRunAccessibility(options.scanType)) {
          try {
            const axeResult = await runAxeOnPage(page, {
              tags: DEFAULT_AXE_TAGS,
              excludeSelectors: options.axeExcludeSelectors
            })
            issues = axeResult.issues
            checkStats = axeResult.checkStats
          } catch (err) {
            a11yFailed = true
            console.warn(`Axe scan failed for ${storedUrl}:`, err)
            await emitLog({
              level: 'warn',
              message: `Accessibility scan failed — page saved without issue results`,
              url: storedUrl
            })
          }
        }

        if (shouldRunQa(options.scanType)) {
          linkHrefs = await extractLinkHrefsFromPage(page)
          brokenLinks = await checkLinksOnPage(page, origin, linkHrefs)
          spelling = checkSpelling(textContent)
        }

        if (followLinks && item.depth < config.maxDepth) {
          const links = await extractLinks(page, origin, config.stayOnDomain)
          if (!shouldRunSeo(options.scanType, seoSettings)) {
            recordInternalLinks(internalLinkGraph, storedUrl, links, origin)
          }
          const filtered = filterUrls(links, config.includePatterns, config.excludePatterns)
          let enqueued = 0
          for (const link of filtered) {
            if (visited.has(link) || queue.some(q => q.url === link)) {
              diag.recordLinkSkip('visited')
              continue
            }
            if (config.respectRobots && isDisallowedByRobots(link, options.robotsDisallows || [])) {
              diag.recordLinkSkip('robots')
              continue
            }
            queue.push({ url: link, depth: item.depth + 1 })
            enqueued++
          }
          diag.recordLinksEnqueued(enqueued)
        }

        let previewImage: Buffer | undefined
        let tabOrder: PageResult['tabOrder']
        try {
          const preview = await captureSimulatorPreview(page)
          previewImage = preview.previewImage
          tabOrder = preview.tabOrder
        } catch (err) {
          console.warn(`Simulator preview capture failed for ${item.url}:`, err)
          await preparePageForPreviewCapture(page).catch(() => {})
        }

        await waitForRenderedContent(page).catch(() => {})
        const htmlSnapshot = await serializeRenderedPage(page).catch(async () => page.content())
        const htmlSizeBytes = Buffer.byteLength(htmlSnapshot, 'utf8')
        const previewHtml = await inlinePageAssetsForPreview(page, htmlSnapshot).catch(() => htmlSnapshot)
        const contentMarkdown = extractContentMarkdown(htmlSnapshot, storedUrl) ?? undefined

        let seoSnapshot: PageResult['seoSnapshot']
        let seoIssues: PageResult['seoIssues']
        if (shouldRunSeo(options.scanType, seoSettings)) {
          const seo = runPageSeoChecks({
            url: storedUrl,
            title,
            wordCount,
            readabilityScore,
            crawlDepth: item.depth,
            htmlSnapshot,
            startUrl,
            axeRuleIds: issues.map(i => i.rule_id),
            settings: seoSettings
          })
          seoSnapshot = seo.snapshot
          seoIssues = seo.issues
          recordInternalLinks(internalLinkGraph, storedUrl, seo.internalLinks, origin)
        }

        const pageResult: PageResult = {
          url: storedUrl,
          title,
          statusCode,
          wordCount,
          readabilityScore,
          readabilityScores,
          crawlDepth: item.depth,
          htmlSnapshot: truncateHtmlSnapshot(htmlSnapshot),
          htmlSizeBytes,
          renderedHtml: renderedHtmlBufferFromSnapshot(previewHtml),
          issues,
          checkStats,
          brokenLinks,
          linkHrefs,
          spelling,
          inventory: extractInventory(htmlSnapshot, storedUrl),
          seoSnapshot,
          seoIssues,
          previewImage,
          tabOrder,
          contentMarkdown,
          a11yFailed
        }

        try {
          await options.onPageComplete?.(pageResult)
        } catch (err) {
          console.error(`Failed to persist page ${storedUrl}:`, err)
          releasePageResultBinaries(pageResult)
          return
        }
        releasePageResultBinaries(pageResult)
        results.push(pageResult)
        diag.recordSuccess()

        try {
          await onProgress?.(results.length, Math.min(queue.length + results.length, maxPages))
        } catch (err) {
          console.warn(
            'Crawl progress callback failed:',
            err instanceof Error ? err.message : err
          )
        }
      } catch (err) {
        const kind = classifyCrawlError(err)
        if ((kind === 'timeout' || kind === 'network') && !retried.has(item.url)) {
          retried.add(item.url)
          visited.delete(item.url)
          queue.push(item)
          await emitLog({
            level: 'warn',
            message: `${kind} — retrying once`,
            url: item.url
          })
          return
        }
        diag.recordException(item.url, err)
        const reason = err instanceof Error ? err.message : String(err)
        await emitLog({
          level: 'error',
          message: reason.slice(0, 500),
          url: item.url
        })
        console.error(`Failed to crawl ${item.url}:`, err)
      } finally {
        await page?.close()
      }
    })))
  }

  if (results.length >= maxPages && queue.length > 0) {
    stopReason = 'max_pages'
  } else if (stopReason !== 'aborted' && queue.length === 0) {
    stopReason = 'queue_empty'
  }

  diag.finish({
    stopReason,
    queueRemaining: queue.length,
    visitedCount: visited.size,
    resultsCount: results.length,
    maxPages
  })

  if (ownsContext) await context.close()
  return { pages: results, diagnostics: diag, unscannedUrls: diag.unscannedUrls, internalLinkGraph }
}

async function extractLinks(page: Page, origin: string, stayOnDomain: boolean): Promise<string[]> {
  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map(a => (a as HTMLAnchorElement).href)
      .filter(Boolean)
  )

  return hrefs
    .map(h => rewriteSameSiteLink(h, origin, stayOnDomain))
    .filter((u): u is string => !!u)
}

function hostnameKey(hostname: string): string {
  return hostname.replace(/^www\./i, '').toLowerCase()
}

/**
 * Keep crawls on the configured site. www and apex are treated as the same host
 * so `href="/"` on a non-www sitemap page still queues the start-origin homepage.
 */
export function rewriteSameSiteLink(href: string, origin: string, stayOnDomain: boolean): string | null {
  try {
    const u = new URL(href)
    if (stayOnDomain) {
      const start = new URL(origin)
      if (hostnameKey(u.hostname) !== hostnameKey(start.hostname)) return null
      u.protocol = start.protocol
      u.hostname = start.hostname
    }
    return normalizeUrl(u.toString())
  } catch {
    return null
  }
}

function extractInventory(html: string, pageUrl: string) {
  const items: PageResult['inventory'] = []
  const seen = new Set<string>()
  const regex = /(?:src|href)=["']([^"']+)["']/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    const asset = inventoryAssetFromUrl(match[1], pageUrl)
    if (!asset || !isHttpUrl(asset.url) || seen.has(asset.url)) continue
    seen.add(asset.url)
    items.push(asset)
  }
  return items
}

export function normalizeUrl(url: string): string {
  const u = new URL(url)
  u.hash = ''
  if (u.pathname.endsWith('/') && u.pathname.length > 1) {
    u.pathname = u.pathname.slice(0, -1)
  }
  return u.toString()
}

export interface AggregateScoresOptions {
  depthWeightedScoring?: boolean
  /** Cached denominators from an in-memory aggregate — avoids truncated HTML under-counting on re-aggregate. */
  cachedDenominators?: ScoreDenominators
  checkStats?: A11yCheckStats
}

function parseElementTotals(raw: unknown): ElementTotals | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const totals = emptyElementTotals()
  for (const key of Object.keys(totals) as (keyof ElementTotals)[]) {
    const value = Number((raw as Record<string, unknown>)[key])
    if (Number.isFinite(value) && value >= 0) totals[key] = value
  }
  return Object.values(totals).some(v => v > 0) ? totals : undefined
}

function parseQaDenominators(raw: unknown): QaDenominators | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const totalLinks = Number(o.totalLinks)
  const totalWords = Number(o.totalWords)
  const totalPages = Number(o.totalPages)
  if (![totalLinks, totalWords, totalPages].every(v => Number.isFinite(v) && v >= 0)) {
    return undefined
  }
  return { totalLinks, totalWords, totalPages }
}

export function parseScoreDenominators(raw: unknown): ScoreDenominators | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const elements = parseElementTotals(o.elements)
  const qa = parseQaDenominators(o.qa)
  if (!elements && !qa) return undefined
  return {
    elements: elements ?? emptyElementTotals(),
    qa: qa ?? { totalLinks: 0, totalWords: 0, totalPages: 0 }
  }
}

export interface AggregateScoresResult {
  score_overall: number
  score_a: number
  score_aa: number
  score_aaa: number
  score_best_practices: number
  score_qa: number
  score_denominators: ScoreDenominators
  a11y_check_stats: A11yCheckStats
}

/** PocketBase scan fields for all scores — written together in one update. */
export type ScanScoreFields = Pick<
  AggregateScoresResult,
  | 'score_overall'
  | 'score_a'
  | 'score_aa'
  | 'score_aaa'
  | 'score_best_practices'
  | 'score_qa'
  | 'score_denominators'
  | 'a11y_check_stats'
>

function normalizeWcagLevel(level: string | undefined): WcagLevel {
  if (level === 'A' || level === 'AA' || level === 'AAA') return level
  return 'AA'
}

function scoreIssuesFromPageResults(
  pages: PageResult[],
  options?: { depthWeightedScoring?: boolean }
): SiteimproveScoreIssue[] {
  return issuesFromPages(
    pages.map(page => ({
      crawlDepth: page.crawlDepth,
      issues: page.issues.map(issue => ({
        rule_id: issue.rule_id,
        wcag_level: normalizeWcagLevel(issue.wcag_level),
        element_type: issue.element_type,
        status: issue.status
      }))
    })),
    options
  )
}

function finiteScore(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    console.warn(`[aggregateScores] ${label} is not finite (${value}); using 0`)
    return 0
  }
  return value
}

export function scanScoreFieldsFromAggregate(result: AggregateScoresResult): ScanScoreFields {
  return {
    score_overall: finiteScore(result.score_overall, 'score_overall'),
    score_a: finiteScore(result.score_a, 'score_a'),
    score_aa: finiteScore(result.score_aa, 'score_aa'),
    score_aaa: finiteScore(result.score_aaa, 'score_aaa'),
    score_best_practices: finiteScore(result.score_best_practices, 'score_best_practices'),
    score_qa: finiteScore(result.score_qa, 'score_qa'),
    score_denominators: result.score_denominators,
    a11y_check_stats: result.a11y_check_stats
  }
}

/** Log score fields immediately before a PocketBase scans update. */
export function logScoreFieldsBeforePbWrite(scanId: string, fields: ScanScoreFields): void {
  console.log(
    `[aggregateScores] PocketBase write scan=${scanId} ` +
    `score_overall=${fields.score_overall} score_a=${fields.score_a} ` +
    `score_aa=${fields.score_aa} score_aaa=${fields.score_aaa} ` +
    `score_best_practices=${fields.score_best_practices} score_qa=${fields.score_qa}`
  )
}

export function logAggregateScores(
  scanId: string | undefined,
  pageCount: number,
  issueCount: number,
  result: AggregateScoresResult,
  details?: { wcagLevelCounts: Record<string, number>, elementTotals: ElementTotals }
): void {
  const tag = scanId ? `scan=${scanId}` : 'aggregateScores'
  const levelSummary = details
    ? ` wcagLevels=${JSON.stringify(details.wcagLevelCounts)} elements=${JSON.stringify(details.elementTotals)}`
    : ''
  console.log(
    `[aggregateScores] ${tag} pages=${pageCount} issues=${issueCount}${levelSummary} ` +
    `overall=${result.score_overall} A=${result.score_a} AA=${result.score_aa} ` +
    `AAA=${result.score_aaa} QA=${result.score_qa}`
  )
}

export function aggregateScores(
  pages: PageResult[],
  options?: AggregateScoresOptions
): AggregateScoresResult {
  const depthWeightedScoring = options?.depthWeightedScoring ?? false
  const scoringOptions = { depthWeightedScoring }
  const freshElements = countElementsFromHtmlSnapshots(pages, scoringOptions)
  const mergedFromHtml = options?.cachedDenominators?.elements
    ? mergeElementTotalsMax(options.cachedDenominators.elements, freshElements)
    : freshElements
  const allIssues = scoreIssuesFromPageResults(pages, scoringOptions)
  const elementTotals = resolveElementTotals(mergedFromHtml, allIssues)
  const mergedStats = options?.checkStats
    ?? mergeA11yCheckStats(pages.map(page => page.checkStats))
  const catalogById = new Map(FALLBACK_AXE_CATALOG.map(entry => [entry.rule_id, { ...entry }]))
  for (const entry of mergedStats.catalog) {
    if (entry?.rule_id) catalogById.set(entry.rule_id, entry)
  }
  const a11y_check_stats: A11yCheckStats = {
    catalog: [...catalogById.values()],
    rules: mergedStats.rules
  }
  const accessibility = calculateSiteimproveScores(allIssues, elementTotals, a11y_check_stats)
  const scoreBestPractices = scoreBestPracticeCategory(allIssues, elementTotals, a11y_check_stats)

  const freshQa = countQaDenominatorsFromPages(pages, scoringOptions)
  const qaCounts = options?.cachedDenominators?.qa
    ? {
        ...freshQa,
        totalLinks: Math.max(options.cachedDenominators.qa.totalLinks, freshQa.totalLinks),
        totalWords: Math.max(options.cachedDenominators.qa.totalWords, freshQa.totalWords),
        totalPages: Math.max(options.cachedDenominators.qa.totalPages, freshQa.totalPages)
      }
    : freshQa
  const qaScore = calculateQaScore(
    qaCounts.failedLinks,
    qaCounts.totalLinks,
    qaCounts.failedSpelling,
    qaCounts.totalWords
  )

  const score_denominators: ScoreDenominators = {
    elements: elementTotals,
    qa: {
      totalLinks: qaCounts.totalLinks,
      totalWords: qaCounts.totalWords,
      totalPages: qaCounts.totalPages
    }
  }

  return {
    score_overall: accessibility.overall,
    score_a: accessibility.levelA,
    score_aa: accessibility.levelAA,
    score_aaa: accessibility.levelAAA,
    score_best_practices: scoreBestPractices,
    score_qa: qaScore,
    score_denominators,
    a11y_check_stats
  }
}

type PbRecord = Record<string, unknown> & { id: string }

function groupRecordsByPage(records: PbRecord[]): Map<string, PbRecord[]> {
  const map = new Map<string, PbRecord[]>()
  for (const record of records) {
    const pageId = typeof record.page === 'string' ? record.page : undefined
    if (!pageId) continue
    const list = map.get(pageId) ?? []
    list.push(record)
    map.set(pageId, list)
  }
  return map
}

/** Rebuild in-memory page results from persisted scan data (for score re-aggregation). */
export async function rebuildPageResultsFromScan(
  pb: PocketBase,
  scanId: string
): Promise<PageResult[]> {
  const pageFields = 'id,url,title,status_code,word_count,readability_score,readability_scores,crawl_depth,html_snapshot,html_size_bytes'
  const [pageRecords, issueRecords, linkRecords, spellRecords] = await Promise.all([
    pb.collection('pages').getFullList({ filter: `scan = "${scanId}"`, fields: pageFields }),
    pb.collection('accessibility_issues').getFullList({ filter: `scan = "${scanId}"` }),
    pb.collection('qa_broken_links').getFullList({ filter: `scan = "${scanId}"` }),
    pb.collection('qa_spelling').getFullList({ filter: `scan = "${scanId}"` })
  ])

  const issuesByPage = groupRecordsByPage(issueRecords as PbRecord[])
  const linksByPage = groupRecordsByPage(linkRecords as PbRecord[])
  const spellingByPage = groupRecordsByPage(spellRecords as PbRecord[])

  return (pageRecords as PbRecord[]).map(page => ({
    url: String(page.url ?? ''),
    title: String(page.title ?? ''),
    statusCode: Number(page.status_code) || 200,
    wordCount: Number(page.word_count) || 0,
    readabilityScore: Number(page.readability_score) || 0,
    readabilityScores: parseStoredReadabilityScores(page.readability_scores, Number(page.readability_score) || 0),
    crawlDepth: Number(page.crawl_depth) || 0,
    htmlSnapshot: String(page.html_snapshot ?? ''),
    htmlSizeBytes: Number(page.html_size_bytes) || Buffer.byteLength(String(page.html_snapshot ?? ''), 'utf8'),
    issues: (issuesByPage.get(page.id) ?? []).map(issue => ({
      rule_id: String(issue.rule_id ?? ''),
      wcag_level: String(issue.wcag_level ?? 'AA'),
      wcag_sc: String(issue.wcag_sc ?? ''),
      wcag_version: String(issue.wcag_version ?? ''),
      impact: String(issue.impact ?? 'moderate'),
      type: String(issue.type ?? 'warning'),
      element_type: String(issue.element_type ?? 'other'),
      responsible_role: String(issue.responsible_role ?? 'developer'),
      description: String(issue.description ?? ''),
      html_snippet: String(issue.html_snippet ?? ''),
      css_selector: String(issue.css_selector ?? ''),
      fix_suggestion: String(issue.fix_suggestion ?? ''),
      status: String(issue.status ?? 'open')
    })),
    brokenLinks: (linksByPage.get(page.id) ?? []).map(link => ({
      href: String(link.href ?? ''),
      status: (link.status === 'broken' || link.status === 'redirected' ? link.status : 'broken') as 'broken' | 'redirected',
      status_code: Number(link.status_code) || 0,
      link_type: (link.link_type === 'external' ? 'external' : 'internal') as 'internal' | 'external'
    })),
    linkHrefs: (linksByPage.get(page.id) ?? []).map(link => String(link.href ?? '')).filter(Boolean),
    spelling: (spellingByPage.get(page.id) ?? []).map(entry => ({
      word: String(entry.word ?? ''),
      context: String(entry.context ?? ''),
      confidence: (entry.confidence === 'error' ? 'error' : 'review') as 'error' | 'review',
      status: String(entry.status ?? 'open')
    })),
    inventory: []
  }))
}

export function aggregateScoresForScan(
  scanId: string,
  pages: PageResult[],
  options?: AggregateScoresOptions
): AggregateScoresResult {
  const scoringOptions = { depthWeightedScoring: options?.depthWeightedScoring ?? false }
  const allIssues = scoreIssuesFromPageResults(pages, scoringOptions)
  const wcagLevelCounts: Record<string, number> = { A: 0, AA: 0, AAA: 0 }
  for (const issue of allIssues) {
    wcagLevelCounts[issue.wcag_level] = (wcagLevelCounts[issue.wcag_level] ?? 0) + 1
  }

  const result = aggregateScores(pages, options)
  logAggregateScores(scanId, pages.length, allIssues.length, result, {
    wcagLevelCounts,
    elementTotals: result.score_denominators.elements
  })
  return result
}

