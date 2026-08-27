import type PocketBase from 'pocketbase'

/** PocketBase `pages.rendered_html` maxSize (8MB). */
export const RENDERED_HTML_MAX_BYTES = 8 * 1024 * 1024

/** Encode crawl HTML for the file field, or skip when empty / over budget. */
export function renderedHtmlBufferFromSnapshot(html: string): Buffer | undefined {
  if (!html) return undefined
  const buf = Buffer.from(html, 'utf8')
  if (!buf.length) return undefined
  if (buf.length > RENDERED_HTML_MAX_BYTES) {
    console.warn(
      `Skipping rendered HTML attach (${buf.length} bytes > ${RENDERED_HTML_MAX_BYTES})`
    )
    return undefined
  }
  return buf
}

export async function attachPageRenderedHtml(
  pb: PocketBase,
  pageId: string,
  renderedHtml?: Buffer
): Promise<void> {
  if (!renderedHtml?.length) return
  if (renderedHtml.length > RENDERED_HTML_MAX_BYTES) {
    console.warn(
      `Skipping rendered HTML attach for page ${pageId}: ${renderedHtml.length} bytes exceeds cap`
    )
    return
  }

  try {
    const form = new FormData()
    form.append(
      'rendered_html',
      new Blob([new Uint8Array(renderedHtml)], { type: 'text/html' }),
      'snapshot.html'
    )
    await pb.collection('pages').update(pageId, form)
  } catch (err) {
    console.warn(
      `Failed to attach rendered HTML for page ${pageId}:`,
      err instanceof Error ? err.message : err
    )
  }
}
