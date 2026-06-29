/**
 * Extracts article/main text from stored HTML snapshots.
 * Keep in sync with apps/scanner/src/qa/extractMainContent.ts
 */
import {
  READABILITY_BLOCK_SELECTOR,
  READABILITY_NOISE_SELECTORS,
  READABILITY_PROSE_SKIP_SELECTORS,
  filterProseBlocks,
  looksLikeNonProseBlock,
  stripToReadabilityProse
} from '~/utils/proseForReadability'

export interface ReadablePageContent {
  /** Plain text with paragraph breaks. */
  text: string
  /** Minimal HTML for rich-text paste (paragraphs, headings, blockquotes). */
  html: string
}

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

function finalizeReadabilityText(text: string): string {
  return stripToReadabilityProse(text)
}

export function extractReadablePageContent(
  html: string,
  options?: { title?: string }
): ReadablePageContent {
  if (!html?.trim()) {
    return { text: '', html: '' }
  }

  const fromPayload = tryExtractStructuredBody(html)
  if (fromPayload) {
    const text = finalizeReadabilityText(fromPayload)
    return {
      text,
      html: markdownToCopyHtml(fromPayload)
    }
  }

  const fromDom = tryExtractFromDom(html)
  if (fromDom.text.length >= 50) {
    return {
      text: finalizeReadabilityText(fromDom.text),
      html: fromDom.html
    }
  }

  const fallback = regexFallbackPlainText(html)
  return {
    text: finalizeReadabilityText(fallback),
    html: plainTextToCopyHtml(fallback)
  }
}

/** @deprecated Use extractReadablePageContent */
export function htmlSnapshotToPlainText(html: string, title?: string): string {
  return extractReadablePageContent(html, { title }).text
}

function tryExtractStructuredBody(html: string): string | null {
  const nextScript = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (nextScript) {
    const body = pickBodyField(parseJsonSafe(nextScript[1]))
    if (body) return normalizeMarkdownBody(body)
  }

  const nuxtMatch = html.match(/<script[^>]+id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (nuxtMatch) {
    const body = pickBodyField(parseJsonSafe(nuxtMatch[1]))
    if (body) return normalizeMarkdownBody(body)
  }

  const markdownBodyMatch = html.match(/"markdownBody"\s*:\s*"((?:\\.|[^"\\])*)"/)
  if (markdownBodyMatch) {
    try {
      const decoded = JSON.parse(`"${markdownBodyMatch[1]}"`) as string
      if (typeof decoded === 'string' && decoded.trim().length > 50) {
        return normalizeMarkdownBody(decoded)
      }
    } catch {
      // ignore
    }
  }

  return null
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
    if (typeof node === 'string' && node.trim().length > 50) {
      return node
    }
  }

  return null
}

function parseJsonSafe(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
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

function tryExtractFromDom(html: string): ReadablePageContent {
  if (typeof DOMParser === 'undefined') {
    return { text: '', html: '' }
  }

  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const selector of [...READABILITY_NOISE_SELECTORS, ...READABILITY_PROSE_SKIP_SELECTORS]) {
    doc.querySelectorAll(selector).forEach(node => node.remove())
  }

  let best: Element | null = null
  let bestLength = 0
  for (const selector of CONTENT_SELECTORS) {
    for (const el of doc.querySelectorAll(selector)) {
      const length = meaningfulText(el.textContent || '').length
      if (length > bestLength) {
        bestLength = length
        best = el
      }
    }
  }

  const root = best ?? doc.body
  if (!root) return { text: '', html: '' }

  const text = blocksToPlainText(root)
  const htmlOut = blocksToSimpleHtml(root)
  return { text, html: htmlOut || plainTextToCopyHtml(text) }
}

function blocksToPlainText(root: Element): string {
  const blocks = Array.from(root.querySelectorAll(READABILITY_BLOCK_SELECTOR))
    .map(el => meaningfulText(el.textContent || ''))

  const filtered = filterProseBlocks(blocks)
  if (filtered.length >= 1) return filtered.join('\n\n')

  const fallback = meaningfulText(root.textContent || '')
  return stripTrailingJson(stripLeadingCssNoise(fallback))
}

function blocksToSimpleHtml(root: Element): string {
  const parts: string[] = []

  for (const el of root.querySelectorAll(READABILITY_BLOCK_SELECTOR)) {
    const text = meaningfulText(el.textContent || '')
    if (!text || looksLikeNonProseBlock(text)) continue

    const tag = el.tagName.toLowerCase()
    if (tag === 'blockquote') {
      parts.push(`<blockquote><p>${escapeHtml(text)}</p></blockquote>`)
    } else if (tag === 'pre') {
      parts.push(`<pre>${escapeHtml(text)}</pre>`)
    } else if (tag.startsWith('h') && tag.length === 2) {
      parts.push(`<${tag}>${escapeHtml(text)}</${tag}>`)
    } else if (tag === 'li') {
      parts.push(`<li>${escapeHtml(text)}</li>`)
    } else {
      parts.push(`<p>${escapeHtml(text)}</p>`)
    }
  }

  return parts.join('\n')
}

function regexFallbackPlainText(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')

  text = decodeHtmlEntities(text)
  text = meaningfulText(stripTrailingJson(stripLeadingCssNoise(text)))
  return stripToReadabilityProse(text)
}

function markdownToCopyHtml(markdown: string): string {
  const paragraphs = markdown.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  const parts: string[] = []

  for (const block of paragraphs) {
    if (block.startsWith('### ')) {
      parts.push(`<h3>${inlineMarkdownToHtml(block.slice(4))}</h3>`)
    } else if (block.startsWith('## ')) {
      parts.push(`<h2>${inlineMarkdownToHtml(block.slice(3))}</h2>`)
    } else if (block.startsWith('# ')) {
      parts.push(`<h1>${inlineMarkdownToHtml(block.slice(2))}</h1>`)
    } else if (block.startsWith('> ')) {
      const quote = block.split('\n').map(line => line.replace(/^>\s?/, '')).join(' ')
      parts.push(`<blockquote><p>${inlineMarkdownToHtml(quote)}</p></blockquote>`)
    } else if (block === '---') {
      parts.push('<hr>')
    } else {
      const body = block.split('\n').map(line => inlineMarkdownToHtml(line)).join('<br>')
      parts.push(`<p>${body}</p>`)
    }
  }

  return parts.join('\n')
}

function inlineMarkdownToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

function plainTextToCopyHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

function meaningfulText(text: string): string {
  return text.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim()
}

function stripTrailingJson(text: string): string {
  const idx = text.search(/\s\{"props"\s*:\s*\{/)
  if (idx > 50) return text.slice(0, idx).trim()
  const buildIdx = text.search(/\s\{"buildId"\s*:/)
  if (buildIdx > 50) return text.slice(0, buildIdx).trim()
  return text
}

function stripLeadingCssNoise(text: string): string {
  let rest = text.trim()
  for (let i = 0; i < 20; i++) {
    const stripped = rest
      .replace(/^@(?:keyframes|media)[^{]+\{(?:[^{}]|\{[^}]*\})*\}/, '')
      .replace(/^[.#@][\w\-/.%[\](),\s#+*~>:"'=^$|]+(?:\{[^}]*\})+/, '')
      .trim()
    if (stripped === rest) break
    rest = stripped
  }
  return rest
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function decodeHtmlEntities(text: string): string {
  if (typeof document !== 'undefined') {
    const el = document.createElement('textarea')
    el.innerHTML = text
    return el.value
  }
  return text
}
