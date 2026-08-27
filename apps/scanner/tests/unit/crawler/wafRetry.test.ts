import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  WAF_FORBIDDEN_RETRY_DELAYS_MS,
  retryForbiddenWithBackoff,
  withWafJitter
} from '../../../src/crawler/wafRetry.js'

describe('wafRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('exports 5s then 10s retry delays', () => {
    expect(WAF_FORBIDDEN_RETRY_DELAYS_MS).toEqual([5000, 10000])
  })

  it('clamps jittered delay to at least 1s', () => {
    expect(withWafJitter(5000, -1000)).toBe(4000)
    expect(withWafJitter(5000, -4500)).toBe(1000)
  })

  it('waits 5s then stops when a retry succeeds', async () => {
    const goto = vi
      .fn()
      .mockResolvedValueOnce({ status: () => 200 })
    const waitForTimeout = vi.fn(async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms)
    })
    const page = { goto, waitForTimeout } as unknown as import('playwright').Page

    const onWafRetry = vi.fn()
    const promise = retryForbiddenWithBackoff(page, 'https://example.com/page', {
      timeoutMs: 30_000,
      onWafRetry,
      jitterMs: 0
    })

    await vi.runAllTimersAsync()
    const result = await promise

    expect(onWafRetry).toHaveBeenCalledTimes(1)
    expect(onWafRetry).toHaveBeenNthCalledWith(1, {
      attempt: 1,
      delayMs: 5000,
      url: 'https://example.com/page'
    })
    expect(waitForTimeout).toHaveBeenCalledWith(5000)
    expect(goto).toHaveBeenCalledTimes(1)
    expect(result.statusCode).toBe(200)
  })

  it('runs both retries (5s then 10s) when still 403', async () => {
    const goto = vi.fn().mockResolvedValue({ status: () => 403 })
    const waitForTimeout = vi.fn(async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms)
    })
    const page = { goto, waitForTimeout } as unknown as import('playwright').Page

    const promise = retryForbiddenWithBackoff(page, 'https://example.com/blocked', {
      timeoutMs: 30_000,
      jitterMs: 0
    })

    await vi.runAllTimersAsync()
    const result = await promise

    expect(waitForTimeout).toHaveBeenCalledTimes(2)
    expect(waitForTimeout).toHaveBeenNthCalledWith(1, 5000)
    expect(waitForTimeout).toHaveBeenNthCalledWith(2, 10000)
    expect(goto).toHaveBeenCalledTimes(2)
    expect(result.statusCode).toBe(403)
  })

  it('applies injected jitter to wait and callback', async () => {
    const goto = vi.fn().mockResolvedValue({ status: () => 200 })
    const waitForTimeout = vi.fn(async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms)
    })
    const page = { goto, waitForTimeout } as unknown as import('playwright').Page
    const onWafRetry = vi.fn()

    const promise = retryForbiddenWithBackoff(page, 'https://example.com/page', {
      timeoutMs: 30_000,
      onWafRetry,
      jitterMs: 500
    })

    await vi.runAllTimersAsync()
    await promise

    expect(onWafRetry).toHaveBeenCalledWith({
      attempt: 1,
      delayMs: 5500,
      url: 'https://example.com/page'
    })
    expect(waitForTimeout).toHaveBeenCalledWith(5500)
  })

  it('retries while status stays 202 (SiteGround challenge)', async () => {
    const goto = vi
      .fn()
      .mockResolvedValueOnce({ status: () => 202 })
      .mockResolvedValueOnce({ status: () => 200 })
    const waitForTimeout = vi.fn(async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms)
    })
    const page = { goto, waitForTimeout } as unknown as import('playwright').Page

    const promise = retryForbiddenWithBackoff(page, 'https://example.com/', {
      timeoutMs: 30_000,
      jitterMs: 0
    })

    await vi.runAllTimersAsync()
    const result = await promise

    expect(goto).toHaveBeenCalledTimes(2)
    expect(result.statusCode).toBe(200)
  })
})
