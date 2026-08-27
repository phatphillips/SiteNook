export function previewHttpErrorMessage(
  status: number,
  statusText: string,
  detail?: string
): string {
  const trimmed = detail?.trim()
  if (status === 401) return 'Sign in again to preview this PDF.'
  if (status === 403) {
    return trimmed
      || 'This PDF source blocked preview (403). Upload a copy if the crawl URL is protected.'
  }
  if (status === 404) return trimmed || 'PDF file not found.'
  if (status >= 500) {
    if (trimmed) return trimmed
    return `Preview server error (${status}). Try again shortly.`
  }
  return trimmed || statusText || `Failed to load PDF preview (${status})`
}

function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (err.name === 'AbortError') return false
  return /Failed to fetch|NetworkError|network|Load failed|ECONNRESET|ETIMEDOUT/i.test(err.message)
}

/**
 * Fetch an authed PDF proxy URL into an ArrayBuffer, with one retry on transient network failure.
 */
export async function fetchAuthedPdfBuffer(
  url: string,
  token: string | undefined,
  options?: { signal?: AbortSignal }
): Promise<ArrayBuffer> {
  const headers: HeadersInit = token && url.startsWith('/api/')
    ? { Authorization: `Bearer ${token}` }
    : {}

  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        headers,
        signal: options?.signal
      })
      if (!response.ok) {
        let detail = ''
        try {
          const body = await response.json() as { statusMessage?: string, message?: string }
          detail = body.statusMessage || body.message || ''
        } catch {
          // Non-JSON error bodies are fine.
        }
        throw new Error(previewHttpErrorMessage(response.status, response.statusText, detail))
      }
      return await response.arrayBuffer()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (isRetryableNetworkError(err) && attempt === 0 && !options?.signal?.aborted) {
        await new Promise(r => setTimeout(r, 400))
        continue
      }
      throw lastError
    }
  }

  throw lastError ?? new Error('Failed to load PDF preview')
}
