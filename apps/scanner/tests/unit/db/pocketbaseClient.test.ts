import { describe, expect, it } from 'vitest'
import {
  isPocketBaseConnectionError,
  resetPocketBaseClient,
  withPocketBaseRetry
} from '../../../src/db/pocketbaseClient.js'
import {
  computeShareExpiresAt,
  generateReportShareToken
} from '../../../src/scheduler/reportScheduleScheduler.js'

describe('pocketbaseClient connection helpers', () => {
  it('detects connection refused style errors', () => {
    expect(isPocketBaseConnectionError({
      status: 0,
      message: 'Something went wrong while processing your request.',
      originalError: { cause: { code: 'ECONNREFUSED' } }
    })).toBe(true)
    expect(isPocketBaseConnectionError({
      status: 400,
      message: 'Invalid filter'
    })).toBe(false)
    expect(isPocketBaseConnectionError({
      status: 0,
      message: 'Something went wrong while processing your request.',
      originalError: { cause: { code: 'ENOTFOUND' } }
    })).toBe(true)
    expect(isPocketBaseConnectionError({
      status: 0,
      message: 'Something went wrong while processing your request.',
      originalError: { cause: { code: 'EAI_AGAIN' } }
    })).toBe(true)
    expect(isPocketBaseConnectionError({
      status: 0,
      message: 'fetch failed',
      originalError: { code: 'UND_ERR_SOCKET', message: 'other side closed' }
    })).toBe(true)
    expect(isPocketBaseConnectionError({
      status: 0,
      message: 'Something went wrong while processing your request.'
    })).toBe(true)
  })

  it('resetPocketBaseClient clears cached client without throwing', () => {
    expect(() => resetPocketBaseClient()).not.toThrow()
  })

  it('retries connection errors then succeeds', async () => {
    let calls = 0
    const result = await withPocketBaseRetry(async () => {
      calls += 1
      if (calls < 3) {
        throw {
          status: 0,
          message: 'fetch failed',
          originalError: { cause: { code: 'EAI_AGAIN' } }
        }
      }
      return 'ok'
    }, { attempts: 4, delayMs: 0, resetClient: false, label: 'test' })
    expect(result).toBe('ok')
    expect(calls).toBe(3)
  })
})

describe('report job share token wiring', () => {
  it('creates opaque share tokens for scheduled report downloads', () => {
    const token = generateReportShareToken()
    expect(token).toHaveLength(48)
    expect(computeShareExpiresAt(new Date('2026-07-11T00:00:00.000Z'))).toBe(
      '2026-08-10T00:00:00.000Z'
    )
  })
})
