import type { SeoSnapshot } from './types.js'

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ''))
}

function firstMatch(html: string, pattern: RegExp): string | undefined {
  const match = pattern.exec(html)
  if (!match?.[1]) return undefined
  return stripTags(match[1])
}

function allMatches(html: string, pattern: RegExp): string[] {
  const results: string[] = []
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const re = new RegExp(pattern.source, flags)
  let match
  while ((match = re.exec(html)) !== null) {
    if (match[1]) results.push(match[1])
  }
  return results
}

function parseJsonLd(html: string): { types: string[], errors: string[] } {
  const types: string[] = []
  const errors: string[] = []
  const scripts = allMatches(html, /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)

  for (const raw of scripts) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    try {
      const parsed = JSON.parse(trimmed) as unknown
      collectJsonLdTypes(parsed, types)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  return { types: [...new Set(types)], errors }
}

function collectJsonLdTypes(node: unknown, types: string[]): void {
  if (!node) return
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdTypes(item, types)
    return
  }
  if (typeof node !== 'object') return
  const record = node as Record<string, unknown>
  const typeValue = record['@type']
  if (typeof typeValue === 'string') types.push(typeValue)
  else if (Array.isArray(typeValue)) {
    for (const t of typeValue) {
      if (typeof t === 'string') types.push(t)
    }
  }
  if (record['@graph']) collectJsonLdTypes(record['@graph'], types)
}

/** Extract on-page SEO signals from HTML. H2+ heading text is not stored — levels only. */
export function parseSeoSnapshot(html: string, pageUrl: string): SeoSnapshot {
  const metaDescription = firstMatch(
    html,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i
  ) ?? firstMatch(
    html,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i
  )

  const canonicalRaw = firstMatch(
    html,
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i
  ) ?? firstMatch(
    html,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i
  )

  let canonical: string | undefined
  if (canonicalRaw) {
    try {
      canonical = new URL(canonicalRaw, pageUrl).toString()
    } catch {
      canonical = canonicalRaw
    }
  }

  const robotsMeta = firstMatch(
    html,
    /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["'][^>]*>/i
  ) ?? firstMatch(
    html,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']robots["'][^>]*>/i
  )

  const htmlLang = firstMatch(html, /<html[^>]+lang=["']([^"']+)["']/i)

  const h1Texts = allMatches(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi).map(stripTags).filter(Boolean)
  const headings: number[] = []
  const headingRe = /<h([2-6])\b[^>]*>[\s\S]*?<\/h\1>/gi
  let headingMatch
  while ((headingMatch = headingRe.exec(html)) !== null) {
    const level = Number(headingMatch[1])
    if (level >= 2 && level <= 6) headings.push(level)
  }

  const ogTitle = firstMatch(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["'][^>]*>/i)
    ?? firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["'][^>]*>/i)
  const ogDescription = firstMatch(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
    ?? firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["'][^>]*>/i)
  const ogImage = firstMatch(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["'][^>]*>/i)
    ?? firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["'][^>]*>/i)

  const twitterCard = firstMatch(html, /<meta[^>]+name=["']twitter:card["'][^>]+content=["']([^"']*)["'][^>]*>/i)
    ?? firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']twitter:card["'][^>]*>/i)

  const jsonLd = parseJsonLd(html)

  return {
    metaDescription,
    canonical,
    robotsMeta,
    htmlLang,
    h1: h1Texts[0],
    h1Count: h1Texts.length,
    headings,
    og: ogTitle || ogDescription || ogImage
      ? { title: ogTitle, description: ogDescription, image: ogImage }
      : undefined,
    twitter: twitterCard ? { card: twitterCard } : undefined,
    jsonLdTypes: jsonLd.types,
    jsonLdErrors: jsonLd.errors
  }
}
