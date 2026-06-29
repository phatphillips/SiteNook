/**
 * Rules for which text counts toward readability scores.
 * Keep in sync with apps/scanner/src/qa/proseForReadability.ts
 */

export const READABILITY_NOISE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'svg',
  'nav',
  'footer',
  'header',
  'aside',
  '[hidden]',
  '[aria-hidden="true"]',
  '.breadcrumb',
  '.breadcrumbs',
  '.toc',
  '.table-of-contents',
  '#toc',
  '.social-share',
  '.share-buttons',
  '.newsletter',
  '.cookie-banner',
  '.related-posts',
  '.comments',
  '#comments',
  '.footnotes',
  '.footnote-ref',
  '.edit-link',
  '.pager',
  '.pagination'
]

export const READABILITY_PROSE_SKIP_SELECTORS = [
  'pre',
  'code',
  'kbd',
  'samp',
  'var',
  'math',
  'table',
  'figure',
  'iframe',
  'video',
  'audio',
  'canvas',
  'form',
  'button',
  'input',
  'select',
  'textarea',
  'details',
  'datalist',
  'output',
  '.highlight',
  '.hljs',
  '.prism-code',
  '.gist',
  '.code-block',
  '.codehilite',
  '.rouge',
  '[class*="language-"]',
  '[class*="highlight-source"]',
  '.copy-line',
  '.line-numbers'
]

export const READABILITY_BLOCK_SELECTOR =
  'p, h1, h2, h3, h4, h5, h6, li, blockquote'

export function looksLikeCss(text: string): boolean {
  if (text.length > 500 && text.includes('{') && text.includes('}') && text.includes(';')) {
    return true
  }
  return /^[.@#*\w][^{]{0,80}\{[^}]*\}/.test(text)
}

export function looksLikeJson(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false
  if (trimmed.length > 200) return true
  return /^[\[{][\s\S]*[}\]]$/.test(trimmed) && /"\w+"\s*:/.test(trimmed)
}

export function looksLikeNonProseBlock(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (looksLikeCss(trimmed) || looksLikeJson(trimmed)) return true

  if (/^https?:\/\/\S+$/i.test(trimmed)) return true
  if (/^[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|css|scss|json|md|svg|vue|py|go|rs|yaml|yml)$/i.test(trimmed)) {
    return true
  }

  const words = trimmed.match(/\b[\p{L}\p{N}'’-]+\b/gu) ?? []
  if (words.length === 0) return true

  const symbolChars = trimmed.replace(/[\p{L}\p{N}\s]/gu, '').length
  if (symbolChars / trimmed.length > 0.45 && words.length < 8) return true

  if (/^[\s\d$#>|:;,.()[\]{}\\/_-]+$/.test(trimmed)) return true

  return false
}

export function stripToReadabilityProse(text: string): string {
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
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')

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

  return kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export function filterProseBlocks(blocks: string[]): string[] {
  const out: string[] = []
  for (const block of blocks) {
    const text = block.replace(/\s+/g, ' ').trim()
    if (!text || looksLikeNonProseBlock(text)) continue
    if (out[out.length - 1] !== text) out.push(text)
  }
  return out
}
