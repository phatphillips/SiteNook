import { requirePbUser } from '../utils/requirePbUser'

function extractTagContent(html: string, pattern: RegExp): string {
  const match = html.match(pattern)
  return match?.[1]?.trim() ?? ''
}

function parseMetaDescription(html: string): string {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i
  ]
  for (const pattern of patterns) {
    const value = extractTagContent(html, pattern)
    if (value) return value
  }
  return ''
}

function parseFavicon(html: string, pageUrl: string): string {
  const linkMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*>/i)
  if (!linkMatch) return ''
  const hrefMatch = linkMatch[0].match(/href=["']([^"']+)["']/i)
  if (!hrefMatch?.[1]) return ''
  try {
    return new URL(hrefMatch[1], pageUrl).toString()
  } catch {
    return ''
  }
}

function urlBelongsToSite(pageUrl: string, siteUrl: string): boolean {
  try {
    const pageHost = new URL(pageUrl).hostname.replace(/^www\./, '')
    const siteHost = new URL(siteUrl).hostname.replace(/^www\./, '')
    return pageHost === siteHost || pageHost.endsWith(`.${siteHost}`)
  } catch {
    return false
  }
}

export default defineEventHandler(async (event) => {
  await requirePbUser(event)

  const query = getQuery(event)
  const url = String(query.url || '').trim()
  const siteUrl = String(query.siteUrl || '').trim()

  if (!url) {
    throw createError({ statusCode: 400, statusMessage: 'url is required' })
  }
  if (!siteUrl) {
    throw createError({ statusCode: 400, statusMessage: 'siteUrl is required' })
  }

  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid URL protocol' })
    }
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid URL' })
  }

  if (!urlBelongsToSite(url, siteUrl)) {
    throw createError({ statusCode: 400, statusMessage: 'URL must belong to the registered site domain' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AccessIQ-SeoPreview/1.0' }
    })
    if (!res.ok) {
      throw createError({ statusCode: 502, statusMessage: `Page returned HTTP ${res.status}` })
    }
    const html = await res.text()
    const title = extractTagContent(html, /<title[^>]*>([^<]*)<\/title>/i)
    const metaDescription = parseMetaDescription(html)
    const canonical = extractTagContent(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
    const favicon = parseFavicon(html, url)

    return { title, metaDescription, canonical, favicon, url }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    const message = err instanceof Error ? err.message : 'Failed to fetch page'
    throw createError({ statusCode: 502, statusMessage: message })
  } finally {
    clearTimeout(timeout)
  }
})
