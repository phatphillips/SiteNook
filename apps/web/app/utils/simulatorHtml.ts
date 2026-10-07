/** Mirror of scanner truncateHtmlSnapshot. Keep body when capping snapshot size. */
import { ASTRA_EMPTY_DESKTOP_HEADER_CSS } from './astraHeaderPreviewCss'

export const HTML_SNAPSHOT_MAX_CHARS = 200_000

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
  head = stripHtmlElements(head, 'script')

  const bodyCloseIdx = html.search(/<\/body>/i)
  let bodyInner = html.slice(
    bodyIdx + bodyOpenTag.length,
    bodyCloseIdx > bodyIdx ? bodyCloseIdx : html.length
  )
  bodyInner = stripHtmlElements(bodyInner, 'script')

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

export function htmlSnapshotHasBody(html: string | null | undefined): boolean {
  if (!html?.trim()) return false
  const bodyIdx = html.search(/<body\b/i)
  if (bodyIdx < 0) return false
  return /<(p|h1|h2|h3|article|main|section|div|img|a|li|span)\b/i.test(html.slice(bodyIdx))
}

/** Linear-time strip of `<script>` / `<SCRIPT>` blocks (regex ReDoS on large crawl HTML). */
export function stripHtmlElements(html: string, tag: string): string {
  const open = `<${tag.toLowerCase()}`
  const close = `</${tag.toLowerCase()}>`
  const lower = html.toLowerCase()
  const parts: string[] = []
  let i = 0
  while (i < html.length) {
    const start = lower.indexOf(open, i)
    if (start === -1) {
      parts.push(html.slice(i))
      break
    }
    const after = start + open.length
    const next = after < html.length ? html.charCodeAt(after) : 62
    // Must be a real tag (`<script>`, `<script `, `<script/`) not `<scripted`.
    if (next !== 32 && next !== 9 && next !== 10 && next !== 13 && next !== 47 && next !== 62) {
      parts.push(html.slice(i, after))
      i = after
      continue
    }
    parts.push(html.slice(i, start))
    const end = lower.indexOf(close, start)
    const nextOpen = lower.indexOf(open, start + 1)
    const inner = end === -1 ? '' : html.slice(start, end)
    const looksLikePageContent = /<(?:div|header|main|section|footer|nav|article)\b/i.test(inner)
    // Truncated snapshots often cut a <script>/<noscript> open with no matching close, then a
    // later closer would swallow the rest of the page (hero, main, header).
    if (end === -1 || (nextOpen !== -1 && nextOpen < end) || looksLikePageContent) {
      const tagEnd = html.indexOf('>', start)
      let resumeAt = tagEnd === -1 ? html.length : tagEnd + 1
      const rest = html.slice(resumeAt)
      const htmlTag = rest.search(/<(?:div|header|main|section|footer|nav|article|span|p|a|h[1-6]|img|ul|ol|li|body|html)\b/i)
      i = htmlTag === -1 ? resumeAt : resumeAt + htmlTag
      continue
    }
    i = end + close.length
  }
  return parts.join('')
}

export function stripScriptsAndHandlers(html: string): string {
  return stripHtmlElements(stripHtmlElements(html, 'script'), 'noscript')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src|action|formaction|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, ' $1=$2#$2')
    .replace(/\s(href|src|action|formaction|xlink:href)\s*=\s*javascript:[^\s>]+/gi, ' $1="#"')
}

/** Astra / Spectra / AOS hide chrome or hero blocks until JS runs. */
export const SNAPSHOT_FREEZE_CSS = `<style data-accessiq-freeze>
html, body, main, #content, #page, .site, .site-content, .entry-content,
.ast-container, .ast-builder-grid-row, .wp-block-group, .wp-block-cover,
.wp-block-cover__inner-container, .site-header, .ast-above-header,
.ast-primary-header-bar, .main-header-bar, .ast-main-header-wrap,
.ast-mobile-header-wrap, #masthead, #ast-desktop-header, #ast-mobile-header {
  opacity: 1 !important; visibility: visible !important;
  content-visibility: visible !important; transform: none !important;
}
iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"], iframe[src*="youtu.be"] {
  display: none !important;
}
[data-sim-yt-poster], [data-accessiq-embed-poster] {
  position: absolute !important; inset: 0 !important;
  width: 100% !important; height: 100% !important;
  object-fit: cover !important; z-index: 2 !important;
  opacity: 1 !important; visibility: visible !important; display: block !important;
}
[data-aos], .aos-init, .uagb-block-wrapper {
  opacity: 1 !important; visibility: visible !important; transform: none !important;
}
.material-symbols-outlined, .material-symbols-rounded, .material-symbols-sharp,
.material-icons, .material-icons-outlined {
  font-family: "Material Symbols Outlined", "Material Icons" !important;
  font-weight: normal; font-style: normal; display: inline-block;
  line-height: 1; letter-spacing: normal; text-transform: none;
  white-space: nowrap; word-wrap: normal; -webkit-font-smoothing: antialiased;
  font-feature-settings: "liga";
}
*, *::before, *::after {
  animation: none !important;
  animation-duration: 0s !important;
  transition: none !important;
}
</style>${ASTRA_EMPTY_DESKTOP_HEADER_CSS}`

const MATERIAL_SYMBOLS_HREF
  = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block'

const PREVIEW_STYLESHEET_FALLBACKS = [
  '/wp-includes/css/dist/block-library/style.min.css',
  '/wp-content/themes/astra/style.css',
  '/wp-content/themes/astra/assets/css/minified/main.min.css'
]

function htmlHasStylesheetLink(html: string, pathOrHref: string): boolean {
  const escaped = pathOrHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`<link\\b[^>]*href=["'][^"']*${escaped}[^"']*["'][^>]*>`, 'i').test(html)
}

/**
 * Stored snapshots often lose stylesheet <link> tags (inlined then truncated).
 * Re-add origin CSS so the user's browser can paint layout even when Node cannot
 * fetch the live site.
 */
export function injectPreviewStylesheetFallbacks(
  html: string,
  pageUrl?: string | null
): string {
  if (!html) return html
  const tags: string[] = []
  const looksWp = /wp-block-|wp-content|wp-theme-|wp-container/i.test(html)
  const looksAstra = /\bast-/i.test(html)
  const looksIcons = /material-symbols|material-icons/i.test(html)

  if (looksIcons && !htmlHasStylesheetLink(html, 'Material+Symbols') && !htmlHasStylesheetLink(html, 'Material+Icons')) {
    tags.push(`<link rel="stylesheet" href="${MATERIAL_SYMBOLS_HREF}">`)
  }

  if ((looksWp || looksAstra) && pageUrl) {
    try {
      const origin = new URL(pageUrl).origin
      for (const path of PREVIEW_STYLESHEET_FALLBACKS) {
        if (path.includes('astra') && !looksAstra) continue
        if (path.includes('block-library') && !looksWp) continue
        if (htmlHasStylesheetLink(html, path)) continue
        tags.push(`<link rel="stylesheet" href="${escapeAttr(`${origin}${path}`)}">`)
      }
    } catch {
      // ignore invalid page URLs
    }
  }

  if (!tags.length) return html
  const insert = tags.join('')
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${insert}`)
  }
  return `${insert}${html}`
}

export function applySnapshotFreezeFrameClasses(html: string): string {
  html = html.replace(/<(html|body)\b([^>]*)>/gi, (full, tag: string, attrs: string) => {
    let next = attrs.replace(/\bast-header-break-point\b/g, '')
    const extras = [
      !/\bast-desktop\b/.test(next) ? 'ast-desktop' : '',
      !/\bast-header-loaded\b/.test(next) ? 'ast-header-loaded' : ''
    ].filter(Boolean).join(' ')
    if (!extras) return `<${tag}${next}>`
    if (/\bclass\s*=\s*["']/i.test(next)) {
      return `<${tag}${next.replace(/\bclass\s*=\s*(["'])/i, `class=$1${extras} `)}>`
    }
    return `<${tag} class="${extras}"${next}>`
  })
  return html
}

/** Close style/script tags truncated by the html_snapshot budget so the body still parses. */
export function closeTruncatedMarkup(html: string): string {
  const bodyIdx = html.search(/<body\b/i)
  const head = bodyIdx >= 0 ? html.slice(0, bodyIdx) : html
  const extra = (open: string, close: string) => {
    const opens = head.match(new RegExp(`<${open}\\b`, 'gi'))?.length ?? 0
    const closes = head.match(new RegExp(close, 'gi'))?.length ?? 0
    return Math.max(0, opens - closes)
  }
  const insert = `${'</style>'.repeat(extra('style', '</style>'))}${'</script>'.repeat(extra('script', '</script>'))}`
  if (!insert) return html
  if (bodyIdx < 0) return `${html}${insert}`
  return `${html.slice(0, bodyIdx)}${insert}${html.slice(bodyIdx)}`
}

export function youtubeIdFromEmbedUrl(src: string): string | null {
  const decoded = src.replace(/&amp;/g, '&')
  const match = decoded.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  )
  return match?.[1] ?? null
}

/** Keep in sync with apps/scanner/src/crawler/serializeRenderedHtml.ts */
export function replaceVideoEmbedsWithPosters(html: string): string {
  const lower = html.toLowerCase()
  const parts: string[] = []
  let i = 0
  while (i < html.length) {
    const start = lower.indexOf('<iframe', i)
    if (start === -1) {
      parts.push(html.slice(i))
      break
    }
    const after = start + 7
    const next = after < html.length ? html.charCodeAt(after) : 62
    if (next !== 32 && next !== 9 && next !== 10 && next !== 13 && next !== 47 && next !== 62) {
      parts.push(html.slice(i, after))
      i = after
      continue
    }
    parts.push(html.slice(i, start))
    const tagEnd = html.indexOf('>', start)
    if (tagEnd === -1) {
      parts.push(html.slice(start))
      break
    }
    const openTag = html.slice(start, tagEnd + 1)
    const selfClosing = /\/\s*>$/.test(openTag)
    let end = tagEnd + 1
    if (!selfClosing) {
      const close = lower.indexOf('</iframe>', tagEnd)
      end = close === -1 ? html.length : close + 9
    }
    const src = openTag.match(/\b(?:src|data-src)\s*=\s*["']([^"']*)/i)?.[1] || ''
    const id = youtubeIdFromEmbedUrl(src)
    if (!id) {
      parts.push(html.slice(start, end))
    } else {
      const title = openTag.match(/\btitle\s*=\s*["']([^"']*)/i)?.[1] || 'YouTube video'
      const alt = title.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
      parts.push(
        `<img data-accessiq-embed-poster="1" src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="${alt}" `
        + 'style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;border:0">'
      )
    }
    i = end
  }
  return parts.join('')
}

export function prepareSnapshotPreviewHtml(
  html: string,
  pageUrl?: string | null,
  options?: { truncate?: boolean, extraHead?: string }
): string {
  let bodyHtml = replaceVideoEmbedsWithPosters(
    stripScriptsAndHandlers(closeTruncatedMarkup(html.trim()))
  )
  if (!bodyHtml) return ''

  if (options?.truncate) {
    bodyHtml = truncateHtmlSnapshot(bodyHtml, HTML_SNAPSHOT_MAX_CHARS)
  }

  const baseHref = pageUrl
    ? `<base target="_blank" href="${escapeAttr(pageUrl)}">`
    : ''
  const freezeCss = options?.truncate ? '' : SNAPSHOT_FREEZE_CSS
  const extraHead = `${freezeCss}${options?.extraHead ?? ''}`
  const headInsert = `${baseHref}${extraHead}`

  const looksComplete = /<html[\s>]/i.test(bodyHtml)
  let out = ''
  if (looksComplete) {
    if (/<head[\s>]/i.test(bodyHtml)) {
      out = bodyHtml.replace(/<head([^>]*)>/i, `<head$1>${headInsert}`)
    } else {
      out = bodyHtml.replace(/<html([^>]*)>/i, `<html$1><head>${headInsert}</head>`)
    }
  } else {
    out = `<!DOCTYPE html><html><head>${headInsert}<meta charset="utf-8"></head><body>${bodyHtml}</body></html>`
  }
  return options?.truncate ? out : applySnapshotFreezeFrameClasses(out)
}

export function prepareSimulatorPreviewHtml(
  html: string,
  pageUrl?: string | null
): string {
  const previewCss = `<style data-simulator-preview>
    html, body { background: #fff; color: #111; }
    body { margin: 0; padding: 12px; }
    img, video { max-width: 100%; height: auto; }
  </style>`
  return prepareSnapshotPreviewHtml(html, pageUrl, { truncate: true, extraHead: previewCss })
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}
