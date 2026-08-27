import { createHash } from 'node:crypto'

/** Normalize Markdown for stable hashing across scans. */
export function normalizeMarkdownForHash(markdown: string): string {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function hashMarkdownContent(markdown: string): string {
  return createHash('sha256')
    .update(normalizeMarkdownForHash(markdown), 'utf8')
    .digest('hex')
}
