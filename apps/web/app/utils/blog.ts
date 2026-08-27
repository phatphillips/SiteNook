export type BlogCategory = 'product' | 'research' | 'company' | 'guides'

export interface BlogListItem {
  title: string
  description: string
  date: string
  category: BlogCategory | string
  authors: string[]
  image: string
  featured?: boolean
  path: string
  body?: unknown
}

export const BLOG_CATEGORIES: Array<{ label: string, value: BlogCategory | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Product', value: 'product' },
  { label: 'Research', value: 'research' },
  { label: 'Company', value: 'company' },
  { label: 'Guides', value: 'guides' }
]

/** Approximate reading time from body text (~200 wpm), Cursor-style. */
export function readingTimeMinutes(text: string | null | undefined): number {
  if (!text?.trim()) return 1
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export function formatReadingTime(minutes: number): string {
  return `${minutes} min read`
}

export function formatBlogDate(dateIso: string): string {
  const date = new Date(dateIso)
  if (Number.isNaN(date.getTime())) return dateIso
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function formatAuthors(authors: string[]): string {
  if (!authors.length) return 'SiteNook Team'
  if (authors.length === 1) return authors[0]!
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`
  return `${authors.slice(0, -1).join(', ')} & ${authors[authors.length - 1]}`
}

export function categoryLabel(category: string): string {
  const found = BLOG_CATEGORIES.find(c => c.value === category)
  return found?.label ?? category
}

/** Extract plain text from a Nuxt Content page body for reading-time estimates. */
export function bodyTextFromPost(post: { body?: unknown, description?: string, title?: string }): string {
  const fromBody = collectText(post.body)
  if (fromBody.trim()) return fromBody
  return [post.title, post.description].filter(Boolean).join(' ')
}

function collectText(node: unknown): string {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number' || typeof node === 'boolean') return String(node)
  if (Array.isArray(node)) return node.map(collectText).join(' ')
  if (typeof node === 'object') {
    const record = node as Record<string, unknown>
    if (typeof record.text === 'string') return record.text
    if (typeof record.value === 'string') return record.value
    if (record.children != null) return collectText(record.children)
    if (record.body != null) return collectText(record.body)
  }
  return ''
}

export function postSlugFromPath(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? path
}

export function sortPostsByDateDesc<T extends { date: string }>(posts: T[]): T[] {
  return [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function featuredPosts<T extends { featured?: boolean, date: string }>(posts: T[], limit = 3): T[] {
  return sortPostsByDateDesc(posts.filter(p => p.featured)).slice(0, limit)
}

export function relatedPosts<T extends { path: string, category: string, date: string }>(
  posts: T[],
  current: { path: string, category: string },
  limit = 3
): T[] {
  const others = posts.filter(p => p.path !== current.path)
  const sameCategory = sortPostsByDateDesc(others.filter(p => p.category === current.category))
  if (sameCategory.length >= limit) return sameCategory.slice(0, limit)
  const remaining = sortPostsByDateDesc(
    others.filter(p => !sameCategory.some(s => s.path === p.path))
  )
  return [...sameCategory, ...remaining].slice(0, limit)
}
