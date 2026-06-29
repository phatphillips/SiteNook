function extractLocTags(xml: string): string[] {
  const urls: string[] = []
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi
  let match
  while ((match = re.exec(xml)) !== null) {
    const loc = match[1]
    if (loc) urls.push(loc.trim())
  }
  return urls
}

export default defineEventHandler(async (event) => {
  await requirePbUser(event)

  const query = getQuery(event)
  const url = String(query.url || '').trim()
  if (!url) {
    throw createError({ statusCode: 400, statusMessage: 'url is required' })
  }

  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid URL protocol' })
    }
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid URL' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AccessIQ-SitemapPreview/1.0' }
    })
    if (!res.ok) {
      throw createError({ statusCode: 502, statusMessage: `Sitemap returned HTTP ${res.status}` })
    }
    const xml = await res.text()
    const urls = extractLocTags(xml)
    return { count: urls.length, urls: urls.slice(0, 20) }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    const message = err instanceof Error ? err.message : 'Failed to fetch sitemap'
    throw createError({ statusCode: 502, statusMessage: message })
  } finally {
    clearTimeout(timeout)
  }
})
