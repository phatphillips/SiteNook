import type { Page } from 'playwright'

/** Focusable tab-order entry with document-space geometry (CSS pixels). */
export interface SimulatorTabOrderEntry {
  index: number
  tag: string
  role: string
  name: string
  x: number
  y: number
  width: number
  height: number
}

export interface SimulatorTabOrderPayload {
  pageWidth: number
  pageHeight: number
  entries: SimulatorTabOrderEntry[]
}

export interface SimulatorPreviewCapture {
  previewImage: Buffer
  tabOrder: SimulatorTabOrderPayload
}

const MAX_TAB_ENTRIES = 250
const PREPARE_SCROLL_STEP_MS = 40
const PREPARE_SETTLE_MS = 400
const IMAGE_WAIT_TIMEOUT_MS = 3_000
const FONT_WAIT_TIMEOUT_MS = 3_000
const STYLESHEET_WAIT_TIMEOUT_MS = 3_000
const MAX_PREPARE_SCROLL_MS = 4_000

const ICON_FONT_FAMILIES = [
  'Material Symbols Outlined',
  'Material Symbols Rounded',
  'Material Symbols Sharp',
  'Material Icons',
  'Material Icons Outlined',
  'Material Icons Round',
  'Material Icons Sharp'
] as const

/**
 * Capture a full-page JPEG and keyboard tab-order geometry for the accessibility simulator.
 * Failures are swallowed by the caller — preview is best-effort and must not fail the scan.
 */
export async function captureSimulatorPreview(page: Page): Promise<SimulatorPreviewCapture> {
  await preparePageForPreviewCapture(page)
  const tabOrder = await captureTabOrder(page)
  const previewImage = await page.screenshot({
    fullPage: true,
    type: 'jpeg',
    quality: 78,
    animations: 'disabled'
  })

  return { previewImage, tabOrder }
}

/**
 * Settle the page so a screenshot matches a normal browser view as closely as possible:
 * stylesheets → webfonts/icon fonts → lazy media → scroll wake → CSS backgrounds → settle.
 *
 * Kept intentionally short: with correct browser headers, fonts load quickly. Long waits
 * previously added 20–40s+ per page and overloaded PocketBase during concurrent crawls.
 */
export async function preparePageForPreviewCapture(page: Page): Promise<void> {
  await waitForStylesheets(page)
  await ensureIconFontStylesheet(page)
  await waitForDocumentFonts(page)
  await promoteLazyMedia(page)
  await scrollPageToTriggerLazyLoads(page)
  await promoteLazyMedia(page)
  await waitForImages(page)
  await waitForCssBackgroundImages(page)
  await page.waitForLoadState('networkidle', { timeout: 2_000 }).catch(() => {})
  await page.waitForTimeout(PREPARE_SETTLE_MS)
  await page.evaluate(() => {
    document.documentElement.classList.add('ast-header-loaded')
    document.body?.classList.add('ast-header-loaded')
    if (window.innerWidth >= 922) {
      document.documentElement.classList.add('ast-desktop')
      document.documentElement.classList.remove('ast-header-break-point')
    }
    window.scrollTo(0, 0)
  }).catch(() => {})
  await page.waitForTimeout(150)
}

/**
 * Wait until primary content is in the DOM (Astra/Spectra often paint the hero
 * after header JS). Caps at 8s so a slow third-party script cannot stall the scan.
 */
export async function waitForRenderedContent(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const heading = document.querySelector('h1, .entry-title, .wp-block-heading')
    if (heading && (heading.textContent || '').trim().length > 1) return true
    const main = document.querySelector('main, .entry-content, .site-content, #content')
    return Boolean(main && (main.textContent || '').trim().length > 40)
  }, { timeout: 8_000 }).catch(() => {})
}

async function waitForStylesheets(page: Page): Promise<void> {
  await page.evaluate(async (timeoutMs) => {
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')] as HTMLLinkElement[]
    await Promise.all(links.map((link) => {
      // Already applied.
      if (link.sheet) return Promise.resolve()
      return new Promise<void>((resolve) => {
        const done = () => resolve()
        link.addEventListener('load', done, { once: true })
        link.addEventListener('error', done, { once: true })
        setTimeout(done, timeoutMs)
      })
    }))
  }, STYLESHEET_WAIT_TIMEOUT_MS).catch(() => {})
}

/**
 * If the page uses Material icon ligatures but the Google Fonts CSS never applied
 * (common race in headless crawls), inject the stylesheet with font-display=block.
 */
async function ensureIconFontStylesheet(page: Page): Promise<void> {
  await page.evaluate(async (timeoutMs) => {
    const hasIconNodes = Boolean(
      document.querySelector(
        '.material-symbols-outlined, .material-symbols-rounded, .material-symbols-sharp, .material-icons, .material-icons-outlined, [class*="material-symbols"], [class*="material-icons"]'
      )
    )
    if (!hasIconNodes) return

    const alreadyLinked = [...document.querySelectorAll('link[rel="stylesheet"]')].some((node) => {
      const href = (node as HTMLLinkElement).href || ''
      return /fonts\.googleapis\.com\/css.*Material/i.test(href)
        || /material-symbols|material-icons/i.test(href)
    })

    const iconFontReady = () => {
      try {
        return (
          document.fonts.check('24px "Material Symbols Outlined"')
          || document.fonts.check('24px "Material Icons"')
          || document.fonts.check('24px Material Symbols Outlined')
          || document.fonts.check('24px Material Icons')
        )
      } catch {
        return false
      }
    }

    if (!alreadyLinked || !iconFontReady()) {
      if (!document.querySelector('link[data-sim-material-fonts]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href
          = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&family=Material+Icons&display=block'
        link.setAttribute('data-sim-material-fonts', '1')
        document.head.appendChild(link)
        await new Promise<void>((resolve) => {
          link.addEventListener('load', () => resolve(), { once: true })
          link.addEventListener('error', () => resolve(), { once: true })
          setTimeout(() => resolve(), timeoutMs)
        })
      }
    }

    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline && !iconFontReady()) {
      try {
        await Promise.allSettled([
          document.fonts.load('24px "Material Symbols Outlined"'),
          document.fonts.load('24px "Material Icons"')
        ])
      } catch {
        // ignore
      }
      await new Promise((r) => setTimeout(r, 150))
    }
  }, FONT_WAIT_TIMEOUT_MS).catch(() => {})
}

async function waitForDocumentFonts(page: Page): Promise<void> {
  await page.evaluate(async (payload) => {
    const { iconFamilies, timeoutMs } = payload
    try {
      if (document.fonts?.ready) await document.fonts.ready
    } catch {
      // ignore
    }

    const families = new Set<string>(iconFamilies)
    try {
      for (const el of document.querySelectorAll('body, body *')) {
        const ff = getComputedStyle(el).fontFamily
        if (!ff) continue
        for (const part of ff.split(',')) {
          const name = part.trim().replace(/^["']|["']$/g, '')
          if (name && name.toLowerCase() !== 'inherit' && name.toLowerCase() !== 'initial') {
            families.add(name)
          }
        }
      }
    } catch {
      // ignore
    }

    if (document.fonts?.load) {
      await Promise.allSettled(
        [...families].slice(0, 40).map((family) =>
          document.fonts.load(`16px "${family}"`).catch(() => undefined)
        )
      )
    }

    try {
      if (document.fonts?.ready) await document.fonts.ready
    } catch {
      // ignore
    }

    // Poll until icon fonts report as available when icon nodes exist.
    const needsIcons = Boolean(
      document.querySelector(
        '.material-symbols-outlined, .material-icons, [class*="material-symbols"], [class*="material-icons"]'
      )
    )
    if (!needsIcons || !document.fonts?.check) return

    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const ok = iconFamilies.some((family: string) => {
        try {
          return document.fonts.check(`24px "${family}"`) || document.fonts.check(`24px ${family}`)
        } catch {
          return false
        }
      })
      if (ok) break
      await new Promise((r) => setTimeout(r, 150))
    }
  }, { iconFamilies: [...ICON_FONT_FAMILIES], timeoutMs: FONT_WAIT_TIMEOUT_MS }).catch(() => {})
}

async function promoteLazyMedia(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('img[loading="lazy"]').forEach((node) => {
      const img = node as HTMLImageElement
      img.loading = 'eager'
      const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src')
      if (dataSrc && !img.getAttribute('src')) img.setAttribute('src', dataSrc)
      const srcset = img.getAttribute('data-srcset') || img.getAttribute('data-lazy-srcset')
      if (srcset && !img.getAttribute('srcset')) img.setAttribute('srcset', srcset)
    })

    document.querySelectorAll('source[data-srcset]').forEach((node) => {
      const source = node as HTMLSourceElement
      const srcset = source.getAttribute('data-srcset')
      if (srcset && !source.getAttribute('srcset')) source.setAttribute('srcset', srcset)
    })

    document.querySelectorAll('iframe[loading="lazy"], iframe[data-src]').forEach((node) => {
      const frame = node as HTMLIFrameElement
      frame.loading = 'eager'
      const dataSrc = frame.getAttribute('data-src')
      if (dataSrc && (!frame.getAttribute('src') || frame.getAttribute('src') === 'about:blank')) {
        frame.setAttribute('src', dataSrc)
      }
    })

    // Elements that stash background URLs in data attributes (common lazy-bg pattern).
    document.querySelectorAll<HTMLElement>('[data-bg], [data-background], [data-bg-src], [data-lazy-bg]').forEach((el) => {
      const url
        = el.getAttribute('data-bg')
        || el.getAttribute('data-background')
        || el.getAttribute('data-bg-src')
        || el.getAttribute('data-lazy-bg')
      if (!url) return
      if (!el.style.backgroundImage || el.style.backgroundImage === 'none') {
        el.style.backgroundImage = `url("${url}")`
      }
    })

    document.querySelectorAll('lite-youtube').forEach((node) => {
      const el = node as HTMLElement
      const id = el.getAttribute('videoid') || el.getAttribute('video-id')
      if (id && !el.style.backgroundImage) {
        el.style.backgroundImage = `url("https://i.ytimg.com/vi/${id}/hqdefault.jpg")`
        el.style.backgroundSize = 'cover'
        el.style.backgroundPosition = 'center'
      }
    })

    document.querySelectorAll(
      'iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"], iframe[data-src*="youtube.com/embed"], iframe[data-src*="youtube-nocookie.com/embed"]'
    ).forEach((node) => {
      const iframe = node as HTMLIFrameElement
      const src = iframe.getAttribute('src') || iframe.getAttribute('data-src') || ''
      const match = src.match(/embed\/([\w-]{11})/)
      if (!match) return
      const wrap = iframe.parentElement
      if (!wrap) {
        iframe.remove()
        return
      }
      const style = window.getComputedStyle(wrap)
      if (style.position === 'static') wrap.style.position = 'relative'
      let poster = wrap.querySelector('[data-sim-yt-poster]') as HTMLImageElement | null
      if (!poster) {
        poster = document.createElement('img')
        poster.setAttribute('data-sim-yt-poster', '1')
        poster.src = `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`
        poster.alt = iframe.getAttribute('title') || 'YouTube video'
        wrap.insertBefore(poster, iframe)
      }
      poster.setAttribute(
        'style',
        'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;display:block;border:0;'
      )
      iframe.remove()
    })
  }).catch(() => {})
}

async function scrollPageToTriggerLazyLoads(page: Page): Promise<void> {
  await page.evaluate(async ({ stepMs, maxMs }) => {
    const height = Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight ?? 0,
      1
    )
    const viewport = Math.max(window.innerHeight, 1)
    const step = Math.max(Math.floor(viewport * 0.9), 400)
    const started = Date.now()
    for (let y = 0; y < height; y += step) {
      if (Date.now() - started > maxMs) break
      window.scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, stepMs))
    }
    window.scrollTo(0, height)
    await new Promise((resolve) => setTimeout(resolve, stepMs))
  }, { stepMs: PREPARE_SCROLL_STEP_MS, maxMs: MAX_PREPARE_SCROLL_MS }).catch(() => {})
}

async function waitForImages(page: Page): Promise<void> {
  await page.evaluate(async (timeoutMs) => {
    const images = [...document.images]
    await Promise.all(images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve()
      return new Promise<void>((resolve) => {
        const done = () => resolve()
        img.addEventListener('load', done, { once: true })
        img.addEventListener('error', done, { once: true })
        setTimeout(done, timeoutMs)
      })
    }))
  }, IMAGE_WAIT_TIMEOUT_MS).catch(() => {})
}

/** Preload every CSS `background-image` / `mask-image` / `content` url() so paints aren't empty. */
async function waitForCssBackgroundImages(page: Page): Promise<void> {
  await page.evaluate(async (timeoutMs) => {
    const urls = new Set<string>()

    const collectFromValue = (value: string) => {
      if (!value || value === 'none') return
      for (const match of value.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) {
        const raw = match[2]?.trim()
        if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) continue
        try {
          urls.add(new URL(raw, document.baseURI).href)
        } catch {
          // ignore invalid
        }
      }
    }

    for (const el of document.querySelectorAll('body, body *')) {
      const style = getComputedStyle(el)
      collectFromValue(style.backgroundImage)
      collectFromValue((style as CSSStyleDeclaration & { webkitMaskImage?: string }).webkitMaskImage || '')
      collectFromValue(style.getPropertyValue('mask-image'))
      collectFromValue(style.getPropertyValue('content'))
      collectFromValue(style.getPropertyValue('list-style-image'))
      collectFromValue(style.getPropertyValue('border-image-source'))
    }

    // Also scan same-origin stylesheets for url() references (pseudo-elements etc.).
    try {
      for (const sheet of [...document.styleSheets]) {
        let rules: CSSRuleList | undefined
        try {
          rules = sheet.cssRules
        } catch {
          continue // cross-origin stylesheet
        }
        if (!rules) continue
        for (const rule of [...rules]) {
          const text = (rule as CSSStyleRule).cssText || ''
          collectFromValue(text)
        }
      }
    } catch {
      // ignore
    }

    await Promise.all([...urls].slice(0, 120).map((url) => new Promise<void>((resolve) => {
      const img = new Image()
      const done = () => resolve()
      img.onload = done
      img.onerror = done
      img.src = url
      setTimeout(done, timeoutMs)
    })))
  }, IMAGE_WAIT_TIMEOUT_MS).catch(() => {})
}

export async function captureTabOrder(page: Page): Promise<SimulatorTabOrderPayload> {
  return page.evaluate((maxEntries) => {
    const FOCUSABLE_SELECTOR = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      'summary',
      'area[href]'
    ].join(',')

    function tabIndexValue(el: any) {
      const raw = el.getAttribute('tabindex')
      if (raw == null || raw === '') return 0
      const n = Number(raw)
      return Number.isFinite(n) ? n : 0
    }

    function accessibleName(el: any) {
      const aria = el.getAttribute('aria-label')?.trim()
      if (aria) return aria.slice(0, 80)
      const titled = el.getAttribute('title')?.trim()
      if (titled) return titled.slice(0, 80)
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (text) return text.slice(0, 80)
      const name = el.getAttribute('name')?.trim()
      if (name) return name.slice(0, 80)
      const id = el.getAttribute('id')?.trim()
      if (id) return `#${id}`.slice(0, 80)
      return el.tagName.toLowerCase()
    }

    function roleOf(el: any) {
      const explicit = el.getAttribute('role')?.trim()
      if (explicit) return explicit
      const tag = el.tagName.toLowerCase()
      if (tag === 'a') return 'link'
      if (tag === 'button') return 'button'
      if (tag === 'input') return el.getAttribute('type') || 'textbox'
      if (tag === 'select') return 'combobox'
      if (tag === 'textarea') return 'textbox'
      if (tag === 'summary') return 'button'
      return tag
    }

    const nodes = [...document.querySelectorAll(FOCUSABLE_SELECTOR)].filter((el: any) => {
      if (el.closest('[hidden], [aria-hidden="true"]')) return false
      return tabIndexValue(el) >= 0
    })

    const positive = nodes
      .filter((el: any) => tabIndexValue(el) > 0)
      .sort((a: any, b: any) => tabIndexValue(a) - tabIndexValue(b))
    const zero = nodes.filter((el: any) => tabIndexValue(el) === 0)
    const ordered = [...positive, ...zero].slice(0, maxEntries)

    const scrollX = window.scrollX || window.pageXOffset || 0
    const scrollY = window.scrollY || window.pageYOffset || 0

    const entries = ordered.map((el: any, i: number) => {
      const rect = el.getBoundingClientRect()
      return {
        index: i + 1,
        tag: el.tagName.toLowerCase(),
        role: roleOf(el),
        name: accessibleName(el),
        x: Math.round(rect.left + scrollX),
        y: Math.round(rect.top + scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    })

    const pageWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
      document.documentElement.clientWidth
    )
    const pageHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight ?? 0,
      document.documentElement.clientHeight
    )

    return {
      pageWidth,
      pageHeight,
      entries
    }
  }, MAX_TAB_ENTRIES)
}

/** Pure helper for unit tests — order focusable-like descriptors. */
export function orderTabCandidates<T extends { tabindex: number }>(nodes: T[]): T[] {
  const positive = nodes
    .filter(n => n.tabindex > 0)
    .sort((a, b) => a.tabindex - b.tabindex)
  const zero = nodes.filter(n => n.tabindex === 0)
  return [...positive, ...zero]
}

/** Extract css url() targets — used by unit tests. */
export function extractCssUrls(cssText: string): string[] {
  const urls: string[] = []
  for (const match of cssText.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) {
    const raw = match[2]?.trim()
    if (raw && !raw.startsWith('data:') && !raw.startsWith('blob:')) urls.push(raw)
  }
  return urls
}
