export function fileFieldName(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').trim()
}

/** True when a crawl stored the freeze-frame file used by Content Explorer. */
export function pageHasRenderedHtml(page: {
  rendered_html?: unknown
}): boolean {
  return Boolean(fileFieldName(page.rendered_html))
}

export function pageHasHtmlSnapshot(page: {
  rendered_html?: unknown
  html_snapshot?: string
  html_size_bytes?: number
}): boolean {
  if (pageHasRenderedHtml(page)) return true
  if (String(page.html_snapshot ?? '').trim()) return true
  return Number(page.html_size_bytes) > 0
}

/** Truncated WordPress/Astra snapshots drop theme CSS and paint as unstyled HTML. */
export function htmlLooksStyledForPreview(html: string | null | undefined): boolean {
  const value = String(html ?? '')
  if (!value.trim()) return false
  if (value.includes('trimmed for snapshot storage')) return false
  if (/\bast-/.test(value) && !value.includes('--ast-global-color-0:')) return false
  return true
}
