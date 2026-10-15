/** Single-URL link check (mirrors scanner linkChecker HEAD logic). */

export type RecheckLinkStatus = 'broken' | 'redirected' | 'ok'

export type RecheckLinkResult = {
  href: string
  status_code: number
  status: RecheckLinkStatus
  link_type: 'internal' | 'external'
}

const TIMEOUT_MS = 8000
const USER_AGENT = 'SiteNookLinkRecheck/1.0 (+https://sitenook.com)'

function classify(statusCode: number): RecheckLinkStatus {
  if (statusCode >= 400 || statusCode === 0) return 'broken'
  if (statusCode >= 300) return 'redirected'
  return 'ok'
}

function linkTypeFor(href: string, origin: string): 'internal' | 'external' {
  return href.startsWith(origin) ? 'internal' : 'external'
}

async function fetchOnce(href: string, method: 'HEAD' | 'GET'): Promise<number> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(href, {
      method,
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*'
      }
    })
    return response.status
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Recheck one URL. Prefers HEAD; falls back to GET when HEAD is rejected or errors.
 * Does not follow redirects (`redirect: 'manual'`), matching scan-time behaviour.
 */
export async function checkBrokenLinkUrl(
  href: string,
  siteOrigin: string
): Promise<RecheckLinkResult> {
  const link_type = linkTypeFor(href, siteOrigin)
  let statusCode = 0

  try {
    statusCode = await fetchOnce(href, 'HEAD')
    // Some hosts reject HEAD with 405/501; retry with GET.
    if (statusCode === 405 || statusCode === 501) {
      statusCode = await fetchOnce(href, 'GET')
    }
  } catch {
    try {
      statusCode = await fetchOnce(href, 'GET')
    } catch {
      statusCode = 0
    }
  }

  return {
    href,
    status_code: statusCode,
    status: classify(statusCode),
    link_type
  }
}

/** PocketBase `qa_broken_links.status` value for a recheck outcome. */
export function brokenLinkStatusForRecheck(result: RecheckLinkStatus): 'broken' | 'redirected' {
  // Schema only allows broken | redirected | dismissed. Treat healthy (2xx) like Fixed → redirected.
  return result === 'broken' ? 'broken' : 'redirected'
}
