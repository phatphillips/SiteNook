import { describe, expect, it, afterEach } from 'vitest'
import { isCommercialEnabled, parseCommercialFlag } from '../../../src/config/commercial.js'

describe('commercial gate (scanner)', () => {
  const prev = process.env.SITENOOK_COMMERCIAL

  afterEach(() => {
    if (prev === undefined) delete process.env.SITENOOK_COMMERCIAL
    else process.env.SITENOOK_COMMERCIAL = prev
  })

  it('defaults to off', () => {
    delete process.env.SITENOOK_COMMERCIAL
    expect(isCommercialEnabled()).toBe(false)
    expect(parseCommercialFlag('0')).toBe(false)
  })

  it('enables on 1/true/on', () => {
    process.env.SITENOOK_COMMERCIAL = '1'
    expect(isCommercialEnabled()).toBe(true)
  })
})
