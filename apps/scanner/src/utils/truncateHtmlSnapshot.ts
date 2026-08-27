/** Default storage budget for pages.html_snapshot (PocketBase field max 500k). */
export const HTML_SNAPSHOT_MAX_CHARS = 200_000

/**
 * Truncate HTML for storage while preferring visible body content and complete
 * `<style>` / stylesheet `<link>` tags (never cut mid-CSS).
 */
export function truncateHtmlSnapshot(
  html: string,
  maxChars: number = HTML_SNAPSHOT_MAX_CHARS
): string {
  if (!html) return ''
  if (html.length <= maxChars) return html

  const bodyMatch = html.match(/<body\b[^>]*>/i)
  if (!bodyMatch || bodyMatch.index == null) {
    return html.slice(0, maxChars)
  }

  const bodyIdx = bodyMatch.index
  const bodyOpenTag = bodyMatch[0]
  let head = html.slice(0, bodyIdx)
  head = head.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  const bodyCloseIdx = html.search(/<\/body>/i)
  let bodyInner = html.slice(
    bodyIdx + bodyOpenTag.length,
    bodyCloseIdx > bodyIdx ? bodyCloseIdx : html.length
  )
  bodyInner = bodyInner.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  bodyInner = bodyInner.replace(/<script\b[^>]*>[\s\S]*$/i, '')

  const styles = head.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? []
  const links = (head.match(/<link\b[^>]*>/gi) ?? []).filter(tag =>
    /stylesheet/i.test(tag) || /as\s*=\s*["']style["']/i.test(tag)
  )
  const headRest = head
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<link\b[^>]*>/gi, (tag) => (
      /stylesheet/i.test(tag) || /as\s*=\s*["']style["']/i.test(tag) ? '' : tag
    ))

  const doctype = /<!doctype/i.test(html) ? '<!DOCTYPE html>' : ''
  const htmlOpen = html.match(/<html\b[^>]*>/i)?.[0] ?? '<html>'
  const charset = '<meta charset="utf-8">'
  const wrapperLen = doctype.length + htmlOpen.length + '<head></head>'.length
    + bodyOpenTag.length + '</body></html>'.length + 8

  const available = Math.max(1_000, maxChars - wrapperLen)
  const minBody = Math.min(bodyInner.length, Math.max(4_000, Math.floor(available * 0.45)))
  let bodyKeep = minBody
  let remaining = available - bodyKeep

  const keptHead: string[] = [charset]
  remaining -= charset.length

  const takeIfFits = (tag: string) => {
    if (tag.length + 1 > remaining) return false
    keptHead.push(tag)
    remaining -= tag.length
    return true
  }

  for (const tag of styles) {
    if (takeIfFits(tag)) continue
    // Steal from the body budget once so the first theme stylesheet still fits.
    const steal = Math.min(tag.length - remaining, bodyKeep - Math.min(bodyInner.length, 4_000))
    if (steal > 0) {
      bodyKeep -= steal
      remaining += steal
      takeIfFits(tag)
    }
  }
  for (const tag of links) takeIfFits(tag)

  if (remaining > 80 && headRest.trim()) {
    const clip = headRest.slice(0, remaining)
    keptHead.push(clip)
    remaining -= clip.length
  }

  bodyKeep = Math.min(bodyInner.length, bodyKeep + Math.max(0, remaining))
  const keptBody = bodyInner.slice(0, bodyKeep)

  let out = `${doctype}${htmlOpen}<head>${keptHead.join('')}</head>${bodyOpenTag}${keptBody}</body></html>`
  if (out.length > maxChars) out = out.slice(0, maxChars)
  return out
}

/** True when a snapshot has no usable body (truncated head-only / empty). */
export function htmlSnapshotHasBody(html: string | null | undefined): boolean {
  if (!html?.trim()) return false
  return /<body\b/i.test(html) && /<(p|h1|h2|h3|article|main|section|div|img|a)\b/i.test(
    html.slice(html.search(/<body\b/i))
  )
}
