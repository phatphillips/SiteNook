import { describe, expect, it } from 'vitest'
import { withTimeout } from '~/utils/fetchTimeout'

describe('fetchTimeout', () => {
  it('resolves when the promise completes in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100)).resolves.toBe('ok')
  })

  it('rejects when the promise exceeds the timeout', async () => {
    await expect(
      withTimeout(new Promise<string>(() => {}), 20, 'Test op')
    ).rejects.toThrow(/Test op timed out/)
  })
})
