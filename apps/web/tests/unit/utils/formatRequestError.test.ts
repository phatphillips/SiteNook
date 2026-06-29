import { describe, expect, it } from 'vitest'
import { formatRequestError } from '~/utils/pbClientError'

describe('formatRequestError', () => {
  it('reads Nitro statusMessage from fetch error data', () => {
    const message = formatRequestError({
      data: { statusMessage: 'NUXT_STRIPE_STARTER_PRICE_ID is not configured.' }
    })
    expect(message).toBe('NUXT_STRIPE_STARTER_PRICE_ID is not configured.')
  })

  it('skips generic server error messages', () => {
    expect(formatRequestError({
      data: { message: 'Server Error' }
    }, 'Could not change plan.')).toBe('Could not change plan.')
  })
})
