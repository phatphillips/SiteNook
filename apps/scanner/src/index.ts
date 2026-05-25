import { chromium } from 'playwright'
import { authenticateAdmin, batchCreate, getPocketBase } from './db/pocketbaseClient.js'
import { crawlSite, aggregateScores } from './crawler/siteCrawler.js'
import { runPolicies, type Policy } from './qa/policyEngine.js'
import { diffScans } from './accessibility/diffEngine.js'
import { initSpellChecker } from './qa/spellChecker.js'
import { parseRawConfig } from './config/scanConfig.js'
import { parseSitemap } from './crawler/sitemapParser.js'
import { filterUrls } from './crawler/urlPatterns.js'
import { loadRobotsDisallows } from './crawler/robots.js'
import { createAuthenticatedContext } from './crawler/authHandler.js'

const POLL_INTERVAL = Number(process.env.SCANNER_POLL_INTERVAL_MS || 10000)
const MAX_PAGES = Number(process.env.MAX_PAGES_PER_SCAN || 500)

let pollFailures = 0
let pollBackoffMs = 5000
let missingCollectionLogged = false

async function loadPolicies(siteId: string): Promise<Policy[]> {
  const pb = getPocketBase()

  try {
    const records = await pb.collection('policies').getFullList()
    return records.filter((record) => {
      const policySite = (record as { site?: string }).site
      return !policySite || policySite === siteId
    }) as unknown as Policy[]
  } catch (err) {
    console.warn('Could not load policies, continuing without policy checks:', err)
    return []
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

  if (config.mode === 'pages' && config.pages.length) {
    return filterUrls(config.pages, config.includePatterns, config.excludePatterns)
  }

  if (config.mode === 'sitemap' && config.sitemapUrl) {
    const urls = await parseSitemap(config.sitemapUrl, config.maxPages * 2)
    return filterUrls(urls, config.includePatterns, config.excludePatterns).slice(0, config.maxPages)
  }

  return []
}

async function processQueueItem(queueId: string) {
  const pb = getPocketBase()
  const queueItem = await pb.collection('scan_queue').getOne(queueId, { expand: 'site' })
  const site = queueItem.expand?.site as {
    id: string
    url: string
    custom_headers?: Record<string, string>
  }
  const targetUrl = queueItem.target_url as string | undefined
  const rawConfig = queueItem.raw_config
  const config = parseRawConfig(rawConfig)

  if (!config.maxPages) config.maxPages = MAX_PAGES

  if (!site?.url) {
    await pb.collection('scan_queue').update(queueId, { status: 'failed' })
    return
  }

  const startUrl = targetUrl || site.url
  const scanType = (queueItem.scan_type as string) || 'full'

  const mergedHeaders = {
    ...(site.custom_headers || {}),
    ...(config.customHeaders || {})
  }

  const scan = await pb.collection('scans').create({
    site: site.id,
    status: 'running',
    scan_type: scanType,
    pages_crawled: 0,
    started_at: new Date().toISOString(),
    wcag_version: config.wcagVersion,
    raw_config: typeof rawConfig === 'string'
      ? JSON.parse(rawConfig)
      : (rawConfig || config)
  })

  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
  } catch (err) {
    console.error('Browser launch failed:', err)
    await pb.collection('scans').update(scan.id, { status: 'failed' })
    await pb.collection('scan_queue').update(queueId, { status: 'failed' })
    return
  }

  try {
    if (config.checkSpelling) {
      try {
        await initSpellChecker()
      } catch (err) {
        console.warn('Spell checker unavailable, continuing without spelling checks:', err)
      }
    }

    const policies = config.runPolicies ? await loadPolicies(site.id) : []
    const robotsDisallows = config.respectRobots
      ? await loadRobotsDisallows(new URL(startUrl).origin)
      : []

    const prebuiltUrls = await buildUrlQueue(startUrl, config, targetUrl)
    const useUrlList = prebuiltUrls.length > 0

    const context = await createAuthenticatedContext(browser, {
      auth: config.auth,
      customHeaders: mergedHeaders,
      userAgent: config.userAgent
    })

    const pages = await crawlSite(browser, {
      startUrl,
      config: {
        ...config,
        maxPages: useUrlList ? Math.min(config.maxPages, prebuiltUrls.length || config.maxPages) : config.maxPages
      },
      scanType,
      initialUrls: useUrlList ? prebuiltUrls.slice(0, config.maxPages) : undefined,
      robotsDisallows,
      sharedContext: context
    }, async (crawled) => {
      await pb.collection('scans').update(scan.id, { pages_crawled: crawled })
    })

    await context.close()

    for (const pageResult of pages) {
      const pageRecord = await pb.collection('pages').create({
        scan: scan.id,
        site: site.id,
        url: pageResult.url,
        title: pageResult.title,
        status_code: pageResult.statusCode,
        word_count: pageResult.wordCount,
        readability_score: pageResult.readabilityScore,
        crawl_depth: pageResult.crawlDepth,
        html_snapshot: pageResult.htmlSnapshot.slice(0, 50000)
      })

      await batchCreate('accessibility_issues', pageResult.issues.map(issue => ({
        ...issue,
        scan: scan.id,
        page: pageRecord.id
      })))

      if (config.checkLinks) {
        await batchCreate('qa_broken_links', pageResult.brokenLinks.map(link => ({
          ...link,
          scan: scan.id,
          page: pageRecord.id
        })))
      }

      if (config.checkSpelling) {
        await batchCreate('qa_spelling', pageResult.spelling.map(s => ({
          ...s,
          scan: scan.id,
          page: pageRecord.id
        })))
      }

      await batchCreate('qa_inventory', pageResult.inventory.map(item => ({
        ...item,
        scan: scan.id
      })))

      if (config.runPolicies && policies.length) {
        const policyMatches = runPolicies(pageResult.htmlSnapshot, policies).map(m => ({
          ...m,
          scan: scan.id,
          page: pageRecord.id
        }))
        await batchCreate('policy_matches', policyMatches)
      }
    }

    const scores = aggregateScores(pages)

    let diffSummary = null
    if (config.diffFromPrevious) {
      const previousScans = await pb.collection('scans').getList(1, 1, {
        filter: `site = "${site.id}" && status = 'complete' && id != "${scan.id}"`,
        sort: '-completed_at'
      })

      if (previousScans.items.length > 0) {
        const prevScanId = previousScans.items[0].id
        const [currentIssues, previousIssues] = await Promise.all([
          pb.collection('accessibility_issues').getFullList({ filter: `scan = "${scan.id}"`, expand: 'page' }),
          pb.collection('accessibility_issues').getFullList({ filter: `scan = "${prevScanId}"`, expand: 'page' })
        ])

        diffSummary = diffScans(
          currentIssues.map(i => ({
            id: i.id,
            rule_id: i.rule_id,
            css_selector: i.css_selector,
            page_url: (i.expand as { page?: { url: string } })?.page?.url || ''
          })),
          previousIssues.map(i => ({
            id: i.id,
            rule_id: i.rule_id,
            css_selector: i.css_selector,
            page_url: (i.expand as { page?: { url: string } })?.page?.url || ''
          }))
        )
      }
    }

    await pb.collection('scans').update(scan.id, {
      status: 'complete',
      pages_crawled: pages.length,
      completed_at: new Date().toISOString(),
      ...scores,
      diff_summary: diffSummary
    })

    await pb.collection('scan_queue').update(queueId, { status: 'complete' })
    console.log(`Scan complete for ${startUrl}: ${pages.length} pages`)
  } catch (err) {
    console.error('Scan failed:', err)
    await pb.collection('scans').update(scan.id, { status: 'failed' })
    await pb.collection('scan_queue').update(queueId, { status: 'failed' })
  } finally {
    await browser?.close()
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

async function pollQueue() {
  const pb = getPocketBase()

  try {
    const pending = await pb.collection('scan_queue').getList(1, 1, {
      filter: "status = 'pending'",
      sort: '-priority,id'
    })

    pollFailures = 0
    pollBackoffMs = 5000
    missingCollectionLogged = false

    if (pending.items.length === 0) return

    const item = pending.items[0]
    await pb.collection('scan_queue').update(item.id, { status: 'processing' })
    await processQueueItem(item.id)
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
  const delay = pollFailures > 0 ? pollBackoffMs : POLL_INTERVAL
  setTimeout(pollLoop, delay)
}

async function main() {
  console.log('AccessIQ Scanner starting...')
  await authenticateAdmin()
  console.log('Authenticated with PocketBase')
  console.log('Polling queue...')
  pollLoop()
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
