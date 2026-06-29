import type PocketBase from 'pocketbase'
import type { Browser, BrowserContext, Page } from 'playwright'
import PQueue from 'p-queue'
import { DEFAULT_AXE_TAGS, runAxeOnPage } from '../accessibility/axeRunner.js'
import { getPostLoadDelay, getWaitUntil, VIEWPORT_SIZES, type ParsedScanConfig } from '../config/scanConfig.js'
import { checkLinksOnPage, extractLinkHrefsFromPage } from './linkChecker.js'
import { checkSpelling } from '../qa/spellChecker.js'
import { countWords, extractMainContentFromPage } from '../qa/extractMainContent.js'
import { scoreReadability, scoreAllReadabilityMethods, parseStoredReadabilityScores } from '../qa/readability.js'
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
import { isHttpUrl } from '../db/recordSanitize.js'
import { CrawlDiagnostics, type CrawlStopReason } from './crawlDiagnostics.js'
import { retryForbiddenWithBackoff } from './wafRetry.js'
import type { ScanLogEventInput } from '../db/scanLogEvents.js'
import { recordInternalLinks } from '../seo/linkGraph.js'
import { runPageSeoChecks, shouldRunAccessibility, shouldRunQa, shouldRunSeo } from '../seo/scanSeo.js'
import type { SeoSettings } from '../seo/types.js'
import { DEFAULT_SEO_SETTINGS } from '../seo/types.js'

export interface CrawlOptions {
  startUrl: string
  config: ParsedScanConfig
  scanType: string
  seoSettings?: SeoSettings
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
  issues: Awaited<ReturnType<typeof runAxeOnPage>>
  brokenLinks: Awaited<ReturnType<typeof checkLinksOnPage>>
  linkHrefs: string[]
  spelling: Awaited<ReturnType<typeof checkSpelling>>
  inventory: Array<{ url: string, content_type: string, mime_type: string, is_pdf: boolean, size_bytes: number }>
  seoSnapshot?: import('../seo/types.js').SeoSnapshot
  seoIssues?: import('../seo/types.js').SeoIssueDraft[]
}

export async function crawlSite(
  browser: Browser,
  options: CrawlOptions,
  onProgress?: (crawled: number, total: number) => void
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
  const context = options.sharedContext || await browser.newContext()

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

      diag.recordAttempt()
      const page = await context.newPage()
      try {
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
        if (statusCode === 403) {
          const wafResult = await retryForbiddenWithBackoff(page, item.url, {
            timeoutMs,
            onWafRetry: async ({ attempt, delayMs }) => {
              const sec = Math.round(delayMs / 1000)
              await emitLog({
                level: 'warn',
                message: `HTTP 403 (WAF) — retry ${attempt}/2 in ${sec}s`,
                url: item.url
              })
            }
          })
          response = wafResult.response
          statusCode = wafResult.statusCode
        }

        if (postDelay > 0) await page.waitForTimeout(postDelay)

        if (statusCode >= 400) {
          diag.recordHttpError(statusCode, item.url)
          await emitLog({
            level: 'error',
            message: `HTTP ${statusCode} — page not scanned`,
            url: item.url
          })
          return
        }

        const title = await page.title()
        const textContent = await extractMainContentFromPage(page)
        const wordCount = countWords(textContent)
        const readabilityScores = scoreAllReadabilityMethods(textContent)
        const readabilityScore = scoreReadability(textContent)
        const htmlSnapshot = await page.content()

        let issues: PageResult['issues'] = []
        let brokenLinks: PageResult['brokenLinks'] = []
        let linkHrefs: string[] = []
        let spelling: PageResult['spelling'] = []

        if (shouldRunAccessibility(options.scanType)) {
          try {
            issues = await runAxeOnPage(page, DEFAULT_AXE_TAGS)
          } catch (err) {
            console.warn(`Axe scan failed for ${item.url}:`, err)
          }
        }

        if (shouldRunQa(options.scanType)) {
          linkHrefs = await extractLinkHrefsFromPage(page)
          brokenLinks = await checkLinksOnPage(page, origin, linkHrefs)
          spelling = checkSpelling(textContent)
        }

        let seoSnapshot: PageResult['seoSnapshot']
        let seoIssues: PageResult['seoIssues']
        if (shouldRunSeo(options.scanType, seoSettings)) {
          const seo = runPageSeoChecks({
            url: item.url,
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
          recordInternalLinks(internalLinkGraph, item.url, seo.internalLinks, origin)
        }

        if (followLinks && item.depth < config.maxDepth) {
          const links = await extractLinks(page, origin, config.stayOnDomain)
          if (!shouldRunSeo(options.scanType, seoSettings)) {
            recordInternalLinks(internalLinkGraph, item.url, links, origin)
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

        const pageResult: PageResult = {
          url: item.url,
          title,
          statusCode,
          wordCount,
          readabilityScore,
          readabilityScores,
          crawlDepth: item.depth,
          htmlSnapshot: htmlSnapshot.slice(0, 100000),
          issues,
          brokenLinks,
          linkHrefs,
          spelling,
          inventory: extractInventory(htmlSnapshot, item.url),
          seoSnapshot,
          seoIssues
        }

        results.push(pageResult)
        diag.recordSuccess()
        await options.onPageComplete?.(pageResult)

        onProgress?.(results.length, Math.min(queue.length + results.length, maxPages))
      } catch (err) {
        diag.recordException(item.url, err)
        const reason = err instanceof Error ? err.message : String(err)
        await emitLog({
          level: 'error',
          message: reason.slice(0, 500),
          url: item.url
        })
        console.error(`Failed to crawl ${item.url}:`, err)
      } finally {
        await page.close()
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
    .map((h) => {
      try {
        const u = new URL(h)
        if (stayOnDomain && u.origin !== origin) return null
        u.hash = ''
        return u.toString()
      } catch {
        return null
      }
    })
    .filter((u): u is string => !!u)
}

function extractInventory(html: string, pageUrl: string) {
  const items: PageResult['inventory'] = []
  const regex = /(?:src|href)=["']([^"']+)["']/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    try {
      const url = new URL(match[1], pageUrl).toString()
      if (!isHttpUrl(url)) continue
      const isPdf = url.toLowerCase().endsWith('.pdf')
      items.push({
        url,
        content_type: isPdf ? 'pdf' : 'asset',
        mime_type: isPdf ? 'application/pdf' : 'unknown',
        is_pdf: isPdf,
        size_bytes: 0
      })
    } catch {
      // skip invalid URLs
    }
  }
  return items
}

function normalizeUrl(url: string): string {
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
    score_denominators: result.score_denominators
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
  const accessibility = calculateSiteimproveScores(allIssues, elementTotals)
  const scoreBestPractices = scoreBestPracticeCategory(allIssues, elementTotals)

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
    score_denominators
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
  const pageFields = 'id,url,title,status_code,word_count,readability_score,readability_scores,crawl_depth,html_snapshot'
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

