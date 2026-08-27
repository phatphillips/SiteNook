import type { Page } from 'playwright'
import { inlineFetchedAssets } from './inlineSnapshotAssets.js'

/**
 * Rewrite relative url() values against a stylesheet/page base.
 * Keep in sync with the copy inside serializeRenderedPage()'s page.evaluate.
 */
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

const ASTRA_HEADER_CONTENT
  = 'img, a, nav, .ast-builder-grid-row, .main-header-bar, .site-branding, .ast-builder-menu'

export function youtubeIdFromEmbedUrl(src: string): string | null {
  const decoded = src.replace(/&amp;/g, '&')
  const match = decoded.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  )
  return match?.[1] ?? null
}

/** Keep in sync with apps/web/app/utils/simulatorHtml.ts */
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

/**
 * Unhide late-animated blocks and mark Astra chrome as loaded so a script-free
 * freeze-frame still shows the post-JS layout.
 */
export async function freezeRenderedDomForSnapshot(page: Page): Promise<void> {
  const headerReady = await page.evaluate((sel) => {
    const desktop = document.getElementById('ast-desktop-header')
    const mobile = document.getElementById('ast-mobile-header')
    if (!desktop) return true
    if (desktop.querySelector(sel)) return true
    // Builder chrome often lives in the mobile wrap; don't wait for desktop.
    return Boolean(mobile?.querySelector(sel))
  }, ASTRA_HEADER_CONTENT).catch(() => true)

  if (!headerReady) {
    await page.waitForFunction((sel) => {
      const desktop = document.getElementById('ast-desktop-header')
      if (!desktop) return true
      return Boolean(desktop.querySelector(sel))
    }, ASTRA_HEADER_CONTENT, { timeout: 4_000 }).catch(() => {})
  }

  await page.evaluate(() => {
    document.documentElement.classList.add('ast-header-loaded', 'ast-desktop')
    document.documentElement.classList.remove('ast-header-break-point')
    document.body?.classList.add('ast-header-loaded')

    const show = (node: Element) => {
      const el = node as HTMLElement
      el.style.setProperty('opacity', '1', 'important')
      el.style.setProperty('visibility', 'visible', 'important')
      el.style.setProperty('transform', 'none', 'important')
    }

    document.querySelectorAll(
      '[data-aos], .aos-init, .wp-block-cover, .wp-block-cover__inner-container, '
      + '.entry-content, main, .site-content, #content, .ast-container, '
      + '#masthead, #ast-desktop-header, .site-header, .ast-main-header-wrap, '
      + '.main-header-bar, .ast-builder-grid-row'
    ).forEach(show)

    document.querySelectorAll('[data-aos], .aos-init').forEach((node) => {
      node.classList.add('aos-animate')
    })
  })
}

/**
 * Freeze the post-JS DOM for iframe preview: absolutize asset URLs and inline
 * stylesheets (including cross-origin) by fetching CSS through Playwright.
 * Successfully inlined stylesheet <link> tags are removed so the freeze-frame
 * does not depend on the live origin for theme CSS.
 */
export async function serializeRenderedPage(page: Page): Promise<string> {
  await freezeRenderedDomForSnapshot(page).catch(() => {})

  const hrefs = await page.evaluate(() => (
    [...document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"][as="style"]')]
      .map(node => (node as HTMLLinkElement).href)
      .filter(Boolean)
  ))

  const cssByHref: Record<string, string> = {}
  const pageUrl = page.url()
  await Promise.all((hrefs as string[]).map(async (href) => {
    try {
      const response = await page.request.get(href, {
        timeout: 8_000,
        headers: { Referer: pageUrl, Accept: 'text/css,*/*;q=0.1' }
      })
      if (!response.ok()) return
      const css = await response.text()
      if (css.trim()) cssByHref[href] = absolutizeCssUrls(css, href)
    } catch {
      // Leave the <link> in place.
    }
  }))

  await page.evaluate((inlined) => {
    const abs = (value: string, base = document.baseURI) => {
      const v = value.trim()
      if (
        !v
        || v.startsWith('data:')
        || v.startsWith('blob:')
        || v.startsWith('#')
        || /^javascript:/i.test(v)
      ) return value
      try {
        return new URL(v, base).href
      } catch {
        return value
      }
    }

    const absSrcset = (value: string) => value.split(',').map((part) => {
      const trimmed = part.trim()
      const sp = trimmed.lastIndexOf(' ')
      if (sp === -1) return abs(trimmed)
      return `${abs(trimmed.slice(0, sp))} ${trimmed.slice(sp + 1).trim()}`
    }).join(', ')

    const urlAttrs: Array<[string, string]> = [
      ['link[href]', 'href'],
      ['img[src]', 'src'],
      ['source[src]', 'src'],
      ['video[src]', 'src'],
      ['video[poster]', 'poster'],
      ['audio[src]', 'src'],
      ['iframe[src]', 'src'],
      ['embed[src]', 'src'],
      ['script[src]', 'src'],
      ['form[action]', 'action'],
      ['use[href]', 'href'],
      ['image[href]', 'href']
    ]
    for (const [selector, attr] of urlAttrs) {
      document.querySelectorAll(selector).forEach((node) => {
        const current = node.getAttribute(attr)
        if (current) node.setAttribute(attr, abs(current))
      })
    }

    document.querySelectorAll('img').forEach((node) => {
      const img = node as HTMLImageElement
      const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src')
      if (dataSrc && !img.getAttribute('src')) img.setAttribute('src', abs(dataSrc))
      if (img.currentSrc) img.setAttribute('src', img.currentSrc)
      img.removeAttribute('srcset')
      img.removeAttribute('sizes')
      img.removeAttribute('data-src')
      img.removeAttribute('data-srcset')
      img.removeAttribute('data-lazy-src')
      img.removeAttribute('data-lazy-srcset')
      img.loading = 'eager'
    })

    document.querySelectorAll('source[srcset]').forEach((node) => {
      const srcset = node.getAttribute('srcset')
      if (srcset) node.setAttribute('srcset', absSrcset(srcset))
    })

    const absolutizeCss = (cssText: string, baseHref: string) => cssText.replace(
      /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
      (full, quote, raw) => {
        const url = String(raw || '').trim()
        if (!url || /^(data:|blob:|https?:|\/\/|#)/i.test(url)) return full
        try {
          return `url(${quote}${new URL(url, baseHref).href}${quote})`
        } catch {
          return full
        }
      }
    )

    document.querySelectorAll('style').forEach((style) => {
      if (style.textContent) {
        style.textContent = absolutizeCss(style.textContent, document.baseURI)
      }
    })

    document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"][as="style"]').forEach((node) => {
      const link = node as HTMLLinkElement
      const href = link.href || abs(link.getAttribute('href') || '')
      const css = href ? inlined[href] : undefined
      if (css && ![...document.querySelectorAll('style[data-accessiq-inlined]')].some(
        node => node.getAttribute('data-accessiq-inlined') === href
      )) {
        const style = document.createElement('style')
        style.setAttribute('data-accessiq-inlined', href)
        style.textContent = css
        link.before(style)
        link.remove()
        return
      }
      if (href) link.setAttribute('href', href)
    })

    const cssom: string[] = []
    for (const sheet of document.styleSheets) {
      try {
        cssom.push([...sheet.cssRules].map(rule => rule.cssText).join('\n'))
      } catch {
        // Cross-origin sheet — keep the <link> instead.
      }
    }
    if (cssom.some(chunk => chunk.trim()) && !document.querySelector('style[data-accessiq-cssom]')) {
      const style = document.createElement('style')
      style.setAttribute('data-accessiq-cssom', '1')
      style.textContent = cssom.filter(Boolean).join('\n')
      document.head?.appendChild(style)
    }

    document.querySelectorAll('script').forEach((node) => node.remove())
  }, cssByHref)

  return replaceVideoEmbedsWithPosters(await page.content())
}

/**
 * Rewrite remaining image/font URLs to data URIs using Playwright's cookie jar.
 * Applied only to pages.rendered_html so truncated html_snapshot stays small.
 */
export async function inlinePageAssetsForPreview(page: Page, html: string): Promise<string> {
  const pageUrl = page.url()
  return inlineFetchedAssets(html, async (url) => {
    try {
      const response = await page.request.get(url, {
        timeout: 8_000,
        headers: { Referer: pageUrl, Accept: 'image/*,font/*,*/*;q=0.1' }
      })
      if (!response.ok()) return null
      const bytes = Buffer.from(await response.body())
      if (!bytes.length) return null
      return { bytes, contentType: response.headers()['content-type'] || '' }
    } catch {
      return null
    }
  }, { pageUrl })
}
