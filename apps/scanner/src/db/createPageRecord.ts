import type PocketBase from 'pocketbase'

function pocketBaseErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object') return String(err)
  const e = err as { message?: string, response?: { message?: string, data?: unknown } }
  const base = e.response?.message || e.message || String(err)
  if (e.response?.data && typeof e.response.data === 'object') {
    try {
      return `${base} ${JSON.stringify(e.response.data)}`.slice(0, 500)
    } catch {
      return base
    }
  }
  return base
}

/**
 * Create a `pages` row. If PocketBase rejects the payload (oversized JSON/text),
 * retry with the crawl identity fields only so the scan can still finish.
 */
export async function createPageRecord(
  pb: PocketBase,
  data: Record<string, unknown>
): Promise<{ id: string }> {
  try {
    return await pb.collection('pages').create(data) as { id: string }
  } catch (err) {
    const slim: Record<string, unknown> = {
      scan: data.scan,
      site: data.site,
      url: data.url,
      title: data.title,
      status_code: data.status_code,
      word_count: data.word_count,
      readability_score: data.readability_score,
      crawl_depth: data.crawl_depth,
      html_snapshot: '',
      html_size_bytes: data.html_size_bytes
    }
    console.warn(
      `Page create failed for ${String(data.url || '')}, retrying without snapshot/json fields:`,
      pocketBaseErrorMessage(err)
    )
    return await pb.collection('pages').create(slim) as { id: string }
  }
}
