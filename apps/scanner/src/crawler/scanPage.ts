import type { Page } from 'playwright'
import { DEFAULT_AXE_TAGS, runAxeOnPage } from '../accessibility/axeRunner.js'
import { getPostLoadDelay, getWaitUntil, VIEWPORT_SIZES, type ParsedScanConfig } from '../config/scanConfig.js'
import { checkLinksOnPage, extractLinkHrefsFromPage } from './linkChecker.js'
import { checkSpelling } from '../qa/spellChecker.js'
import { countWords, extractMainContentFromPage } from '../qa/extractMainContent.js'
import { scoreReadability, scoreAllReadabilityMethods } from '../qa/readability.js'
import { retryForbiddenWithBackoff } from './wafRetry.js'
import type { PageResult } from './siteCrawler.js'
import type { ScanLogEventInput } from '../db/scanLogEvents.js'
import { isHttpUrl } from '../db/recordSanitize.js'
import { runPageSeoChecks, shouldRunAccessibility, shouldRunQa, shouldRunSeo } from '../seo/scanSeo.js'
import type { SeoSettings } from '../seo/types.js'
import { DEFAULT_SEO_SETTINGS } from '../seo/types.js'

export interface ScanOnePageOptions {
  url: string
  depth?: number
  config: ParsedScanConfig
  scanType: string
  origin: string
  startUrl?: string
  seoSettings?: SeoSettings
  onCrawlLog?: (event: ScanLogEventInput) => void | Promise<void>
}

export type ScanOnePageOutcome =
  | { ok: true, page: PageResult }
  | { ok: false, statusCode: number }

function extractInventory(html: string, pageUrl: string): PageResult['inventory'] {
  const items: PageResult['inventory'] = []
  const regex = /(?:src|href)=["']([^"']+)["']/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    try {
      const assetUrl = new URL(match[1], pageUrl).toString()
      if (!isHttpUrl(assetUrl)) continue
      const isPdf = assetUrl.toLowerCase().endsWith('.pdf')
      items.push({
        url: assetUrl,
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
  if (statusCode === 403) {
    const wafResult = await retryForbiddenWithBackoff(page, url, {
      timeoutMs,
      onWafRetry: async ({ attempt, delayMs }) => {
        const sec = Math.round(delayMs / 1000)
        await emitLog({
          level: 'warn',
          message: `HTTP 403 (WAF) — retry ${attempt}/2 in ${sec}s`,
          url
        })
      }
    })
    response = wafResult.response
    statusCode = wafResult.statusCode
  }

  if (postDelay > 0) await page.waitForTimeout(postDelay)

  if (statusCode >= 400) {
    await emitLog({
      level: 'error',
      message: `HTTP ${statusCode} — page not scanned`,
      url
    })
    return { ok: false, statusCode }
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

  if (shouldRunAccessibility(scanType)) {
    try {
      issues = await runAxeOnPage(page, DEFAULT_AXE_TAGS)
    } catch (err) {
      console.warn(`Axe scan failed for ${url}:`, err)
    }
  }

  if (shouldRunQa(scanType)) {
    linkHrefs = await extractLinkHrefsFromPage(page)
    brokenLinks = await checkLinksOnPage(page, origin, linkHrefs)
    spelling = checkSpelling(textContent)
  }

  let seoSnapshot: PageResult['seoSnapshot']
  let seoIssues: PageResult['seoIssues']
  if (shouldRunSeo(scanType, seoSettings)) {
    const seo = runPageSeoChecks({
      url,
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
      url,
      title,
      statusCode,
      wordCount,
      readabilityScore,
      readabilityScores,
      crawlDepth: depth,
      htmlSnapshot: htmlSnapshot.slice(0, 100000),
      issues,
      brokenLinks,
      linkHrefs,
      spelling,
      inventory: extractInventory(htmlSnapshot, url),
      seoSnapshot,
      seoIssues
    }
  }
}
