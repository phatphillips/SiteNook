import type { Browser, BrowserContext, Page } from 'playwright'
import PQueue from 'p-queue'
import { runAxeOnPage } from '../accessibility/axeRunner.js'
import { buildAxeTags, getPostLoadDelay, getWaitUntil, VIEWPORT_SIZES, type ParsedScanConfig } from '../config/scanConfig.js'
import { checkLinksOnPage } from './linkChecker.js'
import { checkSpelling } from '../qa/spellChecker.js'
import { scoreReadability } from '../qa/readability.js'
import { filterUrls } from './urlPatterns.js'
import { isDisallowedByRobots } from './robots.js'
import { applyFormAuth } from './authHandler.js'
import { calculateScore } from '../accessibility/wcagMapper.js'

export interface CrawlOptions {
  startUrl: string
  config: ParsedScanConfig
  scanType: string
  initialUrls?: string[]
  robotsDisallows?: string[]
  sharedContext?: BrowserContext
}

export interface PageResult {
  url: string
  title: string
  statusCode: number
  wordCount: number
  readabilityScore: number
  crawlDepth: number
  htmlSnapshot: string
  issues: Awaited<ReturnType<typeof runAxeOnPage>>
  brokenLinks: Awaited<ReturnType<typeof checkLinksOnPage>>
  spelling: Awaited<ReturnType<typeof checkSpelling>>
  inventory: Array<{ url: string, content_type: string, mime_type: string, is_pdf: boolean, size_bytes: number }>
}

export async function crawlSite(
  browser: Browser,
  options: CrawlOptions,
  onProgress?: (crawled: number, total: number) => void
): Promise<PageResult[]> {
  const { config, startUrl } = options
  const origin = new URL(startUrl).origin
  const axeTags = buildAxeTags(config.wcagVersion, config.wcagLevels, config.bestPractices)
  const viewport = VIEWPORT_SIZES[config.viewport] || VIEWPORT_SIZES.desktop
  const waitUntil = getWaitUntil(config.waitStrategy)
  const postDelay = getPostLoadDelay(config.waitStrategy)
  const timeoutMs = (config.timeout || 30) * 1000

  const visited = new Set<string>()
  const results: PageResult[] = []
  const pQueue = new PQueue({ concurrency: config.concurrency })

  let queue: Array<{ url: string, depth: number }>

  if (options.initialUrls?.length) {
    queue = options.initialUrls.map(url => ({ url: normalizeUrl(url), depth: 0 }))
  } else {
    queue = [{ url: normalizeUrl(startUrl), depth: 0 }]
  }

  const followLinks = config.mode === 'full' && !options.initialUrls?.length
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

  while (queue.length > 0 && results.length < maxPages) {
    const batch: Array<{ url: string, depth: number }> = []
    while (queue.length > 0 && batch.length < config.concurrency && results.length + batch.length < maxPages) {
      const item = queue.shift()!
      if (visited.has(item.url)) continue
      if (config.respectRobots && isDisallowedByRobots(item.url, options.robotsDisallows || [])) continue
      visited.add(item.url)
      batch.push(item)
    }

    if (batch.length === 0) break

    await Promise.all(batch.map(item => pQueue.add(async () => {
      const page = await context.newPage()
      try {
        await page.setViewportSize(viewport)
        const response = await page.goto(item.url, { waitUntil, timeout: timeoutMs })
        if (postDelay > 0) await page.waitForTimeout(postDelay)

        const statusCode = response?.status() || 0
        if (statusCode >= 400) return

        const title = await page.title()
        const textContent = await page.evaluate(() => document.body?.innerText || '')
        const wordCount = textContent.split(/\s+/).filter(Boolean).length
        const readabilityScore = config.checkReadability ? scoreReadability(textContent) : 0
        const htmlSnapshot = await page.content()

        let issues: PageResult['issues'] = []
        let brokenLinks: PageResult['brokenLinks'] = []
        let spelling: PageResult['spelling'] = []

        if (options.scanType !== 'qa_only' && config.wcagLevels.length > 0) {
          try {
            issues = await runAxeOnPage(page, axeTags)
          } catch (err) {
            console.warn(`Axe scan failed for ${item.url}:`, err)
          }
        }

        if (options.scanType !== 'accessibility_only') {
          if (config.checkLinks) {
            brokenLinks = await checkLinksOnPage(page, origin)
          }
          if (config.checkSpelling) {
            spelling = checkSpelling(textContent)
          }
        }

        if (followLinks && item.depth < config.maxDepth) {
          const links = await extractLinks(page, origin, config.stayOnDomain)
          const filtered = filterUrls(links, config.includePatterns, config.excludePatterns)
          for (const link of filtered) {
            if (!visited.has(link) && !queue.some(q => q.url === link)) {
              if (config.respectRobots && isDisallowedByRobots(link, options.robotsDisallows || [])) continue
              queue.push({ url: link, depth: item.depth + 1 })
            }
          }
        }

        results.push({
          url: item.url,
          title,
          statusCode,
          wordCount,
          readabilityScore,
          crawlDepth: item.depth,
          htmlSnapshot: htmlSnapshot.slice(0, 100000),
          issues,
          brokenLinks,
          spelling,
          inventory: extractInventory(htmlSnapshot, item.url)
        })

        onProgress?.(results.length, Math.min(queue.length + results.length, maxPages))
      } catch (err) {
        console.error(`Failed to crawl ${item.url}:`, err)
      } finally {
        await page.close()
      }
    })))
  }

  if (ownsContext) await context.close()
  return results
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

export function aggregateScores(pages: PageResult[]) {
  const allIssues = pages.flatMap(p => p.issues)
  const levelA = allIssues.filter(i => i.wcag_level === 'A')
  const levelAA = allIssues.filter(i => i.wcag_level === 'AA')
  const levelAAA = allIssues.filter(i => i.wcag_level === 'AAA')

  const brokenCount = pages.reduce((n, p) => n + p.brokenLinks.filter(l => l.status === 'broken').length, 0)
  const spellingCount = pages.reduce((n, p) => n + p.spelling.filter(s => s.confidence === 'error').length, 0)
  const qaScore = Math.max(0, 100 - brokenCount * 2 - spellingCount)

  return {
    score_a: calculateScore(levelA),
    score_aa: calculateScore(levelAA),
    score_aaa: calculateScore(levelAAA),
    score_qa: qaScore
  }
}

