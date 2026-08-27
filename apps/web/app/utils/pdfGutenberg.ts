/**
 * Convert OpenDataLoader-style HTML into WordPress Gutenberg block markup.
 * Keeps structure; does not invent content.
 */
export function htmlToGutenbergBlocks(html: string): string {
  const trimmed = html?.trim()
  if (!trimmed) return ''

  if (typeof DOMParser === 'undefined') {
    return htmlToGutenbergBlocksFallback(trimmed)
  }

  const doc = new DOMParser().parseFromString(wrappedHtml(trimmed), 'text/html')
  const body = doc.body
  const blocks: string[] = []

  for (const node of Array.from(body.childNodes)) {
    const block = nodeToBlock(node)
    if (block) blocks.push(block)
  }

  return blocks.join('\n\n')
}

function wrappedHtml(html: string): string {
  if (/<\s*html[\s>]/i.test(html) || /<\s*body[\s>]/i.test(html)) return html
  return `<!DOCTYPE html><html><body>${html}</body></html>`
}

function nodeToBlock(node: Node): string | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent || '').trim()
    if (!text) return null
    return paragraphBlock(escapeHtml(text))
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()

  if (tag === 'script' || tag === 'style') return null

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag[1])
    const inner = el.innerHTML.trim() || escapeHtml(el.textContent || '')
    return `<!-- wp:heading ${JSON.stringify({ level })} -->\n<h${level} class="wp-block-heading">${inner}</h${level}>\n<!-- /wp:heading -->`
  }

  if (tag === 'p') {
    const inner = el.innerHTML.trim()
    if (!inner) return null
    return paragraphBlock(inner)
  }

  if (tag === 'ul' || tag === 'ol') {
    const ordered = tag === 'ol'
    const attrs = ordered ? ' {"ordered":true}' : ''
    return `<!-- wp:list${attrs} -->\n<${tag} class="wp-block-list">${el.innerHTML}</${tag}>\n<!-- /wp:list -->`
  }

  if (tag === 'table') {
    return `<!-- wp:table -->\n<figure class="wp-block-table"><table>${el.innerHTML}</table></figure>\n<!-- /wp:table -->`
  }

  if (tag === 'img' || tag === 'figure') {
    const img = tag === 'img' ? el : el.querySelector('img')
    const src = img?.getAttribute('src') || ''
    const alt = img?.getAttribute('alt') || el.querySelector('figcaption')?.textContent?.trim() || ''
    const attrs = JSON.stringify({
      url: src || undefined,
      alt: alt || undefined
    })
    const imgTag = src
      ? `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"/>`
      : `<img alt="${escapeAttr(alt || 'Extracted figure')}"/>`
    return `<!-- wp:image ${attrs} -->\n<figure class="wp-block-image">${imgTag}</figure>\n<!-- /wp:image -->`
  }

  if (tag === 'blockquote') {
    return `<!-- wp:quote -->\n<blockquote class="wp-block-quote">${el.innerHTML}</blockquote>\n<!-- /wp:quote -->`
  }

  if (tag === 'pre' || tag === 'code') {
    const text = escapeHtml(el.textContent || '')
    return `<!-- wp:code -->\n<pre class="wp-block-code"><code>${text}</code></pre>\n<!-- /wp:code -->`
  }

  if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main') {
    const childBlocks = Array.from(el.childNodes)
      .map(nodeToBlock)
      .filter(Boolean) as string[]
    if (childBlocks.length) return childBlocks.join('\n\n')
    const text = (el.textContent || '').trim()
    return text ? paragraphBlock(escapeHtml(text)) : null
  }

  const text = (el.textContent || '').trim()
  if (!text) return null
  return paragraphBlock(el.innerHTML.trim() || escapeHtml(text))
}

function paragraphBlock(inner: string): string {
  return `<!-- wp:paragraph -->\n<p>${inner}</p>\n<!-- /wp:paragraph -->`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

/** Regex fallback for non-DOM environments (SSR / node tests without happy-dom). */
export function htmlToGutenbergBlocksFallback(html: string): string {
  const blocks: string[] = []
  const headingRe = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi
  let match: RegExpExecArray | null
  const used: { start: number, end: number, block: string }[] = []

  while ((match = headingRe.exec(html)) !== null) {
    const level = Number(match[1])
    const inner = match[2]!.trim()
    used.push({
      start: match.index,
      end: match.index + match[0].length,
      block: `<!-- wp:heading ${JSON.stringify({ level })} -->\n<h${level} class="wp-block-heading">${inner}</h${level}>\n<!-- /wp:heading -->`
    })
  }

  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi
  while ((match = pRe.exec(html)) !== null) {
    const inner = match[1]!.trim()
    if (!inner) continue
    used.push({
      start: match.index,
      end: match.index + match[0].length,
      block: paragraphBlock(inner)
    })
  }

  used.sort((a, b) => a.start - b.start)
  for (const item of used) blocks.push(item.block)

  if (!blocks.length) {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (text) blocks.push(paragraphBlock(escapeHtml(text)))
  }

  return blocks.join('\n\n')
}
