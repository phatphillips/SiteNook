import type { ContentExplorerEntry, ContentExplorerTreeNode } from '~/types/sitenook'

function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'index'
}

function contentExportFilename(url: string, title: string | undefined, extension: string): string {
  const ext = extension.replace(/^\./, '') || 'md'
  try {
    const parsed = new URL(url)
    let path = parsed.pathname.replace(/^\/+|\/+$/g, '')
    if (!path) {
      const fromTitle = (title || 'index').trim().toLowerCase().replace(/[^\w.-]+/g, '-')
      return `${fromTitle || 'index'}.${ext}`
    }
    const parts = path.split('/').map(sanitizePathSegment)
    const last = parts[parts.length - 1] || 'index'
    if (!last.includes('.')) {
      parts[parts.length - 1] = `${last}.${ext}`
    } else if (!last.endsWith(`.${ext}`)) {
      parts[parts.length - 1] = `${last}.${ext}`
    }
    return parts.join('/')
  } catch {
    const fallback = sanitizePathSegment(title || url || 'page')
    return `${fallback}.${ext}`
  }
}

export function markdownExportFilename(url: string, title?: string): string {
  return contentExportFilename(url, title, 'md')
}

export function htmlExportFilename(url: string, title?: string): string {
  return contentExportFilename(url, title, 'html')
}

function nodeId(path: string): string {
  return `node:${path || '/'}`
}

function displayLabel(entry: ContentExplorerEntry, fallback: string): string {
  const title = entry.title?.trim()
  if (title && title !== entry.url) return title
  return fallback
}

function ensureChild(
  siblings: ContentExplorerTreeNode[],
  segment: string,
  path: string
): ContentExplorerTreeNode {
  let node = siblings.find(n => n.path === path)
  if (!node) {
    node = {
      id: nodeId(path),
      label: segment,
      path,
      children: []
    }
    siblings.push(node)
  }
  if (!node.children) node.children = []
  return node
}

function insertEntry(root: ContentExplorerTreeNode[], entry: ContentExplorerEntry): void {
  let url: URL
  try {
    url = new URL(entry.url)
  } catch {
    root.push({
      id: `page:${entry.id}`,
      label: displayLabel(entry, entry.url),
      path: entry.url,
      entry
    })
    return
  }

  const segments = url.pathname.split('/').filter(Boolean)
  if (!segments.length) {
    let node = root.find(n => n.path === '/')
    if (!node) {
      node = {
        id: nodeId('/'),
        label: displayLabel(entry, url.hostname || entry.url),
        path: '/',
        entry
      }
      root.push(node)
    } else {
      node.entry = entry
      node.label = displayLabel(entry, url.hostname || entry.url)
    }
    return
  }

  let siblings = root
  let builtPath = ''
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!
    const isLeaf = i === segments.length - 1
    builtPath += `/${segment}`

    if (isLeaf) {
      let node = siblings.find(n => n.path === builtPath)
      if (!node) {
        node = {
          id: nodeId(builtPath),
          label: displayLabel(entry, segment),
          path: builtPath,
          entry,
          children: []
        }
        siblings.push(node)
      } else {
        node.entry = entry
        node.label = displayLabel(entry, segment)
        if (!node.children) node.children = []
      }
      return
    }

    const folder = ensureChild(siblings, segment, builtPath)
    siblings = folder.children!
  }
}

function hasSubpages(node: ContentExplorerTreeNode): boolean {
  return Boolean(node.children?.length)
}

function isHomepageNode(node: ContentExplorerTreeNode): boolean {
  if (node.path === '/') return true
  if (!node.entry?.url) return false
  try {
    const path = new URL(node.entry.url).pathname.replace(/\/+$/, '') || '/'
    return path === '/'
  } catch {
    return false
  }
}

/** Folders, then the site homepage, then other leaf pages. */
function nodeSortRank(node: ContentExplorerTreeNode): number {
  if (hasSubpages(node)) return 0
  if (isHomepageNode(node)) return 1
  return 2
}

function sortNodes(nodes: ContentExplorerTreeNode[]): ContentExplorerTreeNode[] {
  return nodes
    .map(node => ({
      ...node,
      children: node.children?.length ? sortNodes(node.children) : undefined
    }))
    .sort((a, b) => {
      const rankDelta = nodeSortRank(a) - nodeSortRank(b)
      if (rankDelta !== 0) return rankDelta
      return a.label.localeCompare(b.label)
    })
}

export function buildContentExplorerTree(entries: ContentExplorerEntry[]): ContentExplorerTreeNode[] {
  const root: ContentExplorerTreeNode[] = []
  const sorted = [...entries].sort((a, b) => a.url.localeCompare(b.url))
  for (const entry of sorted) {
    insertEntry(root, entry)
  }
  return sortNodes(root)
}

export function flattenContentExplorerPages(nodes: ContentExplorerTreeNode[]): ContentExplorerEntry[] {
  const out: ContentExplorerEntry[] = []
  const walk = (list: ContentExplorerTreeNode[]) => {
    for (const node of list) {
      if (node.entry) out.push(node.entry)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return out
}

export function filterContentExplorerTree(
  nodes: ContentExplorerTreeNode[],
  query: string
): ContentExplorerTreeNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes

  const filterNode = (node: ContentExplorerTreeNode): ContentExplorerTreeNode | null => {
    const children = (node.children ?? [])
      .map(filterNode)
      .filter((n): n is ContentExplorerTreeNode => n !== null)

    const hay = `${node.label} ${node.entry?.url ?? ''} ${node.entry?.title ?? ''}`.toLowerCase()
    const selfMatch = hay.includes(q)

    if (!selfMatch && !children.length) return null
    return {
      ...node,
      children: children.length ? children : undefined
    }
  }

  return sortNodes(nodes.map(filterNode).filter((n): n is ContentExplorerTreeNode => n !== null))
}

/** First markdown ATX heading (# …), for display when PB title is missing. */
export function firstMarkdownHeading(markdown: string): string | null {
  const match = markdown.match(/^#{1,6}\s+(.+?)\s*$/m)
  if (!match?.[1]) return null
  const heading = match[1].replace(/#+\s*$/, '').trim()
  return heading || null
}

export function resolveContentExplorerTitle(
  entry: ContentExplorerEntry,
  markdown?: string
): string {
  const raw = entry.title?.trim()
  if (raw && raw !== entry.url) return raw
  if (markdown) {
    const heading = firstMarkdownHeading(markdown)
    if (heading) return heading
  }
  if (raw) return raw
  return entry.url || 'Untitled'
}
