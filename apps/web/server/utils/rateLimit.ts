import { getRequestIP, type H3Event } from 'h3'

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function checkRateLimit(
  key: string,
  options: { max: number, windowMs: number }
): { allowed: boolean, retryAfterSec?: number } {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs })
    return { allowed: true }
  }

  if (bucket.count >= options.max) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    }
  }

  bucket.count += 1
  return { allowed: true }
}

export function getClientIp(event: H3Event): string {
  return getRequestIP(event, { xForwardedFor: true }) || 'unknown'
}

export function assertRateLimit(
  event: H3Event,
  key: string,
  options: { max: number, windowMs: number }
): void {
  const result = checkRateLimit(key, options)
  if (result.allowed) return

  throw createError({
    statusCode: 429,
    statusMessage: 'Too many requests. Please try again later.'
  })
}

/** Test helper. Clears in-memory buckets between unit tests. */
export function resetRateLimitsForTests(): void {
  buckets.clear()
}
