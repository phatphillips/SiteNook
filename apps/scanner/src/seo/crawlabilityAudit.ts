import {
  checkAiBotStatus,
  fetchRobotsTxt,
  KNOWN_AI_BOTS,
  type AiBotStatus
} from '../crawler/robots.js'
import {
  auditSitemap,
  resolveSitemapUrl,
  type SitemapAuditResult
} from '../crawler/sitemapParser.js'
import { normalizeSeoUrl } from './linkGraph.js'
import { checkLlmsTxt } from './llmsChecker.js'
import { ruleMeta } from './seoRuleCatalog.js'
import type { SeoCrawlAudit, SeoIssueDraft, SeoSnapshot } from './types.js'

const SITEMAP_SAMPLE_SIZE = 50
const MAX_SAMPLE_URLS_IN_EVIDENCE = 5
const FETCH_TIMEOUT_MS = 5000

export interface CrawlabilityAuditContext {
  origin: string
  startUrl: string
  configSitemapUrl?: string
  /** Crawled pages for noindex cross-reference */
  crawledPages: Array<{ url: string, seoSnapshot?: SeoSnapshot }>
}

export interface CrawlabilityAuditResult {
  issues: SeoIssueDraft[]
  audit: SeoCrawlAudit
}

function pushIssue(
  issues: SeoIssueDraft[],
  ruleId: string,
  pageUrl: string | undefined,
  extra?: Partial<SeoIssueDraft>
): void {
  const meta = ruleMeta(ruleId)
  issues.push({
    rule_id: ruleId,
    category: meta.category,
    subcategory: meta.subcategory,
    severity: meta.severity,
    title: meta.title,
    description: meta.title,
    recommendation: meta.recommendation,
    ...(pageUrl ? { pageUrl } : {}),
    ...extra
  })
}

function formatBotSummary(aiBots: Record<string, AiBotStatus>): string {
  const parts: string[] = []
  for (const bot of KNOWN_AI_BOTS) {
    const status = aiBots[bot]
    if (status === 'blocked') parts.push(`${bot} blocked`)
    else if (status === 'allowed') parts.push(`${bot} allowed`)
  }
  return parts.join(' · ')
}

function buildRobotsSummary(
  found: boolean,
  declaresSitemap: boolean,
  aiBots: Record<string, AiBotStatus>
): string {
  if (!found) return 'Not reachable'
  const parts: string[] = []
  parts.push(declaresSitemap ? 'Declares sitemap' : 'No Sitemap: directive')
  const botPart = formatBotSummary(aiBots)
  if (botPart) parts.push(botPart)
  return parts.join(' · ')
}

function buildSitemapSummary(
  audit: SitemapAuditResult,
  badUrlCount: number,
  noindexCount: number,
  sampledCount: number
): string {
  if (!audit.found) {
    return audit.status ? `Not reachable (HTTP ${audit.status})` : 'Not reachable'
  }
  const parts: string[] = []
  const viaLabel = audit.discoveredVia === 'robots'
    ? 'via robots.txt'
    : audit.discoveredVia === 'scan_config'
      ? 'via scan config'
      : 'at default path'
  parts.push(`${audit.urlCount} URLs · ${viaLabel}`)
  if (!audit.validXml) parts.push('invalid XML')
  else parts.push('valid XML')
  if (badUrlCount > 0) parts.push(`${badUrlCount} sampled URL(s) returned errors`)
  if (noindexCount > 0) parts.push(`${noindexCount} noindex URL(s) in sitemap`)
  if (sampledCount > 0 && badUrlCount === 0 && noindexCount === 0) {
    parts.push(`${sampledCount} URLs sampled — no issues`)
  }
  return parts.join(' · ')
}

function buildLlmsSummary(found: boolean, valid: boolean, url: string): string {
  if (!found) return `Not found at ${new URL(url).pathname}`
  if (!valid) return 'Present but missing site summary or links'
  return 'Present · site summary and links found'
}

function isNoindexSnapshot(snapshot?: SeoSnapshot): boolean {
  return (snapshot?.robotsMeta ?? '').toLowerCase().includes('noindex')
}

async function probeUrl(url: string): Promise<{ status?: number, redirect?: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': 'SiteNook-Scanner/1.0' }
    })
    if (res.status >= 300 && res.status < 400) {
      return { status: res.status, redirect: res.headers.get('location') ?? undefined }
    }
    if (res.status === 405 || res.status === 501) {
      const getRes = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'SiteNook-Scanner/1.0' }
      })
      if (getRes.status >= 300 && getRes.status < 400) {
        return { status: getRes.status, redirect: getRes.headers.get('location') ?? undefined }
      }
      return { status: getRes.status }
    }
    return { status: res.status }
  } catch {
    return {}
  } finally {
    clearTimeout(timeout)
  }
}

async function probeSitemapUrls(
  sitemapAudit: SitemapAuditResult,
  crawledPages: Array<{ url: string, seoSnapshot?: SeoSnapshot }>
): Promise<{
  badUrls: string[]
  noindexUrls: string[]
  sampledCount: number
}> {
  const crawledByUrl = new Map<string, SeoSnapshot | undefined>()
  for (const p of crawledPages) {
    crawledByUrl.set(normalizeSeoUrl(p.url), p.seoSnapshot)
  }

  const toSample = sitemapAudit.pageUrls.slice(0, SITEMAP_SAMPLE_SIZE)
  const badUrls: string[] = []
  const noindexUrls: string[] = []

  for (const url of toSample) {
    const normalized = normalizeSeoUrl(url)
    const snapshot = crawledByUrl.get(normalized)
    if (isNoindexSnapshot(snapshot)) {
      noindexUrls.push(url)
      continue
    }
    if (!snapshot) {
      const probe = await probeUrl(url)
      if (probe.redirect) {
        badUrls.push(url)
        continue
      }
      if (probe.status && probe.status >= 400) {
        badUrls.push(url)
      }
    }
  }

  return { badUrls, noindexUrls, sampledCount: toSample.length }
}

/** Site-level crawlability audit (robots, sitemap, llms.txt). */
export async function runCrawlabilityAudit(
  ctx: CrawlabilityAuditContext
): Promise<CrawlabilityAuditResult> {
  const issues: SeoIssueDraft[] = []
  const homepageUrl = ctx.startUrl

  const [robotsResult, llmsResult] = await Promise.all([
    fetchRobotsTxt(ctx.origin),
    checkLlmsTxt(ctx.origin)
  ])

  const aiBots = robotsResult.parsed
    ? checkAiBotStatus(robotsResult.parsed)
    : Object.fromEntries(KNOWN_AI_BOTS.map(b => [b, 'allowed' as AiBotStatus]))

  const declaresSitemap = (robotsResult.parsed?.sitemapUrls.length ?? 0) > 0
  const sitemapResolve = resolveSitemapUrl(
    ctx.origin,
    robotsResult.parsed?.sitemapUrls ?? [],
    ctx.configSitemapUrl
  )

  let sitemapAudit: SitemapAuditResult = {
    url: sitemapResolve.url,
    discoveredVia: sitemapResolve.discoveredVia,
    found: false,
    validXml: false,
    isIndex: false,
    urlCount: 0,
    pageUrls: [],
    entries: [],
    specialized: {},
    overUrlLimit: false,
    overSizeLimit: false,
    relativeUrlCount: 0,
    childSitemapCount: 0,
    lastmodCoverage: 0,
    staleLastmod: false
  }

  if (!robotsResult.found) {
    pushIssue(issues, 'robots-unreachable', homepageUrl, {
      current_value: robotsResult.status ? `HTTP ${robotsResult.status}` : 'fetch failed'
    })
  } else if (!declaresSitemap) {
    pushIssue(issues, 'robots-missing-sitemap-directive', homepageUrl)
  }

  if (robotsResult.found && robotsResult.parsed) {
    const blockedBots = KNOWN_AI_BOTS.filter(b => aiBots[b] === 'blocked')
    if (blockedBots.length) {
      pushIssue(issues, 'ai-bot-blocked', homepageUrl, {
        evidence: { blockedBots, aiBots },
        current_value: blockedBots.join(', ')
      })
    }
  }

  sitemapAudit = await auditSitemap(sitemapResolve.url, sitemapResolve.discoveredVia)

  if (!sitemapAudit.found) {
    pushIssue(issues, 'sitemap-unreachable', homepageUrl, {
      current_value: sitemapAudit.status ? `HTTP ${sitemapAudit.status}` : 'fetch failed',
      evidence: { url: sitemapAudit.url, discoveredVia: sitemapAudit.discoveredVia }
    })
  } else if (!sitemapAudit.validXml) {
    pushIssue(issues, 'sitemap-invalid-xml', homepageUrl, {
      current_value: sitemapAudit.url
    })
  } else {
    if (sitemapAudit.overUrlLimit || sitemapAudit.overSizeLimit) {
      pushIssue(issues, 'sitemap-over-limit', homepageUrl, {
        evidence: {
          urlCount: sitemapAudit.urlCount,
          overUrlLimit: sitemapAudit.overUrlLimit,
          overSizeLimit: sitemapAudit.overSizeLimit
        }
      })
    }
    if (sitemapAudit.relativeUrlCount > 0) {
      pushIssue(issues, 'sitemap-relative-url', homepageUrl, {
        current_value: String(sitemapAudit.relativeUrlCount),
        evidence: { count: sitemapAudit.relativeUrlCount }
      })
    }
    if (sitemapAudit.lastmodCoverage < 50 && sitemapAudit.entries.length > 0) {
      pushIssue(issues, 'sitemap-missing-lastmod', homepageUrl, {
        current_value: `${sitemapAudit.lastmodCoverage}%`,
        evidence: { lastmodCoverage: sitemapAudit.lastmodCoverage }
      })
    }
    if (sitemapAudit.staleLastmod) {
      pushIssue(issues, 'sitemap-stale-lastmod', homepageUrl)
    }
    if (sitemapAudit.childSitemapCount > 1 && !sitemapAudit.isIndex) {
      pushIssue(issues, 'sitemap-index-missing', homepageUrl, {
        evidence: { childSitemapCount: sitemapAudit.childSitemapCount }
      })
    }
  }

  let badUrlCount = 0
  let noindexCount = 0
  let sampledCount = 0

  if (sitemapAudit.found && sitemapAudit.validXml && sitemapAudit.pageUrls.length > 0) {
    const probe = await probeSitemapUrls(sitemapAudit, ctx.crawledPages)
    badUrlCount = probe.badUrls.length
    noindexCount = probe.noindexUrls.length
    sampledCount = probe.sampledCount

    if (badUrlCount > 0) {
      pushIssue(issues, 'sitemap-bad-urls', homepageUrl, {
        evidence: {
          count: badUrlCount,
          sampleUrls: probe.badUrls.slice(0, MAX_SAMPLE_URLS_IN_EVIDENCE)
        }
      })
    }
    if (noindexCount > 0) {
      pushIssue(issues, 'sitemap-noindex-urls', homepageUrl, {
        evidence: {
          count: noindexCount,
          sampleUrls: probe.noindexUrls.slice(0, MAX_SAMPLE_URLS_IN_EVIDENCE)
        }
      })
    }
  }

  if (!llmsResult.found) {
    pushIssue(issues, 'llms-missing', homepageUrl, { current_value: llmsResult.url })
  } else if (!llmsResult.valid) {
    pushIssue(issues, 'llms-invalid-format', homepageUrl)
  }

  const audit: SeoCrawlAudit = {
    robots: {
      found: robotsResult.found,
      url: robotsResult.url,
      status: robotsResult.status,
      declaresSitemap,
      sitemapUrls: robotsResult.parsed?.sitemapUrls ?? [],
      summary: buildRobotsSummary(robotsResult.found, declaresSitemap, aiBots),
      aiBots
    },
    sitemap: {
      found: sitemapAudit.found,
      url: sitemapAudit.url,
      discoveredVia: sitemapAudit.discoveredVia,
      status: sitemapAudit.status,
      validXml: sitemapAudit.validXml,
      urlCount: sitemapAudit.urlCount,
      isIndex: sitemapAudit.isIndex,
      specialized: sitemapAudit.specialized,
      summary: buildSitemapSummary(sitemapAudit, badUrlCount, noindexCount, sampledCount),
      badUrlCount: badUrlCount || undefined,
      noindexCount: noindexCount || undefined,
      sampledCount: sampledCount || undefined,
      lastmodCoverage: sitemapAudit.lastmodCoverage || undefined
    },
    llms: {
      found: llmsResult.found,
      url: llmsResult.url,
      valid: llmsResult.valid,
      summary: buildLlmsSummary(llmsResult.found, llmsResult.valid, llmsResult.url)
    },
    checkedAt: new Date().toISOString()
  }

  return { issues, audit }
}
