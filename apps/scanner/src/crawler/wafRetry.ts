import type { Page, Response } from 'playwright'

/** Cooldown waits when a host returns HTTP 403 (WAF / rate limit). */
export const WAF_FORBIDDEN_RETRY_DELAYS_MS = [5000, 5000] as const

export interface RetryForbiddenOptions {
  timeoutMs: number
  /** Called before each retry (attempt 1 = wait 5s, attempt 2 = wait 10s). */
  onWafRetry?: (info: { attempt: number, delayMs: number, url: string }) => void | Promise<void>
}

export interface RetryForbiddenResult {
  response: Response | null
  statusCode: number
}

function responseStatus(response: Response | null | undefined): number {
  return response?.status() || 0
}

/**
 * After an initial HTTP 403, wait 5s then 10s and retry navigation (WAF cooldown pattern).
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
    const delayMs = WAF_FORBIDDEN_RETRY_DELAYS_MS[i]!
    if (onWafRetry) {
      await onWafRetry({ attempt: i + 1, delayMs, url })
    }
    await page.waitForTimeout(delayMs)
    response = await page.goto(url, { waitUntil: 'load', timeout: timeoutMs }).catch(() => null)
    statusCode = responseStatus(response)
    if (statusCode !== 403) break
  }

  return { response, statusCode }
}
