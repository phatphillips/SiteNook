import { isHttpUrl } from '../db/recordSanitize.js'
import { BODY_MAX_CHARS } from './typesenseConfig.js'

const HREF_REGEX = /href\s*=\s*["']([^"']+)["']/gi
export const OUTBOUND_LINKS_SECTION_PREFIX = '\n<!-- outbound-links -->\n'

export function extractHrefUrlsFromHtml(html: string, baseUrl?: string): string[] {
  const urls = new Set<string>()
  let match: RegExpExecArray | null
  HREF_REGEX.lastIndex = 0
  while ((match = HREF_REGEX.exec(html)) !== null) {
    try {
      const resolved = baseUrl ? new URL(match[1], baseUrl).toString() : match[1]
      if (isHttpUrl(resolved)) urls.add(resolved)
    } catch {
      // skip invalid URLs
    }
  }
  return [...urls]
}

export function mergeOutboundLinkUrls(...sources: Array<string[] | undefined>): string[] {
  const set = new Set<string>()
  for (const list of sources) {
    if (!list) continue
    for (const url of list) {
      const trimmed = url.trim()
      if (trimmed) set.add(trimmed)
    }
  }
  return [...set]
}

export function buildSearchableWebpageBody(html: string, outboundUrls: string[]): string {
  const uniqueUrls = mergeOutboundLinkUrls(outboundUrls)
  const linkBlock = uniqueUrls.length
    ? `${OUTBOUND_LINKS_SECTION_PREFIX}${uniqueUrls.join('\n')}`
    : ''
  if (!linkBlock) return html.slice(0, BODY_MAX_CHARS)
  const maxHtml = Math.max(0, BODY_MAX_CHARS - linkBlock.length)
  return html.slice(0, maxHtml) + linkBlock
}
