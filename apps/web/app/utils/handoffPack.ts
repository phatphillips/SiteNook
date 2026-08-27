import type { ContentExplorerEntry } from '~/types/sitenook'
import { buildContentExplorerTree, markdownExportFilename } from '~/utils/contentExplorerTree'
import type { HandoffSectionId } from '~/utils/handoffSectionPrompts'
import { HANDOFF_SECTION_LABELS } from '~/utils/handoffSectionPrompts'

export interface HandoffTreePage {
  url: string
  title?: string
  /** Relative path inside pages/ used by TREE.md links */
  filePath: string
}

/**
 * Build an indented markdown TREE of selected pages only (ancestors implied by path segments).
 * Each leaf links to `pages/<filePath>`.
 */
export function buildHandoffTreeMarkdown(pages: HandoffTreePage[]): string {
  if (!pages.length) return '# Selected pages\n\n_(no pages selected)_\n'

  const entries: ContentExplorerEntry[] = pages.map((page, index) => ({
    id: String(index),
    url: page.url,
    title: page.title || page.url,
    unchanged: false,
    hasContent: true,
    failed: false
  }))

  const pathByUrl = new Map(pages.map(page => [page.url, page.filePath]))
  const tree = buildContentExplorerTree(entries)
  const lines: string[] = ['# Selected pages', '']

  const walk = (nodes: ReturnType<typeof buildContentExplorerTree>, depth: number) => {
    for (const node of nodes) {
      const indent = '  '.repeat(depth)
      const hasKids = Boolean(node.children?.length)

      if (node.entry) {
        const filePath = pathByUrl.get(node.entry.url)
          || markdownExportFilename(node.entry.url, node.entry.title)
        const label = node.entry.title || node.label
        lines.push(`${indent}- [${label}](pages/${filePath})`)
      } else if (hasKids) {
        lines.push(`${indent}- **${node.label}/**`)
      }

      if (hasKids) walk(node.children!, depth + 1)
    }
  }

  walk(tree, 0)
  lines.push('')
  return lines.join('\n')
}

export function buildHandoffTaskMarkdown(options: {
  prompt: string
  siteName: string
  siteUrl: string
  section: HandoffSectionId
  pageCount: number
}): string {
  const sectionLabel = HANDOFF_SECTION_LABELS[options.section]
  return [
    '# AI handoff task',
    '',
    `**Site:** ${options.siteName} (${options.siteUrl})`,
    `**Section:** ${sectionLabel}`,
    `**Pages in scope:** ${options.pageCount}`,
    '',
    '## Goal',
    '',
    options.prompt.trim(),
    '',
    '## How to use this pack',
    '',
    '1. Read `TREE.md` for the selected page hierarchy.',
    '2. Process each leaf one file at a time via the linked `pages/*.md` file.',
    '3. Do not assume unlisted pages are in scope.',
    '4. Prefer edits grounded in the page markdown and any “Known findings from SiteNook” block.',
    ''
  ].join('\n')
}

export function wrapPageMarkdown(options: {
  body: string
  url: string
  title?: string
  section: HandoffSectionId
  findingsBlock?: string
}): string {
  const title = (options.title || '').replace(/"/g, '\\"')
  const frontmatter = [
    '---',
    `url: ${JSON.stringify(options.url)}`,
    `title: ${JSON.stringify(title || options.url)}`,
    `section: ${options.section}`,
    '---',
    ''
  ].join('\n')

  const body = options.body.replace(/\s+$/, '')
  const findings = options.findingsBlock?.trim()
    ? `\n\n## Known findings from SiteNook\n\n${options.findingsBlock.trim()}\n`
    : '\n'

  return `${frontmatter}${body}${findings}`
}
