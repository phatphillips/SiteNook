export type ContentPromptFormat = 'markdown' | 'html' | 'gutenberg'

function htmlCommentSafe(text: string): string {
  return text.replace(/--/g, '—')
}

/**
 * Temporarily prepend a task prompt to page content for copy/download.
 * Does not persist. Callers decide when to apply it.
 */
export function attachPromptToPageContent(
  content: string,
  prompt: string,
  format: ContentPromptFormat
): string {
  const trimmed = prompt.trim()
  if (!trimmed) return content
  const body = content.trimEnd()

  if (format === 'html') {
    const block = `<!-- SiteNook task prompt\n${htmlCommentSafe(trimmed)}\n-->`
    if (!body) return `${block}\n`
    if (/<body[^>]*>/i.test(body)) {
      return body.replace(/<body[^>]*>/i, match => `${match}\n${block}\n`)
    }
    return `${block}\n${body}\n`
  }

  if (format === 'gutenberg') {
    const block = [
      '<!-- wp:paragraph -->',
      `<p><strong>Task prompt</strong></p>`,
      '<!-- /wp:paragraph -->',
      '',
      '<!-- wp:paragraph -->',
      `<p>${escapeHtml(trimmed).replace(/\n/g, '<br>')}</p>`,
      '<!-- /wp:paragraph -->'
    ].join('\n')
    return body ? `${block}\n\n${body}\n` : `${block}\n`
  }

  const block = `## Task prompt\n\n${trimmed}\n\n---`
  return body ? `${block}\n\n${body}\n` : `${block}\n`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
