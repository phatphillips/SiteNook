export type SitemapDiscoveredVia = 'robots' | 'default_path' | 'scan_config'

export interface SitemapUrlEntry {
  loc: string
  lastmod?: string
}

export interface SitemapAuditResult {
  url: string
  discoveredVia: SitemapDiscoveredVia
  found: boolean
  status?: number
  validXml: boolean
  isIndex: boolean
  urlCount: number
  pageUrls: string[]
  entries: SitemapUrlEntry[]
  specialized: { image?: boolean, video?: boolean }
  overUrlLimit: boolean
  overSizeLimit: boolean
  relativeUrlCount: number
  childSitemapCount: number
  lastmodCoverage: number
  staleLastmod: boolean
}

const URLSET_NS = /xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i
const SITEMAPINDEX_NS = /xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i

function extractLocTags(xml: string): string[] {
  const urls: string[] = []
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi
  let match
  while ((match = re.exec(xml)) !== null) {
    urls.push(match[1].trim())
  }
  return urls
}

function extractUrlEntries(xml: string): SitemapUrlEntry[] {
  const entries: SitemapUrlEntry[] = []
  const urlBlockRe = /<url>([\s\S]*?)<\/url>/gi
  let block
  while ((block = urlBlockRe.exec(xml)) !== null) {
    const blockXml = block[1]
    const locMatch = /<loc>\s*([^<]+?)\s*<\/loc>/i.exec(blockXml)
    if (!locMatch?.[1]) continue
    const lastmodMatch = /<lastmod>\s*([^<]+?)\s*<\/lastmod>/i.exec(blockXml)
    entries.push({
      loc: locMatch[1].trim(),
      lastmod: lastmodMatch?.[1]?.trim()
    })
  }
  return entries
}

function isValidSitemapXml(xml: string): { valid: boolean, isIndex: boolean } {
  const trimmed = xml.trim()
  if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<')) {
    return { valid: false, isIndex: false }
  }
  const isIndex = /<sitemapindex/i.test(xml) && SITEMAPINDEX_NS.test(xml)
  const isUrlset = /<urlset/i.test(xml) && URLSET_NS.test(xml)
  if (isIndex || isUrlset) return { valid: true, isIndex }
  if (/<sitemapindex/i.test(xml) || /<urlset/i.test(xml)) {
    return { valid: true, isIndex: /<sitemapindex/i.test(xml) }
  }
  return { valid: false, isIndex: false }
}

function detectSpecialized(xml: string): { image?: boolean, video?: boolean } {
  const specialized: { image?: boolean, video?: boolean } = {}
  if (/xmlns=["']http:\/\/www\.google\.com\/schemas\/sitemap-image/i.test(xml)) {
    specialized.image = true
  }
  if (/xmlns=["']http:\/\/www\.google\.com\/schemas\/sitemap-video/i.test(xml)) {
    specialized.video = true
  }
  return specialized
}

function isAbsoluteHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function computeLastmodStats(entries: SitemapUrlEntry[]): { coverage: number, stale: boolean } {
  if (!entries.length) return { coverage: 0, stale: false }
  const withLastmod = entries.filter(e => e.lastmod)
  const coverage = Math.round((withLastmod.length / entries.length) * 100)
  if (withLastmod.length < 2) return { coverage, stale: false }
  const unique = new Set(withLastmod.map(e => e.lastmod))
  return { coverage, stale: unique.size === 1 }
}

export function resolveSitemapUrl(
  origin: string,
  robotsSitemaps: string[],
  configSitemapUrl?: string
): { url: string, discoveredVia: SitemapDiscoveredVia } {
  if (robotsSitemaps.length > 0) {
    return { url: robotsSitemaps[0], discoveredVia: 'robots' }
  }
  if (configSitemapUrl?.trim()) {
    return { url: configSitemapUrl.trim(), discoveredVia: 'scan_config' }
  }
  return { url: `${origin}/sitemap.xml`, discoveredVia: 'default_path' }
}

const MAX_SITEMAP_URLS = 50_000
const MAX_SITEMAP_BYTES = 50 * 1024 * 1024

export async function auditSitemap(
  sitemapUrl: string,
  discoveredVia: SitemapDiscoveredVia,
  maxUrls = 5000
): Promise<SitemapAuditResult> {
  const base: SitemapAuditResult = {
    url: sitemapUrl,
    discoveredVia,
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

  const visited = new Set<string>()
  const pageUrls: string[] = []
  const entries: SitemapUrlEntry[] = []
  let validXml = false
  let isIndex = false
  let specialized: { image?: boolean, video?: boolean } = {}
  let overSizeLimit = false
  let childSitemapCount = 0
  let status: number | undefined

  async function fetchSitemap(url: string, xmlBytesTotal: { n: number }) {
    if (visited.has(url) || pageUrls.length >= maxUrls) return
    visited.add(url)

    const res = await fetch(url, {
      headers: { 'User-Agent': 'AccessIQ-Scanner/1.0' }
    })
    status = res.status
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const xml = await res.text()
    xmlBytesTotal.n += new TextEncoder().encode(xml).length
    if (xmlBytesTotal.n > MAX_SITEMAP_BYTES) overSizeLimit = true

    const validation = isValidSitemapXml(xml)
    validXml = validation.valid
    isIndex = validation.isIndex || isIndex
    specialized = { ...specialized, ...detectSpecialized(xml) }

    const locs = extractLocTags(xml)
    const urlEntries = extractUrlEntries(xml)
    if (urlEntries.length) {
      for (const entry of urlEntries) {
        if (entries.length >= maxUrls) break
        entries.push(entry)
        if (!entry.loc.endsWith('.xml')) pageUrls.push(entry.loc)
      }
    } else {
      const childSitemaps = locs.filter(loc => loc.endsWith('.xml'))
      const directPages = locs.filter(loc => !loc.endsWith('.xml'))
      childSitemapCount += childSitemaps.length
      for (const pageUrl of directPages) {
        if (pageUrls.length >= maxUrls) break
        pageUrls.push(pageUrl)
        entries.push({ loc: pageUrl })
      }
      for (const child of childSitemaps) {
        if (pageUrls.length >= maxUrls) break
        await fetchSitemap(child, xmlBytesTotal)
      }
    }
  }

  try {
    await fetchSitemap(sitemapUrl, { n: 0 })
    const relativeUrlCount = entries.filter(e => !isAbsoluteHttpUrl(e.loc)).length
    const { coverage, stale } = computeLastmodStats(entries)

    return {
      ...base,
      found: true,
      status,
      validXml,
      isIndex,
      urlCount: pageUrls.length,
      pageUrls,
      entries,
      specialized,
      overUrlLimit: pageUrls.length > MAX_SITEMAP_URLS,
      overSizeLimit,
      relativeUrlCount,
      childSitemapCount,
      lastmodCoverage: coverage,
      staleLastmod: stale
    }
  } catch (err) {
    return {
      ...base,
      status: status ?? (err instanceof Error && err.message.startsWith('HTTP')
        ? Number.parseInt(err.message.replace('HTTP ', ''), 10)
        : undefined)
    }
  }
}

export async function parseSitemap(sitemapUrl: string, maxUrls = 5000): Promise<string[]> {
  const audit = await auditSitemap(sitemapUrl, 'default_path', maxUrls)
  if (!audit.found) {
    throw new Error(`Sitemap fetch failed: HTTP ${audit.status ?? 'error'}`)
  }
  return audit.pageUrls
}
