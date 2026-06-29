import { describe, expect, it, beforeEach } from 'vitest'
import { checkRateLimit, resetRateLimitsForTests } from '../../../server/utils/rateLimit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimitsForTests()
  })

  it('allows requests under the limit', () => {
    expect(checkRateLimit('test-key', { max: 2, windowMs: 60_000 }).allowed).toBe(true)
    expect(checkRateLimit('test-key', { max: 2, windowMs: 60_000 }).allowed).toBe(true)
  })

  it('blocks requests over the limit', () => {
    checkRateLimit('blocked-key', { max: 1, windowMs: 60_000 })
    const result = checkRateLimit('blocked-key', { max: 1, windowMs: 60_000 })
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSec).toBeGreaterThan(0)
  })

  it('tracks keys independently', () => {
    checkRateLimit('key-a', { max: 1, windowMs: 60_000 })
    expect(checkRateLimit('key-a', { max: 1, windowMs: 60_000 }).allowed).toBe(false)
    expect(checkRateLimit('key-b', { max: 1, windowMs: 60_000 }).allowed).toBe(true)
  })
})
