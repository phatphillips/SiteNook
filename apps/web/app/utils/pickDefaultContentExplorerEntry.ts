import type { ContentExplorerEntry } from '~/types/sitenook'

const INDEX_PATH = /^\/(index|home|default)(\.(html?|php|aspx?))?$/i

function pathnameOf(url: string): string | null {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '') || '/'
    return path
  } catch {
    return null
  }
}

function defaultPageScore(entry: ContentExplorerEntry): number {
  const path = pathnameOf(entry.url)
  let score = 0
  if (path === '/') score = 100
  else if (path && INDEX_PATH.test(path)) score = 90

  const title = (entry.title ?? '').trim().toLowerCase()
  if (title === 'home' || title === 'index' || title.startsWith('home -') || title.startsWith('home |') || title.startsWith('index -')) {
    score = Math.max(score, 70)
  }

  if (score > 0 && entry.hasContent) score += 5
  return score
}

/** Prefer the site home/index page for the initial explorer preview. */
export function pickDefaultContentExplorerEntry(
  entries: ContentExplorerEntry[]
): ContentExplorerEntry | null {
  if (!entries.length) return null
  let best: ContentExplorerEntry | null = null
  let bestScore = -1
  for (const entry of entries) {
    const score = defaultPageScore(entry)
    if (score > bestScore) {
      best = entry
      bestScore = score
    }
  }
  if (best && bestScore > 0) return best
  return entries.find(e => e.hasContent) ?? entries[0] ?? null
}
