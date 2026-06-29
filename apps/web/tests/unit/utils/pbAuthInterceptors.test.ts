import { describe, expect, it, vi } from 'vitest'
import { ClientResponseError } from 'pocketbase'
import {
  attachPb401Retry,
  isAuthRelatedRequest,
  shouldRetryOn401
} from '~/utils/pbAuthInterceptors'

describe('pbAuthInterceptors', () => {
  it('detects auth-related request paths', () => {
    expect(isAuthRelatedRequest('/api/collections/users/auth-with-password')).toBe(true)
    expect(isAuthRelatedRequest('/api/collections/users/auth-refresh')).toBe(true)
    expect(isAuthRelatedRequest('/api/collections/users/request-password-reset')).toBe(true)
    expect(isAuthRelatedRequest('/api/collections/sites/records')).toBe(false)
  })

  it('retries only non-auth 401 responses', () => {
    const error = new ClientResponseError({ status: 401, response: {} })
    expect(shouldRetryOn401(error, '/api/collections/sites/records')).toBe(true)
    expect(shouldRetryOn401(error, '/api/collections/users/auth-refresh')).toBe(false)
    expect(shouldRetryOn401(new ClientResponseError({ status: 403, response: {} }), '/api/collections/sites/records')).toBe(false)
  })

  it('refreshes once and retries the original request on 401', async () => {
    const originalSend = vi.fn()
      .mockRejectedValueOnce(new ClientResponseError({ status: 401, response: {} }))
      .mockResolvedValueOnce({ items: [] })

    const refreshAuthToken = vi.fn().mockResolvedValue(true)
    const onSessionExpired = vi.fn()

    const pb = { send: originalSend } as never
    attachPb401Retry(pb, { refreshAuthToken, onSessionExpired })

    const result = await pb.send('/api/collections/sites/records', { method: 'GET' })

    expect(result).toEqual({ items: [] })
    expect(refreshAuthToken).toHaveBeenCalledTimes(1)
    expect(onSessionExpired).not.toHaveBeenCalled()
    expect(originalSend).toHaveBeenCalledTimes(2)
    expect(originalSend.mock.calls[1]?.[1]).toMatchObject({ __pbAuthRetry: true })
  })

  it('clears session and does not retry when refresh fails', async () => {
    const originalSend = vi.fn()
      .mockRejectedValue(new ClientResponseError({ status: 401, response: {} }))

    const refreshAuthToken = vi.fn().mockResolvedValue(false)
    const onSessionExpired = vi.fn()

    const pb = { send: originalSend } as never
    attachPb401Retry(pb, { refreshAuthToken, onSessionExpired })

    await expect(pb.send('/api/collections/sites/records')).rejects.toBeInstanceOf(ClientResponseError)
    expect(refreshAuthToken).toHaveBeenCalledTimes(1)
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
    expect(originalSend).toHaveBeenCalledTimes(1)
  })
})
