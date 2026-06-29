import type { Page } from 'playwright'

/**

 * Extracts article/main text for readability, spelling, and word counts.

 * Self-contained for Playwright page.evaluate (no closure imports).

 *

 * Keep selector/strip rules in sync with apps/scanner/src/qa/proseForReadability.ts

 */

async function ensureEsbuildEvaluatePolyfill(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = globalThis as typeof globalThis & { __name?: (target: unknown) => unknown }
    g.__name = (target) => target
  })
}

export async function extractMainContentFromPage(page: Page): Promise<string> {
  await ensureEsbuildEvaluatePolyfill(page)
  return page.evaluate(extractMainContentTextInPage)
}

export function extractMainContentTextInPage(): string {

  const CONTENT_SELECTORS = [

    'article',

    'main',

    '[role="main"]',

    '.post-content',

    '.entry-content',

    '.article-body',

    '.article-content',

    '.markdown-body',

    '.prose',

    '#content',

    '.content'

  ]



  const NOISE_SELECTORS = [

    'script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header', 'aside',

    '[hidden]', '[aria-hidden="true"]', '.breadcrumb', '.breadcrumbs', '.toc',

    '.table-of-contents', '#toc', '.social-share', '.share-buttons', '.newsletter',

    '.cookie-banner', '.related-posts', '.comments', '#comments', '.footnotes',

    '.footnote-ref', '.edit-link', '.pager', '.pagination'

  ]



  const PROSE_SKIP_SELECTORS = [

    'pre', 'code', 'kbd', 'samp', 'var', 'math', 'table', 'figure', 'iframe',

    'video', 'audio', 'canvas', 'form', 'button', 'input', 'select', 'textarea',

    'details', 'datalist', 'output', '.highlight', '.hljs', '.prism-code', '.gist',

    '.code-block', '.codehilite', '.rouge', '[class*="language-"]',

    '[class*="highlight-source"]', '.copy-line', '.line-numbers'

  ]



  const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, blockquote'

  const STRIP_SELECTORS = [...NOISE_SELECTORS, ...PROSE_SKIP_SELECTORS]



  function meaningfulText(text: string): string {

    return text.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim()

  }



  function looksLikeCss(text: string): boolean {

    if (text.length > 500 && text.includes('{') && text.includes('}') && text.includes(';')) return true

    return /^[.@#*\w][^{]{0,80}\{[^}]*\}/.test(text)

  }



  function looksLikeJson(text: string): boolean {
    const trimmed = text.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false
    if (trimmed.length > 200) return true
    return /^[\[{][\s\S]*[}\]]$/.test(trimmed) && /"\w+"\s*:/.test(trimmed)
  }



  function looksLikeNonProseBlock(text: string): boolean {

    const trimmed = text.trim()

    if (!trimmed) return true

    if (looksLikeCss(trimmed) || looksLikeJson(trimmed)) return true

    if (/^https?:\/\/\S+$/i.test(trimmed)) return true

    if (/^[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|css|scss|json|md|svg|vue|py|go|rs|yaml|yml)$/i.test(trimmed)) return true

    const words = trimmed.match(/\b[\p{L}\p{N}'’-]+\b/gu) ?? []

    if (words.length === 0) return true

    const symbolChars = trimmed.replace(/[\p{L}\p{N}\s]/gu, '').length

    if (symbolChars / trimmed.length > 0.45 && words.length < 8) return true

    if (/^[\s\d$#>|:;,.()[\]{}\\/_-]+$/.test(trimmed)) return true

    return false

  }



  function stripToReadabilityProse(text: string): string {

    let prose = text

      .replace(/\r\n/g, '\n')

      .replace(/^\uFEFF?---[\s\S]*?---\n*/m, '')

      .replace(/<!--[\s\S]*?-->/g, '')

      .replace(/<(pre|code|style|script|svg|math)[^>]*>[\s\S]*?<\/\1>/gi, '\n\n')

      .replace(/```[\s\S]*?```/g, '\n\n')

      .replace(/^( {4}|\t).+$/gm, '\n')

      .replace(/\$\$[\s\S]*?\$\$/g, '\n\n')

      .replace(/\$[^$\n]+\$/g, ' ')

      .replace(/^#{1,6}\s+/gm, '')

      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')

      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

      .replace(/`[^`\n]+`/g, ' ')

      .replace(/^\s*[-*+]\s+/gm, '')

      .replace(/^\s*\d+\.\s+/gm, '')

      .replace(/^\s*>\s?/gm, '')

      .replace(/\*\*([^*]+)\*\*/g, '$1')

      .replace(/\*([^*]+)\*/g, '$1')

      .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')

      .replace(/<[^>]+>/g, ' ')

      .replace(/\n{3,}/g, '\n\n')

      .replace(/[ \t]+/g, ' ')

      .trim()



    const lines = prose.split('\n').map(line => line.trim())

    const kept: string[] = []

    for (const line of lines) {

      if (!line) {

        if (kept.length && kept[kept.length - 1] !== '') kept.push('')

        continue

      }

      if (looksLikeNonProseBlock(line)) continue

      kept.push(line)

    }

    return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()

  }



  function normalizeMarkdownBody(raw: string): string {

    return raw

      .replace(/\r\n/g, '\n')

      .replace(/\\n/g, '\n')

      .replace(/\\t/g, '\t')

      .replace(/\\"/g, '"')

      .replace(/\n{3,}/g, '\n\n')

      .trim()

  }



  function pickBodyField(data: unknown): string | null {

    if (!data || typeof data !== 'object') return null

    const paths = [

      ['props', 'pageProps', 'post', 'markdownBody'],

      ['props', 'pageProps', 'content'],

      ['props', 'pageProps', 'markdown'],

      ['data', 'content'],

      ['content']

    ]

    for (const path of paths) {

      let node: unknown = data

      for (const key of path) {

        if (!node || typeof node !== 'object') {

          node = undefined

          break

        }

        node = (node as Record<string, unknown>)[key]

      }

      if (typeof node === 'string' && node.trim().length > 50) return node

    }

    return null

  }



  function stripTrailingJson(text: string): string {

    const idx = text.search(/\s\{"props"\s*:\s*\{/)

    if (idx > 50) return text.slice(0, idx).trim()

    const buildIdx = text.search(/\s\{"buildId"\s*:/)

    if (buildIdx > 50) return text.slice(0, buildIdx).trim()

    return text

  }



  function removeNonProseNodes(root: Element): void {

    for (const selector of STRIP_SELECTORS) {

      root.querySelectorAll(selector).forEach(node => node.remove())

    }

  }



  function blocksToPlainText(root: Element): string {

    const blocks: string[] = []

    for (const el of root.querySelectorAll(BLOCK_SELECTOR)) {

      const text = meaningfulText(el.textContent || '')

      if (!text || looksLikeNonProseBlock(text)) continue

      if (blocks[blocks.length - 1] !== text) blocks.push(text)

    }

    if (blocks.length >= 1) return blocks.join('\n\n')

    const fallback = meaningfulText(root.textContent || '')

    return stripTrailingJson(fallback)

  }



  function textFromElement(el: Element): string {

    const clone = el.cloneNode(true) as Element

    removeNonProseNodes(clone)

    return stripToReadabilityProse(blocksToPlainText(clone))

  }



  const nextScript = document.getElementById('__NEXT_DATA__')

  if (nextScript?.textContent) {

    try {

      const data = JSON.parse(nextScript.textContent) as unknown

      const body = pickBodyField(data)

      if (body) return stripToReadabilityProse(normalizeMarkdownBody(body))

    } catch {

      // continue

    }

  }



  const nuxtScript = document.getElementById('__NUXT_DATA__')

  if (nuxtScript?.textContent) {

    try {

      const data = JSON.parse(nuxtScript.textContent) as unknown

      const body = pickBodyField(data)

      if (body) return stripToReadabilityProse(normalizeMarkdownBody(body))

    } catch {

      // continue

    }

  }



  let best: Element | null = null

  let bestLength = 0

  for (const selector of CONTENT_SELECTORS) {

    for (const el of document.querySelectorAll(selector)) {

      const text = textFromElement(el)

      if (text.length > bestLength) {

        bestLength = text.length

        best = el

      }

    }

  }



  if (best && bestLength >= 50) return textFromElement(best)



  const body = document.body

  if (!body) return ''



  const bodyClone = body.cloneNode(true) as Element

  removeNonProseNodes(bodyClone)

  return stripToReadabilityProse(blocksToPlainText(bodyClone))

}



export function countWords(text: string): number {

  return text.match(/\b[\p{L}\p{N}'’-]+\b/gu)?.length ?? 0

}


