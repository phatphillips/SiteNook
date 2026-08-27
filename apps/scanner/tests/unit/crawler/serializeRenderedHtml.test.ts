import http from 'node:http'
import { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type Browser, type Page } from 'playwright'
import {
  absolutizeCssUrls,
  inlinePageAssetsForPreview,
  replaceVideoEmbedsWithPosters,
  serializeRenderedPage
} from '../../../src/crawler/serializeRenderedHtml.js'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

describe('replaceVideoEmbedsWithPosters', () => {
  it('swaps YouTube iframes for a poster image', () => {
    const html = replaceVideoEmbedsWithPosters(
      '<p>Hi</p><iframe title="Talk" src="https://www.youtube.com/embed/FVLRFAVyvRU?feature=oembed"></iframe>'
      + '<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-X"></iframe>'
    )
    expect(html).toContain('data-accessiq-embed-poster')
    expect(html).toContain('https://i.ytimg.com/vi/FVLRFAVyvRU/hqdefault.jpg')
    expect(html).not.toContain('youtube.com/embed')
    expect(html).toContain('googletagmanager.com')
  })
})

describe('absolutizeCssUrls', () => {
  it('resolves relative url() values against the stylesheet base', () => {
    const css = '.hero { background-image: url("../images/hero.jpg"); }'
    expect(absolutizeCssUrls(css, 'https://example.com/wp-content/themes/astra/style.css')).toBe(
      '.hero { background-image: url("https://example.com/wp-content/themes/images/hero.jpg"); }'
    )
  })

  it('leaves absolute, data, and hash urls unchanged', () => {
    const css = 'a { background: url(https://cdn.example/a.png) url(data:image/gif;base64,xx) url(#icon); }'
    expect(absolutizeCssUrls(css, 'https://example.com/style.css')).toBe(css)
  })
})

describe('serializeRenderedPage freeze-frame', () => {
  let server: http.Server
  let origin = ''
  let browser: Browser

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const url = req.url || '/'
      if (url === '/hero.png' || url === '/bg.png' || url === '/icon.woff2') {
        const type = url.endsWith('.woff2') ? 'font/woff2' : 'image/png'
        res.writeHead(200, { 'content-type': type })
        res.end(PNG)
        return
      }
      if (url === '/theme.css') {
        res.writeHead(200, { 'content-type': 'text/css' })
        res.end(`@font-face { font-family: Test; src: url("/icon.woff2") format("woff2"); }
.hero { background-image: url("/bg.png"); }`)
        return
      }
      if (url === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(`<!DOCTYPE html>
<html class="ast-desktop">
<head>
  <link rel="stylesheet" href="/theme.css">
</head>
<body class="ast-header-loaded">
  <img src="/hero.png" alt="Hero">
  <img src="https://www.facebook.com/tr?id=1&ev=PageView" alt="">
  <main class="hero"><h1>Home</h1></main>
  <script>window.__shouldNotSurvive = true</script>
</body>
</html>`)
        return
      }
      res.writeHead(404)
      res.end()
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address() as AddressInfo
    origin = `http://127.0.0.1:${addr.port}`
    browser = await chromium.launch({ headless: true })
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
    await new Promise<void>((resolve, reject) => {
      server.close((err) => err ? reject(err) : resolve())
    })
  })

  it('leaves an empty Astra desktop wrap empty so preview CSS can hide it', async () => {
    let page: Page | undefined
    try {
      page = await browser.newPage()
      await page.setContent(`<!DOCTYPE html>
<html class="ast-desktop">
<body>
  <header id="masthead">
    <div id="ast-desktop-header"></div>
    <div id="ast-mobile-header">
      <a class="site-logo" href="/"><img alt="Anything" src="/hero.png"></a>
    </div>
  </header>
  <iframe title="Every School Day Matters" src="https://www.youtube.com/embed/FVLRFAVyvRU"></iframe>
</body>
</html>`)
      const freeze = await serializeRenderedPage(page)
      expect(freeze).toMatch(/id="ast-desktop-header"[^>]*><\/div>/)
      expect(freeze).toMatch(/id="ast-mobile-header"[^>]*>[\s\S]*alt="Anything"/)
      expect(freeze).toContain('data-accessiq-embed-poster')
      expect(freeze).not.toContain('youtube.com/embed')
    } finally {
      await page?.close()
    }
  }, 60_000)

  it('inlines CSS, images, and fonts and strips scripts', async () => {
    let page: Page | undefined
    try {
      page = await browser.newPage()
      await page.goto(origin, { waitUntil: 'domcontentloaded' })
      const freeze = await serializeRenderedPage(page)
      expect(freeze).toContain('Home')
      expect(freeze).not.toContain('<script>')
      expect(freeze).toContain('data-accessiq-inlined')
      expect(freeze.toLowerCase()).not.toContain('rel="stylesheet"')

      const preview = await inlinePageAssetsForPreview(page, freeze)
      expect(preview).toContain('data:image/png;base64,')
      expect(preview).toContain('data:font/woff2;base64,')
      expect(preview).not.toContain(`${origin}/hero.png`)
      expect(preview).not.toContain(`${origin}/bg.png`)
      expect(preview).not.toContain(`${origin}/icon.woff2`)
      expect(preview).toContain('https://www.facebook.com/tr?id=1')
    } finally {
      await page?.close()
    }
  }, 60_000)
})
