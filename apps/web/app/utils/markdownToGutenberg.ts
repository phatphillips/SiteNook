function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
}

function paragraphBlock(lines: string[]): string {
  const content = inlineMarkdown(lines.join(' ').trim())
  return `<!-- wp:paragraph -->\n<p>${content}</p>\n<!-- /wp:paragraph -->`
}

/**
 * Convert extracted page Markdown to paste-ready WordPress Gutenberg blocks.
 * The converter deliberately handles the common structural Markdown emitted by
 * the crawler without inventing content or requiring a second HTML snapshot.
 */
export function markdownToGutenbergBlocks(markdown: string): string {
  const source = markdown.trim()
  if (!source) return ''

  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]!
    if (!line.trim()) {
      index += 1
      continue
    }

    const fence = line.match(/^```/)
    if (fence) {
      const code: string[] = []
      index += 1
      while (index < lines.length && !/^```/.test(lines[index]!)) {
        code.push(lines[index]!)
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push(`<!-- wp:code -->\n<pre class="wp-block-code"><code>${escapeHtml(code.join('\n'))}</code></pre>\n<!-- /wp:code -->`)
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = heading[1]!.length
      blocks.push(`<!-- wp:heading ${JSON.stringify({ level })} -->\n<h${level} class="wp-block-heading">${inlineMarkdown(heading[2]!)}</h${level}>\n<!-- /wp:heading -->`)
      index += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index]!)) {
        quote.push(lines[index]!.replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push(`<!-- wp:quote -->\n<blockquote class="wp-block-quote"><p>${inlineMarkdown(quote.join(' '))}</p></blockquote>\n<!-- /wp:quote -->`)
      continue
    }

    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/)
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[2]!)
      const items: string[] = []
      while (index < lines.length) {
        const item = lines[index]!.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/)
        if (!item || /\d+\./.test(item[2]!) !== ordered) break
        items.push(`<li>${inlineMarkdown(item[3]!)}</li>`)
        index += 1
      }
      const tag = ordered ? 'ol' : 'ul'
      const attributes = ordered ? ' {"ordered":true}' : ''
      blocks.push(`<!-- wp:list${attributes} -->\n<${tag} class="wp-block-list">${items.join('')}</${tag}>\n<!-- /wp:list -->`)
      continue
    }

    if (/^([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      blocks.push('<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity"/>\n<!-- /wp:separator -->')
      index += 1
      continue
    }

    const paragraph: string[] = []
    while (index < lines.length && lines[index]!.trim()) {
      if (paragraph.length && /^(#{1,6})\s+|^```|^>\s?|^(\s*)([-*+]|\d+\.)\s+/.test(lines[index]!)) break
      paragraph.push(lines[index]!)
      index += 1
    }
    if (paragraph.length) blocks.push(paragraphBlock(paragraph))
  }

  return blocks.join('\n\n')
}
