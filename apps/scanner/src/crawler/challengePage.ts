import type { Page, Response } from 'playwright'

/** How long to wait for a soft challenge interstitial to auto-clear. */
export const CHALLENGE_SOFT_WAIT_MS = 8000

/** Poll interval while waiting for the URL to leave a challenge path. */
export const CHALLENGE_POLL_MS = 500

/** Wait for SiteGround meta-refresh to land on sgcaptcha (or clear). */
export const CHALLENGE_SETTLE_MS = 3000

const CHALLENGE_URL_MARKERS = [
  '/.well-known/sgcaptcha',
  '/cdn-cgi/challenge',
  '/cdn-cgi/challenge-platform'
] as const

const CHALLENGE_BODY_MARKERS = [
  'checking the site connection security',
  'checking if the site connection is secure'
] as const

export type ChallengeKind = 'sgcaptcha' | 'cloudflare' | 'challenge'

/** SiteGround challenge uses HTTP 202; many WAFs use 403. */
export function isWafBlockedStatus(status: number): boolean {
  return status === 403 || status === 202
}

/**
 * True when the final URL looks like a known WAF / bot-challenge interstitial.
 */
export function isChallengeUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase()
    return CHALLENGE_URL_MARKERS.some((marker) => path.includes(marker))
  } catch {
    const lower = url.toLowerCase()
    return CHALLENGE_URL_MARKERS.some((marker) => lower.includes(marker))
  }
}

export function challengeKindFromUrl(url: string): ChallengeKind {
  const lower = url.toLowerCase()
  if (lower.includes('sgcaptcha')) return 'sgcaptcha'
  if (lower.includes('cdn-cgi')) return 'cloudflare'
  return 'challenge'
}

/**
 * Conservative body/title check — only used when the URL already looks like a challenge.
 */
export function looksLikeChallengeContent(text: string): boolean {
  const lower = text.toLowerCase()
  return CHALLENGE_BODY_MARKERS.some((marker) => lower.includes(marker))
}

/** SiteGround sets `SG-Captcha: challenge` on the 202 interstitial. */
export function responseHasSgCaptcha(
  response: { headers(): Record<string, string> } | null | undefined
): boolean {
  if (!response) return false
  try {
    const headers = response.headers()
    const value = headers['sg-captcha'] ?? headers['SG-Captcha'] ?? ''
    return String(value).toLowerCase() === 'challenge'
  } catch {
    return false
  }
}

export function htmlLooksLikeSgCaptchaStub(html: string): boolean {
  return html.includes('/.well-known/sgcaptcha')
}

export function challengeBlockLogMessage(kind: ChallengeKind): string {
  if (kind === 'sgcaptcha') {
    return 'Security challenge page (sgcaptcha) — page not scanned'
  }
  if (kind === 'cloudflare') {
    return 'Security challenge page (cloudflare) — page not scanned'
  }
  return 'Security challenge page — page not scanned'
}

/**
 * If the page landed on a challenge URL, wait briefly for an auto-clear.
 * Returns true when still on a challenge page after the soft wait (blocked).
 */
export async function resolveChallengeInterstitial(
  page: Page,
  options?: { softWaitMs?: number, pollMs?: number }
): Promise<{ blocked: boolean, kind: ChallengeKind | null, finalUrl: string }> {
  const softWaitMs = options?.softWaitMs ?? CHALLENGE_SOFT_WAIT_MS
  const pollMs = options?.pollMs ?? CHALLENGE_POLL_MS
  let finalUrl = page.url()

  if (!isChallengeUrl(finalUrl)) {
    return { blocked: false, kind: null, finalUrl }
  }

  const kind = challengeKindFromUrl(finalUrl)
  const deadline = Date.now() + softWaitMs

  while (Date.now() < deadline) {
    await page.waitForTimeout(pollMs)
    finalUrl = page.url()
    if (!isChallengeUrl(finalUrl)) {
      return { blocked: false, kind: null, finalUrl }
    }
  }

  return { blocked: true, kind, finalUrl }
}

/**
 * Handle SiteGround-style 202 + meta-refresh and URL challenge interstitials.
 * Call after navigation (and after any WAF status retries).
 */
export async function resolveNavigationChallenge(
  page: Page,
  response: Response | null | undefined,
  options?: { softWaitMs?: number, pollMs?: number, settleMs?: number }
): Promise<{ blocked: boolean, kind: ChallengeKind | null, finalUrl: string }> {
  const softWaitMs = options?.softWaitMs ?? CHALLENGE_SOFT_WAIT_MS
  const pollMs = options?.pollMs ?? CHALLENGE_POLL_MS
  const settleMs = options?.settleMs ?? CHALLENGE_SETTLE_MS
  const status = response?.status() ?? 0
  const sgHeader = responseHasSgCaptcha(response)
  let finalUrl = page.url()

  let needsFlow =
    isWafBlockedStatus(status) || sgHeader || isChallengeUrl(finalUrl)

  if (!needsFlow && status > 0 && status < 400) {
    try {
      const html = await page.content()
      if (htmlLooksLikeSgCaptchaStub(html) || looksLikeChallengeContent(html)) {
        needsFlow = true
      }
    } catch {
      // ignore content read failures
    }
  }

  if (!needsFlow) {
    return { blocked: false, kind: null, finalUrl }
  }

  // Meta-refresh from 202 stub → /.well-known/sgcaptcha/...
  if (!isChallengeUrl(finalUrl) && settleMs > 0) {
    const settleDeadline = Date.now() + settleMs
    while (Date.now() < settleDeadline) {
      await page.waitForTimeout(pollMs)
      finalUrl = page.url()
      if (isChallengeUrl(finalUrl)) break
    }
  }

  if (isChallengeUrl(page.url())) {
    return resolveChallengeInterstitial(page, { softWaitMs, pollMs })
  }

  // Still on the original URL with 202 / SG-Captcha header → blocked
  if (status === 202 || sgHeader || softWaitMs === 0) {
    return {
      blocked: true,
      kind: sgHeader || status === 202 ? 'sgcaptcha' : 'challenge',
      finalUrl: page.url()
    }
  }

  return { blocked: false, kind: null, finalUrl: page.url() }
}
