import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import { NodeHtmlMarkdown } from 'node-html-markdown'
import { normalizeMarkdownForHash } from './contentHash.js'

const nhm = new NodeHtmlMarkdown({
  preferNativeParser: false,
  codeBlockStyle: 'fenced'
})

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
  '.cookie-banner', '.related-posts', '.comments', '#comments', '.footnotes'
]

function removeNoise(root: Element): void {
  for (const selector of NOISE_SELECTORS) {
    root.querySelectorAll(selector).forEach(node => node.remove())
  }
}

function pickMainElement(document: Document): Element | null {
  let best: Element | null = null
  let bestLength = 0
  for (const selector of CONTENT_SELECTORS) {
    for (const el of document.querySelectorAll(selector)) {
      const len = (el.textContent || '').trim().length
      if (len > bestLength) {
        bestLength = len
        best = el
      }
    }
  }
  return bestLength >= 50 ? best : null
}

function fallbackArticleHtml(document: Document): string {
  const main = pickMainElement(document)
  if (main) {
    const clone = main.cloneNode(true) as Element
    removeNoise(clone)
    return clone.innerHTML
  }
  const body = document.body
  if (!body) return ''
  const clone = body.cloneNode(true) as Element
  removeNoise(clone)
  return clone.innerHTML
}

/**
 * Extract clean Markdown from rendered page HTML (post-JS).
 * Uses Readability for boilerplate removal, then HTML→Markdown conversion.
 */
export function extractContentMarkdown(html: string, pageUrl: string): string | null {
  const trimmed = html?.trim()
  if (!trimmed) return null

  let document: Document
  try {
    const parsed = parseHTML(trimmed)
    document = parsed.document as Document
  } catch {
    return null
  }

  let articleHtml: string | null = null
  try {
    const readable = new Readability(document, { charThreshold: 50 }).parse()
    if (readable?.content?.trim()) {
      articleHtml = readable.content
    }
  } catch {
    // fall through to selector fallback
  }

  if (!articleHtml) {
    articleHtml = fallbackArticleHtml(document)
  }

  if (!articleHtml?.trim()) return null

  try {
    const md = nhm.translate(articleHtml)
    const normalized = normalizeMarkdownForHash(md)
    return normalized.length > 0 ? normalized : null
  } catch {
    return null
  }
}
