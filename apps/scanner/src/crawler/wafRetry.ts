import type { Page, Response } from 'playwright'
import { isWafBlockedStatus } from './challengePage.js'

/** Cooldown waits when a host returns HTTP 403 / 202 (WAF / rate limit / SG-Captcha). */
export const WAF_FORBIDDEN_RETRY_DELAYS_MS = [5000, 10000] as const

/** Max absolute jitter applied to each retry delay (±). */
export const WAF_RETRY_JITTER_MS = 1000

export interface RetryForbiddenOptions {
  timeoutMs: number
  /** Called before each retry (attempt 1 = wait 5s, attempt 2 = wait 10s). */
  onWafRetry?: (info: { attempt: number, delayMs: number, url: string }) => void | Promise<void>
  /**
   * Extra ms added to the base delay (can be negative). Defaults to random ±1s.
   * Pass `0` in tests for deterministic timing.
   */
  jitterMs?: number
}

export interface RetryForbiddenResult {
  response: Response | null
  statusCode: number
}

function responseStatus(response: Response | null | undefined): number {
  return response?.status() || 0
}

/** Random jitter in [-WAF_RETRY_JITTER_MS, +WAF_RETRY_JITTER_MS]. */
export function randomWafJitterMs(): number {
  return Math.floor(Math.random() * (WAF_RETRY_JITTER_MS * 2 + 1)) - WAF_RETRY_JITTER_MS
}

/** Apply jitter to a base delay; result is always ≥ 1000ms. */
export function withWafJitter(baseMs: number, jitterMs: number): number {
  return Math.max(1000, baseMs + jitterMs)
}

/**
 * After an initial WAF block (HTTP 403 or SiteGround 202), wait 5s then 10s
 * (plus jitter) and retry navigation.
 */
export async function retryForbiddenWithBackoff(
  page: Page,
  url: string,
  options: RetryForbiddenOptions
): Promise<RetryForbiddenResult> {
  const { timeoutMs, onWafRetry } = options

  let response: Response | null = null
  let statusCode = 403

  for (let i = 0; i < WAF_FORBIDDEN_RETRY_DELAYS_MS.length; i++) {
    const baseMs = WAF_FORBIDDEN_RETRY_DELAYS_MS[i]!
    const jitterMs = options.jitterMs ?? randomWafJitterMs()
    const delayMs = withWafJitter(baseMs, jitterMs)
    if (onWafRetry) {
      await onWafRetry({ attempt: i + 1, delayMs, url })
    }
    await page.waitForTimeout(delayMs)
    response = await page.goto(url, { waitUntil: 'load', timeout: timeoutMs }).catch(() => null)
    statusCode = responseStatus(response)
    if (!isWafBlockedStatus(statusCode)) break
  }

  return { response, statusCode }
}
