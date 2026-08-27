import type { Page } from 'playwright'
import { DEFAULT_AXE_TAGS, runAxeOnPage } from '../accessibility/axeRunner.js'
import { getPostLoadDelay, getWaitUntil, VIEWPORT_SIZES, type ParsedScanConfig } from '../config/scanConfig.js'
import { checkLinksOnPage, extractLinkHrefsFromPage } from './linkChecker.js'
import { checkSpelling } from '../qa/spellChecker.js'
import { countWords, extractMainContentFromPage } from '../qa/extractMainContent.js'
import { scoreReadability, scoreAllReadabilityMethods } from '../qa/readability.js'
import {
  challengeBlockLogMessage,
  isWafBlockedStatus,
  resolveNavigationChallenge,
  responseHasSgCaptcha
} from './challengePage.js'
import { retryForbiddenWithBackoff } from './wafRetry.js'
import type { PageResult } from './siteCrawler.js'
import type { ScanLogEventInput } from '../db/scanLogEvents.js'
import { isHttpUrl } from '../db/recordSanitize.js'
import { inventoryAssetFromUrl } from '../qa/inventoryUrl.js'
import { runPageSeoChecks, shouldRunAccessibility, shouldRunQa, shouldRunSeo } from '../seo/scanSeo.js'
import type { SeoSettings } from '../seo/types.js'
import { DEFAULT_SEO_SETTINGS } from '../seo/types.js'
import { truncateHtmlSnapshot } from '../utils/truncateHtmlSnapshot.js'
import { captureSimulatorPreview, preparePageForPreviewCapture, waitForRenderedContent } from './captureSimulatorPreview.js'
import { serializeRenderedPage, inlinePageAssetsForPreview } from './serializeRenderedHtml.js'
import { renderedHtmlBufferFromSnapshot } from '../db/attachPageRenderedHtml.js'
import { extractContentMarkdown } from '../content/extractContentMarkdown.js'
import { settlePageForAxe } from './settlePageForAxe.js'
import { normalizeUrl } from './siteCrawler.js'

export interface ScanOnePageOptions {
  url: string
  depth?: number
  config: ParsedScanConfig
  scanType: string
  origin: string
  startUrl?: string
  seoSettings?: SeoSettings
  /** CSS selectors excluded from axe (from exclude_from_accessibility policies). */
  axeExcludeSelectors?: string[]
  onCrawlLog?: (event: ScanLogEventInput) => void | Promise<void>
}

export type ScanOnePageOutcome =
  | { ok: true, page: PageResult }
  | { ok: false, statusCode: number }

function extractInventory(html: string, pageUrl: string): PageResult['inventory'] {
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

export async function scanOnePage(
  page: Page,
  options: ScanOnePageOptions
): Promise<ScanOnePageOutcome> {
  const { url, config, scanType, origin, onCrawlLog } = options
  const depth = options.depth ?? 0
  const startUrl = options.startUrl ?? url
  const seoSettings = options.seoSettings ?? DEFAULT_SEO_SETTINGS
  const viewport = VIEWPORT_SIZES[config.viewport] || VIEWPORT_SIZES.desktop
  const waitUntil = getWaitUntil(config.waitStrategy)
  const postDelay = getPostLoadDelay(config.waitStrategy)
  const timeoutMs = (config.timeout || 30) * 1000
  const emitLog = async (event: ScanLogEventInput) => {
    if (onCrawlLog) await onCrawlLog(event)
  }

  await page.setViewportSize(viewport)
  let response = await page.goto(url, { waitUntil, timeout: timeoutMs }).catch(async (err) => {
    if (waitUntil === 'networkidle') {
      await emitLog({
        level: 'warn',
        message: 'networkidle timeout — retrying with load',
        url
      })
      return page.goto(url, { waitUntil: 'load', timeout: timeoutMs })
    }
    throw err
  })

  let statusCode = response?.status() || 0
  if (isWafBlockedStatus(statusCode) || responseHasSgCaptcha(response)) {
    const wafResult = await retryForbiddenWithBackoff(page, url, {
      timeoutMs,
      onWafRetry: async ({ attempt, delayMs }) => {
        const sec = Math.round(delayMs / 1000)
        await emitLog({
          level: 'warn',
          message: `HTTP ${statusCode || 403} (WAF) — retry ${attempt}/2 in ${sec}s`,
          url
        })
      }
    })
    response = wafResult.response
    statusCode = wafResult.statusCode
  }

  if (postDelay > 0) await page.waitForTimeout(postDelay)

  const challenge = await resolveNavigationChallenge(page, response)
  if (challenge.blocked && challenge.kind) {
    await emitLog({
      level: 'error',
      message: challengeBlockLogMessage(challenge.kind),
      url
    })
    return { ok: false, statusCode: statusCode === 202 ? 202 : 403 }
  }

  if (statusCode >= 400) {
    await emitLog({
      level: 'error',
      message: `HTTP ${statusCode} — page not scanned`,
      url
    })
    return { ok: false, statusCode }
  }

  await settlePageForAxe(page)

  let storedUrl = url
  try {
    const finalUrl = page.url()
    if (finalUrl.startsWith('http')) storedUrl = normalizeUrl(finalUrl)
  } catch {
    // keep requested URL
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

  if (shouldRunAccessibility(scanType)) {
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
        message: 'Accessibility scan failed — page saved without issue results',
        url: storedUrl
      })
    }
  }

  if (shouldRunQa(scanType)) {
    linkHrefs = await extractLinkHrefsFromPage(page)
    brokenLinks = await checkLinksOnPage(page, origin, linkHrefs)
    spelling = checkSpelling(textContent)
  }

  let previewImage: Buffer | undefined
  let tabOrder: PageResult['tabOrder']
  try {
    const preview = await captureSimulatorPreview(page)
    previewImage = preview.previewImage
    tabOrder = preview.tabOrder
  } catch (err) {
    console.warn(`Simulator preview capture failed for ${url}:`, err)
    await preparePageForPreviewCapture(page).catch(() => {})
  }

  await waitForRenderedContent(page).catch(() => {})
  const htmlSnapshot = await serializeRenderedPage(page).catch(async () => page.content())
  const htmlSizeBytes = Buffer.byteLength(htmlSnapshot, 'utf8')
  const previewHtml = await inlinePageAssetsForPreview(page, htmlSnapshot).catch(() => htmlSnapshot)
  const contentMarkdown = extractContentMarkdown(htmlSnapshot, storedUrl) ?? undefined

  let seoSnapshot: PageResult['seoSnapshot']
  let seoIssues: PageResult['seoIssues']
  if (shouldRunSeo(scanType, seoSettings)) {
    const seo = runPageSeoChecks({
      url: storedUrl,
      title,
      wordCount,
      readabilityScore,
      crawlDepth: depth,
      htmlSnapshot,
      startUrl,
      axeRuleIds: issues.map(i => i.rule_id),
      settings: seoSettings
    })
    seoSnapshot = seo.snapshot
    seoIssues = seo.issues
  }

  return {
    ok: true,
    page: {
      url: storedUrl,
      title,
      statusCode,
      wordCount,
      readabilityScore,
      readabilityScores,
      crawlDepth: depth,
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
  }
}
