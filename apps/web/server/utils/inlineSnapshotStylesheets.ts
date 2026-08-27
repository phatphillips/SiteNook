const STYLESHEET_FETCH_TIMEOUT_MS = 2_500
const OVERALL_INLINE_TIMEOUT_MS = 2_500
const MAX_STYLESHEETS = 20
const MAX_CSS_BYTES = 1_500_000

const LINK_TAG_RE = /<link\b[^>]*>/gi

export function absolutizeCssUrls(cssText: string, baseHref: string): string {
  return cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, quote, raw) => {
    const url = String(raw || '').trim()
    if (!url || /^(data:|blob:|https?:|\/\/|#)/i.test(url)) return full
    try {
      return `url(${quote}${new URL(url, baseHref).href}${quote})`
    } catch {
      return full
    }
  })
}

export function stylesheetHrefFromLinkTag(tag: string, pageUrl: string): string | null {
  if (!/\brel\s*=\s*(["']?)[^"']*stylesheet[^"']*\1/i.test(tag) && !/\brel\s*=\s*stylesheet\b/i.test(tag)) {
    return null
  }
  const href = tag.match(/\bhref\s*=\s*(["'])([^"']+)\1/i)?.[2]
    ?? tag.match(/\bhref\s*=\s*([^\s>]+)/i)?.[1]
  if (!href) return null
  try {
    const absolute = new URL(href, pageUrl).href
    if (!/^https?:\/\//i.test(absolute)) return null
    const host = new URL(absolute).hostname
    if (
      /(?:^|\.)(?:googleapis|gstatic)\.com$/i.test(host)
      || /(?:^|\.)typekit\.net$/i.test(host)
    ) return null
    return absolute
  } catch {
    return null
  }
}

async function fetchStylesheet(href: string, pageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(href, {
      headers: {
        Accept: 'text/css,*/*;q=0.1',
        Referer: pageUrl
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(STYLESHEET_FETCH_TIMEOUT_MS)
    })
    if (!response.ok) return null
    const css = await response.text()
    if (!css.trim() || css.length > MAX_CSS_BYTES) return null
    return absolutizeCssUrls(css, href)
  } catch {
    return null
  }
}

const THEME_STYLE_RESTORE_TIMEOUT_MS = 8_000
const THEME_STYLE_IDS = [
  'astra-theme-css-inline-css',
  'global-styles-inline-css',
  'wp-custom-css',
  'wp-block-library-inline-css',
  'wp-block-button-inline-css',
  'wp-block-buttons-inline-css',
  'wp-block-columns-inline-css',
  'wp-block-embed-inline-css',
  'wp-block-group-inline-css',
  'wp-block-heading-inline-css',
  'core-block-supports-inline-css'
] as const

const MIN_STYLE_CHARS: Record<string, number> = {
  'astra-theme-css-inline-css': 8_000,
  'global-styles-inline-css': 2_000,
  'wp-custom-css': 1_000,
  'wp-block-library-inline-css': 500
}

export function extractStyleTagById(html: string, id: string): string | null {
  const re = new RegExp(`<style\\b[^>]*\\bid\\s*=\\s*["']${id}["'][^>]*>[\\s\\S]*?<\\/style>`, 'i')
  return html.match(re)?.[0] ?? null
}

function styleInnerLength(tag: string): number {
  return tag.replace(/^<style\b[^>]*>/i, '').replace(/<\/style>$/i, '').length
}

function snapshotHasUsableStyle(html: string, id: string, liveTag?: string | null): boolean {
  const existing = extractStyleTagById(html, id)
  if (!existing) return false
  const min = MIN_STYLE_CHARS[id] ?? 0
  const liveLen = liveTag ? styleInnerLength(liveTag) : 0
  const needed = Math.max(min, liveLen ? Math.floor(liveLen * 0.5) : 0)
  return styleInnerLength(existing) >= needed
}

export function snapshotNeedsThemeStyles(html: string): boolean {
  if (html.includes('trimmed for snapshot storage')) return true
  if (!/\bast-|wp-block-|wp-theme-|grid-background/i.test(html)) return false
  return THEME_STYLE_IDS.some(id => !snapshotHasUsableStyle(html, id))
}

function stylesheetLinkTags(html: string): string[] {
  return (html.match(/<link\b[^>]*>/gi) ?? []).filter(tag =>
    /stylesheet/i.test(tag) || /as\s*=\s*["']style["']/i.test(tag)
  )
}

function hrefFromLinkTag(tag: string): string | null {
  return tag.match(/\bhref\s*=\s*(["'])([^"']+)\1/i)?.[2]
    ?? tag.match(/\bhref\s*=\s*([^\s>]+)/i)?.[1]
    ?? null
}

/**
 * Truncated html_snapshot storage strips large WordPress/Astra inline theme CSS.
 * Pull those tags from the page URL so freeze-frame preview can paint without a rescan.
 */
export async function restoreMissingThemeStyles(
  html: string,
  pageUrl: string,
  fetchHtml: (url: string) => Promise<string | null> = fetchPageHtml
): Promise<string> {
  if (!html || !pageUrl || !snapshotNeedsThemeStyles(html)) return html

  const live = await fetchHtml(pageUrl)
  if (!live) return html

  let out = html.replace(/<style>\/\* trimmed for snapshot storage \*\/<\/style>/gi, '')
  const blocks: string[] = []

  for (const id of THEME_STYLE_IDS) {
    const liveTag = extractStyleTagById(live, id)
    if (!liveTag) continue
    if (snapshotHasUsableStyle(out, id, liveTag)) continue
    const existing = extractStyleTagById(out, id)
    if (existing) out = out.replace(existing, liveTag)
    else blocks.push(liveTag)
  }

  for (const tag of stylesheetLinkTags(live)) {
    const href = hrefFromLinkTag(tag)
    if (!href) continue
    let absolute = href
    try {
      absolute = new URL(href, pageUrl).href
    } catch {
      continue
    }
    const path = absolute.split('?')[0] ?? absolute
    if (out.includes(absolute) || out.includes(path)) continue
    blocks.push(tag.includes(href) ? tag.replace(href, absolute) : tag)
  }

  if (!blocks.length) return out
  if (/<head[\s>]/i.test(out)) {
    return out.replace(/<head([^>]*)>/i, `<head$1>${blocks.join('')}`)
  }
  return `${blocks.join('')}${out}`
}

async function fetchPageHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/html,*/*;q=0.1' },
      redirect: 'follow',
      signal: AbortSignal.timeout(THEME_STYLE_RESTORE_TIMEOUT_MS)
    })
    if (!response.ok) return null
    const text = await response.text()
    return text.trim() ? text : null
  } catch {
    return null
  }
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms)
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

/**
 * Replace remaining external <link rel="stylesheet"> tags with inlined <style>
 * so the iframe does not have to fetch cross-origin CSS.
 * Already-inlined hrefs (`data-accessiq-inlined`) are left alone.
 */
export async function inlineSnapshotStylesheets(
  html: string,
  pageUrl: string,
  fetchCss: (href: string, pageUrl: string) => Promise<string | null> = fetchStylesheet
): Promise<string> {
  if (!html || !pageUrl) return html

  const inlinedHrefs = new Set(
    [...html.matchAll(/data-accessiq-inlined="([^"]+)"/g)].map(match => match[1])
  )

  const tags = html.match(LINK_TAG_RE) ?? []
  const replacements: Array<{ tag: string, href: string }> = []
  for (const tag of tags) {
    if (replacements.length >= MAX_STYLESHEETS) break
    const href = stylesheetHrefFromLinkTag(tag, pageUrl)
    if (href && !inlinedHrefs.has(href)) replacements.push({ tag, href })
  }
  if (!replacements.length) return html

  const uniqueHrefs = [...new Set(replacements.map(item => item.href))]
  const cssByHref = new Map<string, string>()
  await withTimeout(
    Promise.all(uniqueHrefs.map(async (href) => {
      const css = await fetchCss(href, pageUrl)
      if (css) cssByHref.set(href, css)
    })),
    OVERALL_INLINE_TIMEOUT_MS,
    undefined
  )

  let out = html
  for (const { tag, href } of replacements) {
    const css = cssByHref.get(href)
    if (!css) continue
    const style = `<style data-accessiq-inlined="${escapeAttr(href)}">${css}</style>`
    // Keep the original <link> so the browser can still load theme CSS if this
    // inlined copy is later truncated or incomplete.
    out = out.replace(tag, `${style}${tag}`)
  }
  return out
}
