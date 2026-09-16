import { describe, it, expect, afterEach } from 'vitest'
import { isCommercialEnabled, parseCommercialFlag } from '../../../server/utils/commercial'

describe('commercial gate', () => {
  const prev = process.env.SITENOOK_COMMERCIAL

  afterEach(() => {
    if (prev === undefined) delete process.env.SITENOOK_COMMERCIAL
    else process.env.SITENOOK_COMMERCIAL = prev
  })

  it('parses truthy commercial flags', () => {
    expect(parseCommercialFlag('1')).toBe(true)
    expect(parseCommercialFlag('true')).toBe(true)
    expect(parseCommercialFlag('ON')).toBe(true)
    expect(parseCommercialFlag('yes')).toBe(true)
  })

  it('defaults to off (OSS) when unset or falsy', () => {
    delete process.env.SITENOOK_COMMERCIAL
    expect(isCommercialEnabled()).toBe(false)
    expect(parseCommercialFlag('0')).toBe(false)
    expect(parseCommercialFlag('')).toBe(false)
    expect(parseCommercialFlag(undefined)).toBe(false)
  })

  it('reads SITENOOK_COMMERCIAL from the environment', () => {
    process.env.SITENOOK_COMMERCIAL = '1'
    expect(isCommercialEnabled()).toBe(true)
    process.env.SITENOOK_COMMERCIAL = '0'
    expect(isCommercialEnabled()).toBe(false)
  })
})
