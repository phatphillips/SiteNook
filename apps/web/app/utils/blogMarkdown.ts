/** Shared Markdown helpers for the marketing blog (trusted in-repo content). */

export function parseBlogFrontmatter(raw: string): { data: Record<string, unknown>, body: string } {
  const normalized = raw.replace(/^\uFEFF/, '')
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { data: {}, body: normalized.trim() }

  const yaml = match[1] ?? ''
  const body = (match[2] ?? '').trim()
  const data: Record<string, unknown> = {}
  let currentKey: string | null = null
  let currentArray: string[] | null = null

  for (const line of yaml.split(/\r?\n/)) {
    if (/^\s*-\s+/.test(line) && currentKey && currentArray) {
      currentArray.push(line.replace(/^\s*-\s+/, '').trim().replace(/^["']|["']$/g, ''))
      data[currentKey] = currentArray
      continue
    }

    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!kv) continue
    currentKey = kv[1]!
    const rawValue = kv[2]!.trim()
    currentArray = null

    if (rawValue === '') {
      currentArray = []
      data[currentKey] = currentArray
      continue
    }

    if (rawValue === 'true' || rawValue === 'false') {
      data[currentKey] = rawValue === 'true'
      continue
    }

    data[currentKey] = rawValue.replace(/^["']|["']$/g, '')
  }

  return { data, body }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineMarkdown(text: string): string {
  let out = escapeHtml(text)
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  return out
}

/** Minimal Markdown → HTML for blog posts (headings, lists, paragraphs, images). */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let i = 0
  let inUl = false
  let inOl = false

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>')
      inUl = false
    }
    if (inOl) {
      html.push('</ol>')
      inOl = false
    }
  }

  while (i < lines.length) {
    const line = lines[i] ?? ''

    if (!line.trim()) {
      closeLists()
      i++
      continue
    }

    const heading = line.match(/^(#{2,3})\s+(.+)$/)
    if (heading) {
      closeLists()
      const level = heading[1]!.length
      html.push(`<h${level}>${inlineMarkdown(heading[2]!)}</h${level}>`)
      i++
      continue
    }

    if (/^---+$/.test(line.trim())) {
      closeLists()
      html.push('<hr />')
      i++
      continue
    }

    const ul = line.match(/^[-*]\s+(.+)$/)
    if (ul) {
      if (inOl) {
        html.push('</ol>')
        inOl = false
      }
      if (!inUl) {
        html.push('<ul>')
        inUl = true
      }
      html.push(`<li>${inlineMarkdown(ul[1]!)}</li>`)
      i++
      continue
    }

    const ol = line.match(/^\d+\.\s+(.+)$/)
    if (ol) {
      if (inUl) {
        html.push('</ul>')
        inUl = false
      }
      if (!inOl) {
        html.push('<ol>')
        inOl = true
      }
      html.push(`<li>${inlineMarkdown(ol[1]!)}</li>`)
      i++
      continue
    }

    closeLists()
    const para: string[] = [line]
    i++
    while (i < lines.length && lines[i]!.trim() && !/^(#{2,3}\s|[-*]\s|\d+\.\s|---+$)/.test(lines[i]!)) {
      para.push(lines[i]!)
      i++
    }
    html.push(`<p>${inlineMarkdown(para.join(' '))}</p>`)
  }

  closeLists()
  return html.join('\n')
}
